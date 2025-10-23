import { IsNotEmpty, IsString } from 'class-validator';
import { RegisterUserDto } from './register-user.dto';

export class RegisterAdminDto extends RegisterUserDto {
  @IsString()
  @IsNotEmpty()
  adminSecret: string;
}
