# Frontend Production Verification

Date: 2026-07-26

- Flutter path: `D:\three\app_app`
- Backend path: `D:\three\question-bank-api`
- Flutter branch: `flutter-production-api-integration`
- Backend contract commit: `9734ec8`
- Base URL: supplied with `--dart-define=API_BASE_URL=.../api/v1`; HTTPS is mandatory in release.
- `flutter analyze`: no errors (existing warnings/info remain).
- `flutter test`: 102/102 passed.
- Backend `npm run build`: passed.
- Backend `npm run test:ci`: 144/144 passed; e2e: 63/63 passed.
- Integration test: source compiles under analyzer; live API flow is skipped without isolated test credentials. Windows device build is blocked on this machine because CMake requests Visual Studio 16 2019, which is not installed.
- Native FCM delivery: blocked until Firebase deployment files are provided. REST inbox and device APIs are connected.
- Updates: `NOT_USED_BY_CURRENT_UI`; no update screen exists.
- Production mocks: removed; the anti-regression test passes.

Runtime commands:

```shell
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1
flutter test integration_test -d <device> --dart-define=API_TEST_USERNAME=<test-user> --dart-define=API_TEST_PASSWORD=<test-password>
```
## Google Sign-In addendum

- Flutter branch: `flutter-google-sign-in`
- Backend branch: `google-auth-integration`
- Setup: `docs/google-sign-in-setup.md`
- Production/device checklist: `docs/google-auth-production-verification.md`
- Google supplies an ID token only; the backend verifies it and returns the existing application JWT session.
- Native verification remains deployment-blocked until Android/iOS OAuth clients and production signing values are supplied.
