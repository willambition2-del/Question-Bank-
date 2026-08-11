import { UserRole } from '../../generated/prisma/enums';

export interface AuthenticatedUser {
  userId: string;
  username: string;
  role: UserRole;
  tokenVersion: number;
}
