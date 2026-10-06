import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../theme/app_theme.dart';
import '../api/api_config.dart';
import '../utils/formatters.dart';

class ConflictItemModel {
  final String fileName;
  final String type;
  final ConflictSideModel src;
  final ConflictSideModel dest;

  ConflictItemModel({
    required this.fileName,
    required this.type,
    required this.src,
    required this.dest,
  });

  factory ConflictItemModel.fromJson(Map<String, dynamic> json) {
    return ConflictItemModel(
      fileName: json['file_name']?.toString() ?? '',
      type: json['type']?.toString() ?? 'file',
      src: ConflictSideModel.fromJson(json['src'] as Map<String, dynamic>? ?? {}),
      dest: ConflictSideModel.fromJson(json['dest'] as Map<String, dynamic>? ?? {}),
    );
  }
}

class ConflictSideModel {
  final String drive;
  final String path;
  final String name;
  final int size;
  final String modTime;
  final bool isDir;
  final String? thumbnailUrl;

  ConflictSideModel({
    required this.drive,
    required this.path,
    required this.name,
    required this.size,
    required this.modTime,
    required this.isDir,
    this.thumbnailUrl,
  });

  factory ConflictSideModel.fromJson(Map<String, dynamic> json) {
    return ConflictSideModel(
      drive: json['drive']?.toString() ?? '',
      path: json['path']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      size: (json['size'] as num?)?.toInt() ?? 0,
      modTime: json['mod_time']?.toString() ?? '',
      isDir: json['is_dir'] == true,
      thumbnailUrl: json['thumbnail_url']?.toString(),
    );
  }
}

class ConflictResolutionDialog extends StatefulWidget {
  final List<ConflictItemModel> conflicts;
  final String action;

  const ConflictResolutionDialog({
    super.key,
    required this.conflicts,
    required this.action,
  });

  static Future<Map<String, String>?> show(
    BuildContext context, {
    required List<ConflictItemModel> conflicts,
    required String action,
  }) {
    return showDialog<Map<String, String>>(
      context: context,
      barrierDismissible: false,
      builder: (_) => ConflictResolutionDialog(
        conflicts: conflicts,
        action: action,
      ),
    );
  }

  @override
  State<ConflictResolutionDialog> createState() => _ConflictResolutionDialogState();
}

class _ConflictResolutionDialogState extends State<ConflictResolutionDialog> {
  int _currentIndex = 0;
  bool _applyToAll = false;
  final Map<String, String> _resolutions = {};

  ConflictItemModel get _currentConflict => widget.conflicts[_currentIndex];
  bool get _isLast => _currentIndex >= widget.conflicts.length - 1;

  void _handleChoice(String choice) {
    // choice: 'skip' | 'overwrite' | 'keep_both'
    _resolutions[_currentConflict.fileName] = choice;
    if (_currentConflict.src.path.isNotEmpty) {
      _resolutions[_currentConflict.src.path] = choice;
    }

    if (_applyToAll || _isLast) {
      // Set choice for all remaining conflicts
      for (int i = _currentIndex + 1; i < widget.conflicts.length; i++) {
        final c = widget.conflicts[i];
        _resolutions[c.fileName] = choice;
        if (c.src.path.isNotEmpty) {
          _resolutions[c.src.path] = choice;
        }
      }
      Navigator.of(context).pop(_resolutions);
      return;
    }

    setState(() {
      _currentIndex++;
    });
  }

  Widget _buildMediaThumbnail(ConflictSideModel side, String type) {
    final isVid = type == 'video' ||
        RegExp(r'\.(mp4|mkv|webm|avi|mov|flv|wmv|m4v)$', caseSensitive: false).hasMatch(side.name);
    final isPic = type == 'picture' ||
        RegExp(r'\.(jpg|jpeg|png|gif|webp|bmp|svg)$', caseSensitive: false).hasMatch(side.name);
    final isDir = side.isDir || type == 'folder';

    if (isDir) {
      return Container(
        height: 120,
        decoration: BoxDecoration(
          color: const Color(0xFF141518),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.borderColor),
        ),
        alignment: Alignment.center,
        child: const Icon(Icons.folder_rounded, size: 48, color: Colors.amber),
      );
    }

    final rawThumb = side.thumbnailUrl;
    final thumbUrl = (rawThumb != null && rawThumb.isNotEmpty)
        ? Formatters.toAbsoluteUrl(rawThumb, ApiConfig.baseUrl)
        : '';

