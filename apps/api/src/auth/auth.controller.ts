import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import type { AuthResponse } from './auth.types.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { Public } from './public.decorator.js';

@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() input: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(input);
  }

  @Post('login')
  login(@Body() input: LoginDto): Promise<AuthResponse> {
    return this.authService.login(input);
  }
}
