# Google Authentication Backend Flow

## Endpoint

`POST /api/v1/auth/google` accepts only `{ "idToken": "..." }`.

1. `GoogleTokenVerifier` uses `google-auth-library` to verify the token signature, Google issuer, expiration, and the configured Web client audience.
2. The Backend reads `sub`, verified email, and name only from the verified payload.
3. An existing `(GOOGLE, sub)` identity signs into its linked user.
4. A verified email collision returns `GOOGLE_ACCOUNT_LINK_REQUIRED`; no silent linking occurs.
5. A new user is created with nullable password, a deterministic unique username, the official default companion, and an atomic `UserIdentity` relation.
6. `AuthService.createSession` issues the same access/refresh token pair used by password login, hashes the refresh token, and updates login metadata.
7. `/auth/me`, `/auth/refresh`, and `/auth/logout` are unchanged and work for either login method.

Google ID tokens, access tokens, authorization codes, and client secrets are never persisted. Concurrent first login is protected by database uniqueness and recovery after `P2002`.

## Configuration

```dotenv
GOOGLE_AUTH_ENABLED=true
GOOGLE_CLIENT_ID=<web-oauth-client-id>
```

When disabled, the endpoint returns `SOCIAL_PROVIDER_DISABLED`. Other stable codes are `GOOGLE_TOKEN_INVALID`, `GOOGLE_TOKEN_EXPIRED`, `GOOGLE_TOKEN_AUDIENCE_INVALID`, `GOOGLE_EMAIL_NOT_VERIFIED`, and `GOOGLE_ACCOUNT_LINK_REQUIRED`.
