import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_\-]+$/)
  userId: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}
