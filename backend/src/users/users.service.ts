import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const USER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  status: true,
  isAdmin: true,
  createdAt: true,
  updatedAt: true,
  role: true
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.user.findMany({
      select: USER_SELECT,
      orderBy: { createdAt: 'desc' }
    });
  }

  listAssignable() {
    return this.prisma.user.findMany({
      where: { status: UserStatus.ACTIVE },
      select: { id: true, username: true, displayName: true },
      orderBy: { displayName: 'asc' }
    });
  }

  async update(id: string, body: { displayName?: string }) {
    await this.ensureUser(id);
    const displayName = body.displayName?.trim();
    if (!displayName) {
      throw new BadRequestException('displayName is required');
    }
    return this.prisma.user.update({
      where: { id },
      data: { displayName },
      select: USER_SELECT
    });
  }

  async approve(id: string, body: { roleId?: string }) {
    await this.ensureUser(id);
    if (body.roleId) {
      await this.ensureRole(body.roleId);
    }
    return this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.ACTIVE, roleId: body.roleId },
      select: USER_SELECT
    });
  }

  async updateRole(id: string, body: { roleId?: string | null }) {
    await this.ensureUser(id);
    if (body.roleId) {
      await this.ensureRole(body.roleId);
    }
    return this.prisma.user.update({
      where: { id },
      data: { roleId: body.roleId ?? null },
      select: USER_SELECT
    });
  }

  async updateAdmin(id: string, body: { isAdmin?: boolean }, actorId: string) {
    await this.ensureUser(id);
    if (id === actorId && body.isAdmin === false) {
      throw new BadRequestException('Admins cannot remove their own admin flag');
    }
    return this.prisma.user.update({
      where: { id },
      data: { isAdmin: Boolean(body.isAdmin) },
      select: USER_SELECT
    });
  }

  async updateStatus(id: string, body: { status?: UserStatus }, actorId: string) {
    await this.ensureUser(id);
    if (!body.status || !Object.values(UserStatus).includes(body.status)) {
      throw new BadRequestException('status is required');
    }
    if (id === actorId && body.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('Users cannot disable their own account');
    }
    return this.prisma.user.update({
      where: { id },
      data: { status: body.status },
      select: USER_SELECT
    });
  }

  private async ensureUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private async ensureRole(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }
}
