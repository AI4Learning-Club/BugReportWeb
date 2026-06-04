import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { FeatureStatus, Prisma, Severity } from '@prisma/client';
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
    const feature = await this.prisma.feature.findUnique({
      where: { id },
      include: this.featureInclude()
    });
    if (!feature || (feature.deletedAt && !user.isAdmin)) {
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

      const feature = await tx.feature.findUnique({
        where: { id: created.id },
        include: this.featureInclude()
      });
      return this.toFeatureResponse(feature!);
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

    if (Object.keys(data).length === 0) {
      return this.detail(id, user);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.feature.update({ where: { id: feature.id }, data });
      const updated = await tx.feature.findUnique({
        where: { id: feature.id },
        include: this.featureInclude()
      });
      return this.toFeatureResponse(updated!);
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
    await this.ensureFeature(id);

    return this.prisma.$transaction(async (tx) => {
      const data: Prisma.FeatureUncheckedUpdateInput = { status: body.status! };
      if (body.status === FeatureStatus.DONE) {
        data.completedAt = new Date();
        data.completedById = user.id;
      } else {
        data.completedAt = null;
        data.completedById = null;
      }
      await tx.feature.update({ where: { id }, data });
      const feature = await tx.feature.findUnique({
        where: { id },
        include: this.featureInclude()
      });
      return this.toFeatureResponse(feature!);
    });
  }

  async softDelete(id: string, body: { reason?: string }, user: AuthUser) {
    const feature = await this.ensureFeature(id);
    if (!user.isAdmin && feature.creatorId !== user.id) {
      throw new ForbiddenException('Only admins or creators can delete features');
    }
    const reason = this.requireNote(body.reason);

    await this.prisma.feature.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: user.id,
        deleteReason: reason
      }
    });
    return { ok: true };
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

  private featureInclude(): Prisma.FeatureInclude {
    return {
      system: true,
      creator: actorSelect,
      completedBy: actorSelect,
      deletedBy: actorSelect,
      ...featurePersonnelInclude
    };
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
}
