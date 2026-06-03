import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  BugActivityType,
  BugStatus,
  Prisma,
  RetestResult,
  Severity
} from '@prisma/client';
import { existsSync } from 'fs';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

type BugBody = {
  systemId?: string;
  title?: string;
  description?: string;
  severity?: Severity;
  environment?: string;
  steps?: string;
  expected?: string;
  actual?: string;
  runtimeInfos?: Array<{ title?: string; environment?: string; logText?: string }>;
};

type StatusBody = {
  status?: BugStatus;
  note?: string;
};

type DeleteBody = {
  reason?: string;
};

type ActivityChange = {
  field: string;
  from: string | null;
  to: string | null;
};

type ActivityContext = Record<string, string | number | boolean | null>;
type DeletedFilter = 'active' | 'only' | 'all';

const actorSelect = {
  select: { id: true, username: true, displayName: true }
} as const;

@Injectable()
export class BugsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: { systemId?: string; status?: BugStatus; deleted?: DeletedFilter },
    user: AuthUser
  ) {
    const deleted = this.normalizeDeletedFilter(query.deleted);
    if (deleted !== 'active' && !user.isAdmin) {
      throw new ForbiddenException('Only admins can access deleted bugs');
    }

    const bugs = await this.prisma.bug.findMany({
      where: this.buildBugWhere(query.systemId, query.status, deleted),
      include: this.bugInclude(),
      orderBy: deleted === 'only' ? { deletedAt: 'desc' } : { createdAt: 'desc' }
    });
    return bugs.map((bug) => this.toBugResponse(bug));
  }

  async detail(id: string, user: AuthUser) {
    const bug = await this.prisma.bug.findUnique({
      where: { id },
      include: this.bugInclude(true)
    });
    if (!bug || (bug.deletedAt && !user.isAdmin)) {
      throw new NotFoundException('Bug not found');
    }
    return this.toBugResponse(bug);
  }

  async create(body: BugBody, user: AuthUser) {
    if (!body.systemId || !body.title?.trim() || !body.description?.trim()) {
      throw new BadRequestException('systemId, title and description are required');
    }
    const system = await this.prisma.trackedSystem.findUnique({ where: { id: body.systemId } });
    if (!system || system.deletedAt) {
      throw new BadRequestException('System is not available for new bugs');
    }

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.bug.create({
        data: {
          systemId: body.systemId!,
          creatorId: user.id,
          title: body.title!.trim(),
          description: body.description!.trim(),
          severity: this.normalizeSeverity(body.severity),
          environment: this.clean(body.environment),
          steps: this.clean(body.steps),
          expected: this.clean(body.expected),
          actual: this.clean(body.actual),
          runtimeInfos: {
            create: this.normalizeRuntimeInfos(body.runtimeInfos).map((info) => ({
              ...info,
              authorId: user.id
            }))
          }
        }
      });

      await this.createActivity(tx, {
        bugId: created.id,
        actorId: user.id,
        type: BugActivityType.CREATED,
        createdAt: created.createdAt
      });

      const bug = await this.findBugDetail(tx, created.id);
      return this.toBugResponse(bug);
    });
  }

  async update(id: string, body: Partial<BugBody>, user: AuthUser) {
    const bug = await this.findBugForEdit(id, user);
    const data = this.buildBugUpdateData(body);

    if (data.systemId !== undefined) {
      const system = await this.prisma.trackedSystem.findUnique({ where: { id: data.systemId as string } });
      if (!system || system.deletedAt) {
        throw new BadRequestException('System is not available for bugs');
      }
    }

    const changes = this.diffFields(bug, data);
    if (changes.length === 0) {
      return this.detail(id, user);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.bug.update({
        where: { id: bug.id },
        data
      });

      await this.createActivity(tx, {
        bugId: bug.id,
        actorId: user.id,
        type: BugActivityType.UPDATED,
        changes
      });

      const updated = await this.findBugDetail(tx, bug.id);
      return this.toBugResponse(updated);
    });
  }

  async softDelete(id: string, body: DeleteBody, user: AuthUser) {
    const bug = await this.ensureBug(id);
    if (!user.isAdmin && bug.creatorId !== user.id) {
      throw new ForbiddenException('Only admins or creators can delete bugs');
    }
    const reason = this.requireNote(body.reason);

    return this.prisma.$transaction(async (tx) => {
      await tx.bug.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          deletedById: user.id,
          deleteReason: reason
        }
      });

      await this.createActivity(tx, {
        bugId: id,
        actorId: user.id,
        type: BugActivityType.DELETED,
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
      throw new ForbiddenException('Only admins can permanently delete bugs');
    }

    const bug = await this.ensureBug(id, { includeDeleted: true });
    if (!bug.deletedAt) {
      throw new BadRequestException('Only deleted bugs can be permanently removed');
    }

    const screenshots = await this.prisma.bugScreenshot.findMany({
      where: { bugId: id },
      select: { path: true }
    });

    await this.prisma.bug.delete({ where: { id } });

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

  async removeActivity(bugId: string, activityId: string, user: AuthUser) {
    await this.detail(bugId, user);

    const activity = await this.prisma.bugActivity.findFirst({
      where: { id: activityId, bugId },
      select: { id: true }
    });
    if (!activity) {
      throw new NotFoundException('Activity not found');
    }

    await this.prisma.bugActivity.delete({ where: { id: activityId } });
    return { ok: true };
  }

  async updateStatus(id: string, body: StatusBody, user: AuthUser) {
    const bug = await this.ensureBug(id);
    const status = this.normalizeStatus(body.status);
    const note = this.requireNote(body.note);

    if (bug.status === status) {
      throw new BadRequestException('Bug already has this status');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.bug.update({
        where: { id },
        data:
          status === BugStatus.FIXED
            ? { status, fixedAt: new Date(), fixedById: user.id }
            : { status, fixedAt: null, fixedById: null }
      });

      await this.createActivity(tx, {
        bugId: id,
        actorId: user.id,
        type: BugActivityType.STATUS_CHANGED,
        note,
        fromStatus: bug.status,
        toStatus: status
      });

      const updated = await this.findBugDetail(tx, id);
      return this.toBugResponse(updated);
    });
  }

  async addScreenshot(
    bugId: string,
    file: Express.Multer.File | undefined,
    body: { caption?: string },
    user: AuthUser
  ) {
    await this.ensureBug(bugId);
    if (!file) {
      throw new BadRequestException('file is required');
    }

    return this.prisma.$transaction(async (tx) => {
      const screenshot = await tx.bugScreenshot.create({
        data: {
          bugId,
          uploaderId: user.id,
          originalName: file.originalname,
          storedName: file.filename,
          path: `/uploads/bug-screenshots/${file.filename}`,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          caption: this.clean(body.caption)
        }
      });

      await this.createActivity(tx, {
        bugId,
        actorId: user.id,
        type: BugActivityType.SCREENSHOT_ADDED,
        context: {
          screenshotId: screenshot.id,
          originalName: screenshot.originalName,
          caption: screenshot.caption
        }
      });

      return screenshot;
    });
  }

  async removeScreenshot(bugId: string, screenshotId: string, user: AuthUser) {
    const screenshot = await this.prisma.bugScreenshot.findFirst({
      where: { id: screenshotId, bugId },
      include: { bug: true }
    });
    if (!screenshot || screenshot.bug.deletedAt) {
      throw new NotFoundException('Screenshot not found');
    }
    if (!user.isAdmin && screenshot.uploaderId !== user.id && screenshot.bug.creatorId !== user.id) {
      throw new ForbiddenException('Only admins, bug creators or uploaders can delete screenshots');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.bugScreenshot.delete({ where: { id: screenshotId } });
      await this.createActivity(tx, {
        bugId,
        actorId: user.id,
        type: BugActivityType.SCREENSHOT_REMOVED,
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

  async addRuntimeInfo(
    bugId: string,
    body: { title?: string; environment?: string; logText?: string },
    user: AuthUser
  ) {
    await this.ensureBug(bugId);
    const info = this.normalizeRuntimeInfo(body);

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.bugRuntimeInfo.create({
        data: { ...info, bugId, authorId: user.id }
      });

      await this.createActivity(tx, {
        bugId,
        actorId: user.id,
        type: BugActivityType.RUNTIME_INFO_ADDED,
        context: {
          runtimeInfoId: created.id,
          title: created.title,
          environment: created.environment
        }
      });

      return created;
    });
  }

  async updateRuntimeInfo(
    bugId: string,
    infoId: string,
    body: { title?: string; environment?: string; logText?: string },
    user: AuthUser
  ) {
    const info = await this.findRuntimeInfo(bugId, infoId);
    if (!user.isAdmin && info.authorId !== user.id) {
      throw new ForbiddenException('Only admins or authors can edit runtime info');
    }

    const data: Record<string, string | null> = {};
    if (body.title !== undefined) {
      const title = body.title.trim();
      if (!title) {
        throw new BadRequestException('title cannot be empty');
      }
      data.title = title;
    }
    if (body.environment !== undefined) {
      data.environment = this.clean(body.environment);
    }
    if (body.logText !== undefined) {
      const logText = body.logText.trim();
      if (!logText) {
        throw new BadRequestException('logText cannot be empty');
      }
      data.logText = logText;
    }

    const changes = this.diffFields(info, data);
    if (changes.length === 0) {
      return info;
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.bugRuntimeInfo.update({ where: { id: infoId }, data });

      await this.createActivity(tx, {
        bugId,
        actorId: user.id,
        type: BugActivityType.RUNTIME_INFO_UPDATED,
        changes,
        context: {
          runtimeInfoId: updated.id,
          title: updated.title
        }
      });

      return updated;
    });
  }

  async removeRuntimeInfo(bugId: string, infoId: string, user: AuthUser) {
    const info = await this.findRuntimeInfo(bugId, infoId);
    if (!user.isAdmin && info.authorId !== user.id) {
      throw new ForbiddenException('Only admins or authors can delete runtime info');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.bugRuntimeInfo.delete({ where: { id: infoId } });
      await this.createActivity(tx, {
        bugId,
        actorId: user.id,
        type: BugActivityType.RUNTIME_INFO_REMOVED,
        context: {
          runtimeInfoId: info.id,
          title: info.title
        }
      });
    });

    return { ok: true };
  }

  async retest(
    bugId: string,
    body: { result?: RetestResult; note?: string },
    user: AuthUser
  ) {
    const bug = await this.ensureBug(bugId);
    if (bug.creatorId === user.id) {
      throw new ForbiddenException('Users cannot retest bugs they created');
    }
    if (!body.result || !Object.values(RetestResult).includes(body.result)) {
      throw new BadRequestException('result must be APPEARED or NOT_APPEARED');
    }
    const result = body.result;

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.bugRetest.findUnique({
        where: { bugId_userId: { bugId, userId: user.id } }
      });
      const note = this.clean(body.note);

      const retest = existing
        ? await tx.bugRetest.update({
            where: { id: existing.id },
            data: { result, note }
          })
        : await tx.bugRetest.create({
            data: {
              bugId,
              userId: user.id,
              result,
              note
            }
          });

      await this.createActivity(tx, {
        bugId,
        actorId: user.id,
        type: BugActivityType.RETEST_RECORDED,
        context: {
          retestId: retest.id,
          mode: existing ? 'updated' : 'created',
          result: retest.result,
          note: retest.note,
          previousResult: existing?.result ?? null,
          previousNote: existing?.note ?? null
        }
      });

      return retest;
    });
  }

  private bugInclude(detail = false): Prisma.BugInclude {
    return {
      system: true,
      creator: actorSelect,
      fixedBy: actorSelect,
      deletedBy: actorSelect,
      screenshots: true,
      runtimeInfos: detail
        ? {
            include: { author: actorSelect },
            orderBy: { createdAt: 'desc' as const }
          }
        : true,
      retests: detail
        ? {
            include: { user: actorSelect },
            orderBy: { createdAt: 'desc' as const }
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

  private toBugResponse(bug: any) {
    const appearedCount = bug.retests.filter(
      (retest: { result: RetestResult }) => retest.result === RetestResult.APPEARED
    ).length;
    const notAppearedCount = bug.retests.filter(
      (retest: { result: RetestResult }) => retest.result === RetestResult.NOT_APPEARED
    ).length;

    return {
      ...bug,
      screenshotCount: bug.screenshots.length,
      runtimeInfoCount: bug.runtimeInfos.length,
      appearedCount,
      notAppearedCount
    };
  }

  private normalizeRuntimeInfos(runtimeInfos: BugBody['runtimeInfos']) {
    return (runtimeInfos ?? []).map((info) => this.normalizeRuntimeInfo(info));
  }

  private normalizeRuntimeInfo(info: { title?: string; environment?: string; logText?: string }) {
    const title = info.title?.trim();
    const logText = info.logText?.trim();
    if (!title || !logText) {
      throw new BadRequestException('runtime info title and logText are required');
    }
    return {
      title,
      environment: this.clean(info.environment),
      logText
    };
  }

  private normalizeSeverity(severity?: Severity) {
    if (!severity) {
      return Severity.MEDIUM;
    }
    if (!Object.values(Severity).includes(severity)) {
      throw new BadRequestException('Invalid severity');
    }
    return severity;
  }

  private normalizeStatus(status?: BugStatus) {
    if (!status || !Object.values(BugStatus).includes(status)) {
      throw new BadRequestException('status must be OPEN or FIXED');
    }
    return status;
  }

  private requireNote(note?: string) {
    const normalized = this.clean(note);
    if (!normalized) {
      throw new BadRequestException('note is required');
    }
    return normalized;
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

  private buildBugWhere(systemId: string | undefined, status: BugStatus | undefined, deleted: DeletedFilter) {
    return {
      systemId,
      status,
      ...(deleted === 'active' ? { deletedAt: null } : {}),
      ...(deleted === 'only' ? { deletedAt: { not: null } } : {})
    };
  }

  private async ensureBug(id: string, options: { includeDeleted?: boolean } = {}) {
    const bug = await this.prisma.bug.findUnique({ where: { id } });
    if (!bug || (!options.includeDeleted && bug.deletedAt)) {
      throw new NotFoundException('Bug not found');
    }
    return bug;
  }

  private async findBugForEdit(id: string, user: AuthUser) {
    const bug = await this.ensureBug(id);
    if (!user.isAdmin && bug.creatorId !== user.id) {
      throw new ForbiddenException('Only admins or creators can edit bugs');
    }
    return bug;
  }

  private async findRuntimeInfo(bugId: string, infoId: string) {
    await this.ensureBug(bugId);
    const info = await this.prisma.bugRuntimeInfo.findFirst({ where: { id: infoId, bugId } });
    if (!info) {
      throw new NotFoundException('Runtime info not found');
    }
    return info;
  }

  private buildBugUpdateData(body: Partial<BugBody>) {
    const data: Prisma.BugUncheckedUpdateInput = {};

    if (body.systemId !== undefined) {
      if (!body.systemId) {
        throw new BadRequestException('systemId cannot be empty');
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
    if (body.severity !== undefined) {
      data.severity = this.normalizeSeverity(body.severity);
    }
    for (const key of ['environment', 'steps', 'expected', 'actual'] as const) {
      if (body[key] !== undefined) {
        data[key] = this.clean(body[key]);
      }
    }

    return data;
  }

  private diffFields(
    original: Record<string, unknown>,
    updates: Record<string, unknown>
  ) {
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

  private async findBugDetail(tx: Prisma.TransactionClient, id: string) {
    const bug = await tx.bug.findUnique({
      where: { id },
      include: this.bugInclude(true)
    });
    if (!bug) {
      throw new NotFoundException('Bug not found');
    }
    return bug;
  }

  private async createActivity(
    tx: Prisma.TransactionClient,
    input: {
      bugId: string;
      actorId: string;
      type: BugActivityType;
      note?: string;
      fromStatus?: BugStatus;
      toStatus?: BugStatus;
      changes?: ActivityChange[];
      context?: ActivityContext;
      createdAt?: Date;
    }
  ) {
    const data: Prisma.BugActivityUncheckedCreateInput = {
      bugId: input.bugId,
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

    await tx.bugActivity.create({ data });
  }

  private clean(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
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
