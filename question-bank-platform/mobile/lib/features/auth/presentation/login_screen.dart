import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app/theme/design_tokens.dart';
import '../../../core/models/companion_enums.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/character_companion.dart';
import '../providers/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _rememberMe = true;
  bool _isLoading = false;
  bool _isGoogleLoading = false;

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _handleLogin() async {
    if (_isLoading || _isGoogleLoading) return;
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
    });

    final success = await ref
        .read(authProvider.notifier)
        .login(_usernameController.text, _passwordController.text);

    setState(() {
      _isLoading = false;
    });

    if (mounted) {
      if (success) {
        context.go('/home');
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              "اسم المستخدم أو كلمة المرور خاطئة. جرب كلمة مرور مكونة من 6 أحرف على الأقل.",
            ),
            backgroundColor: AppColors.errorCoral,
          ),
        );
      }
    }
  }

  void _handleGoogleLogin() async {
    if (_isLoading || _isGoogleLoading) return;
    setState(() => _isGoogleLoading = true);
    final outcome = await ref.read(authProvider.notifier).loginWithGoogle();
    if (!mounted) return;
    setState(() => _isGoogleLoading = false);

    if (outcome.cancelled) return;
    if (outcome.succeeded) {
      context.go(outcome.isNewUser ? '/onboarding' : '/home');
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          outcome.message ??
              'تعذر تسجيل الدخول باستخدام Google. حاول مرة أخرى.',
        ),
        backgroundColor: AppColors.errorCoral,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final student = ref.watch(authProvider);
    final companion = student?.selectedCompanionType ?? CompanionType.male;

    return AppScaffold(
      body: Center(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const SizedBox(height: AppSpacing.md),
                  // Character Greeting
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.xs),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                      boxShadow: const [AppShadows.soft],
                    ),
                    child: CharacterCompanion(
                      companionType: companion,
                      emotion: CharacterEmotion.welcome,
                      message:
                          "مرحباً بك مجدداً! أدخل بياناتك لنبدأ رحلة التفوق معاً.",
                      size: CharacterSize.medium,
                      customHeight: 125,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),

                  Text(
                    "تسجيل الدخول",
                    style: AppTypography.pageTitle.copyWith(fontSize: 26),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    "أدخل اسم المستخدم وكلمة المرور للمتابعة",
                    style: AppTypography.body,
                  ),
                  const SizedBox(height: AppSpacing.lg),

                  // Login Inputs Card
                  AppCard(
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "اسم المستخدم أو رقم الهاتف",
                          style: AppTypography.cardTitle.copyWith(fontSize: 14),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        TextFormField(
                          controller: _usernameController,
                          keyboardType: TextInputType.text,
                          decoration: InputDecoration(
                            hintText: "أدخل اسم المستخدم",
                            prefixIcon: const Icon(
                              Icons.person_outline,
                              color: AppColors.secondaryText,
                            ),
                            filled: true,
                            fillColor: AppColors.background,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(AppRadius.md),
                              borderSide: BorderSide.none,
                            ),
                          ),
                          validator: (value) {
                            if (value == null || value.trim().isEmpty) {
                              return "يرجى إدخال اسم المستخدم";
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: AppSpacing.md),

                        Text(
                          "كلمة المرور",
                          style: AppTypography.cardTitle.copyWith(fontSize: 14),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        TextFormField(
                          controller: _passwordController,
                          obscureText: _obscurePassword,
                          decoration: InputDecoration(
                            hintText: "أدخل كلمة المرور",
                            prefixIcon: const Icon(
                              Icons.lock_outline,
                              color: AppColors.secondaryText,
                            ),
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscurePassword
                                    ? Icons.visibility_outlined
                                    : Icons.visibility_off_outlined,
                                color: AppColors.secondaryText,
                              ),
                              onPressed: () {
                                setState(() {
                                  _obscurePassword = !_obscurePassword;
                                });
                              },
                            ),
                            filled: true,
                            fillColor: AppColors.background,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(AppRadius.md),
                              borderSide: BorderSide.none,
                            ),
                          ),
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return "يرجى إدخال كلمة المرور";
                            }
                            if (value.length < 6) {
                              return "كلمة المرور يجب ألا تقل عن 6 أحرف";
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: AppSpacing.md),

                        // Remember Me & Forgot Password Row
                        Wrap(
                          alignment: WrapAlignment.spaceBetween,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          spacing: AppSpacing.sm,
                          children: [
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Checkbox(
                                  value: _rememberMe,
                                  onChanged: (val) {
                                    setState(() {
                                      _rememberMe = val ?? true;
                                    });
                                  },
                                  activeColor: AppColors.primaryBlue,
                                ),
                                Text(
                                  "تذكرني",
                                  style: AppTypography.body.copyWith(
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                            TextButton(
                              onPressed: () {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text(
                                      "هذه الميزة غير مفعلة في النسخة التجريبية. يمكنك تسجيل الدخول مباشرة.",
                                    ),
                                    backgroundColor: AppColors.warning,
                                  ),
                                );
                              },
                              child: Text(
                                "نسيت كلمة المرور؟",
                                style: AppTypography.body.copyWith(
                                  color: AppColors.primaryBlue,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),

                  // Login Actions
                  PrimaryButton(
                    width: double.infinity,
                    text: "تسجيل الدخول",
                    onPressed: _handleLogin,
                    isLoading: _isLoading,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Row(
                    children: [
                      const Expanded(child: Divider()),
                      Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.sm,
                        ),
                        child: Text('أو', style: AppTypography.body),
                      ),
                      const Expanded(child: Divider()),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      key: const Key('google-sign-in-button'),
                      onPressed: _isLoading || _isGoogleLoading
                          ? null
                          : _handleGoogleLogin,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.darkText,
                        side: const BorderSide(color: AppColors.border),
                        padding: const EdgeInsets.symmetric(
                          vertical: AppSpacing.md,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppRadius.md),
                        ),
                      ),
                      child: _isGoogleLoading
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text(
                              'المتابعة باستخدام Google',
                              style: TextStyle(fontWeight: FontWeight.w700),
                            ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),

                  // Register link
                  Wrap(
                    alignment: WrapAlignment.center,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text("ليس لديك حساب؟", style: AppTypography.body),
                      TextButton(
                        onPressed: () => context.go('/register'),
                        child: Text(
                          "إنشاء حساب جديد",
                          style: AppTypography.cardTitle.copyWith(
                            color: AppColors.primaryBlue,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.md),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
