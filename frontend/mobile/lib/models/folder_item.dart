class FolderItem {
  final String name;
  final String path;
  final String type;
  final List<String> previews;
  final int pictureCount;
  final int videoCount;

  FolderItem({
    required this.name,
    required this.path,
    this.type = 'folder',
    this.previews = const [],
    this.pictureCount = 0,
    this.videoCount = 0,
  });

  factory FolderItem.fromJson(Map<String, dynamic> json) {
    List<String> parsedPreviews = [];
    if (json['previews'] is List) {
      parsedPreviews = (json['previews'] as List)
          .map((item) => item.toString())
          .where((item) => item.isNotEmpty)
          .toList();
    }

    int parseCount(dynamic value) {
      if (value is int) return value;
      if (value is num) return value.toInt();
      if (value is String) return int.tryParse(value) ?? 0;
      return 0;
    }

    return FolderItem(
      name: json['name']?.toString() ?? '',
      path: json['path']?.toString() ?? '',
      type: json['type']?.toString() ?? 'folder',
      previews: parsedPreviews,
      pictureCount: parseCount(json['picture_count'] ?? json['pictureCount']),
      videoCount: parseCount(json['video_count'] ?? json['videoCount']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'path': path,
      'type': type,
      'previews': previews,
      'picture_count': pictureCount,
      'video_count': videoCount,
    };
  }
}
