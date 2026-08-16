import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../app/theme/design_tokens.dart';
import '../../../core/models/subject_model.dart';
import '../providers/curriculum_provider.dart';
import '../widgets/resource_card.dart';

class CurriculumResourcesScreen extends ConsumerStatefulWidget {
  final String subjectId;
  final SubjectModel? subject;

  const CurriculumResourcesScreen({
    super.key,
    required this.subjectId,
    this.subject,
  });

  @override
  ConsumerState<CurriculumResourcesScreen> createState() =>
      _CurriculumResourcesScreenState();
}

class _CurriculumResourcesScreenState
    extends ConsumerState<CurriculumResourcesScreen> {
  String selectedCategory = 'ALL';

  final List<Map<String, String>> categories = [
    {'id': 'ALL', 'name': 'الكل'},
    {'id': 'CURRICULUM', 'name': 'المنهج'},
    {'id': 'TEXTBOOK', 'name': 'الكتب'},
    {'id': 'NOTE', 'name': 'الملازم'},
    {'id': 'SUMMARY', 'name': 'الملخصات'},
    {'id': 'REVIEW', 'name': 'المراجعات'},
    {'id': 'MODEL', 'name': 'النماذج'},
    {'id': 'REFERENCE', 'name': 'المراجع'},
    {'id': 'OTHER', 'name': 'أخرى'},
  ];

  @override
  Widget build(BuildContext context) {
    final resourcesAsync = ref.watch(curriculumResourcesProvider(widget.subjectId));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(widget.subject?.name ?? 'موارد المادة',
            style: AppTypography.pageTitle),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Column(
        children: [
          // Filters
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md, vertical: AppSpacing.sm),
            child: Row(
              children: categories.map((cat) {
                final isSelected = selectedCategory == cat['id'];
                return Padding(
                  padding: const EdgeInsets.only(left: 8.0),
                  child: FilterChip(
                    label: Text(
                      cat['name']!,
                      style: TextStyle(
                        color: isSelected ? Colors.white : AppColors.darkText,
                        fontWeight:
                            isSelected ? FontWeight.bold : FontWeight.normal,
                      ),
                    ),
                    selected: isSelected,
                    onSelected: (selected) {
                      setState(() {
                        selectedCategory = cat['id']!;
                      });
                    },
                    backgroundColor: Colors.white,
                    selectedColor: AppColors.primaryBlue,
                    checkmarkColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                      side: BorderSide(
                        color: isSelected
                            ? AppColors.primaryBlue
                            : AppColors.border,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          const Divider(height: 1),

          // List of resources
          Expanded(
            child: resourcesAsync.when(
              data: (resources) {
                final filtered = selectedCategory == 'ALL'
                    ? resources
                    : resources.where((r) => r.category == selectedCategory).toList();

                if (filtered.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.folder_open_rounded,
                            size: 64, color: AppColors.border),
                        SizedBox(height: 16),
                        Text(
                          'لم تتم إضافة ملفات لهذه المادة بعد',
                          style: AppTypography.body,
                        ),
                      ],
                    ),
                  );
                }

                return ListView.separated(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  itemCount: filtered.length,
                  separatorBuilder: (context, index) =>
                      const SizedBox(height: AppSpacing.md),
                  itemBuilder: (context, index) {
                    return ResourceCard(resource: filtered[index]);
                  },
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (err, stack) => Center(
                child: Text('حدث خطأ: $err', style: AppTypography.body),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
