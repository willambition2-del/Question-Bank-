import 'package:flutter/material.dart';
import '../../app/theme/design_tokens.dart';

class SubjectCard extends StatelessWidget {
  final String subjectId;
  final String title;
  final int unitsCount;
  final int lessonsCount;
  final double progress; // 0.0 to 1.0
  final double mastery; // 0.0 to 1.0
  final bool isFavorite;
  final VoidCallback onTap;
  final VoidCallback? onFavoriteTap;
  final String? bannerAsset;

  const SubjectCard({
    super.key,
    required this.subjectId,
    required this.title,
    required this.unitsCount,
    required this.lessonsCount,
    required this.progress,
    required this.mastery,
    required this.isFavorite,
    required this.onTap,
    this.onFavoriteTap,
    this.bannerAsset,
  });

  String _getSubjectBanner(String id) {
    switch (id) {
      case 'sub_english':
        return 'assets/generated/english_subject_banner.png';
      case 'sub_biology':
        return 'assets/generated/biology_subject_banner.png';
      case 'sub_physics':
        return 'assets/generated/physics_subject_banner.png';
      case 'sub_chemistry':
        return 'assets/generated/chemistry_subject_banner.png';
      case 'sub_arabic':
        return 'assets/generated/arabic_subject_banner.png';
      default:
        return 'assets/generated/math_subject_banner.png';
    }
  }

  @override
  Widget build(BuildContext context) {
    final banner = bannerAsset ?? _getSubjectBanner(subjectId);
    final progressPct = (progress * 100).toInt();
    final masteryPct = (mastery * 100).toInt();

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Container(
        margin: const EdgeInsets.only(bottom: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFF1F5F9), width: 1),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF0F172A).withOpacity(0.04),
              blurRadius: 14,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Material(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(20),
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(20),
            child: IntrinsicHeight(
              child: Row(
                children: [
                  // Details Section (Renders on Right in RTL)
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          // Title & Favorite Button
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Text(
                                  title,
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF0F172A),
                                    fontFamily: 'Cairo',
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              if (onFavoriteTap != null)
                                GestureDetector(
                                  onTap: onFavoriteTap,
                                  child: Container(
                                    width: 30,
                                    height: 30,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFF8FAFC),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(
                                        color: const Color(0xFFF1F5F9),
                                      ),
                                    ),
                                    child: Icon(
                                      isFavorite
                                          ? Icons.star_rounded
                                          : Icons.star_outline_rounded,
                                      color: isFavorite
                                          ? const Color(0xFFF59E0B)
                                          : const Color(0xFF94A3B8),
                                      size: 18,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 6),

                          // Metadata: Units & Lessons
                          FittedBox(
                            fit: BoxFit.scaleDown,
                            alignment: Alignment.centerRight,
                            child: Row(
                              children: [
                                const Icon(
                                  Icons.grid_view_rounded,
                                  size: 13,
                                  color: Color(0xFF64748B),
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  unitsCount > 0
                                      ? "$unitsCount وحدات"
                                      : "وحدات",
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: Color(0xFF64748B),
                                    fontWeight: FontWeight.w500,
                                    fontFamily: 'Cairo',
                                  ),
                                ),
                                const Text(
                                  "  •  ",
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Color(0xFFCBD5E1),
                                    fontFamily: 'Cairo',
                                  ),
                                ),
                                const Icon(
                                  Icons.description_outlined,
                                  size: 13,
                                  color: Color(0xFF64748B),
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  "$lessonsCount درس",
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: Color(0xFF64748B),
                                    fontWeight: FontWeight.w500,
                                    fontFamily: 'Cairo',
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 8),

                          // Progress & Mastery Stats Text
                          FittedBox(
                            fit: BoxFit.scaleDown,
                            alignment: Alignment.centerRight,
                            child: Row(
                              children: [
                                Text(
                                  "نسبة التقدم: $progressPct%",
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF1E293B),
                                    fontFamily: 'Cairo',
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Text(
                                  "الإتقان: $masteryPct%",
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF0EA5E9),
                                    fontFamily: 'Cairo',
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 6),

                          // Dual Progress & Mastery Segmented Bar
                          Stack(
                            children: [
                              Container(
                                height: 6,
                                width: double.infinity,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFE2E8F0),
                                  borderRadius: BorderRadius.circular(3),
                                ),
                              ),
                              FractionallySizedBox(
                                widthFactor: mastery.clamp(0.0, 1.0),
                                child: Container(
                                  height: 6,
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF0EA5E9),
                                    borderRadius: BorderRadius.circular(3),
                                  ),
                                ),
                              ),
                              FractionallySizedBox(
                                widthFactor: progress.clamp(0.0, 1.0),
                                child: Container(
                                  height: 6,
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF2563EB),
                                    borderRadius: BorderRadius.circular(3),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Image Container (Renders on Left in RTL)
                  ClipRRect(
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(20),
                      bottomLeft: Radius.circular(20),
                    ),
                    child: SizedBox(
                      width: 130,
                      height: double.infinity,
                      child: Image.asset(
                        banner,
                        fit: BoxFit.cover,
                        errorBuilder: (context, error, stackTrace) => Container(
                          color: const Color(0xFFE0F2FE),
                          child: const Icon(
                            Icons.school_rounded,
                            color: Color(0xFF0EA5E9),
                            size: 40,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
