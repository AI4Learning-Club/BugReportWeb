import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Permission } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const VALID_PERMISSIONS = new Set(Object.values(Permission));

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.role.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async create(body: { name?: string; permissions?: Permission[] }) {
    const name = body.name?.trim();
    if (!name) {
      throw new BadRequestException('name is required');
    }
    return this.prisma.role.create({
      data: { name, permissions: this.normalizePermissions(body.permissions) }
    });
  }

  async update(id: string, body: { name?: string; permissions?: Permission[] }) {
    await this.ensureRole(id);
    const data: { name?: string; permissions?: Permission[] } = {};
    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) {
        throw new BadRequestException('name cannot be empty');
      }
      data.name = name;
    }
    if (body.permissions !== undefined) {
      data.permissions = this.normalizePermissions(body.permissions);
    }
    return this.prisma.role.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.ensureRole(id);
    const users = await this.prisma.user.count({ where: { roleId: id } });
    if (users > 0) {
      throw new BadRequestException('Cannot delete a role assigned to users');
    }
    await this.prisma.role.delete({ where: { id } });
    return { ok: true };
  }

  private normalizePermissions(permissions: Permission[] | undefined) {
    const list = permissions ?? [];
    const invalid = list.filter((permission) => !VALID_PERMISSIONS.has(permission));
    if (invalid.length) {
      throw new BadRequestException(`Invalid permissions: ${invalid.join(', ')}`);
    }
    return [...new Set(list)];
  }

  private async ensureRole(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }
}
