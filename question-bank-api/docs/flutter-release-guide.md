# Flutter release guide

Set the release API base URL through the existing compile-time configuration;
do not add provider keys, backend secrets or mock mode. Camera and photo-library
descriptions are present and `image_picker` uploads normalized user-selected
bytes only to the backend multipart endpoint.

Run `flutter analyze`, the full test suite, then:

```text
flutter build apk --release
flutter build appbundle --release
```

Configure Android signing through local/CI secret files excluded from Git.
Review network security, token redaction, offline/error states and image size
limits. Test RTL at 320/360/390/412 logical pixels on devices before store
submission.
