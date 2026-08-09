import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/repositories/notifications_api_repository.dart';
import 'notification_route_resolver.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
}

final class FcmNotificationService {
  final NotificationsApiRepository _repository;
  StreamSubscription<String>? _tokenChanges;
  StreamSubscription<RemoteMessage>? _foregroundMessages;
  StreamSubscription<RemoteMessage>? _openedMessages;
  final _routes = StreamController<String>.broadcast();
  final _changes = StreamController<void>.broadcast();
  bool _started = false;

  FcmNotificationService(this._repository);
  Stream<String> get routes => _routes.stream;
  Stream<void> get changes => _changes.stream;

  Future<void> start({bool requestPermission = false}) async {
    if (_started) return;
    try {
      if (Firebase.apps.isEmpty) await Firebase.initializeApp();
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
      final messaging = FirebaseMessaging.instance;
      var permission = await messaging.getNotificationSettings();
      if (requestPermission &&
          permission.authorizationStatus == AuthorizationStatus.notDetermined) {
        permission = await messaging.requestPermission(
          alert: true,
          badge: true,
          sound: true,
        );
      }
      if (permission.authorizationStatus != AuthorizationStatus.authorized &&
          permission.authorizationStatus != AuthorizationStatus.provisional) {
        return;
      }
      _started = true;
      final token = await messaging.getToken();
      if (token != null && token.isNotEmpty) await _register(token);
      _tokenChanges = messaging.onTokenRefresh.listen(_register);
      _foregroundMessages = FirebaseMessaging.onMessage.listen(
        (_) => _changes.add(null),
      );
      _openedMessages = FirebaseMessaging.onMessageOpenedApp.listen(
        _openMessage,
      );
      final initial = await messaging.getInitialMessage();
      if (initial != null) _openMessage(initial);
    } on FirebaseException {
      // Native Firebase configuration is deployment-owned; REST notifications remain available.
      _started = false;
    } on UnsupportedError {
      _started = false;
    }
  }

  Future<void> _register(String token) async {
    final preferences = await SharedPreferences.getInstance();
    final previousId = preferences.getString('notifications.push_device_id');
    final device = await _repository.registerDevice(
      target: token,
      platform: _platform,
    );
    await preferences.setString('notifications.push_device_id', device.id);
    if (previousId != null && previousId != device.id) {
      try {
        await _repository.removeDevice(previousId);
      } catch (_) {
        /* stale device is harmless and can be retried later */
      }
    }
  }

  String get _platform {
    if (kIsWeb) return 'WEB';
    return switch (defaultTargetPlatform) {
      TargetPlatform.android => 'ANDROID',
      TargetPlatform.iOS => 'IOS',
      _ => 'WEB',
    };
  }

  void _openMessage(RemoteMessage message) {
    final route = NotificationRouteResolver.fromData(message.data);
    if (route != null) _routes.add(route);
  }

  Future<void> stop() async {
    await _tokenChanges?.cancel();
    await _foregroundMessages?.cancel();
    await _openedMessages?.cancel();
    _tokenChanges = null;
    _foregroundMessages = null;
    _openedMessages = null;
    _started = false;
  }

  Future<void> unregisterDevice() async {
    final preferences = await SharedPreferences.getInstance();
    final id = preferences.getString('notifications.push_device_id');
    if (id != null) {
      try {
        await _repository.removeDevice(id);
      } finally {
        await preferences.remove('notifications.push_device_id');
      }
    }
    await stop();
  }

  void dispose() {
    unawaited(stop());
    _routes.close();
    _changes.close();
  }
}
