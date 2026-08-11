import 'package:app_app/core/errors/api_exception.dart';
import 'package:app_app/core/repositories/auth_api_repository.dart';
import 'package:app_app/core/storage/token_storage.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
    'posts the Google ID token and persists the normal token pair',
    () async {
      late RequestOptions request;
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            request = options;
            handler.resolve(
              Response<Map<String, dynamic>>(
                requestOptions: options,
                statusCode: 201,
                data: {
                  'user': {
                    'id': 'user-1',
                    'name': 'Google Student',
                    'username': 'google.student',
                    'email': 'student@example.com',
                    'companion': 'MALE',
                  },
                  'tokens': {
                    'accessToken': 'access-token',
                    'refreshToken': 'refresh-token',
                    'accessTokenExpiresIn': '15m',
                  },
                  'isNewUser': true,
                },
              ),
            );
          },
        ),
      );
      final storage = _MemoryTokenStorage();

      final session = await AuthApiRepository(
        dio,
        storage,
      ).loginWithGoogle('google-id-token');

      expect(request.path, '/auth/google');
      expect(request.method, 'POST');
      expect(request.data, {'idToken': 'google-id-token'});
      expect(storage.tokens?.accessToken, 'access-token');
      expect(storage.tokens?.refreshToken, 'refresh-token');
      expect(session.user.email, 'student@example.com');
      expect(session.isNewUser, isTrue);
    },
  );

  test('preserves the backend account-link error code', () async {
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          handler.reject(
            DioException.badResponse(
              statusCode: 409,
              requestOptions: options,
              response: Response<Map<String, dynamic>>(
                requestOptions: options,
                statusCode: 409,
                data: {'code': 'GOOGLE_ACCOUNT_LINK_REQUIRED'},
              ),
            ),
          );
        },
      ),
    );

    expect(
      () => AuthApiRepository(
        dio,
        _MemoryTokenStorage(),
      ).loginWithGoogle('google-id-token'),
      throwsA(
        isA<Conflict>().having(
          (error) => error.backendCode,
          'backendCode',
          'GOOGLE_ACCOUNT_LINK_REQUIRED',
        ),
      ),
    );
  });
  test('preserves the backend invalid Google token error code', () async {
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          handler.reject(
            DioException.badResponse(
              statusCode: 401,
              requestOptions: options,
              response: Response<Map<String, dynamic>>(
                requestOptions: options,
                statusCode: 401,
                data: {'code': 'GOOGLE_TOKEN_INVALID'},
              ),
            ),
          );
        },
      ),
    );

    expect(
      () => AuthApiRepository(
        dio,
        _MemoryTokenStorage(),
      ).loginWithGoogle('invalid-token'),
      throwsA(
        isA<Unauthorized>().having(
          (error) => error.backendCode,
          'backendCode',
          'GOOGLE_TOKEN_INVALID',
        ),
      ),
    );
  });
}

final class _MemoryTokenStorage implements TokenStorage {
  TokenPair? tokens;

  @override
  Future<void> clear() async => tokens = null;

  @override
  Future<String?> readAccessToken() async => tokens?.accessToken;

  @override
  Future<String?> readRefreshToken() async => tokens?.refreshToken;

  @override
  Future<void> write(TokenPair tokens) async => this.tokens = tokens;
}
