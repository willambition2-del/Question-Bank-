# Google Authentication Production Verification

Date: 2026-07-26

## Automated gates

- Backend: Prisma validation/generation, migration status/deploy, lint, build, unit tests and e2e tests.
- Flutter: dependency resolution, formatting, analyzer, unit/widget tests and build validation where a configured target is available.
- Flutter sends only `{ "idToken": "..." }` to `/auth/google`.
- Access/refresh tokens use the existing secure storage and refresh interceptor.

## Native pre-release checklist

- [ ] OAuth consent screen is production-ready.
- [ ] Android OAuth client matches `com.example.app_app`.
- [ ] Debug, CI and production SHA-1/SHA-256 fingerprints are registered.
- [ ] Android release uses production signing, not debug signing.
- [ ] iOS OAuth client matches `com.example.appApp`.
- [ ] iOS `GIDClientID` and reversed-client-ID URL scheme are injected.
- [ ] Backend `GOOGLE_CLIENT_ID` exactly matches Flutter `GOOGLE_SERVER_CLIENT_ID` (the Web OAuth client ID).
- [ ] `GOOGLE_AUTH_ENABLED=true` is set only where intended.
- [ ] No OAuth secret, keystore, signing password, or real token is committed.

## Device scenarios

1. Cancel the chooser: remain on login without an error.
2. First login: create one user and identity, then open onboarding.
3. Repeat login: create no duplicate, then open home.
4. Password-account email collision: show safe link-required guidance.
5. Expired/invalid token: store no application session.
6. Logout: clear backend refresh session, secure tokens and Google SDK state.
7. Narrow phone and tablet: RTL layout has no clipping or overflow.

Run these scenarios on physical Android and iOS devices. Native execution requires deployment-owned OAuth clients and signing credentials; automated tests use fakes and contain no real Google tokens.

## Verification result (2026-07-27)

- Prisma development and test databases: 18/18 migrations applied; no pending migration; migration diff reports no drift.
- Backend: format, lint and build passed; 144 unit tests and 63 e2e tests passed.
- Flutter formatting passed; 102 tests passed.
- Flutter analyzer: no errors in Google Auth files and no new warnings there. The repository still reports 52 pre-existing warnings/info outside the new files.
- Android debug APK: compiled successfully with a placeholder Web client ID after Gradle retried a transient dependency-download failure.
- Live Android Google Sign-In: `EXTERNAL_CONFIGURATION_BLOCKED`; no Android device is connected and no real Web/Android OAuth client is configured locally.
- Backend local `GOOGLE_CLIENT_ID`: absent; `GOOGLE_AUTH_ENABLED`: absent/disabled.
- Android package: `com.example.app_app`.
- Production release certificate fingerprints: pending the deployment-owned signing key. The current release block incorrectly uses debug signing and must not be published as-is.
