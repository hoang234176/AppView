import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../models/folder_item.dart';
import '../models/tree_node.dart';
import '../api/folder_api.dart';
import '../providers/app_state_provider.dart';
import 'app_toast.dart';

class CreateFolderDialog extends StatefulWidget {
  final String parentPath;

  const CreateFolderDialog({super.key, required this.parentPath});

  static Future<String?> show(BuildContext context, String parentPath) {
    return showDialog<String>(
      context: context,
      builder: (ctx) => CreateFolderDialog(parentPath: parentPath),
    );
  }

  @override
  State<CreateFolderDialog> createState() => _CreateFolderDialogState();
}

class _CreateFolderDialogState extends State<CreateFolderDialog> {
  late TextEditingController _nameController;
  String? _errorMessage;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController();
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    final folderName = _nameController.text.trim();
    if (folderName.isEmpty) {
      setState(() => _errorMessage = 'Vui lòng nhập tên thư mục mới.');
      return;
    }

    if (RegExp(r'[/\:*?"<>|]').hasMatch(folderName) || folderName.contains('..')) {
      setState(() => _errorMessage = 'Tên thư mục chứa ký tự không hợp lệ.');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    final res = await FolderApi.createFolder(widget.parentPath, folderName);

    if (!mounted) return;
    setState(() => _isSubmitting = false);

    if (res.success) {
      final createdPath = widget.parentPath.isEmpty ? folderName : '${widget.parentPath}/$folderName';
      Navigator.of(context).pop(createdPath);
      final appState = context.read<AppStateProvider>();
      appState.refreshAll();
      AppToast.showSuccess(
        context,
        'Đã tạo thư mục mới "$folderName" thành công!',
      );
    } else {
      setState(() => _errorMessage = res.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: AppTheme.bgBlock,
      shape: RoundedRectangleBorder(
        borderRadius: AppTheme.borderRadius,
        side: const BorderSide(color: AppTheme.borderColor),
      ),
      title: const Row(
        children: [
          Icon(Icons.create_new_folder_rounded, color: AppTheme.googleBlue, size: 24),
          SizedBox(width: 10),
          Text(
            'Tạo thư mục mới',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
          ),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (_errorMessage != null) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppTheme.errorRed.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppTheme.errorRed.withValues(alpha: 0.3)),
                ),
                child: Text(
                  _errorMessage!,
                  style: const TextStyle(color: AppTheme.errorRed, fontSize: 13, fontWeight: FontWeight.w500),
                ),
              ),
              const SizedBox(height: 12),
            ],
            const Text(
              'Tên thư mục:',
              style: TextStyle(color: Color(0xFFBDC1C6), fontSize: 13, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _nameController,
              autofocus: true,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _handleSubmit(),
              style: const TextStyle(color: Colors.white, fontSize: 15),
              decoration: InputDecoration(
                hintText: 'Nhập tên thư mục mới...',
                hintStyle: const TextStyle(color: Color(0xFF80868B), fontSize: 14),
                filled: true,
                fillColor: AppTheme.bgCard,
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: const BorderSide(color: AppTheme.borderColor),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: const BorderSide(color: AppTheme.borderColor),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: const BorderSide(color: AppTheme.googleBlue, width: 1.5),
                ),
              ),
            ),
          ],
        ),
      ),
      actions: [
        OutlinedButton(
          onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(),
          child: const Text('Hủy bỏ'),
        ),
        ElevatedButton.icon(
          onPressed: _isSubmitting ? null : _handleSubmit,
          icon: _isSubmitting
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : const Icon(Icons.check_rounded, size: 18),
          label: Text(_isSubmitting ? 'Đang tạo...' : 'Xác nhận'),
        ),
      ],
    );
  }
}

class RenameFolderDialog extends StatefulWidget {
  final FolderItem folder;

  const RenameFolderDialog({super.key, required this.folder});

  static Future<void> show(BuildContext context, FolderItem folder) {
    return showDialog(
      context: context,
      builder: (ctx) => RenameFolderDialog(folder: folder),
    );
  }

  @override
  State<RenameFolderDialog> createState() => _RenameFolderDialogState();
}

