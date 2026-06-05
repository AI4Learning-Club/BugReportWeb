import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  FeatureActivityType,
  FeatureStatus,
  ImplementationItemStatus,
  Prisma,
  Severity
} from '@prisma/client';
import { existsSync } from 'fs';
import { unlink } from 'fs/promises';
import { join } from 'path';
import {
  buildFeatureCreatedSnapshot,
  enrichActivityChanges
} from '../activity/activity-format.util';
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
  plannedStartAt?: string | null;
  plannedEndAt?: string | null;
};

type ImplementationItemBody = {
  title?: string;
  note?: string | null;
  sortOrder?: number;
  plannedStartAt?: string | null;
  plannedEndAt?: string | null;
  actualStartAt?: string | null;
  completedAt?: string | null;
  ownerId?: string | null;
};

type DeletedFilter = 'active' | 'only' | 'all';
type FeatureSortBy = 'createdAt' | 'plannedStart' | 'plannedEnd' | 'progress' | 'title';
type SortOrder = 'asc' | 'desc';

type ActivityChange = {
  field: string;
  from: string | null;
  to: string | null;
};

type ActivityContext = Record<string, string | number | boolean | null>;

const actorSelect = {
  select: { id: true, username: true, displayName: true }
} as const;

const implementationItemInclude = {
  owner: actorSelect
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
      sortBy?: FeatureSortBy;
      sortOrder?: SortOrder;
      hasSchedule?: string;
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
      orderBy: this.buildListOrderBy(query.sortBy, query.sortOrder, deleted)
    });

    let results = features.map((feature) => this.toFeatureResponse(feature));

    if (query.hasSchedule === 'true') {
      results = results.filter(
        (feature) =>
          feature.plannedStartAt ||
          feature.plannedEndAt ||
          feature.implementationItemCount > 0
      );
    }

    if (query.sortBy === 'progress') {
      const order = query.sortOrder === 'asc' ? 1 : -1;
      results.sort((left, right) => {
        const leftProgress = left.progressPercent ?? -1;
        const rightProgress = right.progressPercent ?? -1;
        return (leftProgress - rightProgress) * order;
      });
    }

    return results;
  }

  async gantt(
    query: {
      systemId?: string;
      status?: FeatureStatus;
      from?: string;
      to?: string;
      participantUserId?: string;
    },
    user: AuthUser
  ) {
    const features = await this.list(
      {
        systemId: query.systemId,
        status: query.status,
        deleted: 'active',
        participantUserId: query.participantUserId,
        sortBy: 'plannedStart',
        sortOrder: 'asc'
      },
      user
    );

    const fromDate = query.from ? new Date(query.from) : null;
    const toDate = query.to ? new Date(query.to) : null;

    return features
      .filter((feature) => {
        if (!fromDate && !toDate) {
          return true;
        }
        const start = feature.effectivePlannedStartAt
          ? new Date(feature.effectivePlannedStartAt)
          : null;
        const end = feature.effectivePlannedEndAt
          ? new Date(feature.effectivePlannedEndAt)
          : null;
        if (!start && !end) {
          return false;
        }
        if (fromDate && end && end < fromDate) {
          return false;
        }
        if (toDate && start && start > toDate) {
          return false;
        }
        return true;
      })
      .map((feature) => ({
        id: feature.id,
        title: feature.title,
        status: feature.status,
        system: feature.system,
        owner: feature.owner,
        plannedStartAt: feature.plannedStartAt,
        plannedEndAt: feature.plannedEndAt,
        effectivePlannedStartAt: feature.effectivePlannedStartAt,
        effectivePlannedEndAt: feature.effectivePlannedEndAt,
        progressPercent: feature.progressPercent,
        implementationItemCount: feature.implementationItemCount,
        implementationItemDoneCount: feature.implementationItemDoneCount,
        implementationItems: feature.implementationItems
      }));
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
          priority: this.normalizePriority(body.priority),
          plannedStartAt: this.parseOptionalDate(body.plannedStartAt),
          plannedEndAt: this.parseOptionalDate(body.plannedEndAt)
        }
      });

      this.validateDateRange(created.plannedStartAt, created.plannedEndAt);

      await this.createActivity(tx, {
        featureId: created.id,
        actorId: user.id,
        type: FeatureActivityType.CREATED,
        changes: buildFeatureCreatedSnapshot(created, system.name),
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
    if (body.plannedStartAt !== undefined) {
      data.plannedStartAt = this.parseOptionalDate(body.plannedStartAt);
    }
    if (body.plannedEndAt !== undefined) {
      data.plannedEndAt = this.parseOptionalDate(body.plannedEndAt);
    }

    const nextStart =
      body.plannedStartAt !== undefined ? (data.plannedStartAt as Date | null) : feature.plannedStartAt;
    const nextEnd =
      body.plannedEndAt !== undefined ? (data.plannedEndAt as Date | null) : feature.plannedEndAt;
    this.validateDateRange(nextStart, nextEnd);

    const changes = this.diffFields(feature, data);

    if (changes.length === 0) {
      return this.detail(id, user);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.feature.update({ where: { id: feature.id }, data });

      const enrichedChanges = await enrichActivityChanges(tx, changes);

      await this.createActivity(tx, {
        featureId: feature.id,
        actorId: user.id,
        type: FeatureActivityType.UPDATED,
        changes: enrichedChanges
      });

      const updated = await this.findFeatureDetail(tx, feature.id);
      return this.toFeatureResponse(updated);
    });
  }

  async updateStatus(
    id: string,
    body: { status?: FeatureStatus; note?: string },
    user: AuthUser
  ) {
    if (!body.status || !Object.values(FeatureStatus).includes(body.status)) {
      throw new BadRequestException('status must be PLANNED, IN_PROGRESS or DONE');
    }
    const feature = await this.ensureFeature(id);
    const nextStatus = body.status!;
    const note = this.requireNote(body.note);

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
        note,
        fromStatus: feature.status,
        toStatus: nextStatus
      });

      const updated = await this.findFeatureDetail(tx, id);
      return this.toFeatureResponse(updated);
    });
  }

  async addScreenshot(
    featureId: string,
    file: Express.Multer.File | undefined,
    body: { caption?: string },
    user: AuthUser
  ) {
    await this.ensureFeature(featureId);
    if (!file) {
      throw new BadRequestException('file is required');
    }

    return this.prisma.$transaction(async (tx) => {
      const screenshot = await tx.featureScreenshot.create({
        data: {
          featureId,
          uploaderId: user.id,
          originalName: file.originalname,
          storedName: file.filename,
          path: `/uploads/feature-screenshots/${file.filename}`,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          caption: this.clean(body.caption)
        }
      });

      await this.createActivity(tx, {
        featureId,
        actorId: user.id,
        type: FeatureActivityType.SCREENSHOT_ADDED,
        context: {
          screenshotId: screenshot.id,
          originalName: screenshot.originalName,
          caption: screenshot.caption
        }
      });

      return screenshot;
    });
  }

  async removeScreenshot(featureId: string, screenshotId: string, user: AuthUser) {
    const screenshot = await this.prisma.featureScreenshot.findFirst({
      where: { id: screenshotId, featureId },
      include: { feature: true }
    });
    if (!screenshot || screenshot.feature.deletedAt) {
      throw new NotFoundException('Screenshot not found');
    }
    if (
      !user.isAdmin &&
      screenshot.uploaderId !== user.id &&
      screenshot.feature.creatorId !== user.id
    ) {
      throw new ForbiddenException(
        'Only admins, feature creators or uploaders can delete screenshots'
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.featureScreenshot.delete({ where: { id: screenshotId } });
      await this.createActivity(tx, {
        featureId,
        actorId: user.id,
        type: FeatureActivityType.SCREENSHOT_REMOVED,
        context: {
          screenshotId: screenshot.id,
          originalName: screenshot.originalName,
          caption: screenshot.caption
        }
      });
    });

    const filePath = join(process.cwd(), screenshot.path.replace(/^\//, ''));
    if (existsSync(filePath)) {
      await unlink(filePath);
    }
    return { ok: true };
  }

  async listImplementationItems(featureId: string, user: AuthUser) {
    await this.detail(featureId, user);
    const items = await this.prisma.featureImplementationItem.findMany({
      where: { featureId },
      include: implementationItemInclude,
      orderBy: { sortOrder: 'asc' }
    });
    return items.map((item) => this.toImplementationItemResponse(item));
  }

  async createImplementationItem(
    featureId: string,
    body: ImplementationItemBody,
    user: AuthUser
  ) {
    await this.ensureFeature(featureId);
    const title = body.title?.trim();
    if (!title) {
      throw new BadRequestException('title is required');
    }

    const plannedStartAt = this.parseOptionalDate(body.plannedStartAt);
    const plannedEndAt = this.parseOptionalDate(body.plannedEndAt);
    this.validateDateRange(plannedStartAt, plannedEndAt);

    return this.prisma.$transaction(async (tx) => {
      const maxOrder = await tx.featureImplementationItem.aggregate({
        where: { featureId },
        _max: { sortOrder: true }
      });
      const sortOrder = body.sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1;

      if (body.ownerId) {
        await this.ensureAssignableOwner(body.ownerId);
      }

      const item = await tx.featureImplementationItem.create({
        data: {
          featureId,
          sortOrder,
          title,
          note: this.clean(body.note),
          plannedStartAt,
          plannedEndAt,
          actualStartAt: this.parseOptionalDate(body.actualStartAt),
          completedAt: this.parseOptionalDate(body.completedAt),
          ownerId: body.ownerId ?? null
        },
        include: implementationItemInclude
      });

      await this.syncFeatureSchedule(tx, featureId);

      await this.createActivity(tx, {
        featureId,
        actorId: user.id,
        type: FeatureActivityType.IMPLEMENTATION_ITEM_ADDED,
        context: {
          itemId: item.id,
          itemTitle: item.title,
          plannedStartAt: item.plannedStartAt?.toISOString() ?? null,
          plannedEndAt: item.plannedEndAt?.toISOString() ?? null
        }
      });

      return this.toImplementationItemResponse(item);
    });
  }

  async updateImplementationItem(
    featureId: string,
    itemId: string,
    body: ImplementationItemBody,
    user: AuthUser
  ) {
    await this.ensureFeature(featureId);
    const item = await this.prisma.featureImplementationItem.findFirst({
      where: { id: itemId, featureId },
      include: implementationItemInclude
    });
    if (!item) {
      throw new NotFoundException('Implementation item not found');
    }

    const data: Prisma.FeatureImplementationItemUncheckedUpdateInput = {};

    if (body.title !== undefined) {
      const title = body.title.trim();
      if (!title) {
        throw new BadRequestException('title cannot be empty');
      }
      data.title = title;
    }
    if (body.note !== undefined) {
      data.note = this.clean(body.note);
    }
    if (body.sortOrder !== undefined) {
      data.sortOrder = body.sortOrder;
    }
    if (body.plannedStartAt !== undefined) {
      data.plannedStartAt = this.parseOptionalDate(body.plannedStartAt);
    }
    if (body.plannedEndAt !== undefined) {
      data.plannedEndAt = this.parseOptionalDate(body.plannedEndAt);
    }
    if (body.actualStartAt !== undefined) {
      data.actualStartAt = this.parseOptionalDate(body.actualStartAt);
    }
    if (body.completedAt !== undefined) {
      data.completedAt = this.parseOptionalDate(body.completedAt);
    }
    if (body.ownerId !== undefined) {
      if (body.ownerId) {
        await this.ensureAssignableOwner(body.ownerId);
      }
      data.ownerId = body.ownerId;
    }

    const nextStart =
      body.plannedStartAt !== undefined
        ? (data.plannedStartAt as Date | null)
        : item.plannedStartAt;
    const nextEnd =
      body.plannedEndAt !== undefined ? (data.plannedEndAt as Date | null) : item.plannedEndAt;
    this.validateDateRange(nextStart, nextEnd);

    const changes = this.diffFields(item, data);
    if (changes.length === 0) {
      return this.toImplementationItemResponse(item);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.featureImplementationItem.update({
        where: { id: itemId },
        data,
        include: implementationItemInclude
      });

      await this.syncFeatureSchedule(tx, featureId);

      await this.createActivity(tx, {
        featureId,
        actorId: user.id,
        type: FeatureActivityType.IMPLEMENTATION_ITEM_UPDATED,
        context: {
          itemId: updated.id,
          itemTitle: updated.title
        },
        changes
      });

      return this.toImplementationItemResponse(updated);
    });
  }

  async updateImplementationItemStatus(
    featureId: string,
    itemId: string,
    body: { status?: ImplementationItemStatus; note?: string },
    user: AuthUser
  ) {
    await this.ensureFeature(featureId);
    if (!body.status || !Object.values(ImplementationItemStatus).includes(body.status)) {
      throw new BadRequestException('status must be NOT_STARTED, IN_PROGRESS or DONE');
    }
    const note = this.requireNote(body.note);

    const item = await this.prisma.featureImplementationItem.findFirst({
      where: { id: itemId, featureId },
      include: implementationItemInclude
    });
    if (!item) {
      throw new NotFoundException('Implementation item not found');
    }
    if (item.status === body.status) {
      throw new BadRequestException('Implementation item already has this status');
    }

    const data: Prisma.FeatureImplementationItemUncheckedUpdateInput = {
      status: body.status
    };

    if (body.status === ImplementationItemStatus.IN_PROGRESS) {
      if (!item.actualStartAt) {
        data.actualStartAt = new Date();
      }
    } else if (body.status === ImplementationItemStatus.NOT_STARTED) {
      data.actualStartAt = null;
      data.completedAt = null;
    }

    if (body.status === ImplementationItemStatus.DONE) {
      if (!item.actualStartAt && !data.actualStartAt) {
        data.actualStartAt = new Date();
      }
      if (!item.completedAt) {
        data.completedAt = new Date();
      }
    } else {
      data.completedAt = null;
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.featureImplementationItem.update({
        where: { id: itemId },
        data,
        include: implementationItemInclude
      });

      await this.createActivity(tx, {
        featureId,
        actorId: user.id,
        type: FeatureActivityType.IMPLEMENTATION_ITEM_STATUS_CHANGED,
        note,
        context: {
          itemId: updated.id,
          itemTitle: updated.title,
          fromItemStatus: item.status,
          toItemStatus: updated.status
        }
      });

      return this.toImplementationItemResponse(updated);
    });
  }

  async deleteImplementationItem(featureId: string, itemId: string, user: AuthUser) {
    await this.ensureFeature(featureId);
    const item = await this.prisma.featureImplementationItem.findFirst({
      where: { id: itemId, featureId }
    });
    if (!item) {
      throw new NotFoundException('Implementation item not found');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.featureImplementationItem.delete({ where: { id: itemId } });
      await this.syncFeatureSchedule(tx, featureId);

      await this.createActivity(tx, {
        featureId,
        actorId: user.id,
        type: FeatureActivityType.IMPLEMENTATION_ITEM_REMOVED,
        context: {
          itemId: item.id,
          itemTitle: item.title
        }
      });

      return { ok: true };
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

    const screenshots = await this.prisma.featureScreenshot.findMany({
      where: { featureId: id },
      select: { path: true }
    });

    await this.prisma.feature.delete({ where: { id } });

    await Promise.all(
      screenshots.map(async (screenshot) => {
        const filePath = join(process.cwd(), screenshot.path.replace(/^\//, ''));
        if (existsSync(filePath)) {
          await unlink(filePath);
        }
      })
    );

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
      screenshots: detail
        ? {
            include: { uploader: actorSelect },
            orderBy: { createdAt: 'asc' as const }
          }
        : true,
      implementationItems: detail
        ? {
            include: implementationItemInclude,
            orderBy: { sortOrder: 'asc' as const }
          }
        : true,
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
    const items = feature.implementationItems ?? [];
    const doneCount = items.filter(
      (item: { status: ImplementationItemStatus }) => item.status === ImplementationItemStatus.DONE
    ).length;
    const itemCount = items.length;
    const progressPercent = itemCount > 0 ? Math.round((doneCount / itemCount) * 100) : null;

    const itemStarts = items
      .map((item: { plannedStartAt: Date | null }) => item.plannedStartAt)
      .filter(Boolean) as Date[];
    const itemEnds = items
      .map((item: { plannedEndAt: Date | null }) => item.plannedEndAt)
      .filter(Boolean) as Date[];

    const computedStart =
      itemStarts.length > 0
        ? new Date(Math.min(...itemStarts.map((date) => date.getTime())))
        : null;
    const computedEnd =
      itemEnds.length > 0
        ? new Date(Math.max(...itemEnds.map((date) => date.getTime())))
        : null;

    const effectivePlannedStartAt = feature.plannedStartAt ?? computedStart;
    const effectivePlannedEndAt = feature.plannedEndAt ?? computedEnd;

    return {
      ...feature,
      owner: personnel.owner,
      relatedUsers: personnel.relatedUsers,
      screenshotCount: feature.screenshots?.length ?? 0,
      implementationItemCount: itemCount,
      implementationItemDoneCount: doneCount,
      progressPercent,
      effectivePlannedStartAt,
      effectivePlannedEndAt,
      implementationItems: items.map((item: unknown) => this.toImplementationItemResponse(item))
    };
  }

  private toImplementationItemResponse(item: any) {
    return {
      id: item.id,
      featureId: item.featureId,
      sortOrder: item.sortOrder,
      title: item.title,
      note: item.note,
      status: item.status,
      plannedStartAt: item.plannedStartAt,
      plannedEndAt: item.plannedEndAt,
      actualStartAt: item.actualStartAt,
      completedAt: item.completedAt,
      owner: item.owner ?? null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
  }

  private async syncFeatureSchedule(tx: Prisma.TransactionClient, featureId: string) {
    const feature = await tx.feature.findUnique({
      where: { id: featureId },
      select: { plannedStartAt: true, plannedEndAt: true }
    });
    if (!feature) {
      return;
    }

    if (feature.plannedStartAt || feature.plannedEndAt) {
      return;
    }

    const items = await tx.featureImplementationItem.findMany({
      where: { featureId },
      select: { plannedStartAt: true, plannedEndAt: true }
    });

    const starts = items.map((item) => item.plannedStartAt).filter(Boolean) as Date[];
    const ends = items.map((item) => item.plannedEndAt).filter(Boolean) as Date[];

    if (starts.length === 0 && ends.length === 0) {
      return;
    }

    await tx.feature.update({
      where: { id: featureId },
      data: {
        plannedStartAt:
          starts.length > 0
            ? new Date(Math.min(...starts.map((date) => date.getTime())))
            : null,
        plannedEndAt:
          ends.length > 0 ? new Date(Math.max(...ends.map((date) => date.getTime()))) : null
      }
    });
  }

  private buildListOrderBy(
    sortBy?: FeatureSortBy,
    sortOrder?: SortOrder,
    deleted?: DeletedFilter
  ): Prisma.FeatureOrderByWithRelationInput | Prisma.FeatureOrderByWithRelationInput[] {
    const order = sortOrder === 'asc' ? 'asc' : 'desc';

    if (sortBy === 'plannedStart') {
      return [{ plannedStartAt: { sort: order, nulls: 'last' } }, { createdAt: 'desc' }];
    }
    if (sortBy === 'plannedEnd') {
      return [{ plannedEndAt: { sort: order, nulls: 'last' } }, { createdAt: 'desc' }];
    }
    if (sortBy === 'title') {
      return { title: order };
    }
    if (sortBy === 'progress') {
      return deleted === 'only' ? { deletedAt: 'desc' } : { createdAt: 'desc' };
    }
    return deleted === 'only' ? { deletedAt: 'desc' } : { createdAt: order };
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

  private async ensureAssignableOwner(ownerId: string) {
    const owner = await this.prisma.user.findFirst({
      where: { id: ownerId, status: 'ACTIVE' },
      select: { id: true }
    });
    if (!owner) {
      throw new BadRequestException('ownerId is not assignable');
    }
  }

  private parseOptionalDate(value?: string | null) {
    if (value === undefined) {
      return undefined;
    }
    if (value === null || value === '') {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid date value');
    }
    return parsed;
  }

  private validateDateRange(start?: Date | null, end?: Date | null) {
    if (start && end && end < start) {
      throw new BadRequestException('plannedEndAt must be on or after plannedStartAt');
    }
  }

  private clean(value?: string | null) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
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
