# Google Sign-In Setup

The app uses Google Sign-In only to obtain a Google ID token. It sends that token to `POST /api/v1/auth/google`; the NestJS backend verifies it and issues the application's normal access and refresh tokens. Firebase Authentication is not used.

## Shared Google Cloud configuration

1. Configure the OAuth consent screen in Google Cloud Console.
2. Create a **Web application** OAuth client. Use the same client ID for backend `GOOGLE_CLIENT_ID` and Flutter `GOOGLE_SERVER_CLIENT_ID`.
3. Never put the client secret in Flutter or commit it.
4. Enable the backend with `GOOGLE_AUTH_ENABLED=true`.

```shell
flutter run ^
  --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1 ^
  --dart-define=GOOGLE_SERVER_CLIENT_ID=YOUR_WEB_CLIENT_ID
```

## Android

Current application ID: `com.example.app_app`.

Create an **Android** OAuth client for that package and register SHA-1 and SHA-256 for every signing certificate. Obtain debug fingerprints with:

```shell
keytool -list -v -alias androiddebugkey ^
  -keystore "%USERPROFILE%\.android\debug.keystore" ^
  -storepass android -keypass android
```

Detected local debug certificate fingerprints:

- SHA-1: `E8:44:63:DC:1F:60:DF:4B:18:90:24:A1:DD:3E:72:4E:85:3E:E4:5E`
- SHA-256: `5A:D9:05:9A:B2:4E:9C:C0:16:EF:9D:81:7A:2A:57:4A:42:15:13:9F:90:17:5B:A9:F3:33:AE:CF:A3:20:3D:CF`

For release, run the same command against the production keystore and alias. Do not commit the keystore, passwords, or `key.properties`. The current project still uses debug signing for release and must receive deployment-owned production signing before publishing.

No Google secret or ID is required in `AndroidManifest.xml`. OAuth matching uses package plus certificate fingerprints; the Web client ID is supplied through `--dart-define`.

## iOS

Current bundle identifier: `com.example.appApp`.

1. Create an **iOS** OAuth client for this bundle identifier.
2. Add `GIDClientID` to `ios/Runner/Info.plist` using the iOS client ID.
3. Add the reversed client ID as a `CFBundleURLSchemes` entry.
4. Keep `GOOGLE_SERVER_CLIENT_ID` set to the Web client ID used by the backend audience.

Example deployment-owned entries:

```xml
<key>GIDClientID</key>
<string>IOS_CLIENT_ID.apps.googleusercontent.com</string>
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.googleusercontent.apps.IOS_CLIENT_ID</string>
    </array>
  </dict>
</array>
```

Replace placeholders during deployment. They are intentionally not committed to the application plist.

## Backend environment

```dotenv
GOOGLE_AUTH_ENABLED=true
GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID
```

Disabled Google authentication returns `SOCIAL_PROVIDER_DISABLED`. A verified Google email already owned by another account returns `GOOGLE_ACCOUNT_LINK_REQUIRED`; accounts are never silently linked.
