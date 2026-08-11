import { UserRole } from '../../generated/prisma/enums';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  username: string;
  tokenVersion: number;
}

export interface RefreshTokenPayload {
  sub: string;
  tokenVersion: number;
  jti?: string;
  type: 'refresh';
}
