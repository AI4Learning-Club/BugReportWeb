import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Permission } from '@prisma/client';
import { Permissions } from '../auth/permissions.decorator';
import { SystemsService } from './systems.service';

@Controller('systems')
export class SystemsController {
  constructor(private readonly systemsService: SystemsService) {}

  @Get()
  list(@Query('includeDeleted') includeDeleted?: string) {
    return this.systemsService.list(includeDeleted === 'true');
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.systemsService.detail(id);
  }

  @Post()
  @Permissions(Permission.MANAGE_SYSTEMS)
  create(@Body() body: { name?: string; description?: string; owner?: string; versionInfo?: string }) {
    return this.systemsService.create(body);
  }

  @Patch(':id')
  @Permissions(Permission.MANAGE_SYSTEMS)
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string | null; owner?: string | null; versionInfo?: string | null }
  ) {
    return this.systemsService.update(id, body);
  }

  @Delete(':id')
  @Permissions(Permission.MANAGE_SYSTEMS)
  remove(@Param('id') id: string) {
    return this.systemsService.remove(id);
  }
}
