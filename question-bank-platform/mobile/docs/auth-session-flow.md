# Auth Session Flow

Contract source: backend commit `9734ec8`; paths are relative to `/api/v1`.

1. Login/register sends the exact DTO to `/auth/login` or `/auth/register`.
2. Access and refresh tokens are stored only through `flutter_secure_storage`.
3. `AuthInterceptor` adds the bearer access token outside public auth endpoints.
4. Concurrent `401` responses share one refresh operation; the original request is retried once.
5. Refresh failure clears secure storage, disconnects the challenge socket and returns the app to an unauthenticated state.
6. Startup restores the session with `/auth/me`; logout calls `/auth/logout`, unregisters push state, disconnects Socket.IO and clears local tokens.

Tokens, passwords and FCM registration targets are never included in production logs.