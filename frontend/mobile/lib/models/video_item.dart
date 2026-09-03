class VideoItem {
  final String name;
  final String path;
  final String type;
  final String? url;
  final String? thumbnailUrl;
  final String? modTime;
  final int size;
  final int width;
  final int height;
  final String extension;
  final String resolution;

  VideoItem({
    required this.name,
    required this.path,
    this.type = 'video',
    this.url,
    this.thumbnailUrl,
    this.modTime,
    this.size = 0,
    this.width = 0,
    this.height = 0,
    this.extension = '',
    this.resolution = '',
  });

  factory VideoItem.fromJson(Map<String, dynamic> json) {
    int parsedSize = 0;
    if (json['size'] != null) {
      parsedSize = int.tryParse(json['size'].toString()) ?? 0;
    }
    int parsedWidth = 0;
    if (json['width'] != null) {
      parsedWidth = int.tryParse(json['width'].toString()) ?? 0;
    }
    int parsedHeight = 0;
    if (json['height'] != null) {
      parsedHeight = int.tryParse(json['height'].toString()) ?? 0;
    }
    return VideoItem(
      name: json['name']?.toString() ?? '',
      path: json['path']?.toString() ?? '',
      type: json['type']?.toString() ?? 'video',
      url: json['url']?.toString(),
      thumbnailUrl: json['thumbnail_url']?.toString(),
      modTime: json['mod_time']?.toString(),
      size: parsedSize,
      width: parsedWidth,
      height: parsedHeight,
      extension: json['extension']?.toString() ?? '',
      resolution: json['resolution']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'path': path,
      'type': type,
      'url': url,
      'thumbnail_url': thumbnailUrl,
      'mod_time': modTime,
      'size': size,
      'width': width,
      'height': height,
      'extension': extension,
      'resolution': resolution,
    };
  }
}
