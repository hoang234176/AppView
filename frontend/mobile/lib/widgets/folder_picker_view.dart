import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/folder_api.dart';
import '../models/tree_node.dart';
import '../providers/app_state_provider.dart';
import '../theme/app_theme.dart';
import 'app_toast.dart';

class FolderPickerView extends StatefulWidget {
  final String destination;
  final ValueChanged<String> onChanged;
  final bool disabled;
  final Color accentColor;
  final double height;

  const FolderPickerView({
    super.key,
    required this.destination,
    required this.onChanged,
    this.disabled = false,
    this.accentColor = AppTheme.googleBlue,
    this.height = 180,
  });

  @override
  State<FolderPickerView> createState() => _FolderPickerViewState();
}

class _FolderPickerViewState extends State<FolderPickerView> {
  final Set<String> _expandedPaths = {};

  @override
  void initState() {
    super.initState();
    _expandAncestors(widget.destination);
  }

  @override
  void didUpdateWidget(FolderPickerView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.destination != widget.destination) {
      _expandAncestors(widget.destination);
    }
  }

  void _expandAncestors(String path) {
    if (path.isEmpty) return;
    final parts = path.split('/');
    String acc = '';
    for (final part in parts) {
      acc = acc.isEmpty ? part : '$acc/$part';
      _expandedPaths.add(acc);
    }
  }

  Future<void> _handleCreateFolder() async {
    if (widget.disabled) return;
    final folderNameController = TextEditingController();
    final newFolderName = await showDialog<String>(
      context: context,
      builder:
          (ctx) => AlertDialog(
            backgroundColor: AppTheme.bgBlock,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
              side: const BorderSide(color: AppTheme.borderColor),
            ),
            title: Row(
              children: [
                const Icon(
                  Icons.create_new_folder_rounded,
                  color: Colors.amber,
                  size: 20,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Tạo folder mới trong ${widget.destination.isEmpty ? "Root" : "/${widget.destination}"}',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            content: TextField(
              controller: folderNameController,
              autofocus: true,
              style: const TextStyle(color: Colors.white, fontSize: 13),
              decoration: InputDecoration(
                hintText: 'Tên thư mục mới...',
                hintStyle: const TextStyle(color: Colors.white38, fontSize: 12),
                filled: true,
                fillColor: AppTheme.bgCard,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppTheme.borderColor),
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text(
                  'Hủy',
                  style: TextStyle(color: Colors.white54),
                ),
              ),
              ElevatedButton(
                onPressed: () {
                  final val = folderNameController.text.trim();
                  if (val.isNotEmpty) {
                    Navigator.of(ctx).pop(val);
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.amber,
                  foregroundColor: Colors.black,
                ),
                child: const Text(
                  'Tạo',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
    );

    if (newFolderName != null && newFolderName.isNotEmpty && mounted) {
      final appState = context.read<AppStateProvider>();
      final res = await FolderApi.createFolder(widget.destination, newFolderName);
      if (res.success) {
        await appState.loadTreeData();
        if (mounted) {
          final newPath =
              widget.destination.isEmpty
                  ? newFolderName
                  : '${widget.destination}/$newFolderName';
          _expandedPaths.add(widget.destination);
          _expandedPaths.add(newPath);
          widget.onChanged(newPath);
          AppToast.showSuccess(context, 'Đã tạo thư mục mới thành công!');
        }
      } else {
        if (mounted) {
          AppToast.showError(
            context,
            res.message.isNotEmpty ? res.message : 'Không thể tạo thư mục',
          );
        }
      }
    }
  }

  List<Widget> _buildTreeNodeWidgets(List<TreeNode> nodes, int depth) {
    final List<Widget> list = [];

    for (final node in nodes) {
      final isSelected = widget.destination == node.path;
      final isExpanded = _expandedPaths.contains(node.path);

      list.add(
        InkWell(
          onTap:
              widget.disabled
                  ? null
                  : () {
                    widget.onChanged(node.path);
                    if (node.hasChildren && !isExpanded) {
                      setState(() {
                        _expandedPaths.add(node.path);
                      });
                    }
                  },
          borderRadius: BorderRadius.circular(10),
          child: Container(
            margin: const EdgeInsets.symmetric(vertical: 2, horizontal: 4),
            padding: EdgeInsets.only(
              left: depth * 14.0 + 6.0,
              right: 8,
              top: 7,
              bottom: 7,
            ),
            decoration: BoxDecoration(
              color:
                  isSelected
                      ? widget.accentColor.withValues(alpha: 0.25)
                      : Colors.transparent,
              borderRadius: BorderRadius.circular(10),
              border:
                  isSelected
                      ? Border.all(
                        color: widget.accentColor.withValues(alpha: 0.5),
                      )
                      : null,
            ),
            child: Row(
              children: [
                if (node.hasChildren)
                  GestureDetector(
                    onTap:
                        widget.disabled
                            ? null
                            : () {
                              setState(() {
                                if (isExpanded) {
                                  _expandedPaths.remove(node.path);
                                } else {
                                  _expandedPaths.add(node.path);
                                }
                              });
                            },
                    child: Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: Icon(
                        isExpanded
                            ? Icons.expand_more_rounded
                            : Icons.chevron_right_rounded,
                        size: 18,
                        color: Colors.white70,
                      ),
                    ),
                  )
                else
                  const SizedBox(width: 24),

                Icon(
                  isExpanded ? Icons.folder_open_rounded : Icons.folder_rounded,
                  size: 18,
                  color: isSelected ? Colors.white : AppTheme.folderYellow,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    node.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight:
                          isSelected ? FontWeight.bold : FontWeight.normal,
                      color: isSelected ? Colors.white : Colors.white70,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );

      if (node.hasChildren && isExpanded) {
        list.addAll(_buildTreeNodeWidgets(node.children, depth + 1));
      }
    }

    return list;
  }

  @override
  Widget build(BuildContext context) {
    final treeNodes = context.watch<AppStateProvider>().treeData;
    final isRootSelected = widget.destination.isEmpty;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Chọn thư mục lưu trữ:',
          style: TextStyle(
            color: Colors.white70,
            fontSize: 12,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 6),
        Container(
          height: widget.height,
          decoration: BoxDecoration(
            color: AppTheme.bgCard,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppTheme.borderColor),
          ),
          child: ListView(
            padding: const EdgeInsets.all(4),
            children: [
              InkWell(
                onTap: widget.disabled ? null : () => widget.onChanged(''),
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 7,
                  ),
                  decoration: BoxDecoration(
                    color:
                        isRootSelected
                            ? widget.accentColor.withValues(alpha: 0.25)
                            : Colors.transparent,
                    borderRadius: BorderRadius.circular(10),
                    border:
                        isRootSelected
                            ? Border.all(
                              color: widget.accentColor.withValues(alpha: 0.5),
                            )
                            : null,
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.home_rounded,
                        color: widget.accentColor,
                        size: 18,
                      ),
                      const SizedBox(width: 10),
                      Text(
                        'Thư viện gốc (Root)',
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight:
                              isRootSelected
                                  ? FontWeight.bold
                                  : FontWeight.normal,
                          color: isRootSelected ? Colors.white : Colors.white70,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const Divider(color: AppTheme.borderColor, height: 8),
              ..._buildTreeNodeWidgets(treeNodes, 1),
            ],
          ),
        ),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(
            horizontal: 10,
            vertical: 6,
          ),
          decoration: BoxDecoration(
            color: AppTheme.bgCard.withValues(alpha: 0.5),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppTheme.borderColor),
          ),
          child: Row(
            children: [
              const Text(
                'Vị trí lưu:',
                style: TextStyle(color: Colors.white54, fontSize: 11),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  widget.destination.isEmpty
                      ? 'Thư viện gốc (Root)'
                      : '/${widget.destination}',
                  textAlign: TextAlign.right,
                  style: const TextStyle(
                    color: Colors.amber,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    fontFamily: 'monospace',
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              InkWell(
                onTap: widget.disabled ? null : _handleCreateFolder,
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: const EdgeInsets.all(5),
                  decoration: BoxDecoration(
                    color: Colors.amber.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: Colors.amber.withValues(alpha: 0.4),
                    ),
                  ),
                  child: const Icon(
                    Icons.create_new_folder_rounded,
                    color: Colors.amber,
                    size: 16,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
