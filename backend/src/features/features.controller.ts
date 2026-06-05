import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FeatureStatus, ImplementationItemStatus, Permission, Severity } from '@prisma/client';
import { diskStorage } from 'multer';
import { mkdirSync } from 'fs';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { RequestWithUser } from '../auth/auth.types';
import { Permissions } from '../auth/permissions.decorator';
import { PersonnelPatchBody } from '../personnel/personnel.types';
import { PersonnelService } from '../personnel/personnel.service';
import { FeaturesService } from './features.service';

const screenshotUploadMaxSizeBytes = 50 * 1024 * 1024;

const screenshotStorage = diskStorage({
  destination: (_req, _file, callback) => {
    const destination = 'uploads/feature-screenshots';
    mkdirSync(destination, { recursive: true });
    callback(null, destination);
  },
  filename: (_req, file, callback) => {
    callback(null, `${uuidv4()}${extname(file.originalname)}`);
  }
});

const screenshotUpload = FileInterceptor('file', {
  storage: screenshotStorage,
  limits: { fileSize: screenshotUploadMaxSizeBytes },
  fileFilter: (_req, file, callback) => {
    callback(null, file.mimetype.startsWith('image/'));
  }
});

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
    @Query('sortBy') sortBy: 'createdAt' | 'plannedStart' | 'plannedEnd' | 'progress' | 'title' | undefined,
    @Query('sortOrder') sortOrder: 'asc' | 'desc' | undefined,
    @Query('hasSchedule') hasSchedule: string | undefined,
    @Req() request: RequestWithUser
  ) {
    return this.featuresService.list(
      { systemId, status, deleted, participantUserId, sortBy, sortOrder, hasSchedule },
      request.user
    );
  }

  @Get('gantt')
  gantt(
    @Query('systemId') systemId: string | undefined,
    @Query('status') status: FeatureStatus | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('participantUserId') participantUserId: string | undefined,
    @Req() request: RequestWithUser
  ) {
    return this.featuresService.gantt(
      { systemId, status, from, to, participantUserId },
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
      plannedStartAt?: string | null;
      plannedEndAt?: string | null;
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

  @Post(':id/screenshots')
  @Permissions(Permission.ADD_FEATURE_EVIDENCE)
  @UseInterceptors(screenshotUpload)
  addScreenshot(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { caption?: string },
    @Req() request: RequestWithUser
  ) {
    return this.featuresService.addScreenshot(id, file, body, request.user);
  }

  @Delete(':id/screenshots/:screenshotId')
  @Permissions(Permission.ADD_FEATURE_EVIDENCE)
  removeScreenshot(
    @Param('id') id: string,
    @Param('screenshotId') screenshotId: string,
    @Req() request: RequestWithUser
  ) {
    return this.featuresService.removeScreenshot(id, screenshotId, request.user);
  }

  @Get(':id/implementation-items')
  listImplementationItems(@Param('id') id: string, @Req() request: RequestWithUser) {
    return this.featuresService.listImplementationItems(id, request.user);
  }

  @Post(':id/implementation-items')
  @Permissions(Permission.UPDATE_FEATURE)
  createImplementationItem(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: RequestWithUser
  ) {
    return this.featuresService.createImplementationItem(id, body as never, request.user);
  }

  @Patch(':id/implementation-items/:itemId')
  @Permissions(Permission.UPDATE_FEATURE)
  updateImplementationItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: Record<string, unknown>,
    @Req() request: RequestWithUser
  ) {
    return this.featuresService.updateImplementationItem(id, itemId, body as never, request.user);
  }

  @Patch(':id/implementation-items/:itemId/status')
  @Permissions(Permission.UPDATE_FEATURE)
  updateImplementationItemStatus(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: { status?: ImplementationItemStatus; note?: string },
    @Req() request: RequestWithUser
  ) {
    return this.featuresService.updateImplementationItemStatus(id, itemId, body, request.user);
  }

  @Delete(':id/implementation-items/:itemId')
  @Permissions(Permission.UPDATE_FEATURE)
  deleteImplementationItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Req() request: RequestWithUser
  ) {
    return this.featuresService.deleteImplementationItem(id, itemId, request.user);
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
