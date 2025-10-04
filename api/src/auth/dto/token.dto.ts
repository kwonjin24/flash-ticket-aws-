import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenRequestDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class TokenDto {
  accessToken: string;
  refreshToken?: string;
}