    if (thumbUrl.isNotEmpty && (isVid || isPic)) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Container(
          height: 120,
          color: const Color(0xFF141518),
          child: Stack(
            fit: StackFit.expand,
            children: [
              CachedNetworkImage(
                imageUrl: thumbUrl,
                fit: BoxFit.cover,
                placeholder: (context, url) => Container(
                  color: const Color(0xFF1B1C20),
                  child: const Center(
                    child: SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.googleBlue),
                    ),
                  ),
                ),
                errorWidget: (context, url, error) => Center(
                  child: Icon(
                    isVid ? Icons.videocam_rounded : Icons.image_rounded,
                    size: 40,
                    color: isVid ? AppTheme.googleBlue : const Color(0xFF10B981),
                  ),
                ),
              ),
              Positioned(
                bottom: 6,
                right: 6,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.75),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: Colors.white12),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        isVid ? Icons.play_arrow_rounded : Icons.image_rounded,
                        size: 11,
                        color: Colors.white,
                      ),
                      const SizedBox(width: 3),
                      Text(
                        isVid ? 'Video' : 'Ảnh',
                        style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Container(
      height: 120,
      decoration: BoxDecoration(
        color: const Color(0xFF141518),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.borderColor),
      ),
      alignment: Alignment.center,
      child: Icon(
        isVid ? Icons.videocam_rounded : (isPic ? Icons.image_rounded : Icons.insert_drive_file_rounded),
        size: 44,
        color: isVid ? AppTheme.googleBlue : (isPic ? Colors.tealAccent : Colors.white54),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final conflict = _currentConflict;
    final total = widget.conflicts.length;

    return Dialog(
      backgroundColor: AppTheme.bgBlock,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 480),
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header
            Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: Colors.amber.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.amber.withValues(alpha: 0.3)),
                  ),
                  child: const Icon(Icons.warning_amber_rounded, color: Colors.amber, size: 18),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Tệp đã tồn tại: "${conflict.fileName}"',
                        style: const TextStyle(
                          fontSize: 14.5,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                if (total > 1) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppTheme.bgCard,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppTheme.borderColor),
                    ),
                    child: Text(
                      '${_currentIndex + 1} / $total',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white70),
                    ),
                  ),
                  const SizedBox(width: 6),
                ],
                IconButton(
                  onPressed: () => Navigator.of(context).pop(null),
                  icon: const Icon(Icons.close_rounded, size: 18, color: Colors.white60),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Side-by-Side Thumbnails
            Row(
              children: [
                // Left: Destination
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.storage_rounded, size: 13, color: Colors.white60),
                          SizedBox(width: 5),
                          Text('Tệp hiện tại', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: Colors.white70)),
                        ],
                      ),
                      const SizedBox(height: 6),
                      _buildMediaThumbnail(conflict.dest, conflict.type),
                      const SizedBox(height: 5),
                      Text(
                        conflict.dest.name.isNotEmpty ? conflict.dest.name : conflict.fileName,
                        style: const TextStyle(fontSize: 11, color: Colors.white70, fontFamily: 'monospace'),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                // Right: Source
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.arrow_forward_rounded, size: 13, color: AppTheme.googleBlue),
                          SizedBox(width: 5),
                          Text('Tệp chuyển đến', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: AppTheme.googleBlue)),
                        ],
                      ),
                      const SizedBox(height: 6),
                      _buildMediaThumbnail(conflict.src, conflict.type),
                      const SizedBox(height: 5),
                      Text(
                        conflict.src.name.isNotEmpty ? conflict.src.name : conflict.fileName,
                        style: const TextStyle(fontSize: 11, color: Colors.white70, fontFamily: 'monospace'),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Checkbox: Áp dụng cho các tệp trùng tiếp theo
            if (total > 1 && !_isLast) ...[
              InkWell(
                onTap: () => setState(() => _applyToAll = !_applyToAll),
                borderRadius: BorderRadius.circular(8),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      Icon(
                        _applyToAll ? Icons.check_box_rounded : Icons.check_box_outline_blank_rounded,
                        size: 18,
                        color: _applyToAll ? AppTheme.googleBlue : Colors.white54,
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'Áp dụng cho các tệp trùng tiếp theo',
                        style: TextStyle(fontSize: 12, color: Colors.white70),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 14),
            ],

            // 3 Action Buttons (No sub-text)
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                  onPressed: () => _handleChoice('skip'),
                  style: TextButton.styleFrom(
                    backgroundColor: AppTheme.bgCard,
                    foregroundColor: Colors.white70,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Bỏ qua', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12.5)),
                ),
                const SizedBox(width: 8),
                TextButton(
                  onPressed: () => _handleChoice('overwrite'),
                  style: TextButton.styleFrom(
                    backgroundColor: Colors.redAccent.withValues(alpha: 0.15),
                    foregroundColor: Colors.redAccent,
                    side: BorderSide(color: Colors.redAccent.withValues(alpha: 0.35)),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Ghi đè', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12.5)),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed: () => _handleChoice('keep_both'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.googleBlue,
                    foregroundColor: const Color(0xFF141518),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                  ),
                  child: const Text('Giữ cả hai', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12.5)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
