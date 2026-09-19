import 'dart:math';
import 'package:intl/intl.dart';
import '../models/picture_item.dart';
import '../models/video_item.dart';
import '../api/api_config.dart';

class BreadcrumbItem {
  final String name;
  final String path;

  BreadcrumbItem({required this.name, required this.path});
}

class Formatters {
  Formatters._();

  /// Format ISO Date string to readable date: dd/MM/yyyy
  static String formatDate(String? isoString) {
    if (isoString == null || isoString.isEmpty) return 'Chưa có thông tin';
    try {
      final dateTime = DateTime.parse(isoString);
      final formatter = DateFormat('dd/MM/yyyy');
      return formatter.format(dateTime.toLocal());
    } catch (_) {
      return isoString;
    }
  }

  /// Split path string into breadcrumb array
  /// e.g., "Cosplay/Coser@不可爱羚 - 阮梅" -> [{ name: 'Trang chủ', path: '' }, { name: 'Cosplay', path: 'Cosplay' }, ...]
  static List<BreadcrumbItem> parseBreadcrumbs(String pathString, {String rootName = 'Trang chủ'}) {
    final breadcrumbs = [BreadcrumbItem(name: rootName, path: '')];
    if (pathString.trim().isEmpty) return breadcrumbs;

    final parts = pathString.split('/').where((p) => p.isNotEmpty).toList();
    String accumulatedPath = '';

    for (final part in parts) {
      accumulatedPath = accumulatedPath.isEmpty ? part : '$accumulatedPath/$part';
      breadcrumbs.add(BreadcrumbItem(
        name: part,
        path: accumulatedPath,
      ));
    }

    return breadcrumbs;
  }

  /// Clean path and encode URI segments safely
  static String encodePathSegments(String rawPath) {
    String cleanPath = rawPath.startsWith('/') ? rawPath.substring(1) : rawPath;
    final segments = cleanPath.split('/');
    return segments.map((seg) => Uri.encodeComponent(seg)).join('/');
  }

  /// Resolve relative URL to absolute URL using baseUrl origin
  static String _resolveAbsoluteUrl(String baseUrl, String? url) {
    if (url == null || url.isEmpty) return '';
    if (url.contains('://')) return url;
    final origin = baseUrl.replaceAll(RegExp(r'/api/v1/?$'), '');
    final slash = url.startsWith('/') ? '' : '/';
    return '$origin$slash$url';
  }

  /// Convert picture object to original image API endpoint (/pictures/:drive/*)
  static String getPictureUrl(String baseUrl, PictureItem picture) {
    if (picture.url != null && picture.url!.isNotEmpty) {
      return _resolveAbsoluteUrl(baseUrl, picture.url);
    }
    if (picture.path.isNotEmpty) {
      final cleanBase = baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl;
      final encodedPath = encodePathSegments(picture.path);
      final drive = ApiConfig.activeDrive.isNotEmpty ? Uri.encodeComponent(ApiConfig.activeDrive) : 'HDD';
      return '$cleanBase/pictures/$drive/$encodedPath';
    }
    return '';
  }

  /// Convert picture object to thumbnail API endpoint (/thumbnails/:drive/*) for grid preview
  static String getThumbnailUrl(String baseUrl, PictureItem picture) {
    if (picture.thumbnailUrl != null && picture.thumbnailUrl!.isNotEmpty) {
      return _resolveAbsoluteUrl(baseUrl, picture.thumbnailUrl);
    }
    if (picture.url != null && picture.url!.isNotEmpty) {
      final thumb = picture.url!.replaceAll('/pictures/', '/thumbnails/').replaceAll('/picture/', '/thumbnail/');
      return _resolveAbsoluteUrl(baseUrl, thumb);
    }
    if (picture.path.isNotEmpty) {
      final cleanBase = baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl;
      final encodedPath = encodePathSegments(picture.path);
      final drive = ApiConfig.activeDrive.isNotEmpty ? Uri.encodeComponent(ApiConfig.activeDrive) : 'HDD';
      return '$cleanBase/thumbnails/$drive/$encodedPath';
    }
    return '';
  }

  /// Format bytes to readable size string (B, KB, MB, GB, TB)
  static String formatFileSize(int? bytes) {
    if (bytes == null || bytes <= 0) return '0 B';
    const suffixes = ['B', 'KB', 'MB', 'GB', 'TB'];
    final i = (log(bytes) / log(1024)).floor();
    final size = bytes / pow(1024, i);
    return '${size.toStringAsFixed(1)} ${suffixes[i]}';
  }

  /// Format bytes to compact readable size (rounds to int if >= 10 to fit in compact UI)
  static String formatCompactFileSize(int? bytes) {
    if (bytes == null || bytes <= 0) return '0 B';
    const suffixes = ['B', 'KB', 'MB', 'GB', 'TB'];
    final i = (log(bytes) / log(1024)).floor();
    final size = bytes / pow(1024, i);
    final formatted = size >= 10 ? size.round().toString() : size.toStringAsFixed(1);
    return '$formatted ${suffixes[i]}';
  }

