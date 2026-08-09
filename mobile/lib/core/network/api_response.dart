final class PageMeta {
  final int page;
  final int limit;
  final int totalItems;
  final int totalPages;
  final bool hasNextPage;
  final bool hasPreviousPage;

  const PageMeta({
    required this.page,
    required this.limit,
    required this.totalItems,
    required this.totalPages,
    required this.hasNextPage,
    required this.hasPreviousPage,
  });

  factory PageMeta.fromJson(Map<String, dynamic> json) => PageMeta(
    page: (json['page'] as num?)?.toInt() ?? 1,
    limit: (json['limit'] as num?)?.toInt() ?? 20,
    totalItems: (json['totalItems'] as num?)?.toInt() ?? 0,
    totalPages: (json['totalPages'] as num?)?.toInt() ?? 0,
    hasNextPage: json['hasNextPage'] == true,
    hasPreviousPage: json['hasPreviousPage'] == true,
  );
}

Map<String, dynamic> requireObject(Object? value, [String label = 'response']) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  throw FormatException('$label must be a JSON object');
}

List<dynamic> requireList(Object? value, [String label = 'data']) {
  if (value is List) return value;
  throw FormatException('$label must be a JSON array');
}
