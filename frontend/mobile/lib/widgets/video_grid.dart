import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:shimmer/shimmer.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../models/video_item.dart';
import '../utils/formatters.dart';
import '../screens/video_player_screen.dart';
import '../providers/app_state_provider.dart';
import '../api/api_config.dart';
import 'media_info_dialog.dart';
import 'batch_action_dialog.dart';
import 'rolling_number.dart';

class VideoGrid extends StatelessWidget {
  final List<VideoItem> videos;
  final int? totalCount;

  const VideoGrid({
    super.key,
    required this.videos,
    this.totalCount,
  });

  void _openVideo(BuildContext context, int index) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (ctx) => VideoPlayerScreen(
          videos: videos,
          initialIndex: index,
        ),
      ),
    );
  }

  void _showVideoActionMenu(BuildContext context, VideoItem video) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.bgBlock,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.info_outline_rounded, color: AppTheme.googleBlue),
                title: const Text('Thông tin file', style: TextStyle(color: Colors.white, fontSize: 14)),
                onTap: () {
                  Navigator.of(ctx).pop();
                  MediaInfoDialog.show(
                    context,
                    name: video.name,
                    path: video.path,
                    thumbnailUrl: video.thumbnailUrl,
                    url: video.url,
                    size: video.size,
                    width: video.width,
                    height: video.height,
                    extension: video.extension,
                    resolution: video.resolution,
                    modTime: video.modTime,
                    isVideo: true,
                  );
                },
              ),
              ListTile(
                leading: const Icon(Icons.copy_rounded, color: Color(0xFF8AB4F8)),
                title: const Text('Sao chép video', style: TextStyle(color: Colors.white, fontSize: 14)),
                onTap: () {
                  Navigator.of(ctx).pop();
                  BatchActionDialog.show(
                    context,
                    action: 'copy',
                    items: [
                      {'type': 'video', 'name': video.name, 'path': video.path}
                    ],
                  );
                },
              ),
              ListTile(
                leading: const Icon(Icons.drive_file_move_rounded, color: Colors.amber),
                title: const Text('Di chuyển video', style: TextStyle(color: Colors.white, fontSize: 14)),
                onTap: () {
                  Navigator.of(ctx).pop();
                  BatchActionDialog.show(
                    context,
                    action: 'move',
                    items: [
                      {'type': 'video', 'name': video.name, 'path': video.path}
                    ],
                  );
                },
              ),
              ListTile(
                leading: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent),
                title: const Text('Xóa video này', style: TextStyle(color: Colors.redAccent, fontSize: 14)),
                onTap: () {
                  Navigator.of(ctx).pop();
                  BatchActionDialog.show(
                    context,
                    action: 'delete',
                    items: [
                      {'type': 'video', 'name': video.name, 'path': video.path}
                    ],
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (videos.isEmpty) return const SizedBox.shrink();
    final appState = context.watch<AppStateProvider>();
    final isSelectMode = appState.isSelectMode;
    final isAllVideosSelected = appState.isAllVideosSelected;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Section Title
          Padding(
            padding: const EdgeInsets.only(left: 4, right: 4, bottom: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.video_library_rounded, size: 16, color: AppTheme.videoPurple),
                    const SizedBox(width: 6),
                    const Text(
                      'VIDEO',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.0,
                        color: Color(0xFF9AA0A6),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text('(', style: TextStyle(fontSize: 13, fontFamily: 'monospace', color: Color(0xFF80868B))),
                        RollingNumber(
                          value: videos.length,
                          style: const TextStyle(
                            fontSize: 13,
                            fontFamily: 'monospace',
                            color: Color(0xFF80868B),
                          ),
                        ),
                        if (totalCount != null && totalCount! > videos.length) ...[
                          const Text('/', style: TextStyle(fontSize: 13, fontFamily: 'monospace', color: Color(0xFF80868B))),
                          RollingNumber(
                            value: totalCount!,
                            style: const TextStyle(
                              fontSize: 13,
                              fontFamily: 'monospace',
                              color: Color(0xFF80868B),
                            ),
                          ),
                        ],
                        const Text(')', style: TextStyle(fontSize: 13, fontFamily: 'monospace', color: Color(0xFF80868B))),
                      ],
                    ),
                  ],
                ),
                if (isSelectMode)
                  GestureDetector(
                    onTap: () => appState.toggleSelectAllVideos(),
                    behavior: HitTestBehavior.opaque,
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        color: isAllVideosSelected ? AppTheme.googleBlue : const Color(0xFF28292D),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: isAllVideosSelected ? AppTheme.googleBlue : const Color(0xFF383C42),
                          width: 1.8,
                        ),
                        boxShadow: [
                          if (isAllVideosSelected)
                            BoxShadow(
                              color: AppTheme.googleBlue.withValues(alpha: 0.3),
                              blurRadius: 6,
                            ),
                        ],
                      ),
                      child: isAllVideosSelected
                          ? const Icon(Icons.check_rounded, size: 16, color: Colors.white)
                          : null,
                    ),
                  ),
              ],
            ),
          ),

          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: videos.length,
            gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
              maxCrossAxisExtent: 320,
              mainAxisExtent: 228,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
            ),
            itemBuilder: (context, index) {
              final video = videos[index];
              return _buildVideoCard(context, video, index, appState);
            },
          ),
        ],
      ),
    );
  }

  Widget _buildVideoCard(BuildContext context, VideoItem video, int index, AppStateProvider appState) {
    final thumbUrl = (video.thumbnailUrl != null && video.thumbnailUrl!.isNotEmpty)
        ? video.thumbnailUrl!
        : Formatters.getVideoThumbnailUrl(ApiConfig.baseUrl, video);
    final isSelectMode = appState.isSelectMode;
    final isSelected = appState.isVideoSelected(video.path);

    return InkWell(
      onLongPress: () {
        if (!isSelectMode) {
          appState.enterSelectModeWithItem(type: 'video', path: video.path);
        }
      },
      onTap: () {
        if (isSelectMode) {
          appState.toggleSelectItem(type: 'video', path: video.path);
        } else {
          _openVideo(context, index);
        }
      },
      borderRadius: AppTheme.borderRadius,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF1E2638) : AppTheme.bgCard,
          borderRadius: AppTheme.borderRadius,
          boxShadow: [
            BoxShadow(
              color: isSelected
                  ? AppTheme.googleBlue.withValues(alpha: 0.25)
                  : Colors.black.withValues(alpha: 0.3),
              blurRadius: isSelected ? 10 : 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        foregroundDecoration: BoxDecoration(
          borderRadius: AppTheme.borderRadius,
          border: Border.all(
            color: isSelected ? AppTheme.googleBlue : AppTheme.borderColor,
            width: isSelected ? 2.0 : 1.0,
          ),
        ),
        child: ClipRRect(
          borderRadius: AppTheme.borderRadius,
          child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Thumbnail Aspect Ratio Box with Centered Play Button
            Expanded(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Container(color: const Color(0xFF121316)),
                  if (thumbUrl.isNotEmpty)
                    CachedNetworkImage(
                      imageUrl: thumbUrl,
                      fit: BoxFit.cover,
                      placeholder: (context, url) => Shimmer.fromColors(
                        baseColor: const Color(0xFF202124),
                        highlightColor: const Color(0xFF2D2F31),
                        child: Container(color: const Color(0xFF202124)),
                      ),
                      errorWidget: (context, url, error) => const Center(
                        child: Icon(Icons.movie_creation_outlined, color: Colors.white24, size: 36),
                      ),
                    )
                  else
                    const Center(
                      child: Icon(Icons.movie_creation_outlined, color: Colors.white24, size: 36),
                    ),

                  // Overlay Dark Gradient for Contrast
                  Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          Colors.transparent,
                          Colors.black.withValues(alpha: 0.6),
                        ],
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                      ),
                    ),
                  ),

                  // Big Center Play Button
                  Center(
                    child: Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: AppTheme.videoPurpleDeep.withValues(alpha: 0.85),
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.4),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.play_arrow_rounded,
                        color: Colors.white,
                        size: 28,
                      ),
                    ),
                  ),

                  // Selection Checkbox Overlay in Select Mode
                  if (isSelectMode)
                    Positioned(
                      top: 8,
                      right: 8,
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 150),
                        width: 24,
                        height: 24,
                        decoration: BoxDecoration(
                          color: isSelected ? AppTheme.googleBlue : Colors.black.withValues(alpha: 0.5),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: isSelected ? Colors.white : Colors.white.withValues(alpha: 0.8),
                            width: 1.8,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.4),
                              blurRadius: 4,
                            ),
                          ],
                        ),
                        child: isSelected
                            ? const Icon(Icons.check_rounded, size: 16, color: Colors.white)
                            : null,
                      ),
                    ),

                  // File Size Badge (Bottom Right)
                  Positioned(
                    bottom: 8,
                    right: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.75),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.sd_storage_rounded,
                            size: 11,
                            color: AppTheme.videoPurple,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            video.size > 0 ? Formatters.formatFileSize(video.size) : '45.2 MB',
                            style: const TextStyle(
                              fontSize: 10,
                              color: AppTheme.videoPurple,
                              fontFamily: 'monospace',
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Video Title & Meta Bar
            Padding(
              padding: const EdgeInsets.only(left: 10, right: 2, top: 8, bottom: 8),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          video.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Row(
                          children: [
                            const Icon(
                              Icons.calendar_today_rounded,
                              size: 10,
                              color: Color(0xFF9AA0A6),
                            ),
                            const SizedBox(width: 3),
                            Expanded(
                              child: Text(
                                Formatters.formatDate(video.modTime),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: Color(0xFF9AA0A6),
                                  fontFamily: 'monospace',
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.more_vert_rounded, color: Color(0xFF80868B), size: 18),
                    onPressed: () => _showVideoActionMenu(context, video),
                    padding: EdgeInsets.zero,
                    alignment: Alignment.center,
                    constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                    splashRadius: 18,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ),
  );
  }
}
