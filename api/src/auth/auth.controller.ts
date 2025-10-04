import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenRequestDto, TokenDto } from './dto/token.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.OK)
  async register(@Body() dto: RegisterDto): Promise<void> {
    await this.authService.register(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto): Promise<TokenDto> {
    return this.authService.login(dto);
  }

  @Post('token')
  async refresh(@Body() dto: RefreshTokenRequestDto): Promise<TokenDto> {
    return this.authService.refreshAccessToken(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: RefreshTokenRequestDto): Promise<void> {
    await this.authService.logout(dto);
  }
}
