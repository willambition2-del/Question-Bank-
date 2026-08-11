# Notifications + FCM Hardening Audit

Date: 2026-07-19
Status: COMPLETE_FOR_SELECTED_PHASE

## Baseline and defects

The existing Notification table and owner-scoped list/read/delete API were retained. The baseline had only broad event categories, no push target persistence, no deduplication, no delivery metadata, a POST-only read contract, and only an unused push-provider interface.

## Implemented hardening

- Added explicit database notification types for daily reminders, weak-subject alerts, achievement unlocks, challenge invitations and challenge results.
- Added deterministic dedupe keys for repeatable event producers so concurrent daily/event delivery creates one database record.
- Added owner-bound Android/iOS/Web push targets with target uniqueness, reactivation, last-use tracking and soft unregistration. API responses never return the FCM target.
- Added `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`, existing owner-scoped GET/count/DELETE behavior, and backward-compatible POST read aliases.
- Separated `NotificationsService` from the `PushNotificationProvider` contract. Database persistence is authoritative; push failures are contained, attempts are recorded and invalid targets are disabled.
- Implemented `FcmPushNotificationProvider` with Firebase Admin SDK 14.2.0, Application Default Credentials, explicit `FCM_ENABLED` gating, `FIREBASE_PROJECT_ID`, 500-target batching and invalid-registration handling.
- Added event helpers for all five required notification families. Challenge invites, challenge results and achievements now use their explicit event types.

## Migration

Added `20260719030000_notifications_hardening`. It safely appends notification enum values, creates `PushDevicePlatform` and `PushDevice`, and adds notification dedupe/delivery columns plus indexes and the cascading user foreign key. No prior migration was edited. The reviewed SQL matches Prisma's schema diff.

## Verification

- Format, lint and build: pass.
- Unit: 24 suites / 122 tests, all pass, including owner isolation, event dedupe, secret-safe device registration and disabled-provider credential safety.
- PostgreSQL E2E: 13 suites / 63 tests, all pass; the focused notification suite contributes 3 tests.
- Real HTTP/DB coverage proves five event types, concurrent reminder dedupe, device target secrecy/persistence, PATCH read/read-all, unread count, DELETE and cross-user rejection.
- All 17 migrations are applied to development and isolated test databases.

## Operational configuration

Set `FCM_ENABLED=true`, `FIREBASE_PROJECT_ID`, and Application Default Credentials through `GOOGLE_APPLICATION_CREDENTIALS` (or the runtime identity). The implementation follows the official Firebase Admin server flow: https://firebase.google.com/docs/cloud-messaging/send/admin-sdk

## Remaining honest limits

- The API records send attempts and disables definitively invalid targets; guaranteed retry scheduling requires the background job infrastructure introduced in the production phase.
- Live FCM delivery requires project credentials and is intentionally not exercised in local CI. Provider boundaries are unit-tested without secrets or network access.