# Flutter Environment Setup

The API base URL is supplied at build/run time and must include `/api/v1`.

```shell
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1
```

For a physical Android device use the development computer's reachable LAN address. For production use the deployed HTTPS origin. Release builds fail fast when `API_BASE_URL` is absent, malformed, or not HTTPS. Android emulators must use `10.0.2.2`, not `localhost`.

Never place credentials, access tokens, refresh tokens, or sensitive query parameters in the URL.
