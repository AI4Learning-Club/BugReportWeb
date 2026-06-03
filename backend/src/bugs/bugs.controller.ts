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
import { BugStatus, Permission, RetestResult, Severity } from '@prisma/client';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { mkdirSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { RequestWithUser } from '../auth/auth.types';
import { Permissions } from '../auth/permissions.decorator';
import { BugsService } from './bugs.service';

const screenshotStorage = diskStorage({
  destination: (_req, _file, callback) => {
    const destination = 'uploads/bug-screenshots';
    mkdirSync(destination, { recursive: true });
    callback(null, destination);
  },
  filename: (_req, file, callback) => {
    callback(null, `${uuidv4()}${extname(file.originalname)}`);
  }
});

const screenshotUpload = FileInterceptor('file', {
  storage: screenshotStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    callback(null, file.mimetype.startsWith('image/'));
  }
});

@Controller('bugs')
export class BugsController {
  constructor(private readonly bugsService: BugsService) {}

  @Get()
  list(
    @Query('systemId') systemId: string | undefined,
    @Query('status') status: BugStatus | undefined,
    @Query('deleted') deleted: 'active' | 'only' | 'all' | undefined,
    @Req() request: RequestWithUser
  ) {
    return this.bugsService.list({ systemId, status, deleted }, request.user);
  }

  @Get(':id')
  detail(@Param('id') id: string, @Req() request: RequestWithUser) {
    return this.bugsService.detail(id, request.user);
  }

  @Post()
  @Permissions(Permission.CREATE_BUG)
  create(
    @Body()
    body: {
      systemId?: string;
      title?: string;
      description?: string;
      severity?: Severity;
      environment?: string;
      steps?: string;
      expected?: string;
      actual?: string;
      runtimeInfos?: Array<{ title?: string; environment?: string; logText?: string }>;
    },
    @Req() request: RequestWithUser
  ) {
    return this.bugsService.create(body, request.user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>, @Req() request: RequestWithUser) {
    return this.bugsService.update(id, body as never, request.user);
  }

  @Post(':id/delete')
  @Permissions(Permission.DELETE_BUG)
  softDelete(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() request: RequestWithUser
  ) {
    return this.bugsService.softDelete(id, body, request.user);
  }

  @Delete(':id/permanent')
  permanentDelete(@Param('id') id: string, @Req() request: RequestWithUser) {
    return this.bugsService.permanentDelete(id, request.user);
  }

  @Patch(':id/status')
  @Permissions(Permission.MARK_BUG_FIXED)
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status?: BugStatus; note?: string },
    @Req() request: RequestWithUser
  ) {
    return this.bugsService.updateStatus(id, body, request.user);
  }

  @Post(':id/screenshots')
  @Permissions(Permission.ADD_BUG_EVIDENCE)
  @UseInterceptors(screenshotUpload)
  addScreenshot(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { caption?: string },
    @Req() request: RequestWithUser
  ) {
    return this.bugsService.addScreenshot(id, file, body, request.user);
  }

  @Delete(':id/screenshots/:screenshotId')
  @Permissions(Permission.ADD_BUG_EVIDENCE)
  removeScreenshot(
    @Param('id') id: string,
    @Param('screenshotId') screenshotId: string,
    @Req() request: RequestWithUser
  ) {
    return this.bugsService.removeScreenshot(id, screenshotId, request.user);
  }

  @Post(':id/runtime-info')
  @Permissions(Permission.ADD_BUG_EVIDENCE)
  addRuntimeInfo(
    @Param('id') id: string,
    @Body() body: { title?: string; environment?: string; logText?: string },
    @Req() request: RequestWithUser
  ) {
    return this.bugsService.addRuntimeInfo(id, body, request.user);
  }

  @Patch(':id/runtime-info/:infoId')
  @Permissions(Permission.ADD_BUG_EVIDENCE)
  updateRuntimeInfo(
    @Param('id') id: string,
    @Param('infoId') infoId: string,
    @Body() body: { title?: string; environment?: string; logText?: string },
    @Req() request: RequestWithUser
  ) {
    return this.bugsService.updateRuntimeInfo(id, infoId, body, request.user);
  }

  @Delete(':id/runtime-info/:infoId')
  @Permissions(Permission.ADD_BUG_EVIDENCE)
  removeRuntimeInfo(
    @Param('id') id: string,
    @Param('infoId') infoId: string,
    @Req() request: RequestWithUser
  ) {
    return this.bugsService.removeRuntimeInfo(id, infoId, request.user);
  }

  @Post(':id/retests')
  @Permissions(Permission.RETEST_BUG)
  retest(
    @Param('id') id: string,
    @Body() body: { result?: RetestResult; note?: string },
    @Req() request: RequestWithUser
  ) {
    return this.bugsService.retest(id, body, request.user);
  }
}
