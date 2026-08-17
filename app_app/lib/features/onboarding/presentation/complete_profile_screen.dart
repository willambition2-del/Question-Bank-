import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app/theme/design_tokens.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_button.dart';
import '../../auth/providers/auth_provider.dart';

class CompleteProfileScreen extends ConsumerStatefulWidget {
  const CompleteProfileScreen({super.key});

  @override
  ConsumerState<CompleteProfileScreen> createState() =>
      _CompleteProfileScreenState();
}

class _CompleteProfileScreenState extends ConsumerState<CompleteProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _schoolController = TextEditingController();
  final _phoneController = TextEditingController();

  static const List<String> _governorates = [
    'أمانة العاصمة',
    'صنعاء',
    'عدن',
    'تعز',
    'إب',
    'الحديدة',
    'حضرموت',
    'ذمار',
    'عمران',
    'حجة',
    'صعدة',
    'المحويت',
    'ريمة',
    'المهرة',
    'مأرب',
    'الجوف',
    'شبوة',
    'أبين',
    'لحج',
    'الضالع',
    'البيضاء',
    'أرخبيل سقطرى',
  ];

  String? _selectedGovernorate;
  String _selectedGrade = 'THIRD_SECONDARY'; // 'THIRD_SECONDARY' | 'NINTH'
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authProvider);
    if (user != null) {
      if (user.schoolName.isNotEmpty && user.schoolName != 'ثانوية عامة') {
        _schoolController.text = user.schoolName;
      }
      if (user.phone.isNotEmpty) {
        _phoneController.text = user.phone;
      }
      if (user.governorate != null &&
          _governorates.contains(user.governorate)) {
        _selectedGovernorate = user.governorate;
      }
      if (user.gradeLevel != null) {
        _selectedGrade = user.gradeLevel!;
      }
    }
  }

  @override
  void dispose() {
    _schoolController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedGovernorate == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('يرجى اختيار المحافظة'),
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
        .completeOnboarding(
          schoolName: _schoolController.text.trim(),
          governorate: _selectedGovernorate!,
          gradeLevel: _selectedGrade,
          phone: _phoneController.text.trim(),
        );

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
              'تعذر حفظ البيانات. يرجى التأكد من الاتصال والمحاولة مجددًا.',
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
            horizontal: AppSpacing.md,
            vertical: AppSpacing.lg,
          ),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: AppSpacing.lg),
                // Logo & Header
                Center(
                  child: Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      color: AppColors.lightBlue,
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: AppColors.primaryBlue,
                        width: 2,
                      ),
                    ),
                    child: const Icon(
                      Icons.school_rounded,
                      size: 36,
                      color: AppColors.primaryBlue,
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  'أكمل بياناتك',
                  textAlign: TextAlign.center,
                  style: AppTypography.pageTitle.copyWith(
                    color: AppColors.darkText,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'ساعدنا في تخصيص المحتوى التعليمي المناسب لك',
                  textAlign: TextAlign.center,
                  style: AppTypography.body.copyWith(
                    color: AppColors.secondaryText,
                  ),
                ),
                const SizedBox(height: AppSpacing.xl),

                // Form Card
                AppCard(
                  child: Padding(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Grade Selection
                        Text(
                          'الصف الدراسي *',
                          style: AppTypography.caption.copyWith(
                            color: AppColors.secondaryText,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Row(
                          children: [
                            Expanded(
                              child: _GradeOptionCard(
                                title: 'الثالث الثانوي',
                                subtitle: 'علمي / أدبي',
                                icon: Icons.workspace_premium_rounded,
                                isSelected: _selectedGrade == 'THIRD_SECONDARY',
                                onTap: () {
                                  setState(() {
                                    _selectedGrade = 'THIRD_SECONDARY';
                                  });
                                },
                              ),
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            Expanded(
                              child: _GradeOptionCard(
                                title: 'الصف التاسع',
                                subtitle: 'الأساسي',
                                icon: Icons.auto_stories_rounded,
                                isSelected: _selectedGrade == 'NINTH',
                                onTap: () {
                                  setState(() {
                                    _selectedGrade = 'NINTH';
                                  });
                                },
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.md),

                        // Governorate Dropdown
                        Text(
                          'المحافظة *',
                          style: AppTypography.caption.copyWith(
                            color: AppColors.secondaryText,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        DropdownButtonFormField<String>(
                          initialValue: _selectedGovernorate,
                          decoration: InputDecoration(
                            hintText: 'اختر المحافظة',
                            hintStyle: AppTypography.body.copyWith(
                              color: AppColors.secondaryText,
                            ),
                            prefixIcon: const Icon(
                              Icons.location_on_outlined,
                              color: AppColors.primaryBlue,
                            ),
                            filled: true,
                            fillColor: AppColors.surface,
                            border: OutlineInputBorder(
                              borderRadius:
                                  BorderRadius.circular(AppRadius.md),
                              borderSide: const BorderSide(
                                color: AppColors.border,
                              ),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius:
                                  BorderRadius.circular(AppRadius.md),
                              borderSide: const BorderSide(
                                color: AppColors.border,
                              ),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius:
                                  BorderRadius.circular(AppRadius.md),
                              borderSide: const BorderSide(
                                color: AppColors.primaryBlue,
                                width: 2,
                              ),
                            ),
                          ),
                          items: _governorates.map((gov) {
                            return DropdownMenuItem<String>(
                              value: gov,
                              child: Text(
                                gov,
                                style: AppTypography.body.copyWith(
                                  color: AppColors.darkText,
                                ),
                              ),
                            );
                          }).toList(),
                          onChanged: (val) {
                            setState(() {
                              _selectedGovernorate = val;
                            });
                          },
                          validator: (val) {
                            if (val == null || val.isEmpty) {
                              return 'يرجى اختيار المحافظة';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: AppSpacing.md),

                        // School Name
                        Text(
                          'اسم المدرسة *',
                          style: AppTypography.caption.copyWith(
                            color: AppColors.secondaryText,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        TextFormField(
                          controller: _schoolController,
                          decoration: InputDecoration(
                            hintText: 'مثال: مدرسة الكويت النموذجية',
                            hintStyle: AppTypography.body.copyWith(
                              color: AppColors.secondaryText,
                            ),
                            prefixIcon: const Icon(
                              Icons.apartment_rounded,
                              color: AppColors.primaryBlue,
                            ),
                            filled: true,
                            fillColor: AppColors.surface,
                            border: OutlineInputBorder(
                              borderRadius:
                                  BorderRadius.circular(AppRadius.md),
                              borderSide: const BorderSide(
                                color: AppColors.border,
                              ),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius:
                                  BorderRadius.circular(AppRadius.md),
                              borderSide: const BorderSide(
                                color: AppColors.border,
                              ),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius:
                                  BorderRadius.circular(AppRadius.md),
                              borderSide: const BorderSide(
                                color: AppColors.primaryBlue,
                                width: 2,
                              ),
                            ),
                          ),
                          validator: (val) {
                            if (val == null || val.trim().isEmpty) {
                              return 'اسم المدرسة مطلوب';
                            }
                            if (val.trim().length < 2) {
                              return 'اسم المدرسة يجب أن يتكون من حرفين على الأقل';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: AppSpacing.md),

                        // Phone Number (Optional)
                        Text(
                          'رقم الهاتف (اختياري)',
                          style: AppTypography.caption.copyWith(
                            color: AppColors.secondaryText,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        TextFormField(
                          controller: _phoneController,
                          keyboardType: TextInputType.phone,
                          decoration: InputDecoration(
                            hintText: 'مثال: 770000000',
                            hintStyle: AppTypography.body.copyWith(
                              color: AppColors.secondaryText,
                            ),
                            prefixIcon: const Icon(
                              Icons.phone_android_rounded,
                              color: AppColors.primaryBlue,
                            ),
                            filled: true,
                            fillColor: AppColors.surface,
                            border: OutlineInputBorder(
                              borderRadius:
                                  BorderRadius.circular(AppRadius.md),
                              borderSide: const BorderSide(
                                color: AppColors.border,
                              ),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius:
                                  BorderRadius.circular(AppRadius.md),
                              borderSide: const BorderSide(
                                color: AppColors.border,
                              ),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius:
                                  BorderRadius.circular(AppRadius.md),
                              borderSide: const BorderSide(
                                color: AppColors.primaryBlue,
                                width: 2,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),

                // Submit Button
                PrimaryButton(
                  text: 'متابعة',
                  isLoading: _isLoading,
                  onPressed: _handleSubmit,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _GradeOptionCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final bool isSelected;
  final VoidCallback onTap;

  const _GradeOptionCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.md,
        ),
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.lightBlue
              : AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: Border.all(
            color: isSelected ? AppColors.primaryBlue : AppColors.border,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Column(
          children: [
            Icon(
              icon,
              size: 28,
              color: isSelected
                  ? AppColors.primaryBlue
                  : AppColors.secondaryText,
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              title,
              textAlign: TextAlign.center,
              style: AppTypography.cardTitle.copyWith(
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                color: isSelected
                    ? AppColors.primaryBlue
                    : AppColors.darkText,
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: AppTypography.caption.copyWith(
                color: AppColors.secondaryText,
                fontSize: 11,
              ),
            ),
          ],
        ),
      ),
    );
  }
}