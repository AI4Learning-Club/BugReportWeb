import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SystemsService {
  constructor(private readonly prisma: PrismaService) {}

  list(includeDeleted = false) {
    return this.prisma.trackedSystem.findMany({
      where: includeDeleted ? undefined : { deletedAt: null },
      orderBy: { createdAt: 'desc' }
    });
  }

  detail(id: string) {
    return this.ensureSystem(id);
  }

  async create(body: { name?: string; description?: string; owner?: string; versionInfo?: string }) {
    const name = body.name?.trim();
    if (!name) {
      throw new BadRequestException('name is required');
    }
    const existing = await this.prisma.trackedSystem.findUnique({ where: { name } });
    if (existing) {
      if (!existing.deletedAt) {
        throw new BadRequestException('系统名称已存在');
      }
      return this.prisma.trackedSystem.update({
        where: { id: existing.id },
        data: {
          deletedAt: null,
          description: this.cleanOptional(body.description),
          owner: this.cleanOptional(body.owner),
          versionInfo: this.cleanOptional(body.versionInfo)
        }
      });
    }
    try {
      return await this.prisma.trackedSystem.create({
        data: {
          name,
          description: this.cleanOptional(body.description),
          owner: this.cleanOptional(body.owner),
          versionInfo: this.cleanOptional(body.versionInfo)
        }
      });
    } catch (error) {
      this.handleUniqueNameError(error);
    }
  }

  async update(
    id: string,
    body: { name?: string; description?: string | null; owner?: string | null; versionInfo?: string | null }
  ) {
    await this.ensureSystem(id);
    const data: Record<string, string | null> = {};
    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) {
        throw new BadRequestException('name cannot be empty');
      }
      data.name = name;
    }
    for (const key of ['description', 'owner', 'versionInfo'] as const) {
      if (body[key] !== undefined) {
        data[key] = this.cleanOptional(body[key] ?? undefined);
      }
    }
    try {
      return await this.prisma.trackedSystem.update({ where: { id }, data });
    } catch (error) {
      this.handleUniqueNameError(error);
    }
  }

  async remove(id: string) {
    await this.ensureSystem(id);
    const bugCount = await this.prisma.bug.count({ where: { systemId: id } });
    if (bugCount > 0) {
      throw new BadRequestException('Cannot delete a system that already has bugs');
    }
    await this.prisma.trackedSystem.delete({ where: { id } });
    return { ok: true };
  }

  private cleanOptional(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private async ensureSystem(id: string) {
    const system = await this.prisma.trackedSystem.findUnique({ where: { id } });
    if (!system) {
      throw new NotFoundException('System not found');
    }
    return system;
  }

  private handleUniqueNameError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new BadRequestException('系统名称已存在');
    }
    throw error;
  }
}
