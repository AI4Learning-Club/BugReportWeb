import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Permission } from '@prisma/client';
import { Permissions } from '../auth/permissions.decorator';
import { RolesService } from './roles.service';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Permissions(Permission.MANAGE_ROLES, Permission.MANAGE_USERS)
  list() {
    return this.rolesService.list();
  }

  @Get('permissions')
  @Permissions(Permission.MANAGE_ROLES, Permission.MANAGE_USERS)
  permissions() {
    return this.rolesService.permissions();
  }

  @Get('export')
  @Permissions(Permission.MANAGE_ROLES)
  exportRoles() {
    return this.rolesService.exportRoles();
  }

  @Post('import')
  @Permissions(Permission.MANAGE_ROLES)
  importRoles(@Body() body: { version?: number; roles?: Array<{ name?: string; permissions?: Permission[] }> }) {
    return this.rolesService.importRoles(body);
  }

  @Post()
  @Permissions(Permission.MANAGE_ROLES)
  create(@Body() body: { name?: string; permissions?: Permission[] }) {
    return this.rolesService.create(body);
  }

  @Patch(':id')
  @Permissions(Permission.MANAGE_ROLES)
  update(@Param('id') id: string, @Body() body: { name?: string; permissions?: Permission[] }) {
    return this.rolesService.update(id, body);
  }

  @Delete(':id')
  @Permissions(Permission.MANAGE_ROLES)
  remove(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }
}
