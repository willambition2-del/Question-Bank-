# Google Authentication Audit

Date: 2026-07-26

## Starting state

- Flutter path: `D:\three\app_app`, branch `flutter-production-api-integration` at `f351afd`.
- Backend path: `D:\three\question-bank-api`, contract commit `9734ec8`.
- LoginScreen had no Google button; no decorative Google action existed.
- `google_sign_in` was not installed.
- `User` had no email field and `passwordHash` was required.
- Existing authentication issues application access/refresh JWTs through `AuthService`, hashes the refresh token, and stores it with `tokenVersion`-based invalidation.
- `CompanionType` is required in Prisma but has the official `MALE` default. Google-created users use that deterministic default and are routed to onboarding so they can choose.
- Existing registration currently routes directly to Home; Google first login will use an explicit `isNewUser` response flag and route to onboarding.
- Android application ID: `com.example.app_app`.
- iOS bundle identifier is supplied by `PRODUCT_BUNDLE_IDENTIFIER`; the current Xcode project default is documented in setup.

## Security decision

Google identity is stored in a dedicated `UserIdentity` model. Google tokens and authorization codes are never persisted. A verified Google email colliding with an existing password account returns `GOOGLE_ACCOUNT_LINK_REQUIRED`; accounts are not silently linked.