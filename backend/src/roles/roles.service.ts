import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Permission } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSION_CATALOG, PERMISSION_CODES } from './permission-catalog';

type RolePayload = {
  name?: string;
  permissions?: Permission[];
};

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const roles = await this.prisma.role.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: { createdAt: 'asc' }
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      permissions: role.permissions,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      userCount: role._count.users,
      permissionCount: role.permissions.length
    }));
  }

  permissions() {
    return PERMISSION_CATALOG;
  }

  async exportRoles() {
    const roles = await this.prisma.role.findMany({
      orderBy: { createdAt: 'asc' },
      select: { name: true, permissions: true }
    });

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      roles
    };
  }

  async importRoles(body: { version?: number; roles?: RolePayload[] }) {
    if (body.version !== 1) {
      throw new BadRequestException('Unsupported import version');
    }
    const roles = this.normalizeImportRoles(body.roles);
    const existingRoles = await this.prisma.role.findMany({
      include: { _count: { select: { users: true } } }
    });
    const importedNames = new Set(roles.map((role) => role.name));
    const blockedRoles = existingRoles
      .filter((role) => !importedNames.has(role.name) && role._count.users > 0)
      .map((role) => role.name);

    if (blockedRoles.length > 0) {
      throw new BadRequestException(
        `Cannot remove roles that are still assigned to users: ${blockedRoles.join(', ')}`
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const existingByName = new Map(existingRoles.map((role) => [role.name, role]));

      for (const incomingRole of roles) {
        const matched = existingByName.get(incomingRole.name);
        if (matched) {
          await tx.role.update({
            where: { id: matched.id },
            data: { permissions: incomingRole.permissions }
          });
          existingByName.delete(incomingRole.name);
          continue;
        }

        await tx.role.create({
          data: {
            name: incomingRole.name,
            permissions: incomingRole.permissions
          }
        });
      }

      for (const leftover of existingByName.values()) {
        if (leftover._count.users === 0) {
          await tx.role.delete({ where: { id: leftover.id } });
        }
      }
    });

    return this.exportRoles();
  }

  async create(body: RolePayload) {
    const name = body.name?.trim();
    if (!name) {
      throw new BadRequestException('name is required');
    }
    return this.prisma.role.create({
      data: { name, permissions: this.normalizePermissions(body.permissions) }
    });
  }

  async update(id: string, body: RolePayload) {
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
    const invalid = list.filter((permission) => !PERMISSION_CODES.has(permission));
    if (invalid.length) {
      throw new BadRequestException(`Invalid permissions: ${invalid.join(', ')}`);
    }
    return [...new Set(list)];
  }

  private normalizeImportRoles(roles: RolePayload[] | undefined) {
    if (!Array.isArray(roles) || roles.length === 0) {
      throw new BadRequestException('roles must be a non-empty array');
    }

    const normalized = roles.map((role) => {
      const name = role.name?.trim();
      if (!name) {
        throw new BadRequestException('role name is required');
      }
      return {
        name,
        permissions: this.normalizePermissions(role.permissions)
      };
    });
    const duplicatedNames = normalized
      .map((role) => role.name)
      .filter((name, index, names) => names.indexOf(name) !== index);

    if (duplicatedNames.length > 0) {
      throw new BadRequestException(`Duplicate role names: ${[...new Set(duplicatedNames)].join(', ')}`);
    }

    return normalized;
  }

  private async ensureRole(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }
}
