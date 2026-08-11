import 'package:dio/dio.dart';

import '../errors/api_exception.dart';
import '../errors/api_error_mapper.dart';

Never throwApiError(DioException error) {
  final mapped = error.error;
  if (mapped is ApiException) throw mapped;
  throw mapDioError(error);
}
