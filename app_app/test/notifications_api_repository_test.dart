import 'package:app_app/core/repositories/notifications_api_repository.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:app_app/features/notifications/services/notification_route_resolver.dart';

void main() {
  test('notification list sends backend filters and parses page', () async {
    final remote = _FakeNotificationsRemote({
      'data': [
        {
          'id': 'n1',
          'type': 'CHALLENGE_INVITE',
          'title': 'Invite',
          'body': 'Join',
          'isRead': false,
          'createdAt': '2026-07-22T10:00:00Z',
        },
      ],
      'meta': {
        'page': 1,
        'limit': 20,
        'totalItems': 1,
        'totalPages': 1,
        'hasNextPage': false,
        'hasPreviousPage': false,
      },
    });
    final page = await NotificationsApiRepository(
      remote,
    ).list(type: 'CHALLENGE_INVITE', unreadOnly: true);
    expect(remote.path, '/notifications');
    expect(remote.query?['unreadOnly'], isTrue);
    expect(page.items.single.isRead, isFalse);
  });

  test('device registration uses exact FCM DTO', () async {
    final remote = _FakeNotificationsRemote({
      'data': {
        'id': 'd1',
        'target': '1234567890123456',
        'platform': 'ANDROID',
        'isActive': true,
      },
    });
    final device = await NotificationsApiRepository(
      remote,
    ).registerDevice(target: '1234567890123456', platform: 'ANDROID');
    expect(remote.path, '/notifications/devices');
    expect(remote.body, {'target': '1234567890123456', 'platform': 'ANDROID'});
    expect(device.id, 'd1');
  });

  test('mark read uses canonical PATCH endpoint', () async {
    final remote = _FakeNotificationsRemote({
      'data': {
        'id': 'n1',
        'type': 'SYSTEM',
        'title': 'Title',
        'body': 'Body',
        'isRead': true,
        'readAt': '2026-07-22T10:01:00Z',
        'createdAt': '2026-07-22T10:00:00Z',
      },
    });
    final item = await NotificationsApiRepository(remote).markRead('n1');
    expect(remote.method, 'PATCH');
    expect(remote.path, '/notifications/n1/read');
    expect(item.isRead, isTrue);
  });

  test('FCM payload routing uses actual backend data keys', () {
    expect(
      NotificationRouteResolver.fromData({'challengeId': 'c1'}),
      '/challenges',
    );
    expect(
      NotificationRouteResolver.fromData({'achievementId': 'a1'}),
      '/achievements',
    );
    expect(
      NotificationRouteResolver.fromData({'subjectId': 's1'}),
      '/subjects/s1',
    );
    expect(NotificationRouteResolver.fromData({'day': '2026-07-22'}), '/home');
    expect(
      NotificationRouteResolver.fromData({
        'route': 'https://malicious.example',
      }),
      isNull,
    );
  });
  test('unread count is server sourced', () async {
    final remote = _FakeNotificationsRemote({
      'data': {'count': 7},
    });
    expect(await NotificationsApiRepository(remote).unreadCount(), 7);
    expect(remote.path, '/notifications/unread-count');
  });
}

class _FakeNotificationsRemote implements NotificationsRemoteDataSource {
  final Object? response;
  String? method;
  String? path;
  Map<String, dynamic>? body;
  Map<String, dynamic>? query;
  _FakeNotificationsRemote(this.response);
  @override
  Future<Object?> get(String path, {Map<String, dynamic>? query}) async {
    method = 'GET';
    this.path = path;
    this.query = query;
    return response;
  }

  @override
  Future<Object?> post(String path, {Map<String, dynamic>? data}) async {
    method = 'POST';
    this.path = path;
    body = data;
    return response;
  }

  @override
  Future<Object?> patch(String path) async {
    method = 'PATCH';
    this.path = path;
    return response;
  }

  @override
  Future<Object?> delete(String path) async {
    method = 'DELETE';
    this.path = path;
    return response;
  }
}
