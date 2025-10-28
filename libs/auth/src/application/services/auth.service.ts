import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { LoginUserDto } from '../dto/login-user.dto';
import { RegisterAdminDto } from '../dto/register-admin.dto';
import { RegisterUserDto } from '../dto/register-user.dto';
import { RefreshTokenDto, TokenDto } from '../dto/token.dto';
import { JwtPayload } from '../../infrastructure/strategies/jwt-payload.interface';
import { User } from '@api/domain/auth/entities/user.entity';
import { UserRole } from '@api/domain/auth/enums/user-role.enum';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterUserDto): Promise<void> {
    const existing = await this.usersRepository.findOne({
      where: { userId: dto.userId },
    });
    if (existing) {
      throw new ConflictException('User ID already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = this.usersRepository.create({
      userId: dto.userId,
      passwordHash,
      role: UserRole.USER,
    });

    await this.usersRepository.save(user);
  }

  async registerAdmin(dto: RegisterAdminDto): Promise<void> {
    const adminSecret = this.configService.getOrThrow<string>(
      'ADMIN_REGISTER_SECRET',
    );
    if (dto.adminSecret !== adminSecret) {
      throw new UnauthorizedException('Invalid admin secret');
    }

    const existing = await this.usersRepository.findOne({
      where: { userId: dto.userId },
    });
    if (existing) {
      throw new ConflictException('User ID already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = this.usersRepository.create({
      userId: dto.userId,
      passwordHash,
      role: UserRole.ADMIN,
    });

    await this.usersRepository.save(user);
  }

  async login(dto: LoginUserDto): Promise<TokenDto> {
    const user = await this.usersRepository.findOne({
      where: { userId: dto.userId },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokenPair(user);
  }

  async refreshAccessToken(dto: RefreshTokenDto): Promise<TokenDto> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(
        dto.refreshToken,
        {
          secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        },
      );

      const user = await this.usersRepository.findOne({
        where: { id: payload.sub },
      });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return this.issueTokenPair(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(dto: RefreshTokenDto): Promise<void> {
    try {
      await this.jwtService.verifyAsync<JwtPayload>(dto.refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async issueTokenPair(user: User): Promise<TokenDto> {
    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(user),
      this.signRefreshToken(user),
    ]);

    return { accessToken, refreshToken };
  }

  private async signAccessToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      userId: user.userId,
      role: user.role,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.getOrThrow<string>('JWT_ACCESS_EXP'),
    });
  }

  private async signRefreshToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      userId: user.userId,
      role: user.role,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.getOrThrow<string>('JWT_REFRESH_EXP'),
    });
  }
}
