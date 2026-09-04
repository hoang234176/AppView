import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../providers/settings_provider.dart';
import '../providers/app_state_provider.dart';
import '../providers/download_provider.dart';
import '../api/api_config.dart';
import '../widgets/app_header.dart';
import '../widgets/breadcrumbs_bar.dart';
import '../widgets/folder_tree_drawer.dart';
import '../widgets/folder_grid.dart';
import '../widgets/video_grid.dart';
import '../widgets/picture_grid.dart';
import '../widgets/loading_skeleton.dart';
import '../widgets/error_state_view.dart';
import '../widgets/empty_state_view.dart';
import '../widgets/config_api_dialog.dart';
import '../widgets/folder_action_dialogs.dart';
import '../widgets/fab_speed_dial.dart';
import 'download_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final settings = context.read<SettingsProvider>();
      final appState = context.read<AppStateProvider>();
      final downloadProvider = context.read<DownloadProvider>();

      downloadProvider.onRefreshGrid = () {
        if (mounted) {
          appState.refreshAll();
        }
      };

      if (!settings.isConfigured) {
        ConfigApiDialog.show(context);
      } else {
        final validation = await ApiConfig.validateCoordinatorHost(
          settings.serverHost,
        );
        if (!mounted) return;
        if (validation['success'] != true) {
          await appState.stopRealtimeAndClearState(
            validation['message']?.toString() ?? 'Không thể kết nối máy chủ.',
          );
          if (mounted) ConfigApiDialog.show(context);
          return;
        }
        appState.markServerConnected();
        appState.startRealtime();
        appState.loadTreeData();
        appState.loadData('');
      }
    });
  }

  void _openDrawer() {
    _scaffoldKey.currentState?.openDrawer();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
      behavior: HitTestBehavior.translucent,
      child: Scaffold(
        key: _scaffoldKey,
        backgroundColor: AppTheme.bgApp,
        drawer: const FolderTreeDrawer(),
        floatingActionButton: FabSpeedDial(
          onCreateFolder: () {
            if (!context.read<AppStateProvider>().isServerConnected) {
              ConfigApiDialog.show(context);
              return;
            }
            final currentPath = context.read<AppStateProvider>().currentPath;
            CreateFolderDialog.show(context, currentPath);
          },
          onDownloadArchive: () {
            if (!context.read<AppStateProvider>().isServerConnected) {
              ConfigApiDialog.show(context);
              return;
            }
            final currentPath = context.read<AppStateProvider>().currentPath;
            DownloadScreen.showAddMediaFireDialog(context, currentPath);
          },
        ),
        body: SafeArea(
          bottom: false,
          child: Stack(
            children: [
              Column(
                children: [
                  // Fixed Top App Header Bar
                  AppHeader(onOpenDrawer: _openDrawer),

                  // Fixed Breadcrumbs Bar
                  const BreadcrumbsBar(),

                  // Independent Scrollable Content Body with Pull-to-refresh & Swipe Right to Navigate Back
                  Expanded(
                    child: Consumer<AppStateProvider>(
                      builder: (context, appState, child) {
                        return GestureDetector(
                          behavior: HitTestBehavior.translucent,
                          onHorizontalDragEnd: (details) {
                            if (details.primaryVelocity != null &&
                                details.primaryVelocity! > 250) {
                              if (appState.currentPath.isNotEmpty) {
                                appState.navigateBack();
                              }
                            }
                          },
                          child: RefreshIndicator(
                            color: AppTheme.googleBlue,
                            backgroundColor: AppTheme.bgBlock,
                            onRefresh: () => appState.refreshAll(),
                            child: _buildBodyContent(appState),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBodyContent(AppStateProvider appState) {
    if (appState.isLoading) {
      return const SingleChildScrollView(
        physics: AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        child: LoadingSkeleton(),
      );
    }

    if (appState.errorInfo != null) {
      return SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        child: ErrorStateView(
          errorInfo: appState.errorInfo!,
          onRetry: () => appState.refreshAll(),
        ),
      );
    }

    if (!appState.hasContent) {
      return const SingleChildScrollView(
        physics: AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        child: EmptyStateView(),
      );
    }

    return NotificationListener<ScrollNotification>(
      onNotification: (scrollInfo) {
        if (scrollInfo.metrics.pixels >=
            scrollInfo.metrics.maxScrollExtent - 500) {
          if (appState.hasMore && !appState.isLoading) {
            appState.loadMore();
          }
        }
        return false;
      },
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        padding: const EdgeInsets.only(bottom: 24),
        children: [
          // 1. Folders Grid
          FolderGrid(
            folders: appState.visibleFolders,
            totalCount: appState.filteredFolders.length,
          ),

          // 2. Videos Grid
          VideoGrid(
            videos: appState.visibleVideos,
            totalCount: appState.filteredVideos.length,
          ),

          // 3. Pictures Grid
          PictureGrid(
            pictures: appState.visiblePictures,
            allPictures: appState.filteredPictures,
            totalCount: appState.filteredPictures.length,
          ),

          if (appState.hasMore)
            Padding(
              padding: const EdgeInsets.only(top: 4, bottom: 16),
              child: Center(
                child: ElevatedButton(
                  onPressed: () => appState.loadMore(),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.bgCard,
                    foregroundColor: AppTheme.googleBlue,
                    side: const BorderSide(color: AppTheme.borderColor),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 10,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20),
                    ),
                    elevation: 2,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text(
                        'Xem thêm',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: AppTheme.googleBlue.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          '+${appState.remainingCount} mục',
                          style: const TextStyle(
                            fontSize: 11,
                            fontFamily: 'monospace',
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
