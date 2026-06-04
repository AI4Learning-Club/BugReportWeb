import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BugActivityType, Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  fetchUserDisplayNames,
  ownerContext,
  recordBugPersonnelActivity,
  relatedNamesContext
} from './personnel-activity.util';
import { EntityKind, PersonnelPatchBody } from './personnel.types';
import {
  assertCanChangeOwner,
  assertCanChangeRelated,
  assertCanClaimOwner,
  assertCanSelfJoinRelated,
  ensureActiveUserIds,
  normalizePersonnelPatch
} from './personnel.util';

@Injectable()
export class PersonnelService {
  constructor(private readonly prisma: PrismaService) {}

  async joinBugRelated(bugId: string, user: AuthUser) {
    return this.joinRelated('bug', bugId, user);
  }

  async claimBugOwner(bugId: string, user: AuthUser) {
    return this.claimOwner('bug', bugId, user);
  }

  async patchBugPersonnel(bugId: string, body: PersonnelPatchBody, user: AuthUser) {
    return this.patchPersonnel('bug', bugId, body, user);
  }

  async joinFeatureRelated(featureId: string, user: AuthUser) {
    return this.joinRelated('feature', featureId, user);
  }

  async claimFeatureOwner(featureId: string, user: AuthUser) {
    return this.claimOwner('feature', featureId, user);
  }

  async patchFeaturePersonnel(featureId: string, body: PersonnelPatchBody, user: AuthUser) {
    return this.patchPersonnel('feature', featureId, body, user);
  }

  private async joinRelated(kind: EntityKind, id: string, user: AuthUser) {
    assertCanSelfJoinRelated(user, kind);
    const ownerId = await this.getOwnerId(kind, id);

    if (ownerId === user.id) {
      throw new BadRequestException('Owner cannot join as related personnel');
    }

    const existing = await this.findRelatedRecord(kind, id, user.id);
    if (existing) {
      throw new BadRequestException('Already listed as related personnel');
    }

    await this.prisma.$transaction(async (tx) => {
      await this.createRelatedRecord(kind, id, user.id, tx);
      if (kind === 'bug') {
        const names = await fetchUserDisplayNames(tx, [user.id]);
        await recordBugPersonnelActivity(tx, {
          bugId: id,
          actorId: user.id,
          type: BugActivityType.RELATED_JOINED,
          context: relatedNamesContext(names, [user.id])
        });
      }
    });

    return { ok: true };
  }

  private async claimOwner(kind: EntityKind, id: string, user: AuthUser) {
    assertCanClaimOwner(user);
    await this.ensureEntity(kind, id);
    const previousOwnerId = await this.getOwnerId(kind, id);

    if (previousOwnerId === user.id) {
      throw new BadRequestException('Already the owner');
    }

    await this.prisma.$transaction(async (tx) => {
      if (kind === 'bug') {
        await tx.bugRelatedUser.deleteMany({ where: { bugId: id, userId: user.id } });
        await tx.bug.update({ where: { id }, data: { ownerId: user.id } });
        const names = await fetchUserDisplayNames(tx, [previousOwnerId, user.id].filter(Boolean) as string[]);
        await recordBugPersonnelActivity(tx, {
          bugId: id,
          actorId: user.id,
          type: BugActivityType.OWNER_CLAIMED,
          context: ownerContext(names, previousOwnerId, user.id)
        });
      } else {
        await tx.featureRelatedUser.deleteMany({ where: { featureId: id, userId: user.id } });
        await tx.feature.update({ where: { id }, data: { ownerId: user.id } });
      }
    });

    return { ok: true };
  }

