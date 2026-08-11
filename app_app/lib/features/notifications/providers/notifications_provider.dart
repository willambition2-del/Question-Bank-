import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_response.dart';
import '../../../core/network/notification_api_models.dart';
import '../../../core/repositories/providers.dart';
import '../../auth/providers/auth_provider.dart';

final class NotificationInboxState {
  final List<AppNotification> items;
  final PageMeta? meta;
  final int unreadCount;
  final bool loadingMore;
  const NotificationInboxState({
    this.items = const [],
    this.meta,
    this.unreadCount = 0,
    this.loadingMore = false,
  });
  NotificationInboxState copyWith({
    List<AppNotification>? items,
    PageMeta? meta,
    int? unreadCount,
    bool? loadingMore,
  }) => NotificationInboxState(
    items: items ?? this.items,
    meta: meta ?? this.meta,
    unreadCount: unreadCount ?? this.unreadCount,
    loadingMore: loadingMore ?? this.loadingMore,
  );
}

class NotificationInboxNotifier extends AsyncNotifier<NotificationInboxState> {
  @override
  Future<NotificationInboxState> build() async {
    final page = await ref.read(notificationsApiRepositoryProvider).list();
    final unread = await ref
        .read(notificationsApiRepositoryProvider)
        .unreadCount();
    return NotificationInboxState(
      items: page.items,
      meta: page.meta,
      unreadCount: unread,
    );
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(build);
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null ||
        current.loadingMore ||
        current.meta?.hasNextPage != true) {
      return;
    }
    state = AsyncData(current.copyWith(loadingMore: true));
    try {
      final page = await ref
          .read(notificationsApiRepositoryProvider)
          .list(page: (current.meta?.page ?? 0) + 1);
      state = AsyncData(
        current.copyWith(
          items: [...current.items, ...page.items],
          meta: page.meta,
          loadingMore: false,
        ),
      );
    } catch (_) {
      state = AsyncData(current.copyWith(loadingMore: false));
      rethrow;
    }
  }

  Future<void> markRead(String id) async {
    final current = state.value;
    if (current == null) return;
    final updated = await ref
        .read(notificationsApiRepositoryProvider)
        .markRead(id);
    state = AsyncData(
      current.copyWith(
        items: current.items
            .map((item) => item.id == id ? updated : item)
            .toList(growable: false),
        unreadCount: updated.isRead
            ? current.unreadCount > 0
                  ? current.unreadCount - 1
                  : 0
            : current.unreadCount,
      ),
    );
  }

  Future<void> markAllRead() async {
    final current = state.value;
    if (current == null) return;
    await ref.read(notificationsApiRepositoryProvider).markAllRead();
    state = AsyncData(
      current.copyWith(
        items: current.items
            .map(
              (item) => AppNotification(
                id: item.id,
                type: item.type,
                title: item.title,
                body: item.body,
                data: item.data,
                isRead: true,
                readAt: DateTime.now().toUtc(),
                createdAt: item.createdAt,
              ),
            )
            .toList(growable: false),
        unreadCount: 0,
      ),
    );
  }

  Future<void> remove(String id) async {
    final current = state.value;
    if (current == null) return;
    final removed = current.items.where((item) => item.id == id).firstOrNull;
    await ref.read(notificationsApiRepositoryProvider).remove(id);
    state = AsyncData(
      current.copyWith(
        items: current.items
            .where((item) => item.id != id)
            .toList(growable: false),
        unreadCount: removed?.isRead == false
            ? current.unreadCount > 0
                  ? current.unreadCount - 1
                  : 0
            : current.unreadCount,
      ),
    );
  }
}

final notificationInboxProvider =
    AsyncNotifierProvider<NotificationInboxNotifier, NotificationInboxState>(
      NotificationInboxNotifier.new,
    );

final notificationCoordinatorProvider = Provider<void>((ref) {
  final service = ref.read(fcmNotificationServiceProvider);
  StreamSubscription<void>? changes;
  ref.listen(authSessionStatusProvider, (_, status) {
    if (status == AuthSessionStatus.authenticated) {
      unawaited(service.start());
      changes ??= service.changes.listen(
        (_) => ref.invalidate(notificationInboxProvider),
      );
    } else if (status == AuthSessionStatus.unauthenticated) {
      unawaited(service.unregisterDevice());
      changes?.cancel();
      changes = null;
    }
  }, fireImmediately: true);
  ref.onDispose(() => changes?.cancel());
});

final notificationRouteProvider = StreamProvider<String>(
  (ref) => ref.read(fcmNotificationServiceProvider).routes,
);
