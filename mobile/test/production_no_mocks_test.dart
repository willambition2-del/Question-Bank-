import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('production Dart sources contain no mock or simulated data sources', () {
    final violations = <String>[];
    final banned = RegExp(
      r'\b(Mock|Fake|Demo)[A-Z]\w*|mock_database|mock_repositories|Future\.delayed\s*\(|\bsimulat(?:e|ed|ion)\b',
      caseSensitive: false,
    );
    for (final entity in Directory('lib').listSync(recursive: true)) {
      if (entity is! File || !entity.path.endsWith('.dart')) continue;
      final match = banned.firstMatch(entity.readAsStringSync());
      if (match != null) violations.add('${entity.path}: ${match.group(0)}');
    }
    expect(
      violations,
      isEmpty,
      reason:
          'Production sources must use real API data sources:\n${violations.join('\n')}',
    );
  });
}
