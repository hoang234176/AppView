import 'dart:io';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';

class ClientCacheInfo {
  final int totalSizeBytes;
  final String formattedSize;
  final int fileCount;

  ClientCacheInfo({
    required this.totalSizeBytes,
    required this.formattedSize,
    required this.fileCount,
  });
}

class ClientCacheManager {
  ClientCacheManager._();

  static Future<List<Directory>> _getCacheDirectories() async {
    final dirs = <Directory>[];
    try {
      final tempDir = await getTemporaryDirectory();
      dirs.add(tempDir);
    } catch (_) {}

    try {
      final appSupportDir = await getApplicationSupportDirectory();
      final cacheManagerDir = Directory('${appSupportDir.path}/libCachedImageData');
      if (cacheManagerDir.existsSync()) {
        dirs.add(cacheManagerDir);
      }
    } catch (_) {}

    return dirs;
  }

  /// Calculate total size of local mobile app cache directories
  static Future<ClientCacheInfo> getClientCacheInfo() async {
    int totalBytes = 0;
    int fileCount = 0;

    final dirs = await _getCacheDirectories();
    for (final dir in dirs) {
      if (!dir.existsSync()) continue;
      try {
        await for (final entity in dir.list(recursive: true, followLinks: false)) {
          if (entity is File) {
            try {
              totalBytes += await entity.length();
              fileCount++;
            } catch (_) {}
          }
        }
      } catch (_) {}
    }

    String formatted = '${(totalBytes / (1024 * 1024)).toStringAsFixed(2)} MB';
    if (totalBytes >= 1024 * 1024 * 1024) {
      formatted = '${(totalBytes / (1024 * 1024 * 1024)).toStringAsFixed(2)} GB';
    } else if (totalBytes < 1024 * 1024) {
      formatted = '${(totalBytes / 1024).toStringAsFixed(1)} KB';
    }

    return ClientCacheInfo(
      totalSizeBytes: totalBytes,
      formattedSize: formatted,
      fileCount: fileCount,
    );
  }

  /// Clear local client cache (Flutter image memory cache, CachedNetworkImage, temp dir)
  static Future<bool> clearClientCache() async {
    try {
      // 1. Clear Flutter Image Memory Cache
      PaintingBinding.instance.imageCache.clear();
      PaintingBinding.instance.imageCache.clearLiveImages();

      // 2. Clear Default Cache Manager (CachedNetworkImage)
      await DefaultCacheManager().emptyCache();

      // 3. Clear Cache Directories files
      final dirs = await _getCacheDirectories();
      for (final dir in dirs) {
        if (!dir.existsSync()) continue;
        try {
          await for (final entity in dir.list(recursive: false, followLinks: false)) {
            try {
              await entity.delete(recursive: true);
            } catch (_) {}
          }
        } catch (_) {}
      }
      return true;
    } catch (_) {
      return false;
    }
  }
}
