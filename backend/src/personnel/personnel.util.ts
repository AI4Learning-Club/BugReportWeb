import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Permission, Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { EntityKind, PersonnelPatchBody } from './personnel.types';

const actorSelect = {
  select: { id: true, username: true, displayName: true }
} as const;

export const bugPersonnelInclude = {
  owner: actorSelect,
  relatedUsers: {
    include: { user: actorSelect }
  }
} as const;

export const featurePersonnelInclude = {
  owner: actorSelect,
  relatedUsers: {
    include: { user: actorSelect }
  }
} as const;

export function toPersonnelResponse(entity: {
  owner: { id: string; username: string; displayName: string } | null;
  relatedUsers: Array<{ user: { id: string; username: string; displayName: string } }>;
}) {
  return {
    owner: entity.owner,
    relatedUsers: entity.relatedUsers.map((item) => item.user)
  };
}

export function buildParticipantFilter(userId: string, entity: EntityKind): Prisma.BugWhereInput | Prisma.FeatureWhereInput {
  if (entity === 'bug') {
    return {
      OR: [
        { creatorId: userId },
        { ownerId: userId },
        { relatedUsers: { some: { userId } } },
        { fixedById: userId },
        { deletedById: userId },
        { activities: { some: { actorId: userId } } },
        { retests: { some: { userId } } },
        { screenshots: { some: { uploaderId: userId } } },
        { runtimeInfos: { some: { authorId: userId } } }
      ]
    };
  }

  return {
    OR: [
      { creatorId: userId },
      { ownerId: userId },
      { relatedUsers: { some: { userId } } },
      { completedById: userId },
      { deletedById: userId }
    ]
  };
}

export function hasPermission(user: AuthUser, permission: Permission) {
  return user.isAdmin || user.permissions.includes(permission);
}

export function assertCanSelfJoinRelated(user: AuthUser, kind: EntityKind) {
  if (user.isAdmin) {
    return;
  }
  const required =
    kind === 'bug' ? Permission.MARK_BUG_FIXED : Permission.UPDATE_FEATURE;
  if (!hasPermission(user, required)) {
    throw new ForbiddenException('You do not have permission to join as related personnel');
  }
}

export function assertCanClaimOwner(user: AuthUser) {
  if (!hasPermission(user, Permission.BECOME_ITEM_OWNER)) {
    throw new ForbiddenException('You do not have permission to become the owner');
  }
}

export function assertCanDelegateRelated(user: AuthUser) {
  if (!hasPermission(user, Permission.DELEGATE_ITEM_RELATED)) {
    throw new ForbiddenException('You do not have permission to delegate related personnel');
  }
}

export function assertCanDelegateOwner(user: AuthUser) {
  if (!hasPermission(user, Permission.DELEGATE_ITEM_OWNER)) {
    throw new ForbiddenException('You do not have permission to delegate the owner');
  }
}

export function assertCanRevokeOwner(user: AuthUser, currentOwnerId: string | null) {
  if (!currentOwnerId) {
    throw new BadRequestException('No owner assigned');
  }
  if (currentOwnerId === user.id) {
    assertCanClaimOwner(user);
    return;
  }
  assertCanDelegateOwner(user);
}

export function assertCanChangeOwner(
  user: AuthUser,
  nextOwnerId: string | null | undefined,
  currentOwnerId: string | null
) {
  if (nextOwnerId === undefined) {
    return;
  }
  if (nextOwnerId === currentOwnerId) {
    return;
  }
  if (nextOwnerId === null) {
    assertCanRevokeOwner(user, currentOwnerId);
    return;
  }
  assertCanDelegateOwner(user);
}

export function assertCanChangeRelated(
  user: AuthUser,
  addRelatedUserIds: string[],
  removeRelatedUserIds: string[],
  isUserRelated: boolean
) {
  if (addRelatedUserIds.length > 0) {
    assertCanDelegateRelated(user);
  }

  if (removeRelatedUserIds.length === 0) {
    return;
  }

  const onlySelf =
    removeRelatedUserIds.length > 0 && removeRelatedUserIds.every((userId) => userId === user.id);
  if (onlySelf) {
    if (!isUserRelated) {
      throw new ForbiddenException('You are not listed as related personnel');
    }
    return;
  }

  assertCanDelegateRelated(user);
}

export function normalizePersonnelPatch(body: PersonnelPatchBody) {
  const hasOwner = body.ownerId !== undefined;
  const addRelatedUserIds = [...new Set((body.addRelatedUserIds ?? []).filter(Boolean))];
  const removeRelatedUserIds = [...new Set((body.removeRelatedUserIds ?? []).filter(Boolean))];

  if (!hasOwner && addRelatedUserIds.length === 0 && removeRelatedUserIds.length === 0) {
    throw new BadRequestException('No personnel changes provided');
  }

  if (hasOwner && body.ownerId && addRelatedUserIds.includes(body.ownerId)) {
    throw new BadRequestException('owner cannot also be listed as related user');
  }

  return {
    ownerId: hasOwner ? body.ownerId ?? null : undefined,
    addRelatedUserIds,
    removeRelatedUserIds
  };
}

export async function ensureActiveUserIds(userIds: string[], prisma: { user: { findMany: (args: { where: { id: { in: string[] }; status: 'ACTIVE' }; select: { id: true } }) => Promise<Array<{ id: string }>> } }) {
  if (userIds.length === 0) {
    return;
  }
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, status: 'ACTIVE' },
    select: { id: true }
  });
  if (users.length !== userIds.length) {
    throw new BadRequestException('One or more users are invalid or inactive');
  }
}
