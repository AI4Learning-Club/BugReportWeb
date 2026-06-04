import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { PermissionsGuard } from './auth/permissions.guard';
import { BugsController } from './bugs/bugs.controller';
import { BugsService } from './bugs/bugs.service';
import { FeaturesController } from './features/features.controller';
import { FeaturesService } from './features/features.service';
import { StatsController } from './stats/stats.controller';
import { StatsService } from './stats/stats.service';
import { PrismaModule } from './prisma/prisma.module';
import { RolesController } from './roles/roles.controller';
import { RolesService } from './roles/roles.service';
import { SystemsController } from './systems/systems.controller';
import { SystemsService } from './systems/systems.service';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';
import { PersonnelService } from './personnel/personnel.service';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      signOptions: { expiresIn: '7d' }
    })
  ],
  controllers: [
    AuthController,
    BugsController,
    FeaturesController,
    StatsController,
    RolesController,
    SystemsController,
    UsersController
  ],
  providers: [
    AuthService,
    BugsService,
    FeaturesService,
    StatsService,
    PersonnelService,
    RolesService,
    SystemsService,
    UsersService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard }
  ]
})
export class AppModule {}
