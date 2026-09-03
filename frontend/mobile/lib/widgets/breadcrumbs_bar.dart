import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../providers/app_state_provider.dart';
import '../utils/formatters.dart';

class BreadcrumbsBar extends StatefulWidget {
  const BreadcrumbsBar({super.key});

  @override
  State<BreadcrumbsBar> createState() => _BreadcrumbsBarState();
}

class _BreadcrumbsBarState extends State<BreadcrumbsBar> {
  final ScrollController _scrollController = ScrollController();
  String _lastPath = '';

  void _scrollToRight() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<AppStateProvider>(
      builder: (context, appState, child) {
        if (_lastPath != appState.currentPath) {
          _lastPath = appState.currentPath;
          _scrollToRight();
        }

        final breadcrumbs = Formatters.parseBreadcrumbs(appState.currentPath);
        final totalFolders = appState.searchQuery.trim().isNotEmpty ? appState.filteredFolders.length : appState.totalFolders;
        final totalPictures = appState.searchQuery.trim().isNotEmpty ? appState.filteredPictures.length : appState.totalPictures;
        final totalVideos = appState.searchQuery.trim().isNotEmpty ? appState.filteredVideos.length : appState.totalVideos;

        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: AppTheme.bgBlock,
              borderRadius: AppTheme.borderRadius,
              border: Border.all(color: AppTheme.borderColorSubtle),
            ),
            child: Row(
              children: [
                // Scrollable Breadcrumbs List (Auto-scrolls to active folder)
                Expanded(
                  child: SingleChildScrollView(
                    controller: _scrollController,
                    scrollDirection: Axis.horizontal,
                    physics: const BouncingScrollPhysics(),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: List.generate(breadcrumbs.length, (index) {
                        final item = breadcrumbs[index];
                        final isLast = index == breadcrumbs.length - 1;
                        final isRoot = index == 0;

                        return Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (index > 0)
                              const Padding(
                                padding: EdgeInsets.symmetric(horizontal: 4),
                                child: Icon(
                                  Icons.chevron_right_rounded,
                                  size: 16,
                                  color: Color(0xFF80868B),
                                ),
                              ),
                            InkWell(
                              onTap: () {
                                appState.navigateTo(item.path);
                                _scrollToRight();
                              },
                              borderRadius: BorderRadius.circular(20),
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 6,
                                ),
                                decoration: BoxDecoration(
                                  color: isLast
                                      ? AppTheme.googleBlue.withValues(alpha: 0.15)
                                      : AppTheme.bgCard,
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(
                                    color: isLast
                                        ? AppTheme.googleBlue.withValues(alpha: 0.4)
                                        : AppTheme.borderColor,
                                  ),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      isRoot ? Icons.home_rounded : Icons.folder_rounded,
                                      size: 14,
                                      color: isRoot
                                          ? AppTheme.googleBlue
                                          : AppTheme.folderYellow,
                                    ),
                                    const SizedBox(width: 6),
                                    ConstrainedBox(
                                      constraints: const BoxConstraints(maxWidth: 160),
                                      child: Text(
                                        item.name,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: isLast
                                              ? FontWeight.bold
                                              : FontWeight.w500,
                                          color: isLast
                                              ? AppTheme.googleBlue
                                              : const Color(0xFFE8EAED),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        );
                      }),
                    ),
                  ),
                ),

                const SizedBox(width: 8),

                // Stats Badge: F • P • V
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                  decoration: BoxDecoration(
                    color: AppTheme.bgCard,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppTheme.borderColor),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '$totalFolders',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.folderYellow,
                          fontFamily: 'monospace',
                        ),
                      ),
                      const Text(
                        'F',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF9AA0A6),
                        ),
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 4),
                        child: Text('•', style: TextStyle(color: Color(0xFF5F6368), fontSize: 12)),
                      ),
                      Text(
                        '$totalPictures',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.googleBlue,
                          fontFamily: 'monospace',
                        ),
                      ),
                      const Text(
                        'P',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF9AA0A6),
                        ),
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 4),
                        child: Text('•', style: TextStyle(color: Color(0xFF5F6368), fontSize: 12)),
                      ),
                      Text(
                        '$totalVideos',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.videoPurple,
                          fontFamily: 'monospace',
                        ),
                      ),
                      const Text(
                        'V',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF9AA0A6),
                        ),
                      ),
                    ],
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
