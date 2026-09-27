import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../providers/app_state_provider.dart';

class FilterModalBottomSheet extends StatelessWidget {
  const FilterModalBottomSheet({super.key});

  static void show(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => const FilterModalBottomSheet(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<AppStateProvider>(
      builder: (context, appState, child) {
        final fileTypeFilters = appState.fileTypeFilters;
        final mxhFilters = appState.mxhFilters;

        final typeOptions = [
          {'key': 'folder', 'label': 'Thư mục', 'icon': Icons.folder_rounded, 'color': AppTheme.folderYellow},
          {'key': 'video', 'label': 'Video', 'icon': Icons.videocam_rounded, 'color': AppTheme.videoPurple},
          {'key': 'picture', 'label': 'Hình ảnh', 'icon': Icons.photo_library_rounded, 'color': AppTheme.googleBlue},
        ];

        final mxhOptions = [
          {'key': 'youtube', 'label': 'YouTube', 'svg': 'assets/icons/youtube.svg', 'color': Color(0xFFFF0000)},
          {'key': 'tiktok', 'label': 'TikTok', 'svg': 'assets/icons/tiktok.svg', 'color': Color(0xFF00F2FE)},
          {'key': 'facebook', 'label': 'Facebook', 'svg': 'assets/icons/facebook.svg', 'color': Color(0xFF1877F2)},
          {'key': 'instagram', 'label': 'Instagram', 'svg': 'assets/icons/instagram.svg', 'color': Color(0xFFE4405F)},
          {'key': 'telegram', 'label': 'Telegram', 'svg': 'assets/icons/telegram.svg', 'color': Color(0xFF24A1DE)},
          {'key': 'x', 'label': 'X', 'svg': 'assets/icons/twitter.svg', 'color': Color(0xFFE7E9EA)},
        ];

        return Container(
          decoration: BoxDecoration(
            color: AppTheme.bgBlock,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            border: Border.all(color: AppTheme.borderColor),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.5),
                blurRadius: 20,
                offset: const Offset(0, -4),
              ),
            ],
          ),
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Handle bar
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.white24,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Title row
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(
                          Icons.filter_alt_rounded,
                          size: 20,
                          color: AppTheme.googleBlue,
                        ),
                        const SizedBox(width: 8),
                        const Text(
                          'Bộ lọc hiển thị',
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                    if (appState.isFilterActive)
                      TextButton(
                        onPressed: () {
                          appState.clearFilters();
                        },
                        style: TextButton.styleFrom(
                          foregroundColor: Colors.redAccent,
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        child: const Text(
                          'Đặt lại',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 18),

                // Section 1: Loại file
                const Text(
                  'LOẠI TẬP TIN',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.8,
                    color: Color(0xFF9AA0A6),
                  ),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: typeOptions.map((opt) {
                    final key = opt['key'] as String;
                    final isSelected = fileTypeFilters.contains(key);
                    final color = (opt['color'] as Color?) ?? Colors.white70;
                    return InkWell(
                      onTap: () {
                        appState.toggleFileTypeFilter(key);
                      },
                      borderRadius: BorderRadius.circular(14),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 150),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? AppTheme.googleBlue.withValues(alpha: 0.2)
                              : AppTheme.bgCard,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: isSelected
                                ? AppTheme.googleBlue
                                : AppTheme.borderColor,
                            width: isSelected ? 1.5 : 1.0,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              opt['icon'] as IconData,
                              size: 16,
                              color: isSelected ? AppTheme.googleBlue : color,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              opt['label'] as String,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                                color: isSelected ? Colors.white : const Color(0xFFE8EAED),
                              ),
                            ),
                            if (isSelected) ...[
                              const SizedBox(width: 6),
                              Container(
                                width: 6,
                                height: 6,
                                decoration: const BoxDecoration(
                                  color: AppTheme.googleBlue,
                                  shape: BoxShape.circle,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 20),

                // Section 2: MXH
                const Text(
                  'MẠNG XÃ HỘI (NGUỒN TẢI)',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.8,
                    color: Color(0xFF9AA0A6),
                  ),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: mxhOptions.map((opt) {
                    final key = opt['key'] as String;
                    final isSelected = mxhFilters.contains(key);
                    final svgPath = opt['svg'] as String?;
                    final color = (opt['color'] as Color?) ?? Colors.white70;
                    return InkWell(
                      onTap: () {
                        appState.toggleMxhFilter(key);
                      },
                      borderRadius: BorderRadius.circular(14),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 150),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? AppTheme.googleBlue.withValues(alpha: 0.2)
                              : AppTheme.bgCard,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: isSelected
                                ? AppTheme.googleBlue
                                : AppTheme.borderColor,
                            width: isSelected ? 1.5 : 1.0,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (svgPath != null) ...[
                              SvgPicture.asset(
                                svgPath,
                                width: 14,
                                height: 14,
                                colorFilter: ColorFilter.mode(
                                  isSelected ? AppTheme.googleBlue : color,
                                  BlendMode.srcIn,
                                ),
                              ),
                              const SizedBox(width: 6),
                            ],
                            Text(
                              opt['label'] as String,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                                color: isSelected ? Colors.white : const Color(0xFFE8EAED),
                              ),
                            ),
                            if (isSelected) ...[
                              const SizedBox(width: 6),
                              Container(
                                width: 6,
                                height: 6,
                                decoration: const BoxDecoration(
                                  color: AppTheme.googleBlue,
                                  shape: BoxShape.circle,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 20),

                // Close / Done button
                ElevatedButton(
                  onPressed: () => Navigator.of(context).pop(),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.googleBlue,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    elevation: 0,
                  ),
                  child: const Text(
                    'Hoàn tất',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
