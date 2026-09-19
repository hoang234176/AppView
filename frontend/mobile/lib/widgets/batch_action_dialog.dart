import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../models/tree_node.dart';
import '../api/folder_api.dart';
import '../providers/app_state_provider.dart';
import 'app_toast.dart';
import 'rolling_number.dart';

class BatchActionDialog extends StatefulWidget {
  final String action; // 'copy', 'move', 'delete'
  final List<Map<String, dynamic>> items;

  const BatchActionDialog({
    super.key,
    required this.action,
    required this.items,
  });

  static Future<void> show(
    BuildContext context, {
    required String action,
    required List<Map<String, dynamic>> items,
  }) {
    return showDialog(
      context: context,
      builder: (ctx) => BatchActionDialog(
        action: action,
        items: items,
      ),
    );
  }

  @override
  State<BatchActionDialog> createState() => _BatchActionDialogState();
}

class _BatchActionDialogState extends State<BatchActionDialog> {
  late String _destDrive;
  String _selectedFolderPath = '';
  final Set<String> _expandedPaths = {};
  List<TreeNode> _treeData = [];
  bool _isLoadingTree = false;
  bool _isSubmitting = false;
  String? _errorMessage;

  int get _folderCount =>
      widget.items.where((it) => it['type'] == 'folder').length;
  int get _pictureCount =>
      widget.items.where((it) => it['type'] == 'picture').length;
  int get _videoCount =>
      widget.items.where((it) => it['type'] == 'video').length;
  int get _totalCount => widget.items.length;

  @override
  void initState() {
    super.initState();
    final appState = context.read<AppStateProvider>();
    _destDrive = appState.activeDrive;

    if (widget.action != 'delete') {
      _selectedFolderPath = appState.currentPath;
      _loadTreeForDrive(_destDrive);
    }
  }

  Future<void> _loadTreeForDrive(String driveId) async {
    setState(() {
      _isLoadingTree = true;
      _errorMessage = null;
    });

    final res = await FolderApi.fetchFolderTree(drive: driveId);

    if (!mounted) return;
    setState(() {
      _isLoadingTree = false;
      if (res.success && res.data != null) {
        _treeData = res.data!;
        if (_selectedFolderPath.isNotEmpty) {
          final parts = _selectedFolderPath.split('/');
          String acc = '';
          for (final part in parts) {
            acc = acc.isEmpty ? part : '$acc/$part';
            _expandedPaths.add(acc);
          }
        }
      } else {
        _errorMessage = res.message.isNotEmpty
            ? res.message
            : 'Không thể tải danh mục thư mục cho ổ $driveId';
      }
    });
  }

  bool _isDescendantOrSelf(String folderPath, String targetPath) {
    if (folderPath == targetPath) return true;
    if (targetPath.startsWith('$folderPath/')) return true;
    return false;
  }

