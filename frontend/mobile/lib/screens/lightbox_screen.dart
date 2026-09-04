import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:photo_view/photo_view.dart';
import 'package:photo_view/photo_view_gallery.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../theme/app_theme.dart';
import '../models/picture_item.dart';
import '../providers/app_state_provider.dart';
import '../utils/formatters.dart';

class LightboxScreen extends StatefulWidget {
  final List<PictureItem> pictures;
  final int initialIndex;

  const LightboxScreen({
    super.key,
    required this.pictures,
    this.initialIndex = 0,
  });

  @override
  State<LightboxScreen> createState() => _LightboxScreenState();
}

class _LightboxScreenState extends State<LightboxScreen> {
  late PageController _pageController;
  late int _currentIndex;
  final Map<int, double> _rotations = {};
  final Map<int, PhotoViewController> _photoViewControllers = {};

  bool _isPlaying = false;
  bool _showInfo = false;
  bool _showControls = true;
  Timer? _slideshowTimer;
  double _dragOffsetY = 0.0;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    _pageController = PageController(initialPage: widget.initialIndex);
  }

  @override
  void dispose() {
    _slideshowTimer?.cancel();
    _pageController.dispose();
    for (final controller in _photoViewControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  PhotoViewController _getController(int index) {
    if (!_photoViewControllers.containsKey(index)) {
      _photoViewControllers[index] = PhotoViewController();
    }
    return _photoViewControllers[index]!;
  }

  void _onPageChanged(int index) {
    setState(() {
      _currentIndex = index;
      _dragOffsetY = 0.0;
    });

    final appState = context.read<AppStateProvider>();
    final list =
        appState.filteredPictures.isNotEmpty
            ? appState.filteredPictures
            : widget.pictures;
    if (appState.hasMore && !appState.isLoading && index >= list.length - 5) {
      appState.loadMore();
    }
  }

  void _toggleSlideshow() {
    setState(() {
      _isPlaying = !_isPlaying;
      if (_isPlaying) {
        _slideshowTimer?.cancel();
        _slideshowTimer = Timer.periodic(const Duration(milliseconds: 3500), (
          timer,
        ) {
          if (_currentIndex < widget.pictures.length - 1) {
            _pageController.nextPage(
              duration: const Duration(milliseconds: 300),
              curve: Curves.easeInOut,
            );
          } else {
            _pageController.animateToPage(
              0,
              duration: const Duration(milliseconds: 300),
              curve: Curves.easeInOut,
            );
          }
        });
      } else {
        _slideshowTimer?.cancel();
      }
    });
  }

  void _handleRotate() {
    setState(() {
      final currentRotation = _rotations[_currentIndex] ?? 0.0;
      _rotations[_currentIndex] = (currentRotation + 90.0) % 360.0;
    });
  }

  void _handleZoomIn() {
    final controller = _getController(_currentIndex);
    final currentScale = controller.scale ?? 1.0;
    controller.scale = (currentScale + 0.5).clamp(1.0, 6.0);
  }

  void _handleZoomOut() {
    final controller = _getController(_currentIndex);
    final currentScale = controller.scale ?? 1.0;
    controller.scale = (currentScale - 0.5).clamp(1.0, 6.0);
  }

  void _handleResetZoom() {
    final controller = _getController(_currentIndex);
    controller.scale = 1.0;
    setState(() {
      _rotations[_currentIndex] = 0.0;
    });
  }

  @override
  Widget build(BuildContext context) {
    // The viewer must keep the canonical items it was opened with. Folder
    // refreshes and thumbnail arrivals are presentation work, not a reason to
    // replace or block an already-open viewer.
    final picturesList = widget.pictures;
    final totalCount = picturesList.length;
    final currentPic =
        _currentIndex < picturesList.length
            ? picturesList[_currentIndex]
            : widget.pictures[_currentIndex];
    final opacity = (1.0 - (_dragOffsetY / 400)).clamp(0.0, 1.0);

    return Scaffold(
      backgroundColor: Color.fromRGBO(12, 13, 16, opacity),
      body: SafeArea(
        child: GestureDetector(
          onVerticalDragUpdate: (details) {
            final controller = _getController(_currentIndex);
            final currentScale = controller.scale ?? 1.0;
            if (currentScale <= 1.05) {
              final newOffset = _dragOffsetY + details.delta.dy;
              if (newOffset >= 0) {
                setState(() {
                  _dragOffsetY = newOffset;
                });
              }
            }
          },
          onVerticalDragEnd: (details) {
            if (_dragOffsetY > 100 ||
                (details.primaryVelocity != null &&
                    details.primaryVelocity! > 300)) {
              Navigator.of(context).pop();
            } else if (_dragOffsetY != 0.0) {
              setState(() {
                _dragOffsetY = 0.0;
              });
            }
          },
          child: Transform.translate(
            offset: Offset(0, _dragOffsetY),
            child: Stack(
              children: [
                // Main Gallery Viewer
                GestureDetector(
                  onTap: () {
                    setState(() {
                      _showControls = !_showControls;
                    });
                  },
                  child: PhotoViewGallery.builder(
                    pageController: _pageController,
                    itemCount: picturesList.length,
                    onPageChanged: _onPageChanged,
                    scrollPhysics: const BouncingScrollPhysics(),
                    builder: (context, index) {
                      final pic = picturesList[index];
                      final rot = _rotations[index] ?? 0.0;
                      final controller = _getController(index);
                      final fullUrl = pic.url ?? pic.thumbnailUrl ?? '';

                      return PhotoViewGalleryPageOptions.customChild(
                        controller: controller,
                        minScale: PhotoViewComputedScale.contained,
                        maxScale: PhotoViewComputedScale.covered * 6.0,
                        initialScale: PhotoViewComputedScale.contained,
                        heroAttributes: PhotoViewHeroAttributes(
                          tag: pic.path.isNotEmpty ? pic.path : '$index',
                        ),
                        child: Transform.rotate(
                          angle: rot * 3.1415926535897932 / 180.0,
                          child: CachedNetworkImage(
                            imageUrl: fullUrl,
                            fit: BoxFit.contain,
                            placeholder:
                                (context, url) => const Center(
                                  child: CircularProgressIndicator(
                                    color: AppTheme.googleBlue,
                                    strokeWidth: 2,
                                  ),
                                ),
                            errorWidget:
                                (context, url, error) => const Center(
                                  child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        Icons.broken_image_rounded,
                                        color: Colors.grey,
                                        size: 48,
                                      ),
                                      SizedBox(height: 8),
                                      Text(
                                        'Không thể tải ảnh gốc',
                                        style: TextStyle(
                                          color: Colors.grey,
                                          fontSize: 14,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                          ),
                        ),
                      );
                    },
                  ),
                ),

                // Top Control Bar
                if (_showControls)
                  Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.black.withValues(alpha: 0.85),
                            Colors.black.withValues(alpha: 0.4),
                            Colors.transparent,
                          ],
                        ),
                      ),
                      child: Row(
                        children: [
                          // Counter badge
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: AppTheme.googleBlue.withValues(
                                alpha: 0.15,
                              ),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: AppTheme.googleBlue.withValues(
                                  alpha: 0.4,
                                ),
                              ),
                            ),
                            child: Text(
                              '${_currentIndex + 1} / $totalCount',
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                fontFamily: 'monospace',
                                color: AppTheme.googleBlue,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),

                          // Title
                          Expanded(
                            child: Text(
                              currentPic.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                                color: Colors.white,
                              ),
                            ),
                          ),

                          // Close button
                          IconButton(
                            onPressed: () => Navigator.of(context).pop(),
                            icon: const Icon(
                              Icons.close_rounded,
                              color: Colors.white,
                              size: 22,
                            ),
                            style: IconButton.styleFrom(
                              backgroundColor: Colors.white.withValues(
                                alpha: 0.15,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                // Bottom Action Control Toolbar
                if (_showControls)
                  Positioned(
                    bottom: 0,
                    left: 0,
                    right: 0,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.bottomCenter,
                          end: Alignment.topCenter,
                          colors: [
                            Colors.black.withValues(alpha: 0.9),
                            Colors.black.withValues(alpha: 0.5),
                            Colors.transparent,
                          ],
                        ),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          // Info drawer if toggled
                          if (_showInfo)
                            Container(
                              margin: const EdgeInsets.only(bottom: 12),
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: AppTheme.bgBlock.withValues(alpha: 0.9),
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: AppTheme.borderColor),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      const Icon(
                                        Icons.calendar_today_rounded,
                                        size: 13,
                                        color: AppTheme.googleBlue,
                                      ),
                                      const SizedBox(width: 6),
                                      Text(
                                        Formatters.formatDate(
                                          currentPic.modTime,
                                        ),
                                        style: const TextStyle(
                                          fontSize: 14,
                                          color: Color(0xFFE8EAED),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Row(
                                    children: [
                                      const Icon(
                                        Icons.folder_rounded,
                                        size: 13,
                                        color: AppTheme.folderYellow,
                                      ),
                                      const SizedBox(width: 6),
                                      Expanded(
                                        child: Text(
                                          currentPic.path,
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            fontSize: 13,
                                            fontFamily: 'monospace',
                                            color: Color(0xFF9AA0A6),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),

                          // Tool buttons row
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              // Slideshow Toggle
                              IconButton(
                                onPressed: _toggleSlideshow,
                                icon: Icon(
                                  _isPlaying
                                      ? Icons.pause_rounded
                                      : Icons.play_arrow_rounded,
                                  color:
                                      _isPlaying
                                          ? AppTheme.googleBlue
                                          : Colors.white,
                                  size: 22,
                                ),
                                style: IconButton.styleFrom(
                                  backgroundColor:
                                      _isPlaying
                                          ? AppTheme.googleBlue.withValues(
                                            alpha: 0.2,
                                          )
                                          : Colors.white.withValues(alpha: 0.1),
                                ),
                                tooltip:
                                    _isPlaying
                                        ? 'Tạm dừng chiếu'
                                        : 'Trình chiếu',
                              ),
                              const SizedBox(width: 8),

                              // Zoom In
                              IconButton(
                                onPressed: _handleZoomIn,
                                icon: const Icon(
                                  Icons.zoom_in_rounded,
                                  color: Colors.white,
                                  size: 22,
                                ),
                                style: IconButton.styleFrom(
                                  backgroundColor: Colors.white.withValues(
                                    alpha: 0.1,
                                  ),
                                ),
                                tooltip: 'Phóng to',
                              ),
                              const SizedBox(width: 8),

                              // Zoom Out
                              IconButton(
                                onPressed: _handleZoomOut,
                                icon: const Icon(
                                  Icons.zoom_out_rounded,
                                  color: Colors.white,
                                  size: 22,
                                ),
                                style: IconButton.styleFrom(
                                  backgroundColor: Colors.white.withValues(
                                    alpha: 0.1,
                                  ),
                                ),
                                tooltip: 'Thu nhỏ',
                              ),
                              const SizedBox(width: 8),

                              // Rotate
                              IconButton(
                                onPressed: _handleRotate,
                                icon: const Icon(
                                  Icons.rotate_right_rounded,
                                  color: Colors.white,
                                  size: 22,
                                ),
                                style: IconButton.styleFrom(
                                  backgroundColor: Colors.white.withValues(
                                    alpha: 0.1,
                                  ),
                                ),
                                tooltip: 'Xoay ảnh 90°',
                              ),
                              const SizedBox(width: 8),

                              // Reset Zoom / Rotate
                              IconButton(
                                onPressed: _handleResetZoom,
                                icon: const Icon(
                                  Icons.restart_alt_rounded,
                                  color: Color(0xFFFDE047),
                                  size: 22,
                                ),
                                style: IconButton.styleFrom(
                                  backgroundColor: Colors.white.withValues(
                                    alpha: 0.1,
                                  ),
                                ),
                                tooltip: 'Kích thước ban đầu',
                              ),
                              const SizedBox(width: 8),

                              // Info Toggle
                              IconButton(
                                onPressed: () {
                                  setState(() => _showInfo = !_showInfo);
                                },
                                icon: Icon(
                                  Icons.info_outline_rounded,
                                  color:
                                      _showInfo
                                          ? AppTheme.googleBlue
                                          : Colors.white,
                                  size: 22,
                                ),
                                style: IconButton.styleFrom(
                                  backgroundColor:
                                      _showInfo
                                          ? AppTheme.googleBlue.withValues(
                                            alpha: 0.2,
                                          )
                                          : Colors.white.withValues(alpha: 0.1),
                                ),
                                tooltip: 'Thông tin ảnh',
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
