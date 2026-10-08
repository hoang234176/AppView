class FolderItem {
  final String name;
  final String path;
  final String type;
  final List<String> previews;

  FolderItem({
    required this.name,
    required this.path,
    this.type = 'folder',
    this.previews = const [],
  });

  factory FolderItem.fromJson(Map<String, dynamic> json) {
    List<String> parsedPreviews = [];
    if (json['previews'] is List) {
      parsedPreviews = (json['previews'] as List)
          .map((item) => item.toString())
          .where((item) => item.isNotEmpty)
          .toList();
    }
    return FolderItem(
      name: json['name']?.toString() ?? '',
      path: json['path']?.toString() ?? '',
      type: json['type']?.toString() ?? 'folder',
      previews: parsedPreviews,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'path': path,
      'type': type,
      'previews': previews,
    };
  }
}
