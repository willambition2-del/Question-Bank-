import { PublicUser } from '../types/public-user.type';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: string;
  refreshTokenExpiresIn: string;
}

export interface AuthResponse {
  user: PublicUser;
  tokens: AuthTokens;
  isNewUser?: boolean;
}

export interface MessageResponse {
  message: string;
}
