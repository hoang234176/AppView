import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../theme/app_theme.dart';
import '../utils/formatters.dart';

class MediaInfoDialog extends StatelessWidget {
  final String name;
  final String path;
  final String? thumbnailUrl;
  final String? url;
  final int size;
  final int width;
  final int height;
  final String extension;
  final String resolution;
  final String? modTime;
  final bool isVideo;

  const MediaInfoDialog({
    super.key,
    required this.name,
    required this.path,
    this.thumbnailUrl,
    this.url,
    this.size = 0,
    this.width = 0,
    this.height = 0,
    this.extension = '',
    this.resolution = '',
    this.modTime,
    this.isVideo = false,
  });

  static Future<void> show(
    BuildContext context, {
    required String name,
    required String path,
    String? thumbnailUrl,
    String? url,
    int size = 0,
    int width = 0,
    int height = 0,
    String extension = '',
    String resolution = '',
    String? modTime,
    bool isVideo = false,
  }) {
    return showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'Dismiss',
      barrierColor: Colors.black.withValues(alpha: 0.75),
      transitionDuration: const Duration(milliseconds: 200),
      pageBuilder: (ctx, anim1, anim2) => MediaInfoDialog(
        name: name,
        path: path,
        thumbnailUrl: thumbnailUrl,
        url: url,
        size: size,
        width: width,
        height: height,
        extension: extension,
        resolution: resolution,
        modTime: modTime,
        isVideo: isVideo,
      ),
      transitionBuilder: (ctx, anim1, anim2, child) {
        return FadeTransition(
          opacity: anim1,
          child: ScaleTransition(
            scale: Tween<double>(begin: 0.95, end: 1.0).animate(
              CurvedAnimation(parent: anim1, curve: Curves.easeOutCubic),
            ),
            child: child,
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final thumb = thumbnailUrl ?? url ?? '';
    final dimensionsStr = (width > 0 && height > 0)
        ? '$width × $height'
        : (resolution.isNotEmpty ? resolution : 'Không rõ');

    final extStr = extension.isNotEmpty
        ? extension.toUpperCase()
        : (name.contains('.') ? name.split('.').last.toUpperCase() : 'UNKNOWN');

    return Dialog(
      backgroundColor: AppTheme.bgBlock,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: const BorderSide(color: AppTheme.borderColor),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: (isVideo ? AppTheme.videoPurple : AppTheme.googleBlue)
                            .withValues(alpha: 0.15),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        isVideo ? Icons.movie_rounded : Icons.image_rounded,
                        color: isVideo ? AppTheme.videoPurple : AppTheme.googleBlue,
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      'Thông tin ${isVideo ? "Video" : "Hình ảnh"}',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded, color: Colors.white54),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Thumbnail Preview Card
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppTheme.bgCard,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppTheme.borderColor),
              ),
              child: Row(
                // Thumbnail bám phía trên khi tên dài; tên ngắn được căn giữa
                // trong chiều cao thumbnail.
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: thumb.isNotEmpty
                        ? CachedNetworkImage(
                            imageUrl: thumb,
                            width: 54,
                            height: 54,
                            fit: BoxFit.cover,
                            errorWidget: (_, __, ___) => Container(
                              width: 54,
                              height: 54,
                              color: Colors.black26,
                              child: Icon(
                                isVideo ? Icons.movie_rounded : Icons.image_rounded,
                                color: Colors.white38,
                              ),
                            ),
                          )
                        : Container(
                            width: 54,
                            height: 54,
                            color: Colors.black26,
                            child: Icon(
                              isVideo ? Icons.movie_rounded : Icons.image_rounded,
                              color: Colors.white38,
                            ),
                          ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(minHeight: 54),
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          name,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                          softWrap: true,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Detailed Info Grid Container
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppTheme.bgCard,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppTheme.borderColor),
              ),
              child: Column(
                children: [
                  _buildInfoRow(
                    icon: Icons.sd_storage_rounded,
                    iconColor: AppTheme.videoPurple,
                    label: 'Dung lượng tệp:',
                    value: Formatters.formatFileSize(size),
                  ),
                  const Divider(color: AppTheme.borderColor, height: 16),
                  _buildInfoRow(
                    icon: Icons.aspect_ratio_rounded,
                    iconColor: AppTheme.googleBlue,
                    label: 'Độ phân giải:',
                    value: dimensionsStr,
                  ),
                  const Divider(color: AppTheme.borderColor, height: 16),
                  _buildInfoRow(
                    icon: Icons.insert_drive_file_rounded,
                    iconColor: AppTheme.folderYellow,
                    label: 'Định dạng tệp:',
                    value: '.$extStr',
                    valueColor: AppTheme.folderYellow,
                  ),
                  const Divider(color: AppTheme.borderColor, height: 16),
                  _buildInfoRow(
                    icon: Icons.calendar_today_rounded,
                    iconColor: const Color(0xFF10B981),
                    label: 'Ngày cập nhật:',
                    value: Formatters.formatDate(modTime),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),
            Align(
              alignment: Alignment.centerRight,
              child: ElevatedButton(
                onPressed: () => Navigator.of(context).pop(),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.googleBlue,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                ),
                child: const Text('Đóng', style: TextStyle(fontSize: 12, color: Colors.white)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow({
    required IconData icon,
    required Color iconColor,
    required String label,
    required String value,
    Color? valueColor,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            Icon(icon, size: 16, color: iconColor),
            const SizedBox(width: 8),
            Text(
              label,
              style: const TextStyle(fontSize: 12, color: Colors.white70),
            ),
          ],
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: 12,
            fontFamily: 'monospace',
            fontWeight: FontWeight.bold,
            color: valueColor ?? Colors.white,
          ),
        ),
      ],
    );
  }
}
