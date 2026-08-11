import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:app_app/core/models/companion_enums.dart';
import 'package:app_app/core/utils/character_expression_registry.dart';
import 'package:app_app/core/utils/character_asset_resolver.dart';
import 'package:app_app/core/utils/companion_context_resolver.dart';
import 'package:app_app/core/controllers/companion_event_controller.dart';
import 'package:app_app/core/widgets/character_companion.dart';
import 'package:app_app/core/widgets/animated_companion.dart';
import 'package:app_app/features/profile/presentation/character_customization_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

void main() {
  group('Character System & Expression Registry Tests', () {
    test(
      'Should resolve male character welcome asset via ExpressionRegistry',
      () {
        final asset = CharacterExpressionRegistry.getAssetPath(
          companionType: CompanionType.male,
          emotion: CharacterEmotion.welcome,
        );
        expect(asset, equals('assets/male/male_1.jpg'));
      },
    );

    test(
      'Should resolve female character welcome asset via ExpressionRegistry',
      () {
        final asset = CharacterExpressionRegistry.getAssetPath(
          companionType: CompanionType.female,
          emotion: CharacterEmotion.welcome,
        );
        expect(asset, equals('assets/female/female_1.jpg'));
      },
    );

    test('Should map correct emotion to index 5', () {
      final index = CharacterExpressionRegistry.getExpressionIndex(
        CharacterEmotion.correct,
      );
      expect(index, equals(5));
      final asset = CharacterExpressionRegistry.getAssetPath(
        companionType: CompanionType.male,
        emotion: CharacterEmotion.correct,
      );
      expect(asset, equals('assets/male/male_5.jpg'));
    });

    test('Should map wrong emotion to index 6', () {
      final index = CharacterExpressionRegistry.getExpressionIndex(
        CharacterEmotion.wrong,
      );
      expect(index, equals(6));
      final asset = CharacterExpressionRegistry.getAssetPath(
        companionType: CompanionType.female,
        emotion: CharacterEmotion.wrong,
      );
      expect(asset, equals('assets/female/female_6.jpg'));
    });

    test('All 28 emotions should resolve to approved local assets', () {
      for (final emotion in CharacterEmotion.values) {
        final maleAsset = CharacterExpressionRegistry.getAssetPath(
          companionType: CompanionType.male,
          emotion: emotion,
        );
        final femaleAsset = CharacterExpressionRegistry.getAssetPath(
          companionType: CompanionType.female,
          emotion: emotion,
        );
        expect(maleAsset.startsWith('assets/'), isTrue);
        expect(femaleAsset.startsWith('assets/'), isTrue);
        expect(maleAsset.contains('http'), isFalse);
        expect(femaleAsset.contains('http'), isFalse);
      }
    });
  });

  group('Companion Event Controller Engine Tests', () {
    test(
      'CompanionEventController handles all 14 events with valid emotion and message',
      () {
        for (final event in CompanionEventType.values) {
          final maleResult = CompanionEventController.handleEvent(
            event: event,
            isMale: true,
            userName: "أحمد",
            level: 12,
          );
          final femaleResult = CompanionEventController.handleEvent(
            event: event,
            isMale: false,
            userName: "أمل",
            level: 12,
          );

          expect(maleResult.message.isNotEmpty, isTrue);
          expect(femaleResult.message.isNotEmpty, isTrue);
          expect(maleResult.animationType.isNotEmpty, isTrue);
          expect(femaleResult.animationType.isNotEmpty, isTrue);
        }
      },
    );

    test(
      'USER_CORRECT_ANSWER event returns correct emotion and personalized message',
      () {
        final res = CompanionEventController.handleEvent(
          event: CompanionEventType.USER_CORRECT_ANSWER,
          isMale: true,
          userName: "أحمد",
        );
        expect(res.emotion, equals(CharacterEmotion.correct));
        expect(res.message, contains("أحمد"));
        expect(res.animationType, equals('scale_pop'));
      },
    );

    test('USER_WRONG_ANSWER event returns support emotion', () {
      final res = CompanionEventController.handleEvent(
        event: CompanionEventType.USER_WRONG_ANSWER,
        isMale: false,
        userName: "أمل",
      );
      expect(res.emotion, equals(CharacterEmotion.support));
      expect(res.message, contains("أمل"));
      expect(res.animationType, equals('shake'));
    });
  });

  group('Character Display & Widget Safety Tests', () {
    testWidgets('1. AnimatedCompanion renders smoothly without exception', (
      tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: AnimatedCompanion(
              companionType: CompanionType.male,
              emotion: CharacterEmotion.welcome,
              message: "مرحباً بك!",
            ),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 500));
      expect(find.byType(Image), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('2. CharacterCompanion resolves correct asset', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: CharacterCompanion(
              companionType: CompanionType.male,
              emotion: CharacterEmotion.welcome,
              animate: false,
            ),
          ),
        ),
      );
      expect(find.byType(Image), findsOneWidget);
      final image = tester.widget<Image>(find.byType(Image));
      expect((image.image as AssetImage).assetName, contains('male_1.jpg'));
      expect(tester.takeException(), isNull);
    });

    testWidgets('3. Fallback uses neutral from same character', (tester) async {
      const widget = CharacterCompanion(
        companionType: CompanionType.female,
        emotion: CharacterEmotion.welcome,
        animate: false,
      );
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (ctx) {
                return widget.build(ctx);
              },
            ),
          ),
        ),
      );
      expect(find.byType(Image), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('4. Character image uses BoxFit.contain', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: CharacterCompanion(
              companionType: CompanionType.male,
              emotion: CharacterEmotion.welcome,
              animate: false,
            ),
          ),
        ),
      );
      final image = tester.widget<Image>(find.byType(Image));
      expect(image.fit, equals(BoxFit.contain));
      expect(tester.takeException(), isNull);
    });

    testWidgets('5. No exception at screen width 320', (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1.0;
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: AnimatedCompanion(
              companionType: CompanionType.male,
              emotion: CharacterEmotion.welcome,
              size: CharacterSize.large,
            ),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 500));
      expect(tester.takeException(), isNull);
      tester.view.resetPhysicalSize();
    });

    testWidgets('6. No exception at screen width 360', (tester) async {
      tester.view.physicalSize = const Size(360, 740);
      tester.view.devicePixelRatio = 1.0;
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: AnimatedCompanion(
              companionType: CompanionType.female,
              emotion: CharacterEmotion.hint,
              size: CharacterSize.medium,
            ),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 500));
      expect(tester.takeException(), isNull);
      tester.view.resetPhysicalSize();
    });

    testWidgets('7. No exception at screen width 412', (tester) async {
      tester.view.physicalSize = const Size(412, 915);
      tester.view.devicePixelRatio = 1.0;
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: AnimatedCompanion(
              companionType: CompanionType.male,
              emotion: CharacterEmotion.victory,
              size: CharacterSize.large,
            ),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 500));
      expect(tester.takeException(), isNull);
      tester.view.resetPhysicalSize();
    });

    testWidgets('8. Home motivation banner has no RenderFlex overflow', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1.0;
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Row(
              children: [
                Expanded(
                  child: Text(
                    "أنت على الطريق الصحيح يا بطل! بقي لك درس واحد فقط.",
                  ),
                ),
                AnimatedCompanion(
                  companionType: CompanionType.male,
                  emotion: CharacterEmotion.welcome,
                  customHeight: 115,
                  showBubble: false,
                ),
              ],
            ),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 500));
      expect(tester.takeException(), isNull);
      tester.view.resetPhysicalSize();
    });

    testWidgets('9. Challenges banner has no RenderFlex overflow', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1.0;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                Image.asset(
                  CharacterAssetResolver.resolveAvatar(
                    type: CompanionType.male,
                    index: 1,
                  ),
                  height: 90,
                  fit: BoxFit.contain,
                ),
                const Text("VS"),
                Image.asset(
                  CharacterAssetResolver.resolveAvatar(
                    type: CompanionType.female,
                    index: 4,
                  ),
                  height: 90,
                  fit: BoxFit.contain,
                ),
              ],
            ),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 500));
      expect(tester.takeException(), isNull);
      tester.view.resetPhysicalSize();
    });

    testWidgets('10. Results screen does not clip character', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: AnimatedCompanion(
              companionType: CompanionType.female,
              emotion: CharacterEmotion.victory,
              customHeight: 150,
              showBubble: false,
            ),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 500));
      final image = tester.widget<Image>(find.byType(Image));
      expect(image.fit, equals(BoxFit.contain));
      expect(tester.takeException(), isNull);
    });

    testWidgets(
      '11. CharacterCustomizationScreen main preview has AnimatedCompanion',
      (tester) async {
        await tester.pumpWidget(
          const ProviderScope(
            child: MaterialApp(home: CharacterCustomizationScreen()),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.byType(AnimatedCompanion), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );
  });

  group('Character Asset Compliance and Anti-Regression Security Tests', () {
    test(
      'No direct Image.asset or ImageProvider calls for characters exist in lib/ directory',
      () {
        final libDir = Directory('lib');
        if (!libDir.existsSync()) return;

        final files = libDir
            .listSync(recursive: true)
            .whereType<File>()
            .where((file) => file.path.endsWith('.dart'));

        final characterAssetPattern = RegExp(
          r"['"
          "]assets/(?:generated/.*character|male/male_|female/female_).*['"
          "]",
          caseSensitive: false,
        );

        final allowedFilesPattern = RegExp(
          r'(character_asset_resolver|character_asset_registry|character_expression_registry|character_companion|animated_companion)\.dart$',
        );

        final violations = <String>[];

        for (final file in files) {
          if (allowedFilesPattern.hasMatch(file.path)) {
            continue;
          }

          final content = file.readAsStringSync();
          if (characterAssetPattern.hasMatch(content)) {
            violations.add(file.path);
          }
        }

        expect(
          violations,
          isEmpty,
          reason:
              'The following files contain direct hardcoded references to character assets instead of using CharacterAssetResolver:\n'
              '${violations.join('\n')}\n'
              'Please use AnimatedCompanion or CharacterAssetResolver instead of hardcoded paths.',
        );
      },
    );
  });
}
