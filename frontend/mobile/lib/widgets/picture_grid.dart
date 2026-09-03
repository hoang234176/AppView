import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:shimmer/shimmer.dart';
import '../theme/app_theme.dart';
import '../models/picture_item.dart';
import '../utils/formatters.dart';
import '../screens/lightbox_screen.dart';
import 'media_info_dialog.dart';
import 'folder_action_dialogs.dart';

class PictureGrid extends StatelessWidget {
  final List<PictureItem> pictures;
  final List<PictureItem>? allPictures;
  final int? totalCount;

  const PictureGrid({
    super.key,
    required this.pictures,
    this.allPictures,
    this.totalCount,
  });

  void _openLightbox(BuildContext context, int index) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (ctx) => LightboxScreen(
          pictures: allPictures ?? pictures,
          initialIndex: index,
        ),
      ),
    );
  }

  void _showPictureActionMenu(BuildContext context, PictureItem picture) {
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
                    name: picture.name,
                    path: picture.path,
                    thumbnailUrl: picture.thumbnailUrl,
                    url: picture.url,
                    size: picture.size,
                    width: picture.width,
                    height: picture.height,
                    modTime: picture.modTime,
                  );
                },
              ),
              ListTile(
                leading: const Icon(Icons.drive_file_move_rounded, color: Colors.amber),
                title: const Text('Di chuyển file', style: TextStyle(color: Colors.white, fontSize: 14)),
                onTap: () {
                  Navigator.of(ctx).pop();
                  MoveItemDialog.show(context, srcPath: picture.path, itemName: picture.name, isFolder: false);
                },
              ),
              ListTile(
                leading: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent),
                title: const Text('Xóa ảnh này', style: TextStyle(color: Colors.redAccent, fontSize: 14)),
                onTap: () {
                  Navigator.of(ctx).pop();
                  DeleteFileDialog.show(context, filePath: picture.path, fileName: picture.name);
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
    if (pictures.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Section Title
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 8),
            child: Row(
              children: [
                const Icon(Icons.image_rounded, color: AppTheme.googleBlue, size: 16),
                const SizedBox(width: 6),
                const Text(
                  'HÌNH ẢNH',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.2,
                    color: Color(0xFF9AA0A6),
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  '(${(totalCount != null && totalCount! > pictures.length) ? "${pictures.length}/$totalCount" : "${pictures.length}"})',
                  style: const TextStyle(
                    fontSize: 13,
                    fontFamily: 'monospace',
                    color: Color(0xFF80868B),
                  ),
                ),
              ],
            ),
          ),

          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: pictures.length,
            gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
              maxCrossAxisExtent: 180,
              childAspectRatio: 0.70,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
            ),
            itemBuilder: (context, index) {
              final picture = pictures[index];
              return _buildPictureCard(context, picture, index);
            },
          ),
        ],
      ),
    );
  }

  Widget _buildPictureCard(BuildContext context, PictureItem picture, int index) {
    final thumbUrl = picture.thumbnailUrl ?? picture.url ?? '';

    return InkWell(
      onTap: () => _openLightbox(context, index),
      borderRadius: AppTheme.borderRadius,
      child: Container(
        decoration: BoxDecoration(
          color: AppTheme.bgCard,
          borderRadius: AppTheme.borderRadius,
          border: Border.all(color: AppTheme.borderColor),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.2),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Thumbnail Aspect Ratio Container
            Expanded(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  CachedNetworkImage(
                    imageUrl: thumbUrl,
                    fit: BoxFit.cover,
                    placeholder: (context, url) => Shimmer.fromColors(
                      baseColor: const Color(0xFF202124),
                      highlightColor: const Color(0xFF2D2F31),
                      child: Container(color: const Color(0xFF202124)),
                    ),
                    errorWidget: (context, url, error) => _buildErrorImage(),
                  ),

                  // File Size Badge with Storage Icon
                  Positioned(
                    bottom: 6,
                    right: 6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.75),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.sd_storage_rounded,
                            size: 10,
                            color: AppTheme.googleBlue,
                          ),
                          const SizedBox(width: 3),
                          Text(
                            picture.size > 0 ? Formatters.formatFileSize(picture.size) : '2.4 MB',
                            style: const TextStyle(
                              fontSize: 9.5,
                              color: Colors.white70,
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

            // Card Footer Bar (Title & Info Button)
            Padding(
              padding: const EdgeInsets.only(left: 10, right: 2, top: 8, bottom: 8),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          picture.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 12.5,
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
                                Formatters.formatDate(picture.modTime),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 10,
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
                    onPressed: () => _showPictureActionMenu(context, picture),
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
    );
  }

  Widget _buildErrorImage() {
    return Container(
      color: const Color(0xFF18191C),
      child: const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.broken_image_rounded, color: Colors.grey, size: 24),
            SizedBox(height: 4),
            Text('Lỗi ảnh', style: TextStyle(fontSize: 11, color: Colors.grey)),
          ],
        ),
      ),
    );
  }
}
