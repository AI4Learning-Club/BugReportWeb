import { Injectable } from '@nestjs/common';
import { BugStatus, FeatureStatus, RetestResult } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const actorSelect = {
  select: { id: true, username: true, displayName: true }
} as const;

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async kpiOverview() {
    const activeUsers = await this.prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: actorSelect.select,
      orderBy: { displayName: 'asc' }
    });

    const [bugsCreated, bugsFixed, featuresCreated, featuresDone, bugsOwned, featuresOwned, retests] =
      await Promise.all([
        this.prisma.bug.groupBy({ by: ['creatorId'], where: { deletedAt: null }, _count: { _all: true } }),
        this.prisma.bug.groupBy({
          by: ['fixedById'],
          where: { deletedAt: null, fixedById: { not: null } },
          _count: { _all: true }
        }),
        this.prisma.feature.groupBy({ by: ['creatorId'], where: { deletedAt: null }, _count: { _all: true } }),
        this.prisma.feature.groupBy({
          by: ['completedById'],
          where: { deletedAt: null, completedById: { not: null } },
          _count: { _all: true }
        }),
        this.prisma.bug.groupBy({
          by: ['ownerId'],
          where: { deletedAt: null, ownerId: { not: null } },
          _count: { _all: true }
        }),
        this.prisma.feature.groupBy({
          by: ['ownerId'],
          where: { deletedAt: null, ownerId: { not: null } },
          _count: { _all: true }
        }),
        this.prisma.bugRetest.groupBy({ by: ['userId'], _count: { _all: true } })
      ]);

    const fixedBugs = await this.prisma.bug.findMany({
      where: { deletedAt: null, status: BugStatus.FIXED, fixedAt: { not: null } },
      select: { fixedById: true, createdAt: true, fixedAt: true }
    });

    const fixHoursByUser = new Map<string, number[]>();
    for (const bug of fixedBugs) {
      if (!bug.fixedById || !bug.fixedAt) {
        continue;
      }
      const hours = (bug.fixedAt.getTime() - bug.createdAt.getTime()) / 3_600_000;
      const bucket = fixHoursByUser.get(bug.fixedById) ?? [];
      bucket.push(hours);
      fixHoursByUser.set(bug.fixedById, bucket);
    }

    const openBugsByOwner = await this.prisma.bug.groupBy({
      by: ['ownerId'],
      where: {
        ownerId: { not: null },
        deletedAt: null,
        status: BugStatus.OPEN
      },
      _count: { _all: true }
    });

    const openFeaturesByOwner = await this.prisma.feature.groupBy({
      by: ['ownerId'],
      where: {
        ownerId: { not: null },
        deletedAt: null,
        status: { not: FeatureStatus.DONE }
      },
      _count: { _all: true }
    });

    const countMap = (rows: Array<{ _count: { _all: number } } & Record<string, unknown>>, key: string) => {
      const map = new Map<string, number>();
      for (const row of rows) {
        const id = row[key] as string | null | undefined;
        if (id) {
          map.set(id, row._count._all);
        }
      }
      return map;
    };

    const bugsCreatedMap = countMap(bugsCreated, 'creatorId');
    const bugsFixedMap = countMap(bugsFixed, 'fixedById');
    const featuresCreatedMap = countMap(featuresCreated, 'creatorId');
    const featuresDoneMap = countMap(featuresDone, 'completedById');
    const bugsOwnedMap = countMap(bugsOwned, 'ownerId');
    const featuresOwnedMap = countMap(featuresOwned, 'ownerId');
    const retestsMap = countMap(retests, 'userId');
    const openBugsOwnedMap = countMap(openBugsByOwner, 'ownerId');
    const openFeaturesOwnedMap = countMap(openFeaturesByOwner, 'ownerId');

    const appearedByUser = await this.prisma.bugRetest.groupBy({
      by: ['userId'],
      where: { result: RetestResult.APPEARED },
      _count: { _all: true }
    });
    const appearedMap = countMap(appearedByUser, 'userId');

    const people = activeUsers.map((user) => {
      const fixHours = fixHoursByUser.get(user.id) ?? [];
      const avgFixHours =
        fixHours.length > 0 ? fixHours.reduce((sum, value) => sum + value, 0) / fixHours.length : null;

      return {
        user,
        bugsCreated: bugsCreatedMap.get(user.id) ?? 0,
        bugsFixed: bugsFixedMap.get(user.id) ?? 0,
        avgFixHours,
        featuresCreated: featuresCreatedMap.get(user.id) ?? 0,
        featuresCompleted: featuresDoneMap.get(user.id) ?? 0,
        retestsSubmitted: retestsMap.get(user.id) ?? 0,
        retestsAppeared: appearedMap.get(user.id) ?? 0,
        bugsOwned: bugsOwnedMap.get(user.id) ?? 0,
        featuresOwned: featuresOwnedMap.get(user.id) ?? 0,
        openBugsOwned: openBugsOwnedMap.get(user.id) ?? 0,
        openFeaturesOwned: openFeaturesOwnedMap.get(user.id) ?? 0,
        workloadScore:
          (openBugsOwnedMap.get(user.id) ?? 0) +
          (openFeaturesOwnedMap.get(user.id) ?? 0) +
          (bugsCreatedMap.get(user.id) ?? 0) * 0.2
      };
    });

    const totals = {
      activeUsers: activeUsers.length,
      openBugs: await this.prisma.bug.count({ where: { deletedAt: null, status: BugStatus.OPEN } }),
      fixedBugs: await this.prisma.bug.count({ where: { deletedAt: null, status: BugStatus.FIXED } }),
      activeFeatures: await this.prisma.feature.count({
        where: { deletedAt: null, status: { not: FeatureStatus.DONE } }
      }),
      doneFeatures: await this.prisma.feature.count({
        where: { deletedAt: null, status: FeatureStatus.DONE }
      })
    };

    return { generatedAt: new Date().toISOString(), totals, people };
  }
}