class _RenameFolderDialogState extends State<RenameFolderDialog> {
  late TextEditingController _nameController;
  String? _errorMessage;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.folder.name);
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    final newName = _nameController.text.trim();
    if (newName.isEmpty) {
      setState(() => _errorMessage = 'Vui lòng nhập tên thư mục mới.');
      return;
    }

    if (newName == widget.folder.name) {
      Navigator.of(context).pop();
      return;
    }

    if (RegExp(r'[/\:*?"<>|]').hasMatch(newName) || newName.contains('..')) {
      setState(() => _errorMessage = 'Tên thư mục chứa ký tự không hợp lệ.');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    final res = await FolderApi.renameFolder(widget.folder.path, newName);

    if (!mounted) return;
    setState(() => _isSubmitting = false);

    if (res.success) {
      Navigator.of(context).pop();
      final appState = context.read<AppStateProvider>();
      appState.refreshAll();
      AppToast.showSuccess(
        context,
        'Đã đổi tên thư mục thành "$newName"!',
      );
    } else {
      setState(() => _errorMessage = res.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: AppTheme.bgBlock,
      shape: RoundedRectangleBorder(
        borderRadius: AppTheme.borderRadius,
        side: const BorderSide(color: AppTheme.borderColor),
      ),
      title: const Row(
        children: [
          Icon(Icons.edit_rounded, color: AppTheme.googleBlue, size: 24),
          SizedBox(width: 10),
          Text(
            'Đổi tên thư mục',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
          ),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (_errorMessage != null) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppTheme.errorRed.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppTheme.errorRed.withValues(alpha: 0.3)),
                ),
                child: Text(
                  _errorMessage!,
                  style: const TextStyle(color: AppTheme.errorRed, fontSize: 13, fontWeight: FontWeight.w500),
                ),
              ),
              const SizedBox(height: 12),
            ],
            Text.rich(
              TextSpan(
                text: 'Tên mới cho thư mục ',
                style: const TextStyle(color: Color(0xFFBDC1C6), fontSize: 13),
                children: [
                  TextSpan(
                    text: '"${widget.folder.name}"',
                    style: const TextStyle(color: AppTheme.folderYellow, fontWeight: FontWeight.bold),
                  ),
                  const TextSpan(text: ':'),
                ],
              ),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _nameController,
              autofocus: true,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _handleSubmit(),
              style: const TextStyle(color: Colors.white, fontSize: 15),
              decoration: InputDecoration(
                hintText: 'Nhập tên mới...',
                hintStyle: const TextStyle(color: Color(0xFF80868B), fontSize: 14),
                filled: true,
                fillColor: AppTheme.bgCard,
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: const BorderSide(color: AppTheme.borderColor),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: const BorderSide(color: AppTheme.borderColor),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: const BorderSide(color: AppTheme.googleBlue, width: 1.5),
                ),
              ),
            ),
          ],
        ),
      ),
      actions: [
        OutlinedButton(
          onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(),
          child: const Text('Hủy bỏ'),
        ),
        ElevatedButton.icon(
          onPressed: _isSubmitting ? null : _handleSubmit,
          icon: _isSubmitting
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : const Icon(Icons.check_rounded, size: 18),
          label: Text(_isSubmitting ? 'Đang đổi tên...' : 'Xác nhận'),
        ),
      ],
    );
  }
}

class DeleteFolderConfirmDialog extends StatefulWidget {
  final FolderItem folder;

  const DeleteFolderConfirmDialog({super.key, required this.folder});

  static Future<void> show(BuildContext context, FolderItem folder) {
    return showDialog(
      context: context,
      builder: (ctx) => DeleteFolderConfirmDialog(folder: folder),
    );
  }

  @override
  State<DeleteFolderConfirmDialog> createState() => _DeleteFolderConfirmDialogState();
}

class _DeleteFolderConfirmDialogState extends State<DeleteFolderConfirmDialog> {
  String? _errorMessage;
  bool _isDeleting = false;

