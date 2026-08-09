import 'api_response.dart';

final class AppNotification {
  final String id;
  final String type;
  final String title;
  final String body;
  final Map<String, dynamic> data;
  final bool isRead;
  final DateTime? readAt;
  final DateTime createdAt;

  const AppNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.data,
    required this.isRead,
    this.readAt,
    required this.createdAt,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) =>
      AppNotification(
        id: json['id']?.toString() ?? '',
        type: json['type']?.toString() ?? 'SYSTEM',
        title: json['title']?.toString() ?? '',
        body: json['body']?.toString() ?? '',
        data: json['data'] is Map
            ? Map<String, dynamic>.unmodifiable(
                Map<String, dynamic>.from(json['data'] as Map),
              )
            : const {},
        isRead: json['isRead'] == true,
        readAt: DateTime.tryParse(json['readAt']?.toString() ?? '')?.toUtc(),
        createdAt:
            DateTime.tryParse(json['createdAt']?.toString() ?? '')?.toUtc() ??
            DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
      );
}

final class NotificationPage {
  final List<AppNotification> items;
  final PageMeta meta;
  const NotificationPage(this.items, this.meta);
}

final class PushDevice {
  final String id;
  final String target;
  final String platform;
  final bool isActive;
  const PushDevice({
    required this.id,
    required this.target,
    required this.platform,
    required this.isActive,
  });
  factory PushDevice.fromJson(Map<String, dynamic> json) => PushDevice(
    id: json['id']?.toString() ?? '',
    target: json['target']?.toString() ?? '',
    platform: json['platform']?.toString() ?? '',
    isActive: json['isActive'] != false,
  );
}
