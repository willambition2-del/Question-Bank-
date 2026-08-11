import 'dart:math';

import 'package:dio/dio.dart';

import '../config/api_config.dart';
import '../errors/api_error_mapper.dart';
import '../storage/token_storage.dart';
import 'auth_interceptor.dart';

final class DioClient {
  final Dio dio;

  DioClient({
    required TokenStorage tokenStorage,
    Future<void> Function()? onSessionExpired,
    Future<void> Function()? onTokensRefreshed,
  }) : dio = Dio(_options()) {
    final refreshClient = Dio(_options());
    dio.interceptors.addAll([
      _RequestIdInterceptor(),
      AuthInterceptor(
        refreshClient: refreshClient,
        storage: tokenStorage,
        onSessionExpired: onSessionExpired,
        onTokensRefreshed: onTokensRefreshed,
      ),
      _SafeLogInterceptor(),
      _ErrorMappingInterceptor(),
    ]);
  }

  static BaseOptions _options() => BaseOptions(
    baseUrl: ApiConfig.baseUrl,
    connectTimeout: const Duration(seconds: 15),
    sendTimeout: const Duration(seconds: 20),
    receiveTimeout: const Duration(seconds: 20),
    headers: const {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': 'ar',
    },
    validateStatus: (status) => status != null && status >= 200 && status < 300,
  );
}

final class _RequestIdInterceptor extends Interceptor {
  final Random _random = Random.secure();

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    options.headers['x-request-id'] =
        '${DateTime.now().microsecondsSinceEpoch.toRadixString(36)}-${_random.nextInt(1 << 32).toRadixString(36)}';
    handler.next(options);
  }
}

final class _SafeLogInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    assert(() {
      // Authentication bodies and all headers are deliberately excluded.
      // ignore: avoid_print
      print('[API] ${options.method} ${options.uri.path}');
      return true;
    }());
    handler.next(options);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    assert(() {
      // ignore: avoid_print
      print('[API] ${response.statusCode} ${response.requestOptions.uri.path}');
      return true;
    }());
    handler.next(response);
  }
}

final class _ErrorMappingInterceptor extends Interceptor {
  @override
  void onError(DioException error, ErrorInterceptorHandler handler) {
    handler.next(error.copyWith(error: mapDioError(error)));
  }
}
