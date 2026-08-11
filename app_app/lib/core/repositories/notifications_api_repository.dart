import 'package:dio/dio.dart';

import '../network/api_call.dart';
import '../network/api_response.dart';
import '../network/notification_api_models.dart';

abstract interface class NotificationsRemoteDataSource {
  Future<Object?> get(String path, {Map<String, dynamic>? query});
  Future<Object?> post(String path, {Map<String, dynamic>? data});
  Future<Object?> patch(String path);
  Future<Object?> delete(String path);
}

final class DioNotificationsRemoteDataSource
    implements NotificationsRemoteDataSource {
  final Dio _dio;
  DioNotificationsRemoteDataSource(this._dio);
  Future<Object?> _call(Future<Response<Object?>> call) async {
    try {
      return (await call).data;
    } on DioException catch (error) {
      throwApiError(error);
    }
  }

  @override
  Future<Object?> get(String path, {Map<String, dynamic>? query}) =>
      _call(_dio.get<Object?>(path, queryParameters: query));
  @override
  Future<Object?> post(String path, {Map<String, dynamic>? data}) =>
      _call(_dio.post<Object?>(path, data: data));
  @override
  Future<Object?> patch(String path) => _call(_dio.patch<Object?>(path));
  @override
  Future<Object?> delete(String path) => _call(_dio.delete<Object?>(path));
}

final class NotificationsApiRepository {
  final NotificationsRemoteDataSource _remote;
  const NotificationsApiRepository(this._remote);
  Map<String, dynamic> _envelope(Object? raw) => requireObject(raw);
  Map<String, dynamic> _data(Object? raw) =>
      requireObject(_envelope(raw)['data'], 'data');

  Future<NotificationPage> list({
    int page = 1,
    int limit = 20,
    String? type,
    bool unreadOnly = false,
  }) async {
    final envelope = _envelope(
      await _remote.get(
        '/notifications',
        query: {
          'page': page,
          'limit': limit,
          'type': ?type,
          if (unreadOnly) 'unreadOnly': true,
        },
      ),
    );
    return NotificationPage(
      requireList(envelope['data'])
          .whereType<Map>()
          .map((e) => AppNotification.fromJson(Map<String, dynamic>.from(e)))
          .toList(growable: false),
      PageMeta.fromJson(requireObject(envelope['meta'], 'meta')),
    );
  }

  Future<int> unreadCount() async =>
      (_data(await _remote.get('/notifications/unread-count'))['count'] as num?)
          ?.toInt() ??
      0;
  Future<PushDevice> registerDevice({
    required String target,
    required String platform,
  }) async => PushDevice.fromJson(
    _data(
      await _remote.post(
        '/notifications/devices',
        data: {'target': target, 'platform': platform},
      ),
    ),
  );
  Future<void> removeDevice(String id) async {
    await _remote.delete('/notifications/devices/$id');
  }

  Future<AppNotification> markRead(String id) async => AppNotification.fromJson(
    _data(await _remote.patch('/notifications/$id/read')),
  );
  Future<int> markAllRead() async =>
      (_data(await _remote.patch('/notifications/read-all'))['updatedCount']
              as num?)
          ?.toInt() ??
      0;
  Future<void> remove(String id) async {
    await _remote.delete('/notifications/$id');
  }
}
