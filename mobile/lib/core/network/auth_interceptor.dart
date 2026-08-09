import 'package:dio/dio.dart';

import '../storage/token_storage.dart';

final class AuthInterceptor extends Interceptor {
  final Dio _refreshClient;
  final TokenStorage _storage;
  final Future<void> Function()? _onSessionExpired;
  final Future<void> Function()? _onTokensRefreshed;
  Future<String?>? _refreshInFlight;

  AuthInterceptor({
    required Dio refreshClient,
    required TokenStorage storage,
    Future<void> Function()? onSessionExpired,
    Future<void> Function()? onTokensRefreshed,
  }) : _refreshClient = refreshClient,
       _storage = storage,
       _onSessionExpired = onSessionExpired,
       _onTokensRefreshed = onTokensRefreshed;

  static const _retriedKey = 'auth.retried';

  @override
  void onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    if (!_isPublicAuthEndpoint(options.path)) {
      final token = await _storage.readAccessToken();
      if (token != null && token.isNotEmpty) {
        options.headers['Authorization'] = 'Bearer $token';
      }
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    final request = err.requestOptions;
    if (err.response?.statusCode != 401 ||
        _isPublicAuthEndpoint(request.path) ||
        request.extra[_retriedKey] == true) {
      handler.next(err);
      return;
    }

    final accessToken = await _refreshSingleFlight();
    if (accessToken == null) {
      await _storage.clear();
      await _onSessionExpired?.call();
      handler.next(err);
      return;
    }

    try {
      request.extra[_retriedKey] = true;
      request.headers['Authorization'] = 'Bearer $accessToken';
      handler.resolve(await _refreshClient.fetch<dynamic>(request));
    } on DioException catch (retryError) {
      handler.next(retryError);
    }
  }

  bool _isPublicAuthEndpoint(String path) =>
      path.endsWith('/auth/login') ||
      path.endsWith('/auth/register') ||
      path.endsWith('/auth/refresh');

  Future<String?> _refreshSingleFlight() {
    final existing = _refreshInFlight;
    if (existing != null) return existing;
    final future = _refresh();
    _refreshInFlight = future;
    return future.whenComplete(() => _refreshInFlight = null);
  }

  Future<String?> _refresh() async {
    final refreshToken = await _storage.readRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) return null;
    try {
      final response = await _refreshClient.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
      );
      final tokens = response.data?['tokens'];
      if (tokens is! Map) return null;
      final normalized = Map<String, dynamic>.from(tokens);
      final access = normalized['accessToken']?.toString();
      final refresh = normalized['refreshToken']?.toString();
      if (access == null || refresh == null) return null;
      await _storage.write(
        TokenPair(
          accessToken: access,
          refreshToken: refresh,
          accessTokenExpiresIn: normalized['accessTokenExpiresIn']?.toString(),
        ),
      );
      await _onTokensRefreshed?.call();
      return access;
    } on DioException {
      return null;
    }
  }
}
