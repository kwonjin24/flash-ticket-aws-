import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AuthFacade,
  AuthService,
  JwtAuthGuard,
  JwtRefreshStrategy,
  JwtStrategy,
} from '@auth';
import { User } from '@api/domain/auth/entities/user.entity';
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
  exports: [JwtAuthGuard],
})
export class AuthModule {}