  private async patchPersonnel(
    kind: EntityKind,
    id: string,
    body: PersonnelPatchBody,
    user: AuthUser
  ) {
    const patch = normalizePersonnelPatch(body);
    await this.ensureEntity(kind, id);

    const previousOwnerId = await this.getOwnerId(kind, id);
    const isUserRelated = Boolean(await this.findRelatedRecord(kind, id, user.id));

    assertCanChangeOwner(user, patch.ownerId, previousOwnerId);
    assertCanChangeRelated(user, patch.addRelatedUserIds, patch.removeRelatedUserIds, isUserRelated);

    const ownerId = patch.ownerId;
    if (ownerId) {
      await ensureActiveUserIds([ownerId], this.prisma);
    }

    const relatedChangeIds = [...patch.addRelatedUserIds, ...patch.removeRelatedUserIds];
    if (relatedChangeIds.length > 0) {
      await ensureActiveUserIds(relatedChangeIds, this.prisma);
    }

    if (ownerId && patch.addRelatedUserIds.includes(ownerId)) {
      throw new BadRequestException('owner cannot also be listed as related user');
    }

    if (ownerId !== undefined && ownerId === previousOwnerId && patch.addRelatedUserIds.length === 0 && patch.removeRelatedUserIds.length === 0) {
      throw new BadRequestException('No personnel changes provided');
    }

    await this.prisma.$transaction(async (tx) => {
      if (ownerId !== undefined && ownerId !== previousOwnerId) {
        if (kind === 'bug') {
          if (ownerId) {
            await tx.bugRelatedUser.deleteMany({ where: { bugId: id, userId: ownerId } });
          }
          await tx.bug.update({ where: { id }, data: { ownerId } });
          const names = await fetchUserDisplayNames(
            tx,
            [previousOwnerId, ownerId].filter(Boolean) as string[]
          );
          await recordBugPersonnelActivity(tx, {
            bugId: id,
            actorId: user.id,
            type: ownerId ? BugActivityType.OWNER_DELEGATED : BugActivityType.OWNER_REVOKED,
            context: ownerContext(names, previousOwnerId, ownerId)
          });
        } else {
          if (ownerId) {
            await tx.featureRelatedUser.deleteMany({ where: { featureId: id, userId: ownerId } });
          }
          await tx.feature.update({ where: { id }, data: { ownerId } });
        }
      }

      const effectiveOwnerId =
        ownerId !== undefined
          ? ownerId
          : kind === 'bug'
            ? (await tx.bug.findUnique({ where: { id }, select: { ownerId: true } }))?.ownerId ?? null
            : (await tx.feature.findUnique({ where: { id }, select: { ownerId: true } }))?.ownerId ?? null;

      const addIds = patch.addRelatedUserIds.filter((userId) => userId !== effectiveOwnerId);
      const removeIds = patch.removeRelatedUserIds;

      if (removeIds.length > 0) {
        if (kind === 'bug') {
          await tx.bugRelatedUser.deleteMany({
            where: { bugId: id, userId: { in: removeIds } }
          });
          const names = await fetchUserDisplayNames(tx, removeIds);
          await recordBugPersonnelActivity(tx, {
            bugId: id,
            actorId: user.id,
            type: BugActivityType.RELATED_REMOVED,
            context: relatedNamesContext(names, removeIds)
          });
        } else {
          await tx.featureRelatedUser.deleteMany({
            where: { featureId: id, userId: { in: removeIds } }
          });
        }
      }

      if (addIds.length > 0) {
        for (const userId of addIds) {
          if (kind === 'bug') {
            await tx.bugRelatedUser.upsert({
              where: { bugId_userId: { bugId: id, userId } },
              create: { bugId: id, userId },
              update: {}
            });
          } else {
            await tx.featureRelatedUser.upsert({
              where: { featureId_userId: { featureId: id, userId } },
              create: { featureId: id, userId },
              update: {}
            });
          }
        }

        if (kind === 'bug') {
          const names = await fetchUserDisplayNames(tx, addIds);
          await recordBugPersonnelActivity(tx, {
            bugId: id,
            actorId: user.id,
            type: BugActivityType.RELATED_ADDED,
            context: relatedNamesContext(names, addIds)
          });
        }
      }
    });

    return { ok: true };
  }

  private async ensureEntity(kind: EntityKind, id: string) {
    if (kind === 'bug') {
      const bug = await this.prisma.bug.findUnique({ where: { id } });
      if (!bug || bug.deletedAt) {
        throw new NotFoundException('Bug not found');
      }
      return bug;
    }

    const feature = await this.prisma.feature.findUnique({ where: { id } });
    if (!feature || feature.deletedAt) {
      throw new NotFoundException('Feature not found');
    }
    return feature;
  }

  private async getOwnerId(kind: EntityKind, id: string) {
    await this.ensureEntity(kind, id);
    if (kind === 'bug') {
      const bug = await this.prisma.bug.findUnique({ where: { id }, select: { ownerId: true } });
      return bug?.ownerId ?? null;
    }
    const feature = await this.prisma.feature.findUnique({ where: { id }, select: { ownerId: true } });
    return feature?.ownerId ?? null;
  }

  private findRelatedRecord(kind: EntityKind, id: string, userId: string) {
    if (kind === 'bug') {
      return this.prisma.bugRelatedUser.findUnique({
        where: { bugId_userId: { bugId: id, userId } }
      });
    }
    return this.prisma.featureRelatedUser.findUnique({
      where: { featureId_userId: { featureId: id, userId } }
    });
  }

  private createRelatedRecord(
    kind: EntityKind,
    id: string,
    userId: string,
    tx: Prisma.TransactionClient = this.prisma
  ) {
    if (kind === 'bug') {
      return tx.bugRelatedUser.create({ data: { bugId: id, userId } });
    }
    return tx.featureRelatedUser.create({ data: { featureId: id, userId } });
  }
}
