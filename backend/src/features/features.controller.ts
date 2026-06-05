import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { FeatureStatus, Permission, Severity } from '@prisma/client';
import { RequestWithUser } from '../auth/auth.types';
import { Permissions } from '../auth/permissions.decorator';
import { PersonnelPatchBody } from '../personnel/personnel.types';
import { PersonnelService } from '../personnel/personnel.service';
import { FeaturesService } from './features.service';

@Controller('features')
export class FeaturesController {
  constructor(
    private readonly featuresService: FeaturesService,
    private readonly personnelService: PersonnelService
  ) {}

  @Get()
  list(
    @Query('systemId') systemId: string | undefined,
    @Query('status') status: FeatureStatus | undefined,
    @Query('deleted') deleted: 'active' | 'only' | 'all' | undefined,
    @Query('participantUserId') participantUserId: string | undefined,
    @Req() request: RequestWithUser
  ) {
    return this.featuresService.list(
      { systemId, status, deleted, participantUserId },
      request.user
    );
  }

  @Get(':id')
  detail(@Param('id') id: string, @Req() request: RequestWithUser) {
    return this.featuresService.detail(id, request.user);
  }

  @Post()
  @Permissions(Permission.CREATE_FEATURE)
  create(
    @Body()
    body: {
      systemId?: string;
      title?: string;
      description?: string;
      priority?: Severity;
    },
    @Req() request: RequestWithUser
  ) {
    return this.featuresService.create(body, request.user);
  }

  @Patch(':id')
  @Permissions(Permission.UPDATE_FEATURE)
  update(@Param('id') id: string, @Body() body: Record<string, unknown>, @Req() request: RequestWithUser) {
    return this.featuresService.update(id, body as never, request.user);
  }

  @Post(':id/personnel/join')
  @Permissions(Permission.UPDATE_FEATURE)
  async joinPersonnel(@Param('id') id: string, @Req() request: RequestWithUser) {
    await this.personnelService.joinFeatureRelated(id, request.user);
    return this.featuresService.detail(id, request.user);
  }

  @Post(':id/personnel/claim-owner')
  @Permissions(Permission.BECOME_ITEM_OWNER)
  async claimOwner(@Param('id') id: string, @Req() request: RequestWithUser) {
    await this.personnelService.claimFeatureOwner(id, request.user);
    return this.featuresService.detail(id, request.user);
  }

  @Patch(':id/personnel')
  async patchPersonnel(
    @Param('id') id: string,
    @Body() body: PersonnelPatchBody,
    @Req() request: RequestWithUser
  ) {
    await this.personnelService.patchFeaturePersonnel(id, body, request.user);
    return this.featuresService.detail(id, request.user);
  }

  @Patch(':id/status')
  @Permissions(Permission.UPDATE_FEATURE)
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status?: FeatureStatus; note?: string },
    @Req() request: RequestWithUser
  ) {
    return this.featuresService.updateStatus(id, body, request.user);
  }

  @Delete(':id/activities/:activityId')
  @Permissions(Permission.DELETE_FEATURE_ACTIVITY)
  removeActivity(
    @Param('id') id: string,
    @Param('activityId') activityId: string,
    @Req() request: RequestWithUser
  ) {
    return this.featuresService.removeActivity(id, activityId, request.user);
  }

  @Post(':id/delete')
  @Permissions(Permission.DELETE_FEATURE)
  softDelete(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() request: RequestWithUser
  ) {
    return this.featuresService.softDelete(id, body, request.user);
  }

  @Delete(':id/permanent')
  permanentDelete(@Param('id') id: string, @Req() request: RequestWithUser) {
    return this.featuresService.permanentDelete(id, request.user);
  }
}
