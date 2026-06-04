import { Controller, Get } from '@nestjs/common';
import { Permission } from '@prisma/client';
import { Permissions } from '../auth/permissions.decorator';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('kpi')
  @Permissions(Permission.VIEW_STATS)
  kpi() {
    return this.statsService.kpiOverview();
  }
}
