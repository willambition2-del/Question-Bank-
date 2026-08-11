import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:app_app/main.dart';

void main() {
  testWidgets('App initialization and splash smoke test', (
    WidgetTester tester,
  ) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const ProviderScope(child: QuestionBankApp()));

    // Initial pump
    await tester.pump();

    // Pump individual frames to advance time beyond the splash delay,
    // avoiding pumpAndSettle which hangs on infinite animation loops.
    for (int i = 0; i < 5; i++) {
      await tester.pump(const Duration(seconds: 1));
    }

    // Verify that the MaterialApp is constructed
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
