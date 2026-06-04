import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { FeatureActivityType, FeatureStatus, Prisma, Severity } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildParticipantFilter,
  featurePersonnelInclude,
  toPersonnelResponse
} from '../personnel/personnel.util';

type FeatureBody = {
  systemId?: string;
  title?: string;
  description?: string;
  priority?: Severity;
  status?: FeatureStatus;
};

type DeletedFilter = 'active' | 'only' | 'all';

type ActivityChange = {
  field: string;
  from: string | null;
  to: string | null;
};

type ActivityContext = Record<string, string | number | boolean | null>;

const actorSelect = {
  select: { id: true, username: true, displayName: true }
} as const;

@Injectable()
export class FeaturesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: {
      systemId?: string;
      status?: FeatureStatus;
      deleted?: DeletedFilter;
      participantUserId?: string;
    },
    user: AuthUser
  ) {
    const deleted = this.normalizeDeletedFilter(query.deleted);
    if (deleted !== 'active' && !user.isAdmin) {
      throw new ForbiddenException('Only admins can access deleted features');
    }

    const features = await this.prisma.feature.findMany({
      where: this.buildFeatureWhere(query, deleted),
      include: this.featureInclude(),
      orderBy: deleted === 'only' ? { deletedAt: 'desc' } : { createdAt: 'desc' }
    });
    return features.map((feature) => this.toFeatureResponse(feature));
  }

  async detail(id: string, user: AuthUser) {
    const feature = await this.findFeatureDetail(this.prisma, id);
    if (feature.deletedAt && !user.isAdmin) {
      throw new NotFoundException('Feature not found');
    }
    return this.toFeatureResponse(feature);
  }

  async create(body: FeatureBody, user: AuthUser) {
    if (!body.systemId || !body.title?.trim() || !body.description?.trim()) {
      throw new BadRequestException('systemId, title and description are required');
    }
    const system = await this.prisma.trackedSystem.findUnique({ where: { id: body.systemId } });
    if (!system || system.deletedAt) {
      throw new BadRequestException('System is not available for new features');
    }

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.feature.create({
        data: {
          systemId: body.systemId!,
          creatorId: user.id,
          title: body.title!.trim(),
          description: body.description!.trim(),
          priority: this.normalizePriority(body.priority)
        }
      });

      await this.createActivity(tx, {
        featureId: created.id,
        actorId: user.id,
        type: FeatureActivityType.CREATED,
        createdAt: created.createdAt
      });

      const feature = await this.findFeatureDetail(tx, created.id);
      return this.toFeatureResponse(feature);
    });
  }

  async update(id: string, body: FeatureBody, user: AuthUser) {
    const feature = await this.findFeatureForEdit(id, user);
    const data: Prisma.FeatureUncheckedUpdateInput = {};

    if (body.systemId !== undefined) {
      if (!body.systemId) {
        throw new BadRequestException('systemId cannot be empty');
      }
      const system = await this.prisma.trackedSystem.findUnique({ where: { id: body.systemId } });
      if (!system || system.deletedAt) {
        throw new BadRequestException('System is not available');
      }
      data.systemId = body.systemId;
    }
    if (body.title !== undefined) {
      const title = body.title.trim();
      if (!title) {
        throw new BadRequestException('title cannot be empty');
      }
      data.title = title;
    }
    if (body.description !== undefined) {
      const description = body.description.trim();
      if (!description) {
        throw new BadRequestException('description cannot be empty');
      }
      data.description = description;
    }
    if (body.priority !== undefined) {
      data.priority = this.normalizePriority(body.priority);
    }

    const changes = this.diffFields(feature, data);

    if (changes.length === 0) {
      return this.detail(id, user);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.feature.update({ where: { id: feature.id }, data });

      await this.createActivity(tx, {
        featureId: feature.id,
        actorId: user.id,
        type: FeatureActivityType.UPDATED,
        changes
      });

      const updated = await this.findFeatureDetail(tx, feature.id);
      return this.toFeatureResponse(updated);
    });
  }

  async updateStatus(
    id: string,
    body: { status?: FeatureStatus },
    user: AuthUser
  ) {
    if (!body.status || !Object.values(FeatureStatus).includes(body.status)) {
      throw new BadRequestException('status must be PLANNED, IN_PROGRESS or DONE');
    }
    const feature = await this.ensureFeature(id);
    const nextStatus = body.status!;

    if (feature.status === nextStatus) {
      throw new BadRequestException('Feature already has this status');
    }

    return this.prisma.$transaction(async (tx) => {
      const data: Prisma.FeatureUncheckedUpdateInput = { status: nextStatus };
      if (nextStatus === FeatureStatus.DONE) {
        data.completedAt = new Date();
        data.completedById = user.id;
      } else {
        data.completedAt = null;
        data.completedById = null;
      }
      await tx.feature.update({ where: { id }, data });

      await this.createActivity(tx, {
        featureId: id,
        actorId: user.id,
        type: FeatureActivityType.STATUS_CHANGED,
        fromStatus: feature.status,
        toStatus: nextStatus
      });

      const updated = await this.findFeatureDetail(tx, id);
      return this.toFeatureResponse(updated);
    });
  }

  async softDelete(id: string, body: { reason?: string }, user: AuthUser) {
    const feature = await this.ensureFeature(id);
    if (!user.isAdmin && feature.creatorId !== user.id) {
      throw new ForbiddenException('Only admins or creators can delete features');
    }
    const reason = this.requireNote(body.reason);

    return this.prisma.$transaction(async (tx) => {
      await tx.feature.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          deletedById: user.id,
          deleteReason: reason
        }
      });

      await this.createActivity(tx, {
        featureId: id,
        actorId: user.id,
        type: FeatureActivityType.DELETED,
        note: reason,
        context: {
          deletedBy: user.displayName,
          deletedById: user.id
        }
      });

      return { ok: true };
    });
  }

  async permanentDelete(id: string, user: AuthUser) {
    if (!user.isAdmin) {
      throw new ForbiddenException('Only admins can permanently delete features');
    }
    const feature = await this.ensureFeature(id, { includeDeleted: true });
    if (!feature.deletedAt) {
      throw new BadRequestException('Feature must be soft-deleted first');
    }
    await this.prisma.feature.delete({ where: { id } });
    return { ok: true };
  }

  async removeActivity(featureId: string, activityId: string, user: AuthUser) {
    await this.detail(featureId, user);

    const activity = await this.prisma.featureActivity.findFirst({
      where: { id: activityId, featureId },
      select: { id: true }
    });
    if (!activity) {
      throw new NotFoundException('Activity not found');
    }

    await this.prisma.featureActivity.delete({ where: { id: activityId } });
    return { ok: true };
  }

  private featureInclude(detail = false): Prisma.FeatureInclude {
    return {
      system: true,
      creator: actorSelect,
      completedBy: actorSelect,
      deletedBy: actorSelect,
      ...featurePersonnelInclude,
      ...(detail
        ? {
            activities: {
              include: { actor: actorSelect },
              orderBy: { createdAt: 'desc' as const }
            }
          }
        : {})
    };
  }

  private async findFeatureDetail(tx: Prisma.TransactionClient | PrismaService, id: string) {
    const feature = await tx.feature.findUnique({
      where: { id },
      include: this.featureInclude(true)
    });
    if (!feature) {
      throw new NotFoundException('Feature not found');
    }
    return feature;
  }

  private toFeatureResponse(feature: any) {
    const personnel = toPersonnelResponse(feature);
    return {
      ...feature,
      owner: personnel.owner,
      relatedUsers: personnel.relatedUsers
    };
  }

  private buildFeatureWhere(
    query: {
      systemId?: string;
      status?: FeatureStatus;
      participantUserId?: string;
    },
    deleted: DeletedFilter
  ): Prisma.FeatureWhereInput {
    return {
      systemId: query.systemId,
      status: query.status,
      ...(query.participantUserId
        ? (buildParticipantFilter(query.participantUserId, 'feature') as Prisma.FeatureWhereInput)
        : {}),
      ...(deleted === 'active' ? { deletedAt: null } : {}),
      ...(deleted === 'only' ? { deletedAt: { not: null } } : {})
    };
  }

  private normalizePriority(priority?: Severity) {
    if (!priority) {
      return Severity.MEDIUM;
    }
    if (!Object.values(Severity).includes(priority)) {
      throw new BadRequestException('Invalid priority');
    }
    return priority;
  }

  private normalizeDeletedFilter(deleted?: DeletedFilter) {
    if (!deleted) {
      return 'active';
    }
    if (!['active', 'only', 'all'].includes(deleted)) {
      throw new BadRequestException('deleted must be active, only or all');
    }
    return deleted;
  }

  private requireNote(note?: string) {
    const normalized = note?.trim();
    if (!normalized) {
      throw new BadRequestException('reason is required');
    }
    return normalized;
  }

  private async ensureFeature(id: string, options: { includeDeleted?: boolean } = {}) {
    const feature = await this.prisma.feature.findUnique({ where: { id } });
    if (!feature || (!options.includeDeleted && feature.deletedAt)) {
      throw new NotFoundException('Feature not found');
    }
    return feature;
  }

  private async findFeatureForEdit(id: string, user: AuthUser) {
    const feature = await this.ensureFeature(id);
    if (!user.isAdmin && feature.creatorId !== user.id) {
      throw new ForbiddenException('Only admins or creators can edit features');
    }
    return feature;
  }

  private diffFields(original: Record<string, unknown>, updates: Record<string, unknown>) {
    const changes: ActivityChange[] = [];

    for (const [field, nextValue] of Object.entries(updates)) {
      const previousValue = original[field];
      if (previousValue === nextValue) {
        continue;
      }
      changes.push({
        field,
        from: this.toChangeValue(previousValue),
        to: this.toChangeValue(nextValue)
      });
    }

    return changes;
  }

  private async createActivity(
    tx: Prisma.TransactionClient,
    input: {
      featureId: string;
      actorId: string;
      type: FeatureActivityType;
      note?: string;
      fromStatus?: FeatureStatus;
      toStatus?: FeatureStatus;
      changes?: ActivityChange[];
      context?: ActivityContext;
      createdAt?: Date;
    }
  ) {
    const data: Prisma.FeatureActivityUncheckedCreateInput = {
      featureId: input.featureId,
      actorId: input.actorId,
      type: input.type
    };

    if (input.note !== undefined) {
      data.note = input.note;
    }
    if (input.fromStatus !== undefined) {
      data.fromStatus = input.fromStatus;
    }
    if (input.toStatus !== undefined) {
      data.toStatus = input.toStatus;
    }
    if (input.changes && input.changes.length > 0) {
      data.changes = input.changes as Prisma.InputJsonValue;
    }
    if (input.context && Object.keys(input.context).length > 0) {
      data.context = input.context as Prisma.InputJsonValue;
    }
    if (input.createdAt) {
      data.createdAt = input.createdAt;
    }

    await tx.featureActivity.create({ data });
  }

  private toChangeValue(value: unknown) {
    if (value === null || value === undefined) {
      return null;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    return String(value);
  }
}
