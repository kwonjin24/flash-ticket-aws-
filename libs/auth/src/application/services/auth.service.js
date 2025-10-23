"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const typeorm_1 = require("@nestjs/typeorm");
const bcrypt = __importStar(require("bcryptjs"));
const typeorm_2 = require("typeorm");
const user_entity_1 = require("../../../../../api/src/domain/auth/entities/user.entity");
const user_role_enum_1 = require("../../../../../api/src/domain/auth/enums/user-role.enum");
let AuthService = class AuthService {
    usersRepository;
    jwtService;
    configService;
    constructor(usersRepository, jwtService, configService) {
        this.usersRepository = usersRepository;
        this.jwtService = jwtService;
        this.configService = configService;
    }
    async register(dto) {
        const existing = await this.usersRepository.findOne({
            where: { userId: dto.userId },
        });
        if (existing) {
            throw new common_1.ConflictException('User ID already registered');
        }
        const passwordHash = await bcrypt.hash(dto.password, 10);
        const user = this.usersRepository.create({
            userId: dto.userId,
            passwordHash,
            role: user_role_enum_1.UserRole.USER,
        });
        await this.usersRepository.save(user);
    }
    async registerAdmin(dto) {
        const adminSecret = this.configService.getOrThrow('ADMIN_REGISTER_SECRET');
        if (dto.adminSecret !== adminSecret) {
            throw new common_1.UnauthorizedException('Invalid admin secret');
        }
        const existing = await this.usersRepository.findOne({
            where: { userId: dto.userId },
        });
        if (existing) {
            throw new common_1.ConflictException('User ID already registered');
        }
        const passwordHash = await bcrypt.hash(dto.password, 10);
        const user = this.usersRepository.create({
            userId: dto.userId,
            passwordHash,
            role: user_role_enum_1.UserRole.ADMIN,
        });
        await this.usersRepository.save(user);
    }
    async login(dto) {
        const user = await this.usersRepository.findOne({
            where: { userId: dto.userId },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!passwordValid) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        return this.issueTokenPair(user);
    }
    async refreshAccessToken(dto) {
        try {
            const payload = await this.jwtService.verifyAsync(dto.refreshToken, {
                secret: this.configService.getOrThrow('JWT_REFRESH_SECRET'),
            });
            const user = await this.usersRepository.findOne({
                where: { id: payload.sub },
            });
            if (!user) {
                throw new common_1.UnauthorizedException('User not found');
            }
            return this.issueTokenPair(user);
        }
        catch (error) {
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
    }
    async logout(dto) {
        try {
            await this.jwtService.verifyAsync(dto.refreshToken, {
                secret: this.configService.getOrThrow('JWT_REFRESH_SECRET'),
            });
        }
        catch (error) {
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
    }
    async issueTokenPair(user) {
        const [accessToken, refreshToken] = await Promise.all([
            this.signAccessToken(user),
            this.signRefreshToken(user),
        ]);
        return { accessToken, refreshToken };
    }
    async signAccessToken(user) {
        const payload = {
            sub: user.id,
            userId: user.userId,
            role: user.role,
        };
        return this.jwtService.signAsync(payload, {
            secret: this.configService.getOrThrow('JWT_ACCESS_SECRET'),
            expiresIn: this.configService.getOrThrow('JWT_ACCESS_EXP'),
        });
    }
    async signRefreshToken(user) {
        const payload = {
            sub: user.id,
            userId: user.userId,
            role: user.role,
        };
        return this.jwtService.signAsync(payload, {
            secret: this.configService.getOrThrow('JWT_REFRESH_SECRET'),
            expiresIn: this.configService.getOrThrow('JWT_REFRESH_EXP'),
        });
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map