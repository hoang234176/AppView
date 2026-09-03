class FolderItem {
  final String name;
  final String path;
  final String type;

  FolderItem({
    required this.name,
    required this.path,
    this.type = 'folder',
  });

  factory FolderItem.fromJson(Map<String, dynamic> json) {
    return FolderItem(
      name: json['name']?.toString() ?? '',
      path: json['path']?.toString() ?? '',
      type: json['type']?.toString() ?? 'folder',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'path': path,
      'type': type,
    };
  }
}
