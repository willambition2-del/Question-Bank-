class TokenPair {
  final String accessToken;
  final String refreshToken;
  final String? accessTokenExpiresIn;

  const TokenPair({
    required this.accessToken,
    required this.refreshToken,
    this.accessTokenExpiresIn,
  });
}

abstract interface class TokenStorage {
  Future<String?> readAccessToken();
  Future<String?> readRefreshToken();
  Future<void> write(TokenPair tokens);
  Future<void> clear();
}
