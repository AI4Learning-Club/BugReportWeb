import { Body, Controller, Delete, Get, Param, Patch, Req } from '@nestjs/common';
import { Permission, UserStatus } from '@prisma/client';
import { Permissions } from '../auth/permissions.decorator';
import { RequestWithUser } from '../auth/auth.types';
import { UsersService } from './users.service';

@Controller('users')
@Permissions(Permission.MANAGE_USERS)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list() {
    return this.usersService.list();
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: { displayName?: string }) {
    return this.usersService.update(id, body);
  }

  @Patch(':id/approve')
  approve(@Param('id') id: string, @Body() body: { roleId?: string }) {
    return this.usersService.approve(id, body);
  }

  @Patch(':id/role')
  updateRole(@Param('id') id: string, @Body() body: { roleId?: string | null }) {
    return this.usersService.updateRole(id, body);
  }

  @Patch(':id/admin')
  updateAdmin(
    @Param('id') id: string,
    @Body() body: { isAdmin?: boolean },
    @Req() request: RequestWithUser
  ) {
    return this.usersService.updateAdmin(id, body, request.user.id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status?: UserStatus },
    @Req() request: RequestWithUser
  ) {
    return this.usersService.updateStatus(id, body, request.user.id);
  }

  @Delete(':id')
  @Permissions(Permission.DELETE_DISABLED_USER)
  deleteDisabled(@Param('id') id: string, @Req() request: RequestWithUser) {
    return this.usersService.deleteDisabled(id, request.user.id);
  }
}
