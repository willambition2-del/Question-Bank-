class UpdateModel {
  final String id;
  final String title;
  final String description;
  final String date;
  final String type; // 'question', 'feature', 'contest', 'performance'

  const UpdateModel({
    required this.id,
    required this.title,
    required this.description,
    required this.date,
    required this.type,
  });
}
