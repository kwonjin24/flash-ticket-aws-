import { UserRole } from './user.entity';

export interface JwtPayload {
  sub: string;
  userId: string;
  role: UserRole;
}
