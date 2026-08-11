import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/design_tokens.dart';
import '../../../core/network/notification_api_models.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../providers/notifications_provider.dart';
import '../services/notification_route_resolver.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final inbox = ref.watch(notificationInboxProvider);
    return AppScaffold(
      appBar: AppBar(
        title: const Text('الإشعارات'),
        actions: [
          TextButton(
            onPressed: inbox.value?.unreadCount == 0
                ? null
                : () => ref
                      .read(notificationInboxProvider.notifier)
                      .markAllRead(),
            child: const Text('قراءة الكل'),
          ),
        ],
      ),
      body: inbox.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('تعذر تحميل الإشعارات'),
              const SizedBox(height: AppSpacing.sm),
              FilledButton(
                onPressed: () =>
                    ref.read(notificationInboxProvider.notifier).refresh(),
                child: const Text('إعادة المحاولة'),
              ),
            ],
          ),
        ),
        data: (data) {
          if (data.items.isEmpty) {
            return const Center(child: Text('لا توجد إشعارات بعد'));
          }
          return RefreshIndicator(
            onRefresh: () =>
                ref.read(notificationInboxProvider.notifier).refresh(),
            child: ListView.builder(
              itemCount:
                  data.items.length + (data.meta?.hasNextPage == true ? 1 : 0),
              itemBuilder: (context, index) {
                if (index == data.items.length) {
                  ref.read(notificationInboxProvider.notifier).loadMore();
                  return const Padding(
                    padding: EdgeInsets.all(AppSpacing.md),
                    child: Center(child: CircularProgressIndicator()),
                  );
                }
                final item = data.items[index];
                return Dismissible(
                  key: ValueKey(item.id),
                  direction: DismissDirection.endToStart,
                  onDismissed: (_) => ref
                      .read(notificationInboxProvider.notifier)
                      .remove(item.id),
                  background: Container(
                    color: AppColors.errorCoral,
                    alignment: Alignment.centerLeft,
                    padding: const EdgeInsets.all(AppSpacing.md),
                    child: const Icon(
                      Icons.delete_outline,
                      color: Colors.white,
                    ),
                  ),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: item.isRead
                          ? AppColors.background
                          : AppColors.lightBlue,
                      child: Icon(
                        _icon(item.type),
                        color: AppColors.primaryBlue,
                      ),
                    ),
                    title: Text(
                      item.title,
                      style: TextStyle(
                        fontWeight: item.isRead
                            ? FontWeight.normal
                            : FontWeight.bold,
                      ),
                    ),
                    subtitle: Text(item.body),
                    trailing: item.isRead
                        ? null
                        : const Icon(
                            Icons.circle,
                            size: 9,
                            color: AppColors.primaryBlue,
                          ),
                    onTap: () => _open(context, ref, item),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }

  Future<void> _open(
    BuildContext context,
    WidgetRef ref,
    AppNotification item,
  ) async {
    if (!item.isRead) {
      await ref.read(notificationInboxProvider.notifier).markRead(item.id);
    }
    if (!context.mounted) return;
    final route = NotificationRouteResolver.fromData(item.data);
    if (route != null) context.push(route);
  }

  IconData _icon(String type) => switch (type) {
    'ACHIEVEMENT' || 'ACHIEVEMENT_UNLOCKED' => Icons.emoji_events_outlined,
    'CHALLENGE' ||
    'CHALLENGE_INVITE' ||
    'CHALLENGE_RESULT' => Icons.sports_esports_outlined,
    'DAILY_TASK' || 'DAILY_REMINDER' => Icons.task_alt,
    'STREAK' => Icons.local_fire_department_outlined,
    _ => Icons.notifications_outlined,
  };
}
