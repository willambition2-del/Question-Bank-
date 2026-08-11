final class NotificationRouteResolver {
  NotificationRouteResolver._();

  static String? fromData(Map<String, dynamic> data) {
    final explicit = data['route']?.toString();
    if (explicit != null && _allowed(explicit)) return explicit;
    if (data['challengeId'] != null) return '/challenges';
    if (data['achievementId'] != null) return '/achievements';
    final subjectId = data['subjectId']?.toString();
    if (subjectId != null && subjectId.isNotEmpty)
      return '/subjects/$subjectId';
    if (data['day'] != null) return '/home';
    return null;
  }

  static bool _allowed(String route) =>
      route == '/home' ||
      route == '/notifications' ||
      route == '/achievements' ||
      route == '/challenges' ||
      route.startsWith('/subjects/') ||
      route.startsWith('/quiz/');
}