  Future<void> _handleDelete() async {
    final appState = context.read<AppStateProvider>();
    setState(() {
      _isDeleting = true;
      _errorMessage = null;
    });

    final res = await FolderApi.deleteFolder(widget.folder.path);

    if (!mounted) return;
    setState(() => _isDeleting = false);

    if (res.success) {
      Navigator.of(context).pop();
      appState.refreshAll();
      AppToast.showSuccess(
        context,
        'Đã xóa thư mục "${widget.folder.name}" thành công!',
      );
    } else {
      setState(() => _errorMessage = res.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: AppTheme.bgBlock,
      shape: RoundedRectangleBorder(
        borderRadius: AppTheme.borderRadius,
        side: BorderSide(color: AppTheme.errorRed.withValues(alpha: 0.3)),
      ),
      title: const Row(
        children: [
          Icon(Icons.warning_amber_rounded, color: AppTheme.errorRed, size: 24),
          SizedBox(width: 10),
          Text(
            'Xác nhận xóa thư mục',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.errorRed),
          ),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (_errorMessage != null) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppTheme.errorRed.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppTheme.errorRed.withValues(alpha: 0.3)),
                ),
                child: Text(
                  _errorMessage!,
                  style: const TextStyle(color: AppTheme.errorRed, fontSize: 13, fontWeight: FontWeight.w500),
                ),
              ),
              const SizedBox(height: 12),
            ],
            Text.rich(
              TextSpan(
                text: 'Bạn có chắc chắn muốn xóa thư mục ',
                style: const TextStyle(color: Colors.white, fontSize: 14.5),
                children: [
                  TextSpan(
                    text: '"${widget.folder.name}"',
                    style: const TextStyle(color: AppTheme.folderYellow, fontWeight: FontWeight.bold),
                  ),
                  const TextSpan(text: ' không?'),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.errorRed.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppTheme.errorRed.withValues(alpha: 0.25)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.info_outline_rounded, color: AppTheme.errorRed, size: 18),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Thao tác này sẽ xóa toàn bộ các thư mục con và tệp bên trong và không thể hoàn tác.',
                      style: TextStyle(fontSize: 12.5, color: Color(0xFFF28B82), height: 1.35),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      actions: [
        OutlinedButton(
          onPressed: _isDeleting ? null : () => Navigator.of(context).pop(),
          child: const Text('Hủy bỏ'),
        ),
        ElevatedButton.icon(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppTheme.errorRed,
            foregroundColor: Colors.white,
          ),
          onPressed: _isDeleting ? null : _handleDelete,
          icon: _isDeleting
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : const Icon(Icons.delete_forever_rounded, size: 18),
          label: Text(_isDeleting ? 'Đang xóa...' : 'Xác nhận'),
        ),
      ],
    );
  }
}

class DeleteFileDialog extends StatefulWidget {
  final String filePath;
  final String fileName;

  const DeleteFileDialog({super.key, required this.filePath, required this.fileName});

  static Future<void> show(BuildContext context, {required String filePath, required String fileName}) {
    return showDialog(
      context: context,
      builder: (ctx) => DeleteFileDialog(filePath: filePath, fileName: fileName),
    );
  }

  @override
  State<DeleteFileDialog> createState() => _DeleteFileDialogState();
}

class _DeleteFileDialogState extends State<DeleteFileDialog> {
  bool _isDeleting = false;
  String? _errorMessage;

  Future<void> _handleDelete() async {
    final appState = context.read<AppStateProvider>();
    setState(() {
      _isDeleting = true;
      _errorMessage = null;
    });

    final res = await FolderApi.deleteFile(widget.filePath);

    if (!mounted) return;
    setState(() => _isDeleting = false);

    if (res.success) {
      Navigator.of(context).pop();
      appState.refreshAll();
      AppToast.showSuccess(
        context,
        'Đã xóa file "${widget.fileName}" thành công!',
      );
    } else {
      setState(() => _errorMessage = res.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: AppTheme.bgBlock,
      shape: RoundedRectangleBorder(
        borderRadius: AppTheme.borderRadius,
        side: BorderSide(color: AppTheme.errorRed.withValues(alpha: 0.3)),
      ),
      title: const Row(
        children: [
          Icon(Icons.delete_forever_rounded, color: AppTheme.errorRed, size: 24),
          SizedBox(width: 10),
          Text(
            'Xác nhận xóa tệp',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.errorRed),
          ),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_errorMessage != null) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppTheme.errorRed.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(_errorMessage!, style: const TextStyle(color: AppTheme.errorRed, fontSize: 13)),
            ),
            const SizedBox(height: 10),
          ],
          Text('Bạn có chắc chắn muốn xóa file "${widget.fileName}" khỏi máy chủ không?', style: const TextStyle(color: Colors.white, fontSize: 14)),
          const SizedBox(height: 8),
          const Text('⚠️ Thao tác này sẽ xóa tệp vĩnh viễn và không thể khôi phục.', style: TextStyle(color: AppTheme.errorRed, fontSize: 12)),
        ],
      ),
      actions: [
        OutlinedButton(
          onPressed: _isDeleting ? null : () => Navigator.of(context).pop(),
          child: const Text('Hủy'),
        ),
        ElevatedButton(
          style: ElevatedButton.styleFrom(backgroundColor: AppTheme.errorRed),
          onPressed: _isDeleting ? null : _handleDelete,
          child: Text(_isDeleting ? 'Đang xóa...' : 'Xác nhận'),
        ),
      ],
    );
  }
}

class MoveItemDialog extends StatefulWidget {
  final String srcPath;
  final String itemName;
  final bool isFolder;

  const MoveItemDialog({
    super.key,
    required this.srcPath,
    required this.itemName,
    this.isFolder = false,
  });

