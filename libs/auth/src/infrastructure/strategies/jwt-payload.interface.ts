import { UserRole } from '@api/domain/auth/enums/user-role.enum';

export interface JwtPayload {
  sub: string;
  userId: string;
  role: UserRole;
}
