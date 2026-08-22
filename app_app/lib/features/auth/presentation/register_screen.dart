import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app/theme/design_tokens.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_button.dart';
import '../providers/auth_provider.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _usernameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _schoolController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _obscurePassword = true;
  bool _isLoading = false;

  @override
  void dispose() {
    _nameController.dispose();
    _usernameController.dispose();
    _phoneController.dispose();
    _schoolController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  void _handleRegister() async {
    if (!_formKey.currentState!.validate()) return;

    if (_passwordController.text != _confirmPasswordController.text) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("كلمتا المرور غير متطابقتين"),
          backgroundColor: AppColors.errorCoral,
        ),
      );
      return;
    }

    setState(() {
      _isLoading = true;
    });

    final success = await ref
        .read(authProvider.notifier)
        .register(
          name: _nameController.text.trim(),
          username: _usernameController.text.trim(),
          phone: _phoneController.text.trim(),
          schoolName: _schoolController.text.trim().isEmpty
              ? "ثانوية عامة"
              : _schoolController.text.trim(),
          password: _passwordController.text,
        );

    setState(() {
      _isLoading = false;
    });

    if (mounted) {
      if (success) {
        final user = ref.read(authProvider);
        if (user != null && !user.onboardingCompleted) {
          context.go('/complete-profile');
        } else {
          context.go('/home');
        }
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              "حدث خطأ أثناء إنشاء الحساب. تأكد من إدخال كافة الحقول بشكل صحيح.",
            ),
            backgroundColor: AppColors.errorCoral,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.xs,
            vertical: AppSpacing.md,
          ),
          child: Form(
            key: _formKey,
            child: Column(
              children: [
                const SizedBox(height: AppSpacing.sm),
                Text(
                  "إنشاء حساب جديد",
                  style: AppTypography.pageTitle.copyWith(fontSize: 26),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  "انضم إلينا وابدأ المذاكرة بطرق حديثة ومحفزة",
                  style: AppTypography.body,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.lg),

                // Form Fields
                AppCard(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildLabel("الاسم الكامل"),
                      _buildTextField(
                        controller: _nameController,
                        hint: "أدخل اسمك الثلاثي",
                        icon: Icons.person_outline,
                        validator: (val) => val == null || val.trim().isEmpty
                            ? "يرجى إدخال الاسم"
                            : null,
                      ),
                      const SizedBox(height: AppSpacing.md),

                      _buildLabel("اسم المستخدم"),
                      _buildTextField(
                        controller: _usernameController,
                        hint: "مثال: ahmed2026",
                        icon: Icons.alternate_email,
                        validator: (val) => val == null || val.trim().isEmpty
                            ? "يرجى إدخال اسم المستخدم"
                            : null,
                      ),
                      const SizedBox(height: AppSpacing.md),

                      _buildLabel("رقم الهاتف (اليمن)"),
                      _buildTextField(
                        controller: _phoneController,
                        hint: "777xxxxxx",
                        icon: Icons.phone_android_outlined,
                        keyboardType: TextInputType.phone,
                        validator: (val) {
                          if (val == null || val.trim().isEmpty)
                            return "يرجى إدخال رقم الهاتف";
                          if (val.length < 9)
                            return "رقم الهاتف يجب أن يتكون من 9 أرقام";
                          return null;
                        },
                      ),
                      const SizedBox(height: AppSpacing.md),

                      _buildLabel("المدرسة (اختياري)"),
                      _buildTextField(
                        controller: _schoolController,
                        hint: "اسم مدرستك الثانوية",
                        icon: Icons.school_outlined,
                      ),
                      const SizedBox(height: AppSpacing.md),

                      _buildLabel("كلمة المرور"),
                      _buildPasswordField(
                        controller: _passwordController,
                        hint: "أدخل كلمة مرور قوية",
                        validator: (val) {
                          if (val == null || val.isEmpty)
                            return "يرجى إدخال كلمة المرور";
                          if (val.length < 8 ||
                              !RegExp(r'^(?=.*[A-Za-z])(?=.*\d)').hasMatch(val))
                            return "يجب ألا تقل كلمة المرور عن 6 أحرف";
                          return null;
                        },
                      ),
                      const SizedBox(height: AppSpacing.md),

                      _buildLabel("تأكيد كلمة المرور"),
                      _buildPasswordField(
                        controller: _confirmPasswordController,
                        hint: "أعد كتابة كلمة المرور",
                        validator: (val) => val == null || val.isEmpty
                            ? "يرجى تأكيد كلمة المرور"
                            : null,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),

                // Register Button
                PrimaryButton(
                  width: double.infinity,
                  text: "إنشاء الحساب والبدء",
                  onPressed: _handleRegister,
                  isLoading: _isLoading,
                ),
                const SizedBox(height: AppSpacing.lg),

                // Login link
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text("لديك حساب بالفعل؟", style: AppTypography.body),
                    TextButton(
                      onPressed: () => context.go('/login'),
                      child: Text(
                        "تسجيل الدخول",
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
    );
  }

  Widget _buildLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xs),
      child: Text(text, style: AppTypography.cardTitle.copyWith(fontSize: 14)),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    TextInputType keyboardType = TextInputType.text,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      decoration: InputDecoration(
        hintText: hint,
        prefixIcon: Icon(icon, color: AppColors.secondaryText),
        filled: true,
        fillColor: AppColors.background,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: BorderSide.none,
        ),
      ),
      validator: validator,
    );
  }

  Widget _buildPasswordField({
    required TextEditingController controller,
    required String hint,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      obscureText: _obscurePassword,
      decoration: InputDecoration(
        hintText: hint,
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
      validator: validator,
    );
  }
}
