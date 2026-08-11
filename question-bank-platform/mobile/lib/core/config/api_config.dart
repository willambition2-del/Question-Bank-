import 'package:flutter/foundation.dart';

final class ApiConfig {
  ApiConfig._();

  static const String _configuredBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
  );

  static Uri get baseUri {
    final raw = _configuredBaseUrl.trim();
    if (raw.isEmpty) {
      if (kReleaseMode) {
        throw StateError(
          'API_BASE_URL is required in release builds. Pass it with --dart-define.',
        );
      }
      return Uri.parse('http://10.0.2.2:3000/api/v1');
    }

    final uri = Uri.tryParse(raw);
    if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
      throw StateError('API_BASE_URL must be an absolute HTTP(S) URL.');
    }
    if (kReleaseMode && uri.scheme != 'https') {
      throw StateError('API_BASE_URL must use HTTPS in release builds.');
    }
    if (!uri.path.endsWith('/api/v1')) {
      throw StateError('API_BASE_URL must include the /api/v1 prefix.');
    }
    return uri;
  }

  static String get baseUrl =>
      baseUri.toString().replaceFirst(RegExp(r'/$'), '');
}
