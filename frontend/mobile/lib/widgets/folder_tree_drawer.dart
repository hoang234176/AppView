import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../models/tree_node.dart';
import '../models/folder_item.dart';
import '../providers/app_state_provider.dart';
import '../providers/settings_provider.dart';
import '../api/download_api.dart';
import '../utils/formatters.dart';
import 'config_api_dialog.dart';
import 'folder_action_dialogs.dart';
import 'rolling_number.dart';

class FolderTreeDrawer extends StatefulWidget {
  const FolderTreeDrawer({super.key});

  @override
  State<FolderTreeDrawer> createState() => _FolderTreeDrawerState();
}

class _FolderTreeDrawerState extends State<FolderTreeDrawer>
    with TickerProviderStateMixin {
  final Map<String, bool> _expandedNodes = {};

  @override
  void initState() {
    super.initState();
    _autoExpandCurrentPath();
  }

  void _autoExpandCurrentPath() {
    final currentPath = context.read<AppStateProvider>().currentPath;
    if (currentPath.isNotEmpty) {
      final parts = currentPath.split('/');
      String accPath = '';
      for (final part in parts) {
        accPath = accPath.isEmpty ? part : '$accPath/$part';
        _expandedNodes[accPath] = true;
      }
    }
  }

  void _toggleExpand(String path, {bool? forceExpand}) {
    setState(() {
      _expandedNodes[path] = forceExpand ?? !(_expandedNodes[path] ?? false);
    });
  }

  void _collapseAll() {
    setState(() {
      _expandedNodes.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<AppStateProvider>(
      builder: (context, appState, child) {
        final treeData = appState.treeData;

        return Drawer(
          backgroundColor: AppTheme.bgBlock,
          shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.only(
              topRight: Radius.circular(AppTheme.radius),
              bottomRight: Radius.circular(AppTheme.radius),
            ),
          ),
          child: SafeArea(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Top Header: Brand Logo & Close Button
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 12, 8),
                  child: Row(
                    children: [
                      Container(
                        width: 32,
                        height: 32,
                        padding: const EdgeInsets.all(2),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          gradient: const LinearGradient(
                            colors: [
                              Color(0xFF4285F4),
                              Color(0xFF34A853),
                              Color(0xFFFBBC05),
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                        ),
                        child: Container(
                          decoration: BoxDecoration(
                            color: AppTheme.bgBlock,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          alignment: Alignment.center,
                          child: SvgPicture.asset(
                            'assets/icons/app_icon.svg',
                            width: 16,
                            height: 16,
                            colorFilter: const ColorFilter.mode(
                              AppTheme.googleBlue,
                              BlendMode.srcIn,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      const Text(
                        'AppView',
                        style: TextStyle(
                          fontSize: 19,
                          fontWeight: FontWeight.w900,
                          letterSpacing: -0.5,
                          color: Colors.white,
                        ),
                      ),
                      const Spacer(),
                      IconButton(
                        onPressed: () => Navigator.of(context).pop(),
                        icon: const Icon(Icons.close_rounded, color: Color(0xFFBDC1C6), size: 18),
                        tooltip: 'Đóng danh mục',
                        style: IconButton.styleFrom(
                          backgroundColor: AppTheme.bgCard,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                            side: const BorderSide(color: AppTheme.borderColor),
                          ),
                          padding: const EdgeInsets.all(6),
                          minimumSize: const Size(34, 34),
                        ),
                      ),
                    ],
                  ),
                ),

                // Subfolder Header with Collapse All
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.folder_open_rounded, size: 15, color: AppTheme.folderYellow),
                          const SizedBox(width: 8),
                          Text(
                            'Thư mục trên ${appState.activeDrive.isNotEmpty ? appState.activeDrive : "Ổ cứng"}',
                            style: const TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF8AB4F8),
                            ),
                          ),
                        ],
                      ),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          RollingNumber(
                            value: treeData.isNotEmpty ? treeData.length : appState.folders.length,
                            suffix: ' mục',
                            animateOnMount: true,
                            duration: const Duration(milliseconds: 650),
                            style: const TextStyle(
                              fontSize: 11,
                              fontFamily: 'monospace',
                              color: Color(0xFF9AA0A6),
                            ),
                          ),
                          if (_expandedNodes.isNotEmpty) ...[
                            const SizedBox(width: 8),
                            InkWell(
                              onTap: _collapseAll,
                              borderRadius: BorderRadius.circular(12),
                              child: const Padding(
                                padding: EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                                child: Row(
                                  children: [
                                    Icon(Icons.unfold_less_rounded, size: 14, color: AppTheme.googleBlue),
                                    SizedBox(width: 2),
                                    Text(
                                      'Thu gọn',
                                      style: TextStyle(
                                        fontSize: 12,
                                        color: AppTheme.googleBlue,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),

                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 14),
                  child: Divider(color: AppTheme.borderColor, height: 1),
                ),

                // Tree Content (Full Scrollable Area)
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    physics: const BouncingScrollPhysics(),
                    children: [
                      // Fallback root item only if no drives configured
                      if (appState.drives.isEmpty) ...[
                        _buildRootItem(appState),
                        const SizedBox(height: 4),
                      ],

                      // Tree Nodes or Fallback Folders
                      if (treeData.isNotEmpty)
                        ...treeData.map((node) => _buildTreeNode(node, depth: 1, appState: appState))
                      else if (appState.folders.isNotEmpty)
                        ...appState.folders.map((f) => _buildFlatFolderItem(f, appState)),
                    ],
                  ),
                ),

                // Bottom Section: Ổ CỨNG (Right above Settings)
                if (appState.drives.isNotEmpty) ...[
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 14),
                    child: Divider(color: AppTheme.borderColor, height: 1),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                    child: Row(
                      children: const [
                        Icon(Icons.storage_rounded, color: AppTheme.googleBlue, size: 15),
                        SizedBox(width: 6),
                        Text(
                          'Ổ CỨNG',
                          style: TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.8,
                            color: Color(0xFF9AA0A6),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    child: Row(
                      children: appState.drives.map((drive) {
                        final isDriveActive = drive.id == appState.activeDrive;
                        return Expanded(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 3),
                            child: LiquidDriveButton(
                              drive: drive,
                              isActive: isDriveActive,
                              onTap: () {
                                appState.selectDrive(drive.id);
                              },
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                ],

                // Cài đặt Hệ Thống Box
                _buildSettingsBox(context),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildSettingsBox(BuildContext context) {
    final settings = context.watch<SettingsProvider>();
    final appState = context.watch<AppStateProvider>();
    final isConnected = appState.errorInfo == null;

    return Container(
      margin: const EdgeInsets.fromLTRB(12, 8, 12, 12),
      decoration: BoxDecoration(
        color: AppTheme.bgCard,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppTheme.borderColor),
      ),
      child: InkWell(
        onTap: () {
          Navigator.of(context).pop();
          ConfigApiDialog.show(context);
        },
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: AppTheme.googleBlue.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: AppTheme.googleBlue.withValues(alpha: 0.3),
                  ),
                ),
                alignment: Alignment.center,
                child: const Icon(
                  Icons.settings_rounded,
                  color: AppTheme.googleBlue,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),

              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'Cài đặt hệ thống',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: isConnected ? const Color(0xFF34A853) : AppTheme.errorRed,
                          ),
                        ),
                        const SizedBox(width: 5),
                        Expanded(
                          child: Text(
                            isConnected
                                ? 'Máy chủ ${settings.serverIp}:${settings.serverPort}'
                                : 'Mất kết nối server',
                            style: TextStyle(
                              fontSize: 11.5,
                              fontFamily: 'monospace',
                              color: isConnected ? const Color(0xFFBDC1C6) : AppTheme.errorRed,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const Icon(
                Icons.chevron_right_rounded,
                color: Color(0xFF9AA0A6),
                size: 20,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRootItem(AppStateProvider appState) {
    final isSelected = appState.currentPath.isEmpty;
    final driveLabel = appState.activeDrive.isNotEmpty
        ? '${appState.activeDrive} (Root)'
        : 'Thư viện gốc (Root)';
    return InkWell(
      onTap: () {
        appState.navigateTo('');
        Navigator.of(context).pop();
      },
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.googleBlue : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          children: [
            Icon(
              appState.activeDrive.isNotEmpty
                  ? Icons.photo_library_rounded
                  : Icons.home_rounded,
              size: 18,
              color: isSelected ? const Color(0xFF1C1D21) : AppTheme.googleBlue,
            ),
            const SizedBox(width: 10),
            Text(
              driveLabel,
              style: TextStyle(
                fontSize: 15,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                color: isSelected ? const Color(0xFF1C1D21) : Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showFolderOptionsModal(FolderItem folder) {
    final appState = context.read<AppStateProvider>();
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.bgBlock,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 36,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF5F6368),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Row(
                    children: [
                      const Icon(Icons.folder_rounded, color: AppTheme.folderYellow, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          folder.name,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
                const Divider(color: AppTheme.borderColor),
                ListTile(
                  leading: const Icon(Icons.folder_open_rounded, color: AppTheme.folderYellow),
                  title: const Text('Mở thư mục', style: TextStyle(color: Colors.white, fontSize: 14)),
                  onTap: () {
                    Navigator.of(ctx).pop();
                    Navigator.of(context).pop();
                    appState.navigateTo(folder.path);
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.drive_file_rename_outline_rounded, color: AppTheme.googleBlue),
                  title: const Text('Đổi tên thư mục', style: TextStyle(color: Colors.white, fontSize: 14)),
                  onTap: () {
                    Navigator.of(ctx).pop();
                    RenameFolderDialog.show(context, folder);
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.drive_file_move_rounded, color: Colors.amber),
                  title: const Text('Di chuyển thư mục', style: TextStyle(color: Colors.white, fontSize: 14)),
                  onTap: () {
                    Navigator.of(ctx).pop();
                    MoveItemDialog.show(context, srcPath: folder.path, itemName: folder.name, isFolder: true);
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent),
                  title: const Text('Xóa thư mục', style: TextStyle(color: Colors.redAccent, fontSize: 14)),
                  onTap: () {
                    Navigator.of(ctx).pop();
                    DeleteFolderConfirmDialog.show(context, folder);
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildTreeNode(TreeNode node, {required int depth, required AppStateProvider appState}) {
    final isSelected = node.path == appState.currentPath;
    final hasChildren = node.hasChildren;
    final isExpanded = _expandedNodes[node.path] ?? false;
    final double leftPadding = depth * 14.0 + 4;
    final folderItem = FolderItem(name: node.name, path: node.path);

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        InkWell(
          onTap: () {
            appState.navigateTo(node.path);
            if (hasChildren && !isExpanded) {
              _toggleExpand(node.path, forceExpand: true);
            }
            Navigator.of(context).pop();
          },
          onLongPress: () => _showFolderOptionsModal(folderItem),
          borderRadius: BorderRadius.circular(20),
          child: Container(
            padding: EdgeInsets.only(left: leftPadding, right: 6, top: 6, bottom: 6),
            decoration: BoxDecoration(
              color: isSelected ? AppTheme.googleBlue : Colors.transparent,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              children: [
                // Expand / Collapse Chevron
                if (hasChildren)
                  InkWell(
                    onTap: () => _toggleExpand(node.path),
                    borderRadius: BorderRadius.circular(12),
                    child: Padding(
                      padding: const EdgeInsets.all(2),
                      child: AnimatedRotation(
                        turns: isExpanded ? 0.25 : 0.0,
                        duration: const Duration(milliseconds: 200),
                        curve: Curves.easeOut,
                        child: Icon(
                          Icons.chevron_right_rounded,
                          size: 18,
                          color: isSelected ? const Color(0xFF1C1D21) : const Color(0xFF9AA0A6),
                        ),
                      ),
                    ),
                  )
                else
                  const SizedBox(width: 22),

                const SizedBox(width: 4),

                // Folder Icon
                Icon(
                  isExpanded ? Icons.folder_open_rounded : Icons.folder_rounded,
                  size: 18,
                  color: isSelected ? const Color(0xFF1C1D21) : AppTheme.folderYellow,
                ),
                const SizedBox(width: 8),

                // Folder Name
                Expanded(
                  child: Text(
                    node.name,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 14.5,
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                      color: isSelected ? const Color(0xFF1C1D21) : const Color(0xFFE8EAED),
                    ),
                  ),
                ),

                // Child count badge
                if (hasChildren)
                  Container(
                    margin: const EdgeInsets.only(right: 2),
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? const Color(0x331C1D21)
                          : AppTheme.bgCard,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: RollingNumber(
                      value: node.children.length,
                      animateOnMount: true,
                      duration: const Duration(milliseconds: 650),
                      style: TextStyle(
                        fontSize: 11,
                        fontFamily: 'monospace',
                        fontWeight: FontWeight.bold,
                        color: isSelected ? const Color(0xFF1C1D21) : const Color(0xFF9AA0A6),
                      ),
                    ),
                  ),

                // 3-dots action button
                IconButton(
                  icon: Icon(
                    Icons.more_vert_rounded,
                    color: isSelected ? const Color(0xFF1C1D21) : const Color(0xFF80868B),
                    size: 16,
                  ),
                  onPressed: () => _showFolderOptionsModal(folderItem),
                  padding: EdgeInsets.zero,
                  alignment: Alignment.center,
                  constraints: const BoxConstraints(minWidth: 26, minHeight: 26),
                  splashRadius: 16,
                ),
              ],
            ),
          ),
        ),

        // Recursive children expand downward instead of appearing instantly.
        AnimatedSize(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
          alignment: Alignment.topCenter,
          child: hasChildren && isExpanded
              ? Column(
                  mainAxisSize: MainAxisSize.min,
                  children: node.children
                      .map((childNode) => _buildTreeNode(
                            childNode,
                            depth: depth + 1,
                            appState: appState,
                          ))
                      .toList(),
                )
              : const SizedBox.shrink(),
        ),
      ],
    );
  }

  Widget _buildFlatFolderItem(FolderItem folder, AppStateProvider appState) {
    final isSelected = folder.path == appState.currentPath;
    return InkWell(
      onTap: () {
        appState.navigateTo(folder.path);
        Navigator.of(context).pop();
      },
      onLongPress: () => _showFolderOptionsModal(folder),
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.googleBlue : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          children: [
            Icon(
              Icons.folder_rounded,
              size: 18,
              color: isSelected ? const Color(0xFF1C1D21) : AppTheme.folderYellow,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                folder.name,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 14.5,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                  color: isSelected ? const Color(0xFF1C1D21) : const Color(0xFFE8EAED),
                ),
              ),
            ),
            IconButton(
              icon: Icon(
                Icons.more_vert_rounded,
                color: isSelected ? const Color(0xFF1C1D21) : const Color(0xFF80868B),
                size: 16,
              ),
              onPressed: () => _showFolderOptionsModal(folder),
              padding: EdgeInsets.zero,
              alignment: Alignment.center,
              constraints: const BoxConstraints(minWidth: 26, minHeight: 26),
              splashRadius: 16,
            ),
          ],
        ),
      ),
    );
  }
}

/// Liquid Water Tank Drive Button Widget
class LiquidDriveButton extends StatefulWidget {
  final DriveInfoModel drive;
  final bool isActive;
  final VoidCallback onTap;

  const LiquidDriveButton({
    super.key,
    required this.drive,
    required this.isActive,
    required this.onTap,
  });

  @override
  State<LiquidDriveButton> createState() => _LiquidDriveButtonState();
}

class _LiquidDriveButtonState extends State<LiquidDriveButton>
    with TickerProviderStateMixin {
  late AnimationController _waveController;
  late AnimationController _fillController;
  late Animation<double> _fillAnimation;

  @override
  void initState() {
    super.initState();
    _waveController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    );
    if (widget.drive.isConnected) {
      _waveController.repeat();
    }

    _fillController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 950),
    );
    _fillAnimation = CurvedAnimation(
      parent: _fillController,
      curve: Curves.easeOutCubic,
    );
    _fillController.forward();
  }

  @override
  void didUpdateWidget(covariant LiquidDriveButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.drive.isConnected && !_waveController.isAnimating) {
      _waveController.repeat();
    } else if (!widget.drive.isConnected && _waveController.isAnimating) {
      _waveController.stop();
    }

    if (oldWidget.drive.id != widget.drive.id) {
      _fillController.reset();
      _fillController.forward();
    }
  }

  @override
  void dispose() {
    _waveController.dispose();
    _fillController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isConnected = widget.drive.isConnected;
    final percent = isConnected ? widget.drive.usedPercent.round().clamp(0, 100) : 0;
    final cap = Formatters.formatDriveCapacity(widget.drive.usedBytes, widget.drive.totalBytes);

    final isDanger = isConnected && percent >= 91;
    final isWarning = isConnected && percent >= 75 && !isDanger;

    // Dynamic styling by connection & capacity tiers
    Color cardBg;
    Border border;
    List<BoxShadow>? shadows;
    Color iconColor;
    Color badgeBg;
    Color badgeText;
    Border? badgeBorder;

    if (!isConnected) {
      cardBg = const Color(0xFF141517).withValues(alpha: 0.9);
      border = Border.all(color: const Color(0xFF2E3036), width: 1.0);
      shadows = null;
      iconColor = const Color(0xFF6B7280);
      badgeBg = const Color(0x25EF4444);
      badgeText = const Color(0xFFF87171);
      badgeBorder = Border.all(color: const Color(0x40EF4444));
    } else if (isDanger) {
      if (widget.isActive) {
        cardBg = const Color(0xFF181212);
        border = Border.all(color: const Color(0xFFEF4444), width: 1.5);
        shadows = [
          BoxShadow(
            color: const Color(0xFFEF4444).withValues(alpha: 0.35),
            blurRadius: 16,
          ),
        ];
        iconColor = const Color(0xFFEF4444);
        badgeBg = const Color(0x40EF4444);
        badgeText = const Color(0xFFFCA5A5);
        badgeBorder = Border.all(color: const Color(0x60EF4444));
      } else {
        cardBg = const Color(0xFF171313);
        border = Border.all(color: const Color(0xFF442323), width: 1.0);
        shadows = null;
        iconColor = const Color(0xCCEF4444);
        badgeBg = const Color(0x307F1D1D);
        badgeText = const Color(0xCCFCA5A5);
        badgeBorder = Border.all(color: const Color(0x507F1D1D));
      }
    } else if (isWarning) {
      if (widget.isActive) {
        cardBg = const Color(0xFF171412);
        border = Border.all(color: const Color(0xFFF97316), width: 1.5);
        shadows = [
          BoxShadow(
            color: const Color(0xFFF97316).withValues(alpha: 0.35),
            blurRadius: 16,
          ),
        ];
        iconColor = const Color(0xFFF97316);
        badgeBg = const Color(0x40F97316);
        badgeText = const Color(0xFFFDE68A);
        badgeBorder = Border.all(color: const Color(0x60F97316));
      } else {
        cardBg = const Color(0xFF161413);
        border = Border.all(color: const Color(0xFF423226), width: 1.0);
        shadows = null;
        iconColor = const Color(0xCCF97316);
        badgeBg = const Color(0x3078350F);
        badgeText = const Color(0xCCFDE68A);
        badgeBorder = Border.all(color: const Color(0x5078350F));
      }
    } else {
      // Normal Blue (< 75%)
      if (widget.isActive) {
        cardBg = const Color(0xFF131417);
        border = Border.all(color: const Color(0xFF60A5FA), width: 1.5);
        shadows = [
          BoxShadow(
            color: const Color(0xFF3B82F6).withValues(alpha: 0.3),
            blurRadius: 16,
          ),
        ];
        iconColor = const Color(0xFF60A5FA);
        badgeBg = const Color(0x403B82F6);
        badgeText = const Color(0xFF93C5FD);
        badgeBorder = Border.all(color: const Color(0x5060A5FA));
      } else {
        cardBg = const Color(0xFF18191C);
        border = Border.all(color: AppTheme.borderColor, width: 1.0);
        shadows = null;
        iconColor = const Color(0xFF9AA0A6);
        badgeBg = Colors.black.withValues(alpha: 0.3);
        badgeText = const Color(0xFF94A3B8);
        badgeBorder = null;
      }
    }

    return InkWell(
      onTap: isConnected ? widget.onTap : null,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        height: 72,
        decoration: BoxDecoration(
          color: cardBg,
          borderRadius: BorderRadius.circular(16),
          border: border,
          boxShadow: shadows,
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(15),
          child: Stack(
            children: [
              // Animated Liquid Background (Only painted when connected)
              if (isConnected)
                Positioned.fill(
                  child: AnimatedBuilder(
                    animation: Listenable.merge([_waveController, _fillAnimation]),
                    builder: (context, child) {
                      final animatedPercent = widget.drive.usedPercent * _fillAnimation.value;
                      return CustomPaint(
                        painter: _WavePainter(
                          animationValue: _waveController.value,
                          usedPercent: animatedPercent,
                          isActive: widget.isActive,
                        ),
                      );
                    },
                  ),
                ),

              // Button Content
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Row(
                            children: [
                              Icon(
                                Icons.storage_rounded,
                                size: 14,
                                color: iconColor,
                              ),
                              const SizedBox(width: 5),
                              Expanded(
                                child: Text(
                                  widget.drive.name.isNotEmpty ? widget.drive.name : widget.drive.id,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.bold,
                                    color: !isConnected
                                        ? const Color(0xFF9AA0A6)
                                        : widget.isActive
                                            ? Colors.white
                                            : const Color(0xFFE2E8F0),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                          decoration: BoxDecoration(
                            color: badgeBg,
                            borderRadius: BorderRadius.circular(8),
                            border: badgeBorder,
                          ),
                          child: isConnected
                              ? RollingNumber(
                                  value: percent,
                                  suffix: '%',
                                  animateOnMount: true,
                                  duration: const Duration(milliseconds: 750),
                                  style: TextStyle(
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.w800,
                                    color: badgeText,
                                  ),
                                )
                              : Text(
                                  'OFF',
                                  style: TextStyle(
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.w800,
                                    color: badgeText,
                                  ),
                                ),
                        ),
                      ],
                    ),
                    if (!isConnected)
                      Row(
                        children: [
                          Container(
                            width: 5,
                            height: 5,
                            decoration: const BoxDecoration(
                              color: Color(0xFFF87171),
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 5),
                          const Text(
                            'Ngắt kết nối',
                            style: TextStyle(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFFF87171),
                            ),
                          ),
                        ],
                      )
                    else
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          RollingNumber(
                            value: cap.usedVal,
                            suffix: ' ${cap.usedUnit}',
                            animateOnMount: true,
                            duration: const Duration(milliseconds: 750),
                            style: const TextStyle(
                              fontSize: 10.5,
                              fontFamily: 'monospace',
                              fontWeight: FontWeight.w600,
                              color: Color(0xFFF1F5F9),
                            ),
                          ),
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.baseline,
                            textBaseline: TextBaseline.alphabetic,
                            children: [
                              const Text(
                                '/ ',
                                style: TextStyle(
                                  fontSize: 9.5,
                                  fontFamily: 'monospace',
                                  fontWeight: FontWeight.w500,
                                  color: Color(0xFF94A3B8),
                                ),
                              ),
                              RollingNumber(
                                value: cap.totalVal,
                                suffix: ' ${cap.totalUnit}',
                                animateOnMount: true,
                                duration: const Duration(milliseconds: 750),
                                style: const TextStyle(
                                  fontSize: 9.5,
                                  fontFamily: 'monospace',
                                  fontWeight: FontWeight.w500,
                                  color: Color(0xFF94A3B8),
                                ),
                              ),
                            ],
                          ),
                        ],
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

/// Custom painter for the liquid fill level and horizontal ripples
class _WavePainter extends CustomPainter {
  final double animationValue;
  final double usedPercent;
  final bool isActive;

  _WavePainter({
    required this.animationValue,
    required this.usedPercent,
    required this.isActive,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final percent = usedPercent.clamp(0.0, 100.0);
    if (percent <= 0) return;

    final waterHeight = size.height * (percent / 100.0);
    final baseWaterY = size.height - waterHeight;

    final isDanger = percent >= 91;
    final isWarning = percent >= 75 && !isDanger;

    // Amplitude scales so low water levels don't clip under bottom
    final maxAmp = math.min(4.5, math.max(0.5, waterHeight * 0.45));
    final amp = isActive ? maxAmp : maxAmp * 0.55;

    // 1. Background ripple wave (Active only for depth)
    if (isActive) {
      final bgWavePath = Path();
      bgWavePath.moveTo(0, size.height);
      bgWavePath.lineTo(0, baseWaterY);
      for (double x = 0; x <= size.width; x += 3) {
        final y = baseWaterY +
            math.cos((x / size.width * 2 * math.pi) - (animationValue * 2 * math.pi)) * (amp * 0.7);
        bgWavePath.lineTo(x, y);
      }
      bgWavePath.lineTo(size.width, size.height);
      bgWavePath.close();

      final bgPaint = Paint()
        ..color = isDanger
            ? const Color(0x30EF4444)
            : isWarning
                ? const Color(0x30F59E0B)
                : const Color(0x3060A5FA);
      canvas.drawPath(bgWavePath, bgPaint);
    }

    // 2. Primary ripple wave (for both active and inactive!)
    final wavePath = Path();
    wavePath.moveTo(0, size.height);
    wavePath.lineTo(0, baseWaterY);
    for (double x = 0; x <= size.width; x += 3) {
      final y = baseWaterY +
          math.sin((x / size.width * 2 * math.pi) + (animationValue * 2 * math.pi)) * amp;
      wavePath.lineTo(x, y);
    }
    wavePath.lineTo(size.width, size.height);
    wavePath.close();

    final waveRect = Rect.fromLTWH(0, math.max(0, baseWaterY - amp), size.width, waterHeight + amp);
    final waveColors = isActive
        ? (isDanger
            ? const [Color(0x85DC2626), Color(0x60EF4444), Color(0x40F87171)]
            : isWarning
                ? const [Color(0x85D97706), Color(0x60F59E0B), Color(0x40FBBF24)]
                : const [Color(0x801D4ED8), Color(0x553B82F6), Color(0x4060A5FA)])
        : (isDanger
            ? const [Color(0x457F1D1D), Color(0x25991B1B)]
            : isWarning
                ? const [Color(0x4578350F), Color(0x2592400E)]
                : const [Color(0x40334155), Color(0x25475569)]);

    final wavePaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.bottomCenter,
        end: Alignment.topCenter,
        colors: waveColors,
      ).createShader(waveRect);
    canvas.drawPath(wavePath, wavePaint);

    // 3. Water surface wave crest line
    final crestPath = Path();
    crestPath.moveTo(0, baseWaterY + math.sin(animationValue * 2 * math.pi) * amp);
    for (double x = 0; x <= size.width; x += 3) {
      final y = baseWaterY +
          math.sin((x / size.width * 2 * math.pi) + (animationValue * 2 * math.pi)) * amp;
      crestPath.lineTo(x, y);
    }

    final crestColor = isActive
        ? (isDanger
            ? const Color(0xFFFCA5A5)
            : isWarning
                ? const Color(0xFFFDE68A)
                : const Color(0xFF93C5FD))
        : (isDanger
            ? const Color(0x70EF4444)
            : isWarning
                ? const Color(0x70F59E0B)
                : const Color(0x5094A3B8));

    final crestPaint = Paint()
      ..color = crestColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = isActive ? 2.0 : 1.2;
    canvas.drawPath(crestPath, crestPaint);
  }

  @override
  bool shouldRepaint(covariant _WavePainter oldDelegate) {
    return oldDelegate.animationValue != animationValue ||
        oldDelegate.usedPercent != usedPercent ||
        oldDelegate.isActive != isActive;
  }
}
