import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class FabSpeedDial extends StatefulWidget {
  final VoidCallback onCreateFolder;
  final VoidCallback onDownloadArchive;
  final VoidCallback onDownloadMedia;

  const FabSpeedDial({
    super.key,
    required this.onCreateFolder,
    required this.onDownloadArchive,
    required this.onDownloadMedia,
  });

  @override
  State<FabSpeedDial> createState() => _FabSpeedDialState();
}

class _FabSpeedDialState extends State<FabSpeedDial> with SingleTickerProviderStateMixin {
  bool _isOpen = false;

  void _toggleDial() {
    setState(() {
      _isOpen = !_isOpen;
    });
  }

  void _handleAction(VoidCallback callback) {
    setState(() {
      _isOpen = false;
    });
    callback();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        // SPEED DIAL OPTIONS (SLIDES UP WHEN ACTIVE)
        if (_isOpen)
          TweenAnimationBuilder<double>(
            duration: const Duration(milliseconds: 400),
            curve: Curves.easeOutCubic,
            tween: Tween(begin: 0, end: 1),
            builder: (context, value, child) => Opacity(
              opacity: value,
              child: Transform.translate(
                offset: Offset(0, 16 * (1 - value)),
                child: child,
              ),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
          // OPTION 1: TẢI FILE NÉN
          InkWell(
            onTap: () => _handleAction(widget.onDownloadArchive),
            borderRadius: BorderRadius.circular(24),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppTheme.bgBlock,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppTheme.borderColor),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.3),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: const Text(
                    'Tải file nén',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: Colors.amber,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: AppTheme.bgCard,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.amber.withValues(alpha: 0.5)),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.3),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  alignment: Alignment.center,
                  child: const Icon(Icons.archive_rounded, color: Colors.amber, size: 20),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // OPTION 2: TẢI ẢNH/VIDEO
          InkWell(
            onTap: () => _handleAction(widget.onDownloadMedia),
            borderRadius: BorderRadius.circular(24),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppTheme.bgBlock,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppTheme.borderColor),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.3),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: const Text(
                    'Tải ảnh/video',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: Colors.redAccent,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: AppTheme.bgCard,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.redAccent.withValues(alpha: 0.5)),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.3),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  alignment: Alignment.center,
                  child: const Icon(Icons.video_library_rounded, color: Colors.redAccent, size: 20),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // OPTION 3: TẠO THƯ MỤC
          InkWell(
            onTap: () => _handleAction(widget.onCreateFolder),
            borderRadius: BorderRadius.circular(24),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppTheme.bgBlock,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppTheme.borderColor),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.3),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: const Text(
                    'Tạo thư mục',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.googleBlue,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: AppTheme.bgCard,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppTheme.googleBlue.withValues(alpha: 0.5)),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.3),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  alignment: Alignment.center,
                  child: const Icon(Icons.create_new_folder_rounded, color: AppTheme.googleBlue, size: 20),
                ),
              ],
            ),
          ),
                const SizedBox(height: 12),
              ],
            ),
          ),

        // MAIN FAB BUTTON (+) - ROTATES 45 DEGREES (0.125 TURNS) ON CLICK
        GestureDetector(
          onTap: _toggleDial,
          child: Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: _isOpen
                    ? [const Color(0xFF28292D), const Color(0xFF383C42)]
                    : [const Color(0xFF1A73E8), const Color(0xFF4285F4)],
                begin: Alignment.bottomLeft,
                end: Alignment.topRight,
              ),
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: AppTheme.googleBlue.withValues(alpha: 0.4),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
              border: Border.all(
                color: Colors.white.withValues(alpha: 0.3),
                width: 1,
              ),
            ),
            alignment: Alignment.center,
            child: AnimatedRotation(
              turns: _isOpen ? 0.125 : 0.0, // 0.125 turns = 45 degrees rotation
              duration: const Duration(milliseconds: 400),
              curve: Curves.easeInOut,
              child: Icon(
                Icons.add_rounded,
                color: _isOpen ? Colors.redAccent : Colors.white,
                size: 30,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
