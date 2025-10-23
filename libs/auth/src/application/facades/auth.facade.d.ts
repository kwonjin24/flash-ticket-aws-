import { LoginUserDto } from '../dto/login-user.dto';
import { RegisterAdminDto } from '../dto/register-admin.dto';
import { RegisterUserDto } from '../dto/register-user.dto';
import { RefreshTokenDto, TokenDto } from '../dto/token.dto';
import { AuthService } from '../services/auth.service';
export declare class AuthFacade {
    private readonly authService;
    constructor(authService: AuthService);
    register(dto: RegisterUserDto): Promise<void>;
    registerAdmin(dto: RegisterAdminDto): Promise<void>;
    login(dto: LoginUserDto): Promise<TokenDto>;
    refresh(dto: RefreshTokenDto): Promise<TokenDto>;
    logout(dto: RefreshTokenDto): Promise<void>;
}
