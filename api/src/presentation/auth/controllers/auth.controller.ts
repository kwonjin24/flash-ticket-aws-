import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthFacade } from '../../../application/auth/facades/auth.facade';
import { LoginRequestDto } from '../dto/login-request.dto';
import { RefreshTokenRequestDto } from '../dto/refresh-token-request.dto';
import { RegisterRequestDto } from '../dto/register-request.dto';
import { TokenResponseDto } from '../dto/token-response.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authFacade: AuthFacade) { }

  @Post('register')
  @HttpCode(HttpStatus.OK)
  async register(@Body() dto: RegisterRequestDto): Promise<void> {
    await this.authFacade.register(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginRequestDto): Promise<TokenResponseDto> {
    return this.authFacade.login(dto);
  }

  @Post('refresh')
  async refresh(
    @Body() dto: RefreshTokenRequestDto,
  ): Promise<TokenResponseDto> {
    return this.authFacade.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: RefreshTokenRequestDto): Promise<void> {
    await this.authFacade.logout(dto);
  }
}
