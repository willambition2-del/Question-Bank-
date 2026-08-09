import 'package:dio/dio.dart';

import 'api_exception.dart';

ApiException mapDioError(DioException error) {
  if (error.type == DioExceptionType.connectionTimeout ||
      error.type == DioExceptionType.sendTimeout ||
      error.type == DioExceptionType.receiveTimeout) {
    return const RequestTimeout();
  }
  if (error.type == DioExceptionType.connectionError) {
    return const NetworkUnavailable();
  }

  final status = error.response?.statusCode;
  final body = error.response?.data;
  final code = body is Map
      ? (body['code'] ?? body['errorCode'])?.toString()
      : null;
  if (status != null && status >= 500) {
    return ServerFailure(code: code, statusCode: status);
  }
  return switch (status) {
    400 || 422 => ValidationFailure(code: code),
    401 => Unauthorized(code: code),
    403 => Forbidden(code: code),
    404 => NotFound(code: code),
    409 => Conflict(code: code),
    429 => RateLimited(code: code),
    _ => UnknownFailure(code: code, statusCode: status),
  };
}
