import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../models/tree_node.dart';
import '../models/folder_item.dart';
import '../providers/app_state_provider.dart';
import '../providers/settings_provider.dart';
import 'config_api_dialog.dart';

class FolderTreeDrawer extends StatefulWidget {
  const FolderTreeDrawer({super.key});

  @override
  State<FolderTreeDrawer> createState() => _FolderTreeDrawerState();
}

class _FolderTreeDrawerState extends State<FolderTreeDrawer>
    with TickerProviderStateMixin {
  final Map<String, bool> _expandedNodes = {};
  String _treeSearchQuery = '';
  late TextEditingController _searchController;

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController();
    _autoExpandCurrentPath();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
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

  List<TreeNode> _filterTreeNodes(List<TreeNode> nodes, String query) {
    if (query.trim().isEmpty) return nodes;
    final q = query.toLowerCase().trim();

    final List<TreeNode> result = [];
    for (final node in nodes) {
      final nameMatch = node.name.toLowerCase().contains(q);
      final pathMatch = node.path.toLowerCase().contains(q);
      final filteredChildren = _filterTreeNodes(node.children, query);

      if (nameMatch || pathMatch || filteredChildren.isNotEmpty) {
        result.add(TreeNode(
          name: node.name,
          path: node.path,
          children: filteredChildren,
        ));
      }
    }
    return result;
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<AppStateProvider>(
      builder: (context, appState, child) {
        final treeData = appState.treeData;
        final filteredTree = _filterTreeNodes(treeData, _treeSearchQuery);

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

                // Search Box Layout
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  child: SizedBox(
                    height: 40,
                    child: TextField(
                      controller: _searchController,
                      style: const TextStyle(color: Colors.white, fontSize: 15),
                      textInputAction: TextInputAction.done,
                      onSubmitted: (_) => FocusManager.instance.primaryFocus?.unfocus(),
                      decoration: InputDecoration(
                        hintText: 'Lọc cây thư mục...',
                        hintStyle: const TextStyle(color: Color(0xFF80868B), fontSize: 14.5),
                        prefixIcon: const Icon(Icons.search_rounded, color: Color(0xFF9AA0A6), size: 18),
                        suffixIcon: _treeSearchQuery.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.clear_rounded, color: Color(0xFF9AA0A6), size: 16),
                                splashRadius: 16,
                                onPressed: () {
                                  _searchController.clear();
                                  setState(() => _treeSearchQuery = '');
                                },
                              )
                            : null,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        filled: true,
                        fillColor: AppTheme.bgCard,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(20),
                          borderSide: const BorderSide(color: AppTheme.borderColor),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(20),
                          borderSide: const BorderSide(color: AppTheme.borderColor),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(20),
                          borderSide: const BorderSide(color: AppTheme.googleBlue, width: 1.5),
                        ),
                      ),
                      onChanged: (val) {
                        setState(() => _treeSearchQuery = val);
                      },
                    ),
                  ),
                ),

                // Separator
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                  child: Divider(color: AppTheme.borderColor, height: 1),
                ),

                // Category Subheader & Collapse All
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.folder_copy_rounded, color: AppTheme.folderYellow, size: 15),
                          const SizedBox(width: 6),
                          const Text(
                            'DANH MỤC THƯ MỤC',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.8,
                              color: Color(0xFF9AA0A6),
                            ),
                          ),
                          if (_treeSearchQuery.isNotEmpty) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                              decoration: BoxDecoration(
                                color: AppTheme.googleBlue.withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Text(
                                'Lọc',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: AppTheme.googleBlue,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      if (_expandedNodes.isNotEmpty)
                        InkWell(
                          onTap: _collapseAll,
                          borderRadius: BorderRadius.circular(12),
                          child: const Padding(
                            padding: EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            child: Row(
                              children: [
                                Icon(Icons.unfold_less_rounded, size: 14, color: AppTheme.googleBlue),
                                SizedBox(width: 4),
                                Text(
                                  'Thu gọn',
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: AppTheme.googleBlue,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                ),

                // Tree Content
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    physics: const BouncingScrollPhysics(),
                    children: [
                      // Root Item
                      _buildRootItem(appState),
                      const SizedBox(height: 4),

                      // Tree Nodes or Fallback Folders
                      if (filteredTree.isNotEmpty)
                        ...filteredTree.map((node) => _buildTreeNode(node, depth: 1, appState: appState))
                      else if (_treeSearchQuery.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 40),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.folder_off_rounded, size: 36, color: Color(0xFF80868B)),
                              const SizedBox(height: 12),
                              Text(
                                'Không tìm thấy thư mục\n"$_treeSearchQuery"',
                                textAlign: TextAlign.center,
                                style: const TextStyle(fontSize: 15, color: Color(0xFFBDC1C6), height: 1.4),
                              ),
                              const SizedBox(height: 12),
                              OutlinedButton.icon(
                                onPressed: () {
                                  _searchController.clear();
                                  setState(() => _treeSearchQuery = '');
                                },
                                icon: const Icon(Icons.clear_rounded, size: 14),
                                label: const Text('Xóa bộ lọc', style: TextStyle(fontSize: 14)),
                                style: OutlinedButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                  minimumSize: const Size(0, 32),
                                ),
                              ),
                            ],
                          ),
                        )
                      else if (appState.folders.isNotEmpty)
                        ...appState.folders.map((f) => _buildFlatFolderItem(f, appState)),
                    ],
                  ),
                ),

                // Separator
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 14),
                  child: Divider(color: AppTheme.borderColor, height: 1),
                ),

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
              Icons.home_rounded,
              size: 18,
              color: isSelected ? const Color(0xFF1C1D21) : AppTheme.googleBlue,
            ),
            const SizedBox(width: 10),
            Text(
              'Thư viện gốc (Root)',
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

  Widget _buildTreeNode(TreeNode node, {required int depth, required AppStateProvider appState}) {
    final isSelected = node.path == appState.currentPath;
    final hasChildren = node.hasChildren;
    final isExpanded = _treeSearchQuery.isNotEmpty ? true : (_expandedNodes[node.path] ?? false);
    final double leftPadding = depth * 14.0 + 4;

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
          borderRadius: BorderRadius.circular(20),
          child: Container(
            padding: EdgeInsets.only(left: leftPadding, right: 10, top: 8, bottom: 8),
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
                      fontSize: 15,
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                      color: isSelected ? const Color(0xFF1C1D21) : const Color(0xFFE8EAED),
                    ),
                  ),
                ),

                // Child count badge
                if (hasChildren)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? const Color(0x331C1D21)
                          : AppTheme.bgCard,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      '${node.children.length}',
                      style: TextStyle(
                        fontSize: 12,
                        fontFamily: 'monospace',
                        fontWeight: FontWeight.bold,
                        color: isSelected ? const Color(0xFF1C1D21) : const Color(0xFF9AA0A6),
                      ),
                    ),
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
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
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
                  fontSize: 15,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                  color: isSelected ? const Color(0xFF1C1D21) : const Color(0xFFE8EAED),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
