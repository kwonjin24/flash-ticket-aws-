import { Injectable } from '@nestjs/common';
import { LoginUserDto } from '../dto/login-user.dto';
import { RegisterAdminDto } from '../dto/register-admin.dto';
import { RegisterUserDto } from '../dto/register-user.dto';
import { RefreshTokenDto, TokenDto } from '../dto/token.dto';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthFacade {
  constructor(private readonly authService: AuthService) {}

  register(dto: RegisterUserDto): Promise<void> {
    return this.authService.register(dto);
  }

  registerAdmin(dto: RegisterAdminDto): Promise<void> {
    return this.authService.registerAdmin(dto);
  }

  login(dto: LoginUserDto): Promise<TokenDto> {
    return this.authService.login(dto);
  }

  refresh(dto: RefreshTokenDto): Promise<TokenDto> {
    return this.authService.refreshAccessToken(dto);
  }

  logout(dto: RefreshTokenDto): Promise<void> {
    return this.authService.logout(dto);
  }
}
