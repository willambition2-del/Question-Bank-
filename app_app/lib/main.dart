import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app/theme/app_theme.dart';
import 'app/router/app_router.dart';
import 'features/auth/providers/auth_provider.dart';
import 'features/notifications/providers/notifications_provider.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: QuestionBankApp()));
}

class QuestionBankApp extends ConsumerWidget {
  const QuestionBankApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(authProvider);
    ref.watch(notificationCoordinatorProvider);
    ref.listen(notificationRouteProvider, (_, next) {
      next.whenData(appRouter.go);
    });
    return MaterialApp.router(
      title: 'بنك الأسئلة للثالث الثانوي',
      debugShowCheckedModeBanner: false,

      // Theme settings
      theme: AppTheme.lightTheme,

      // Routing settings
      routerConfig: appRouter,

      // RTL Localization settings
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('ar', '')],
      locale: const Locale('ar', ''),
    );
  }
}