  Future<void> _handleSubmit() async {
    final appState = context.read<AppStateProvider>();

    if (widget.action == 'move') {
      // Validate: cannot move folder into itself or descendant
      for (final it in widget.items) {
        if (it['type'] == 'folder') {
          final srcPath = it['path']?.toString() ?? '';
          if (_destDrive == appState.activeDrive &&
              _isDescendantOrSelf(srcPath, _selectedFolderPath)) {
            setState(() {
              _errorMessage =
                  'Không thể di chuyển thư mục "${it['name']}" vào chính nó hoặc thư mục con.';
            });
            return;
          }
        }
      }
    }

    setState(() => _isSubmitting = true);

    if (widget.action == 'delete') {
      final res = await FolderApi.executeBatchItems(
        action: 'delete',
        items: widget.items,
        destFolder: '',
        srcDrive: appState.activeDrive,
        destDrive: appState.activeDrive,
      );

      if (!mounted) return;
      setState(() => _isSubmitting = false);

      if (res.success) {
        Navigator.of(context).pop();
        appState.exitSelectMode();
        appState.removeBatchItemsLocally(widget.items);
        AppToast.showSuccess(
          context,
          'Đã xóa $_totalCount mục thành công!',
        );
      } else {
        setState(() {
          _errorMessage = res.message.isNotEmpty
              ? res.message
              : 'Xóa mục thất bại. Vui lòng thử lại.';
        });
      }
    } else {
      // Copy or Move
      Navigator.of(context).pop();
      appState.exitSelectMode();
      appState.startTransfer(
        action: widget.action,
        destFolder: _selectedFolderPath,
        destDrive: _destDrive,
        items: widget.items,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppStateProvider>();
    final drives = appState.drives;
    final isDelete = widget.action == 'delete';
    final isCopy = widget.action == 'copy';

    final actionTitle = isDelete
        ? 'Xác nhận xóa'
        : isCopy
            ? 'Sao chép mục'
            : 'Di chuyển mục';

    final actionIcon = isDelete
        ? Icons.delete_outline_rounded
        : isCopy
            ? Icons.copy_rounded
            : Icons.drive_file_move_rounded;

    final actionColor = isDelete
        ? Colors.redAccent
        : isCopy
            ? const Color(0xFF8AB4F8)
            : Colors.amberAccent;

    return Dialog(
      backgroundColor: AppTheme.bgBlock,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: const BorderSide(color: AppTheme.borderColor),
      ),
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: 480,
          maxHeight: MediaQuery.of(context).size.height * 0.85,
        ),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header
              Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: actionColor.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: actionColor.withValues(alpha: 0.3)),
                    ),
                    child: Icon(actionIcon, color: actionColor, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          actionTitle,
                          style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Row(
                          children: [
                            const Text(
                              'Tổng cộng ',
                              style: TextStyle(
                                fontSize: 12,
                                color: Color(0xFF9AA0A6),
                              ),
                            ),
                            RollingNumber(
                              value: _totalCount,
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                                fontFamily: 'monospace',
                              ),
                            ),
                            const Text(
                              ' mục được chọn',
                              style: TextStyle(
                                fontSize: 12,
                                color: Color(0xFF9AA0A6),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close_rounded, color: Colors.white60, size: 20),
                    splashRadius: 18,
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Item Type Badges
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: [
                  if (_folderCount > 0)
                    _buildTypeChip(
                      icon: Icons.folder_rounded,
                      color: Colors.amber,
                      count: _folderCount,
                      label: 'thư mục',
                    ),
                  if (_pictureCount > 0)
                    _buildTypeChip(
                      icon: Icons.image_rounded,
                      color: AppTheme.googleBlue,
                      count: _pictureCount,
                      label: 'hình ảnh',
                    ),
                  if (_videoCount > 0)
                    _buildTypeChip(
                      icon: Icons.videocam_rounded,
                      color: Colors.purpleAccent,
                      count: _videoCount,
                      label: 'video',
                    ),
                ],
              ),
              const SizedBox(height: 14),

              // Body: Delete Confirmation or Folder Tree Picker
              if (isDelete) ...[
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.redAccent.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.redAccent.withValues(alpha: 0.25)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.warning_amber_rounded, color: Colors.redAccent, size: 22),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Bạn có chắc chắn muốn xóa vĩnh viễn $_totalCount mục đã chọn? Thao tác này không thể hoàn tác.',
                          style: const TextStyle(
                            fontSize: 13,
                            color: Colors.white70,
                            height: 1.35,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ] else ...[
                // Destination Drive Selector (Tabs)
                if (drives.length > 1) ...[
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: AppTheme.bgCard,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppTheme.borderColor),
                    ),
                    child: Row(
                      children: drives.map((d) {
                        final isSelected = d.id == _destDrive;
                        return Expanded(
                          child: GestureDetector(
                            onTap: () {
                              if (_destDrive != d.id) {
                                setState(() {
                                  _destDrive = d.id;
                                  _selectedFolderPath = '';
                                  _expandedPaths.clear();
                                });
                                _loadTreeForDrive(d.id);
                              }
                            },
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              decoration: BoxDecoration(
                                color: isSelected
                                    ? AppTheme.googleBlue.withValues(alpha: 0.2)
                                    : Colors.transparent,
                                borderRadius: BorderRadius.circular(12),
                                border: isSelected
                                    ? Border.all(color: AppTheme.googleBlue.withValues(alpha: 0.5))
                                    : null,
                              ),
                              alignment: Alignment.center,
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.storage_rounded,
                                    size: 15,
                                    color: isSelected ? AppTheme.googleBlue : Colors.white60,
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    d.name.isNotEmpty ? d.name : d.id,
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                                      color: isSelected ? Colors.white : Colors.white60,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                  const SizedBox(height: 10),
                ],

                // Selected Destination Folder Banner
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppTheme.bgCard,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppTheme.borderColor),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.folder_open_rounded, color: Colors.amber, size: 16),
                      const SizedBox(width: 8),
                      const Text(
                        'Đích đến: ',
                        style: TextStyle(fontSize: 12, color: Colors.white60),
                      ),
                      Expanded(
                        child: Text(
                          _selectedFolderPath.isEmpty
                              ? '$_destDrive (Gốc)'
                              : '$_destDrive: /$_selectedFolderPath',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            fontFamily: 'monospace',
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 10),

                // Folder Tree View Container
                Expanded(
                  child: Container(
                    decoration: BoxDecoration(
                      color: AppTheme.bgCard,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppTheme.borderColor),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: _isLoadingTree
                        ? const Center(
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: AppTheme.googleBlue,
                            ),
                          )
                        : ListView(
                            padding: const EdgeInsets.all(8),
                            children: [
                              // Root Level Node
                              _buildFolderItem(
                                path: '',
                                name: '$_destDrive (Gốc / Root)',
                                depth: 0,
                                isRoot: true,
                              ),
                              // Recursive Tree Nodes
                              ..._treeData.map((node) => _buildTreeNode(node, 1)),
                            ],
                          ),
                  ),
                ),
              ],

              // Error banner if any
              if (_errorMessage != null) ...[
                const SizedBox(height: 10),
                Text(
                  _errorMessage!,
                  style: const TextStyle(fontSize: 12, color: Colors.redAccent),
                  textAlign: TextAlign.center,
                ),
              ],

              const SizedBox(height: 14),

              // Action Buttons
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(),
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    child: const Text('Hủy', style: TextStyle(color: Colors.white70)),
                  ),
                  const SizedBox(width: 10),
                  ElevatedButton(
                    onPressed: _isSubmitting ? null : _handleSubmit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: actionColor,
                      foregroundColor: isDelete ? Colors.white : const Color(0xFF1C1D21),
                      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      elevation: 0,
                    ),
                    child: _isSubmitting
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Text(
                            isDelete
                                ? 'Xóa ($_totalCount)'
                                : isCopy
                                    ? 'Sao chép ($_totalCount)'
                                    : 'Di chuyển ($_totalCount)',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5),
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

  Widget _buildTypeChip({
    required IconData icon,
    required Color color,
    required int count,
    required String label,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: color),
          const SizedBox(width: 5),
          RollingNumber(
            value: count,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.bold,
              color: color,
              fontFamily: 'monospace',
            ),
          ),
          Text(
            ' $label',
            style: TextStyle(fontSize: 11.5, color: color),
          ),
        ],
      ),
    );
  }

  Widget _buildTreeNode(TreeNode node, int depth) {
    final hasChildren = node.children.isNotEmpty;
    final isExpanded = _expandedPaths.contains(node.path);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildFolderItem(
          path: node.path,
          name: node.name,
          depth: depth,
          hasChildren: hasChildren,
          isExpanded: isExpanded,
          onToggleExpand: hasChildren
              ? () {
                  setState(() {
                    if (isExpanded) {
                      _expandedPaths.remove(node.path);
                    } else {
                      _expandedPaths.add(node.path);
                    }
                  });
                }
              : null,
        ),
        if (hasChildren && isExpanded)
          ...node.children.map((child) => _buildTreeNode(child, depth + 1)),
      ],
    );
  }

  Widget _buildFolderItem({
    required String path,
    required String name,
    required int depth,
    bool isRoot = false,
    bool hasChildren = false,
    bool isExpanded = false,
    VoidCallback? onToggleExpand,
  }) {
    final isSelected = _selectedFolderPath == path;

    return InkWell(
      onTap: () {
        setState(() {
          _selectedFolderPath = path;
          if (hasChildren && !isExpanded) {
            _expandedPaths.add(path);
          }
        });
      },
      borderRadius: BorderRadius.circular(10),
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 1.5),
        padding: EdgeInsets.only(
          left: (depth * 14.0) + 8.0,
          right: 10,
          top: 7,
          bottom: 7,
        ),
        decoration: BoxDecoration(
          color: isSelected
              ? AppTheme.googleBlue.withValues(alpha: 0.22)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          border: isSelected
              ? Border.all(color: AppTheme.googleBlue.withValues(alpha: 0.6))
              : null,
        ),
        child: Row(
          children: [
            if (hasChildren)
              GestureDetector(
                onTap: onToggleExpand,
                behavior: HitTestBehavior.opaque,
                child: Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: Icon(
                    isExpanded
                        ? Icons.keyboard_arrow_down_rounded
                        : Icons.keyboard_arrow_right_rounded,
                    size: 18,
                    color: isSelected ? AppTheme.googleBlue : Colors.white60,
                  ),
                ),
              )
            else if (!isRoot)
              const SizedBox(width: 24),
            Icon(
              isRoot
                  ? Icons.home_filled
                  : isExpanded
                      ? Icons.folder_open_rounded
                      : Icons.folder_rounded,
              size: 17,
              color: isSelected
                  ? AppTheme.googleBlue
                  : isRoot
                      ? AppTheme.googleBlue
                      : Colors.amber,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                name,
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                  color: isSelected ? Colors.white : Colors.white70,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (isSelected)
              const Icon(Icons.check_circle_rounded, color: AppTheme.googleBlue, size: 16),
          ],
        ),
      ),
    );
  }
}
