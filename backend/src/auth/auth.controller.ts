import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { RequestWithUser } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() body: { username?: string; password?: string; displayName?: string }) {
    return this.authService.register(body);
  }

  @Public()
  @Post('login')
  login(@Body() body: { username?: string; password?: string }) {
    return this.authService.login(body);
  }

  @Get('me')
  me(@Req() request: RequestWithUser) {
    return this.authService.me(request.user.id);
  }
}
