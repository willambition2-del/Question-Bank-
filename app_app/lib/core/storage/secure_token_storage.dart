import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'token_storage.dart';

final class SecureTokenStorage implements TokenStorage {
  static const _accessTokenKey = 'session.access_token';
  static const _refreshTokenKey = 'session.refresh_token';
  static const _accessExpiryKey = 'session.access_expires_in';

  final FlutterSecureStorage _storage;

  SecureTokenStorage({FlutterSecureStorage? storage})
    : _storage = storage ?? const FlutterSecureStorage();

  @override
  Future<String?> readAccessToken() => _storage.read(key: _accessTokenKey);

  @override
  Future<String?> readRefreshToken() => _storage.read(key: _refreshTokenKey);

  @override
  Future<void> write(TokenPair tokens) async {
    await _storage.write(key: _accessTokenKey, value: tokens.accessToken);
    await _storage.write(key: _refreshTokenKey, value: tokens.refreshToken);
    if (tokens.accessTokenExpiresIn case final expiry?) {
      await _storage.write(key: _accessExpiryKey, value: expiry);
    } else {
      await _storage.delete(key: _accessExpiryKey);
    }
  }

  @override
  Future<void> clear() async {
    await Future.wait([
      _storage.delete(key: _accessTokenKey),
      _storage.delete(key: _refreshTokenKey),
      _storage.delete(key: _accessExpiryKey),
    ]);
  }
}