  /// Format drive used and total capacity concisely for compact UI cards
  /// e.g. usedVal: "42.5", usedUnit: "GB", totalVal: "466", totalUnit: "GB"
  static ({String usedVal, String usedUnit, String totalVal, String totalUnit}) formatDriveCapacity(int? usedBytes, int? totalBytes) {
    ({String val, String unit}) formatPart(int? bytes, bool roundInt) {
      if (bytes == null || bytes <= 0) {
        return (val: '0', unit: 'B');
      }
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      final i = (log(bytes) / log(1024)).floor().clamp(0, sizes.length - 1);
      final val = bytes / pow(1024, i);
      final numStr = roundInt && val >= 10
          ? val.round().toString()
          : (val == val.roundToDouble() ? val.toInt().toString() : val.toStringAsFixed(1));
      return (val: numStr, unit: sizes[i]);
    }

    final u = formatPart(usedBytes, false);
    final t = formatPart(totalBytes, true);
    return (usedVal: u.val, usedUnit: u.unit, totalVal: t.val, totalUnit: t.unit);
  }

  /// Format speed bytes per second to readable string (KB/s, MB/s)
  static String formatSpeed(int? bytesPerSec) {
    if (bytesPerSec == null || bytesPerSec <= 0) return '0 KB/s';
    if (bytesPerSec >= 1024 * 1024) {
      return '${(bytesPerSec / (1024 * 1024)).toStringAsFixed(1)} MB/s';
    }
    return '${(bytesPerSec / 1024).toStringAsFixed(0)} KB/s';
  }

  /// Get Video Streaming URL from /videos/* endpoint
  static String getVideoStreamUrl(String baseUrl, VideoItem video) {
    if (video.url != null && video.url!.isNotEmpty) {
      final rawUrl = _resolveAbsoluteUrl(baseUrl, video.url);
      final parts = rawUrl.split('?');
      final pathPart = parts.first;
      final queryPart = parts.length > 1 ? '?${parts.sublist(1).join('?')}' : '';
      final schemeIndex = pathPart.indexOf('://');
      if (schemeIndex != -1) {
        final hostIndex = pathPart.indexOf('/', schemeIndex + 3);
        if (hostIndex != -1) {
          final domain = pathPart.substring(0, hostIndex);
          final path = pathPart.substring(hostIndex + 1);
          final encodedPath = path.split('/').map((seg) {
            try {
              final decoded = Uri.decodeComponent(seg);
              return Uri.encodeComponent(decoded);
            } catch (_) {
              return Uri.encodeComponent(seg);
            }
          }).join('/');
          return '$domain/$encodedPath$queryPart';
        }
      }
      return rawUrl;
    }
    if (video.path.isNotEmpty) {
      final cleanBase = baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl;
      final cleanPath = video.path.startsWith('/') ? video.path.substring(1) : video.path;
      final encodedPath = cleanPath.split('/').map((seg) => Uri.encodeComponent(seg)).join('/');
      final drive = ApiConfig.activeDrive.isNotEmpty ? Uri.encodeComponent(ApiConfig.activeDrive) : 'HDD';
      return '$cleanBase/videos/$drive/$encodedPath';
    }
    return '';
  }

  /// Convert video object to thumbnail API endpoint (/thumbnails/:drive/*) for grid preview
  static String getVideoThumbnailUrl(String baseUrl, VideoItem video) {
    if (video.thumbnailUrl != null && video.thumbnailUrl!.isNotEmpty) {
      return _resolveAbsoluteUrl(baseUrl, video.thumbnailUrl);
    }
    if (video.url != null && video.url!.isNotEmpty) {
      final thumb = video.url!.replaceAll('/videos/', '/thumbnails/').replaceAll('/video/', '/thumbnail/');
      return _resolveAbsoluteUrl(baseUrl, thumb);
    }
    if (video.path.isNotEmpty) {
      final cleanBase = baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl;
      final encodedPath = encodePathSegments(video.path);
      final drive = ApiConfig.activeDrive.isNotEmpty ? Uri.encodeComponent(ApiConfig.activeDrive) : 'HDD';
      return '$cleanBase/thumbnails/$drive/$encodedPath';
    }
    return '';
  }

  /// Detect file category (picture, video, archive) from filename
  static String getFileCategory(String? filenameOrUrl) {
    if (filenameOrUrl == null || filenameOrUrl.isEmpty) return 'archive';
    final clean = filenameOrUrl.split('?').first.toLowerCase();

    final videoExts = ['.mp4', '.mkv', '.mov', '.avi', '.webm', '.m4v', '.flv', '.ts'];
    if (videoExts.any((ext) => clean.endsWith(ext))) return 'video';

    final pictureExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.bmp', '.svg'];
    if (pictureExts.any((ext) => clean.endsWith(ext))) return 'picture';

    return 'archive';
  }

  /// Format seconds to mm:ss string
  static String formatDuration(Duration duration) {
    final minutes = duration.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = duration.inSeconds.remainder(60).toString().padLeft(2, '0');
    final hours = duration.inHours;
    if (hours > 0) {
      final hoursStr = hours.toString().padLeft(2, '0');
      return '$hoursStr:$minutes:$seconds';
    }
    return '$minutes:$seconds';
  }
}