  static Future<void> show(BuildContext context, {required String srcPath, required String itemName, bool isFolder = false}) {
    return showDialog(
      context: context,
      builder: (ctx) => MoveItemDialog(srcPath: srcPath, itemName: itemName, isFolder: isFolder),
    );
  }

  @override
  State<MoveItemDialog> createState() => _MoveItemDialogState();
}

class _MoveItemDialogState extends State<MoveItemDialog> {
  String _selectedFolderPath = '';
  final Set<String> _expandedPaths = {};
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _autoPreselectCurrentPath();
    });
  }

  void _autoPreselectCurrentPath() {
    if (!mounted) return;
    final currentPath = context.read<AppStateProvider>().currentPath;
    setState(() {
      _selectedFolderPath = currentPath;
      if (currentPath.isNotEmpty) {
        final parts = currentPath.split('/');
        String accPath = '';
        for (final part in parts) {
          accPath = accPath.isEmpty ? part : '$accPath/$part';
          _expandedPaths.add(accPath);
        }
      }
    });
  }

  Future<void> _handleMove() async {
    if (widget.isFolder && (_selectedFolderPath == widget.srcPath || _selectedFolderPath.startsWith('${widget.srcPath}/'))) {
      setState(() => _errorMessage = 'Không thể di chuyển thư mục vào chính nó hoặc thư mục con của nó.');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    final res = await FolderApi.moveItem(widget.srcPath, _selectedFolderPath);

    if (!mounted) return;
    setState(() => _isSubmitting = false);

    if (res.success) {
      Navigator.of(context).pop();
      final appState = context.read<AppStateProvider>();
      appState.refreshAll();
      AppToast.showSuccess(
        context,
        'Đã di chuyển "${widget.itemName}" thành công!',
      );
    } else {
      setState(() => _errorMessage = res.message);
    }
  }

  Future<void> _handleCreateNewFolderInMoveDialog() async {
    final appState = context.read<AppStateProvider>();
    final nameController = TextEditingController();
    final newFolderName = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.bgBlock,
        shape: RoundedRectangleBorder(
          borderRadius: AppTheme.borderRadius,
          side: const BorderSide(color: AppTheme.borderColor),
        ),
        title: const Row(
          children: [
            Icon(Icons.create_new_folder_rounded, color: AppTheme.googleBlue, size: 22),
            SizedBox(width: 8),
            Text('Tạo thư mục mới tại đây', style: TextStyle(fontSize: 16, color: Colors.white, fontWeight: FontWeight.bold)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Vị trí tạo: ${_selectedFolderPath.isEmpty ? "Thư viện gốc (Root)" : "/$_selectedFolderPath"}',
              style: const TextStyle(color: Colors.amber, fontSize: 11, fontWeight: FontWeight.bold, fontFamily: 'monospace'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: nameController,
              autofocus: true,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              decoration: InputDecoration(
                hintText: 'Nhập tên thư mục...',
                hintStyle: const TextStyle(color: Colors.white38, fontSize: 13),
                filled: true,
                fillColor: AppTheme.bgCard,
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppTheme.borderColor)),
              ),
              onSubmitted: (val) => Navigator.of(ctx).pop(val.trim()),
            ),
          ],
        ),
        actions: [
          OutlinedButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Hủy')),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(nameController.text.trim()),
            child: const Text('Tạo ngay'),
          ),
        ],
      ),
    );

    if (newFolderName == null || newFolderName.isEmpty) return;

    final res = await FolderApi.createFolder(_selectedFolderPath, newFolderName);

    if (res.success) {
      final createdFolderPath = _selectedFolderPath.isEmpty ? newFolderName : '$_selectedFolderPath/$newFolderName';
      
      // Auto expand parent path and select the newly created folder
      if (_selectedFolderPath.isNotEmpty) {
        _expandedPaths.add(_selectedFolderPath);
      }
      
      await appState.refreshAll();

      if (mounted) {
        setState(() {
          _selectedFolderPath = createdFolderPath;
        });
        AppToast.showSuccess(context, 'Đã tạo và tự động chọn thư mục "$newFolderName"!');
      }
    } else {
      if (mounted) {
        AppToast.showError(context, res.message);
      }
    }
  }

  List<Widget> _buildTreeNodeWidgets(List<TreeNode> nodes, int depth) {
    final List<Widget> list = [];

    for (final node in nodes) {
      // Prevent moving folder into itself or its children
      if (widget.isFolder && (node.path == widget.srcPath || node.path.startsWith('${widget.srcPath}/'))) {
        continue;
      }

      final isSelected = _selectedFolderPath == node.path;
      final isExpanded = _expandedPaths.contains(node.path);

      list.add(
        InkWell(
          onTap: () {
            setState(() {
              _selectedFolderPath = node.path;
              if (node.hasChildren && !isExpanded) {
                _expandedPaths.add(node.path);
              }
            });
          },
          borderRadius: BorderRadius.circular(10),
          child: Container(
            margin: const EdgeInsets.symmetric(vertical: 2, horizontal: 4),
            padding: EdgeInsets.only(left: depth * 14.0 + 6.0, right: 8, top: 8, bottom: 8),
            decoration: BoxDecoration(
              color: isSelected ? AppTheme.googleBlue.withValues(alpha: 0.25) : Colors.transparent,
              borderRadius: BorderRadius.circular(10),
              border: isSelected ? Border.all(color: AppTheme.googleBlue.withValues(alpha: 0.5)) : null,
            ),
            child: Row(
              children: [
                if (node.hasChildren)
                  GestureDetector(
                    onTap: () {
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
                        isExpanded ? Icons.expand_more_rounded : Icons.chevron_right_rounded,
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
                      fontSize: 13,
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
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
    final appState = context.watch<AppStateProvider>();
    final treeNodes = appState.treeData;

    return Dialog(
      backgroundColor: AppTheme.bgBlock,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(28),
        side: const BorderSide(color: AppTheme.borderColor),
      ),
      child: Container(
        constraints: const BoxConstraints(maxHeight: 560),
        padding: const EdgeInsets.all(18),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppTheme.googleBlue.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.drive_file_move_rounded, color: AppTheme.googleBlue, size: 20),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Di chuyển ${widget.isFolder ? "thư mục" : "tệp"}',
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                      Text(
                        widget.itemName,
                        style: const TextStyle(fontSize: 11, color: Colors.white54),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded, color: Colors.white54),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
              ],
            ),
            const SizedBox(height: 10),
            const Divider(color: AppTheme.borderColor, height: 1),
            const SizedBox(height: 10),

            if (_errorMessage != null) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppTheme.errorRed.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppTheme.errorRed.withValues(alpha: 0.3)),
                ),
                child: Text(
                  _errorMessage!,
                  style: const TextStyle(color: AppTheme.errorRed, fontSize: 12, fontWeight: FontWeight.w500),
                ),
              ),
              const SizedBox(height: 10),
            ],

            // Expandable Tree Container with scrollable ListView
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: AppTheme.bgCard,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppTheme.borderColor),
                ),
                child: ListView(
                  padding: const EdgeInsets.all(6),
                  children: [
                    // Root folder option
                    InkWell(
                      onTap: () => setState(() => _selectedFolderPath = ''),
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        decoration: BoxDecoration(
                          color: _selectedFolderPath == '' ? AppTheme.googleBlue.withValues(alpha: 0.25) : Colors.transparent,
                          borderRadius: BorderRadius.circular(10),
                          border: _selectedFolderPath == '' ? Border.all(color: AppTheme.googleBlue.withValues(alpha: 0.5)) : null,
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.home_rounded, color: AppTheme.googleBlue, size: 18),
                            const SizedBox(width: 10),
                            Text(
                              'Thư viện gốc (Root)',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: _selectedFolderPath == '' ? FontWeight.bold : FontWeight.normal,
                                color: _selectedFolderPath == '' ? Colors.white : Colors.white70,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const Divider(color: AppTheme.borderColor, height: 10),

                    ..._buildTreeNodeWidgets(treeNodes, 1),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 10),

            // Target folder info & Create New Folder Button
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    'Đích: ${_selectedFolderPath.isEmpty ? "Thư viện gốc" : "/$_selectedFolderPath"}',
                    style: const TextStyle(color: Colors.amber, fontSize: 11, fontWeight: FontWeight.bold, fontFamily: 'monospace'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),

                // Inline "+ Tạo thư mục mới" Button
                TextButton.icon(
                  onPressed: _handleCreateNewFolderInMoveDialog,
                  icon: const Icon(Icons.create_new_folder_outlined, size: 16, color: AppTheme.googleBlue),
                  label: const Text('Tạo thư mục', style: TextStyle(fontSize: 11, color: AppTheme.googleBlue, fontWeight: FontWeight.bold)),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),

            // Action Buttons
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                OutlinedButton(
                  onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(),
                  child: const Text('Hủy'),
                ),
                const SizedBox(width: 8),
                ElevatedButton.icon(
                  onPressed: _isSubmitting ? null : _handleMove,
                  icon: _isSubmitting
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.check_rounded, size: 18),
                  label: Text(_isSubmitting ? 'Đang chuyển...' : 'Xác nhận'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
