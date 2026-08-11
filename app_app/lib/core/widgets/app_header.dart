import 'package:flutter/material.dart';
import '../../app/theme/design_tokens.dart';

class AppHeader extends StatelessWidget {
  final String userName;
  final String message;
  final VoidCallback? onNotificationTap;
  final int? unreadNotifications;
  final String? avatarAsset;

  const AppHeader({
    super.key,
    required this.userName,
    required this.message,
    this.onNotificationTap,
    this.unreadNotifications,
    this.avatarAsset,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Row(
        children: [
          // Notification Bell
          GestureDetector(
            onTap: onNotificationTap,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  padding: const EdgeInsets.all(AppSpacing.xs + 2),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.border),
                    boxShadow: const [AppShadows.soft],
                  ),
                  child: const Icon(
                    Icons.notifications_outlined,
                    color: AppColors.darkText,
                    size: 22,
                  ),
                ),
                if (unreadNotifications != null && unreadNotifications! > 0)
                  Positioned(
                    top: -2,
                    right: -2,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: const BoxDecoration(
                        color: AppColors.errorCoral,
                        shape: BoxShape.circle,
                      ),
                      constraints: const BoxConstraints(
                        minWidth: 16,
                        minHeight: 16,
                      ),
                      child: Text(
                        '$unreadNotifications',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          // User Greeting & Dynamic Message
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  'مرحباً $userName 👋',
                  style: AppTypography.pageTitle.copyWith(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  message,
                  style: AppTypography.caption,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          // Character Avatar (Unclipped with clean white background)
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.primaryBlue.withValues(alpha: 0.1),
              border: Border.all(color: AppColors.border),
            ),
            child: avatarAsset != null
                ? ClipOval(
                    child: Image.asset(
                      avatarAsset!,
                      fit: BoxFit.cover,
                    ),
                  )
                : const Icon(
                    Icons.person,
                    color: AppColors.primaryBlue,
                  ),
          ),
        ],
      ),
    );
  }
}
