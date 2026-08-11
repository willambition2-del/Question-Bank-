export const PASSWORD_PATTERN = /^(?=.*\p{L})(?=.*\p{N}).{8,}$/u;
export const USERNAME_PATTERN = /^[A-Za-z0-9_]+$/;

export const DEFAULT_ACCESS_TOKEN_EXPIRES_IN = '15m';
export const DEFAULT_REFRESH_TOKEN_EXPIRES_IN = '30d';
