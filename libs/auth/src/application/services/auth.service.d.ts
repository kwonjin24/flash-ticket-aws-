import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { LoginUserDto } from '../dto/login-user.dto';
import { RegisterAdminDto } from '../dto/register-admin.dto';
import { RegisterUserDto } from '../dto/register-user.dto';
import { RefreshTokenDto, TokenDto } from '../dto/token.dto';
import { User } from '@api/domain/auth/entities/user.entity';
export declare class AuthService {
    private readonly usersRepository;
    private readonly jwtService;
    private readonly configService;
    constructor(usersRepository: Repository<User>, jwtService: JwtService, configService: ConfigService);
    register(dto: RegisterUserDto): Promise<void>;
    registerAdmin(dto: RegisterAdminDto): Promise<void>;
    login(dto: LoginUserDto): Promise<TokenDto>;
    refreshAccessToken(dto: RefreshTokenDto): Promise<TokenDto>;
    logout(dto: RefreshTokenDto): Promise<void>;
    private issueTokenPair;
    private signAccessToken;
    private signRefreshToken;
}
