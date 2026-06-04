import { BugActivityType, Prisma } from '@prisma/client';

export type PersonnelActivityContext = Record<string, string | null>;

export async function fetchUserDisplayNames(
  tx: Prisma.TransactionClient,
  userIds: string[]
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const users = await tx.user.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, displayName: true }
  });

  return new Map(users.map((item) => [item.id, item.displayName]));
}

export async function recordBugPersonnelActivity(
  tx: Prisma.TransactionClient,
  input: {
    bugId: string;
    actorId: string;
    type: BugActivityType;
    context?: PersonnelActivityContext;
  }
) {
  const data: Prisma.BugActivityUncheckedCreateInput = {
    bugId: input.bugId,
    actorId: input.actorId,
    type: input.type
  };

  if (input.context && Object.keys(input.context).length > 0) {
    data.context = input.context as Prisma.InputJsonValue;
  }

  await tx.bugActivity.create({ data });
}

export function ownerContext(
  names: Map<string, string>,
  previousOwnerId: string | null,
  nextOwnerId: string | null
): PersonnelActivityContext {
  return {
    previousOwnerId,
    previousOwnerName: previousOwnerId ? names.get(previousOwnerId) ?? previousOwnerId : null,
    newOwnerId: nextOwnerId,
    newOwnerName: nextOwnerId ? names.get(nextOwnerId) ?? nextOwnerId : null
  };
}

export function relatedNamesContext(names: Map<string, string>, userIds: string[]): PersonnelActivityContext {
  const labels = userIds.map((userId) => names.get(userId) ?? userId);
  return {
    userIds: userIds.join(','),
    userNames: labels.join('、')
  };
}
