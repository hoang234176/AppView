import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:shimmer/shimmer.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../models/picture_item.dart';
import '../utils/formatters.dart';
import '../screens/lightbox_screen.dart';
import '../providers/app_state_provider.dart';
import 'media_info_dialog.dart';
import 'batch_action_dialog.dart';
import 'rolling_number.dart';

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
                leading: const Icon(Icons.copy_rounded, color: Color(0xFF8AB4F8)),
                title: const Text('Sao chép file', style: TextStyle(color: Colors.white, fontSize: 14)),
                onTap: () {
                  Navigator.of(ctx).pop();
                  BatchActionDialog.show(
                    context,
                    action: 'copy',
                    items: [
                      {'type': 'picture', 'name': picture.name, 'path': picture.path}
                    ],
                  );
                },
              ),
              ListTile(
                leading: const Icon(Icons.drive_file_move_rounded, color: Colors.amber),
                title: const Text('Di chuyển file', style: TextStyle(color: Colors.white, fontSize: 14)),
                onTap: () {
                  Navigator.of(ctx).pop();
                  BatchActionDialog.show(
                    context,
                    action: 'move',
                    items: [
                      {'type': 'picture', 'name': picture.name, 'path': picture.path}
                    ],
                  );
                },
              ),
              ListTile(
                leading: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent),
                title: const Text('Xóa ảnh này', style: TextStyle(color: Colors.redAccent, fontSize: 14)),
                onTap: () {
                  Navigator.of(ctx).pop();
                  BatchActionDialog.show(
                    context,
                    action: 'delete',
                    items: [
                      {'type': 'picture', 'name': picture.name, 'path': picture.path}
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
    if (pictures.isEmpty) return const SizedBox.shrink();
    final appState = context.watch<AppStateProvider>();

    final isSelectMode = appState.isSelectMode;
    final isAllPicturesSelected = appState.isAllPicturesSelected;

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
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text('(', style: TextStyle(fontSize: 13, fontFamily: 'monospace', color: Color(0xFF80868B))),
                        RollingNumber(
                          value: pictures.length,
                          style: const TextStyle(
                            fontSize: 13,
                            fontFamily: 'monospace',
                            color: Color(0xFF80868B),
                          ),
                        ),
                        if (totalCount != null && totalCount! > pictures.length) ...[
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
                    onTap: () => appState.toggleSelectAllPictures(),
                    behavior: HitTestBehavior.opaque,
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        color: isAllPicturesSelected ? AppTheme.googleBlue : const Color(0xFF28292D),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: isAllPicturesSelected ? AppTheme.googleBlue : const Color(0xFF383C42),
                          width: 1.8,
                        ),
                        boxShadow: [
                          if (isAllPicturesSelected)
                            BoxShadow(
                              color: AppTheme.googleBlue.withValues(alpha: 0.3),
                              blurRadius: 6,
                            ),
                        ],
                      ),
                      child: isAllPicturesSelected
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
            itemCount: pictures.length,
            gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
              maxCrossAxisExtent: 180,
              childAspectRatio: 0.70,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
            ),
            itemBuilder: (context, index) {
              final picture = pictures[index];
              return _buildPictureCard(context, picture, index, appState);
            },
          ),
        ],
      ),
    );
  }

  Widget _buildPictureCard(
    BuildContext context,
    PictureItem picture,
    int index,
    AppStateProvider appState,
  ) {
    final thumbUrl = picture.thumbnailUrl ?? picture.url ?? '';
    final isSelectMode = appState.isSelectMode;
    final isSelected = appState.isPictureSelected(picture.path);

    return InkWell(
      onLongPress: () {
        if (!isSelectMode) {
          appState.enterSelectModeWithItem(type: 'picture', path: picture.path);
        }
      },
      onTap: () {
        if (isSelectMode) {
          appState.toggleSelectItem(type: 'picture', path: picture.path);
        } else {
          _openLightbox(context, index);
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
                  : Colors.black.withValues(alpha: 0.2),
              blurRadius: isSelected ? 8 : 6,
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
