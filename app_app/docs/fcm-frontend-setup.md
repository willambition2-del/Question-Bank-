# FCM frontend setup

The Flutter integration is complete at code level with `firebase_core` and `firebase_messaging`. REST notifications continue to work even when native Firebase configuration is unavailable.

## Deployment configuration still required

This repository does not contain Firebase project credentials, so push delivery cannot be verified locally yet:

- Android: add the project-specific `android/app/google-services.json` and configure the Google Services Gradle plugin using the values generated for the real Firebase project.
- iOS: add the project-specific `ios/Runner/GoogleService-Info.plist`, enable Push Notifications and Background Modes > Remote notifications, and upload the APNs key/certificate in Firebase.
- Web (if shipped): provide Firebase web options. Do not reuse Android/iOS credentials.

These files contain environment-specific identifiers and must come from the project owner; fabricated values are intentionally not committed.

## Runtime flow

1. After an authenticated session, Firebase initializes and notification permission is requested.
2. The FCM target is registered with `POST /notifications/devices` using backend enum `ANDROID`, `IOS`, or `WEB`.
3. `onTokenRefresh` registers the new target. If the backend returns a different device row, the previous row is removed.
4. Foreground messages refresh the REST inbox/unread count. Notification taps accept only allow-listed in-app routes.
5. Logout calls `DELETE /notifications/devices/:id` before auth tokens are cleared.
6. Initialization failures caused by missing deployment configuration do not break the REST inbox.

## Verification

After adding the native files, verify on physical Android and iOS devices: permission prompt, backend device row, foreground refresh, background notification delivery, terminated-app tap route, token rotation, and device removal on logout.