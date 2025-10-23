import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  AuthFacade,
  LoginUserDto,
  RefreshTokenDto,
  RegisterAdminDto,
  RegisterUserDto,
  TokenDto,
} from '@auth';

@Controller('auth')
export class AuthController {
  constructor(private readonly authFacade: AuthFacade) {}

  @Post('register')
  @HttpCode(HttpStatus.OK)
  register(@Body() dto: RegisterUserDto): Promise<void> {
    return this.authFacade.register(dto);
  }

  @Post('register/admin')
  @HttpCode(HttpStatus.OK)
  registerAdmin(@Body() dto: RegisterAdminDto): Promise<void> {
    return this.authFacade.registerAdmin(dto);
  }

  @Post('login')
  login(@Body() dto: LoginUserDto): Promise<TokenDto> {
    return this.authFacade.login(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto): Promise<TokenDto> {
    return this.authFacade.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Body() dto: RefreshTokenDto): Promise<void> {
    return this.authFacade.logout(dto);
  }
}
