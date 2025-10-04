import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthFacade } from '../../application/auth/facades/auth.facade';
import { AuthService } from '../../application/auth/services/auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User } from '../../domain/auth/entities/user.entity';
import { JwtRefreshStrategy } from '../../infrastructure/auth/strategies/jwt-refresh.strategy';
import { JwtStrategy } from '../../infrastructure/auth/strategies/jwt.strategy';
import { AuthController } from './controllers/auth.controller';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    TypeOrmModule.forFeature([User]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthFacade, JwtStrategy, JwtRefreshStrategy, JwtAuthGuard],
  exports: [AuthFacade, JwtAuthGuard],
})
export class AuthModule {}
