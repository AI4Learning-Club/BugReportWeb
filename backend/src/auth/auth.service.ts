import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async register(body: { username?: string; password?: string; displayName?: string }) {
    const username = body.username?.trim();
    const password = body.password;
    const displayName = body.displayName?.trim();
    if (!username || !password || !displayName) {
      throw new BadRequestException('username, password and displayName are required');
    }
    if (password.length < 6) {
      throw new BadRequestException('password must be at least 6 characters');
    }

    const normalRole = await this.prisma.role.findUnique({ where: { name: '普通用户' } });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: {
        username,
        passwordHash,
        displayName,
        roleId: normalRole?.id,
        status: UserStatus.PENDING
      },
      select: { id: true, username: true, displayName: true, status: true, createdAt: true }
    });
    return { user, message: '注册成功，等待管理员审批' };
  }

  async login(body: { username?: string; password?: string }) {
    const username = body.username?.trim();
    if (!username || !body.password) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { role: true }
    });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User is pending approval or disabled');
    }

    return {
      accessToken: await this.jwtService.signAsync({ sub: user.id, username: user.username }),
      user: this.safeUser(user)
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true }
    });
    return user ? this.safeUser(user) : null;
  }

  private safeUser(user: {
    id: string;
    username: string;
    displayName: string;
    status: UserStatus;
    isAdmin: boolean;
    role: { id: string; name: string; permissions: string[] } | null;
  }) {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      status: user.status,
      isAdmin: user.isAdmin,
      role: user.role
    };
  }
}
