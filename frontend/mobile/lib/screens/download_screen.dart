import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../providers/download_provider.dart';
import '../providers/app_state_provider.dart';
import '../models/tree_node.dart';
import '../api/download_api.dart';
import '../api/folder_api.dart';
import '../utils/formatters.dart';
import '../widgets/app_toast.dart';
import '../widgets/file_type_icon.dart';

class DownloadScreen extends StatefulWidget {
  final String currentPath;

  const DownloadScreen({super.key, this.currentPath = ''});

  static Future<void> navigateTo(
    BuildContext context, {
    String currentPath = '',
  }) {
    return Navigator.of(context).push(
      MaterialPageRoute(
        builder: (ctx) => DownloadScreen(currentPath: currentPath),
      ),
    );
  }

  static Future<void> showAddMediaFireDialog(
    BuildContext context,
    String currentPath,
  ) {
    return _AddMediaFireArchiveDialog.show(context, currentPath);
  }

  @override
  State<DownloadScreen> createState() => _DownloadScreenState();
}

class _AddMediaFireArchiveDialog extends StatefulWidget {
  final String currentPath;

  const _AddMediaFireArchiveDialog({required this.currentPath});

  static Future<void> show(BuildContext context, String currentPath) {
    return showDialog(
      context: context,
      builder: (ctx) => _AddMediaFireArchiveDialog(currentPath: currentPath),
    );
  }

  @override
  State<_AddMediaFireArchiveDialog> createState() =>
      _AddMediaFireArchiveDialogState();
}

class _AddMediaFireArchiveDialogState
    extends State<_AddMediaFireArchiveDialog> {
  late TextEditingController _urlController;
  late TextEditingController _pwdController;
  String _selectedDest = '';
  final Set<String> _expandedPaths = {};
  bool _isSubmitting = false;
  bool _obscurePassword = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _urlController = TextEditingController();
    _pwdController = TextEditingController();
    _selectedDest = widget.currentPath;

    if (widget.currentPath.isNotEmpty) {
      final parts = widget.currentPath.split('/');
      String accPath = '';
      for (final part in parts) {
        accPath = accPath.isEmpty ? part : '$accPath/$part';
        _expandedPaths.add(accPath);
      }
    }
  }

  @override
  void dispose() {
    _urlController.dispose();
    _pwdController.dispose();
    super.dispose();
  }

  Future<void> _handleCreateFolderInDialog() async {
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
                    'Tạo folder mới trong ${_selectedDest.isEmpty ? "Root" : "/$_selectedDest"}',
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
      final res = await FolderApi.createFolder(_selectedDest, newFolderName);
      if (res.success) {
        await appState.loadTreeData();
        if (mounted) {
          setState(() {
            final newPath =
                _selectedDest.isEmpty
                    ? newFolderName
                    : '$_selectedDest/$newFolderName';
            _selectedDest = newPath;
            _expandedPaths.add(_selectedDest);
            _expandedPaths.add(newPath);
          });
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
      final isSelected = _selectedDest == node.path;
      final isExpanded = _expandedPaths.contains(node.path);

      list.add(
        InkWell(
          onTap: () {
            setState(() {
              _selectedDest = node.path;
              if (node.hasChildren && !isExpanded) {
                _expandedPaths.add(node.path);
              }
            });
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
                      ? AppTheme.googleBlue.withValues(alpha: 0.25)
                      : Colors.transparent,
              borderRadius: BorderRadius.circular(10),
              border:
                  isSelected
                      ? Border.all(
                        color: AppTheme.googleBlue.withValues(alpha: 0.5),
                      )
                      : null,
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

  Future<void> _handleSubmit() async {
    final url = _urlController.text.trim();
    if (url.isEmpty) {
      setState(() => _errorMessage = 'Vui lòng nhập liên kết MediaFire.');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    final res = await context.read<DownloadProvider>().startCoordinatorDownload(
      url: url,
      destination: canonicalDownloadDestination(_selectedDest),
      password:
          _pwdController.text.trim().isEmpty
              ? null
              : _pwdController.text.trim(),
    );

    if (!mounted) return;
    setState(() => _isSubmitting = false);

    if (res['success'] == true) {
      Navigator.of(context).pop();
      AppToast.showSuccess(context, 'Đã khởi tạo task tải xuống thành công!');
    } else {
      setState(
        () =>
            _errorMessage = res['message'] ?? 'Lỗi khi khởi tạo task tải xuống',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final treeNodes = context.watch<AppStateProvider>().treeData;

    return GestureDetector(
      onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
      behavior: HitTestBehavior.translucent,
      child: AlertDialog(
        backgroundColor: AppTheme.bgBlock,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
          side: const BorderSide(color: AppTheme.borderColor),
        ),
        title: const Row(
          children: [
            Icon(Icons.download_rounded, color: AppTheme.googleBlue, size: 22),
            SizedBox(width: 8),
            Text(
              'Thêm link MediaFire',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
          ],
        ),
        content: SizedBox(
          width: double.maxFinite,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (_errorMessage != null) ...[
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppTheme.errorRed.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: AppTheme.errorRed.withValues(alpha: 0.3),
                      ),
                    ),
                    child: Text(
                      _errorMessage!,
                      style: const TextStyle(
                        color: AppTheme.errorRed,
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                ],

                const Text(
                  'URL MediaFire:',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                TextField(
                  controller: _urlController,
                  autofocus: true,
                  textInputAction: TextInputAction.next,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontFamily: 'monospace',
                  ),
                  decoration: InputDecoration(
                    hintText: 'https://www.mediafire.com/file/...',
                    hintStyle: const TextStyle(
                      color: Colors.white38,
                      fontSize: 12,
                    ),
                    filled: true,
                    fillColor: AppTheme.bgCard,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: const BorderSide(color: AppTheme.borderColor),
                    ),
                  ),
                ),
                const SizedBox(height: 12),

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
                  height: 180,
                  decoration: BoxDecoration(
                    color: AppTheme.bgCard,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppTheme.borderColor),
                  ),
                  child: ListView(
                    padding: const EdgeInsets.all(4),
                    children: [
                      InkWell(
                        onTap: () => setState(() => _selectedDest = ''),
                        borderRadius: BorderRadius.circular(10),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 7,
                          ),
                          decoration: BoxDecoration(
                            color:
                                _selectedDest == ''
                                    ? AppTheme.googleBlue.withValues(
                                      alpha: 0.25,
                                    )
                                    : Colors.transparent,
                            borderRadius: BorderRadius.circular(10),
                            border:
                                _selectedDest == ''
                                    ? Border.all(
                                      color: AppTheme.googleBlue.withValues(
                                        alpha: 0.5,
                                      ),
                                    )
                                    : null,
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.home_rounded,
                                color: AppTheme.googleBlue,
                                size: 18,
                              ),
                              const SizedBox(width: 10),
                              Text(
                                'Thư viện gốc (Root)',
                                style: TextStyle(
                                  fontSize: 12.5,
                                  fontWeight:
                                      _selectedDest == ''
                                          ? FontWeight.bold
                                          : FontWeight.normal,
                                  color:
                                      _selectedDest == ''
                                          ? Colors.white
                                          : Colors.white70,
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
                          _selectedDest.isEmpty
                              ? 'Thư viện gốc (Root)'
                              : '/$_selectedDest',
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
                        onTap: _handleCreateFolderInDialog,
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

                const SizedBox(height: 12),
                const Text(
                  'Mật khẩu giải nén (nếu có):',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                TextField(
                  controller: _pwdController,
                  obscureText: _obscurePassword,
                  textInputAction: TextInputAction.done,
                  onSubmitted:
                      (_) => FocusManager.instance.primaryFocus?.unfocus(),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontFamily: 'monospace',
                  ),
                  decoration: InputDecoration(
                    hintText: 'Nhập password nếu tệp bị khóa',
                    hintStyle: const TextStyle(
                      color: Colors.white38,
                      fontSize: 12,
                    ),
                    filled: true,
                    fillColor: AppTheme.bgCard,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: const BorderSide(color: AppTheme.borderColor),
                    ),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscurePassword
                            ? Icons.visibility_off_rounded
                            : Icons.visibility_rounded,
                        color: Colors.white54,
                        size: 18,
                      ),
                      onPressed:
                          () => setState(
                            () => _obscurePassword = !_obscurePassword,
                          ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        actions: [
          OutlinedButton(
            onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(),
            child: const Text('Hủy'),
          ),
          ElevatedButton.icon(
            onPressed: _isSubmitting ? null : _handleSubmit,
            icon:
                _isSubmitting
                    ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                    : const Icon(Icons.download_rounded, size: 18),
            label: Text(_isSubmitting ? 'Đang xử lý...' : 'Bắt đầu tải'),
          ),
        ],
      ),
    );
  }
}

class _DownloadScreenState extends State<DownloadScreen> {
  final Map<String, TextEditingController> _pwdControllers = {};
  final Set<String> _passwordSubmissions = {};
  final Set<String> _retrySubmissions = {};
  final Set<String> _cancelSubmissions = {};
  final Map<String, String> _pendingDecisions = {};
  final Set<String> _applySubmissions = {};

  @override
  void dispose() {
    for (final controller in _pwdControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  TextEditingController _getController(String taskId) {
    if (!_pwdControllers.containsKey(taskId)) {
      _pwdControllers[taskId] = TextEditingController();
    }
    return _pwdControllers[taskId]!;
  }

  @override
  Widget build(BuildContext context) {
    final downloadProvider = context.watch<DownloadProvider>();
    final tasks = downloadProvider.tasks;
    bool isRetryableDownloadError(DownloadTaskModel task) =>
        DownloadProvider.isRetryableDownload(task);
    final activeTasks =
        tasks
            .where(
              (task) =>
                  DownloadProvider.isActiveDownload(task) ||
                  isRetryableDownloadError(task),
            )
            .toList();
    final cancelledTasks =
        tasks.where((task) => task.stage == 'cancelled').toList();
    final completedTasks =
        tasks
            .where(
              (task) =>
                  task.stage != 'cancelled' &&
                  !DownloadProvider.isActiveDownload(task) &&
                  !isRetryableDownloadError(task),
            )
            .toList();

    return DefaultTabController(
      length: 3,
      child: GestureDetector(
        onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
        behavior: HitTestBehavior.translucent,
        child: Scaffold(
          backgroundColor: AppTheme.bgBlock,
          appBar: AppBar(
            backgroundColor: AppTheme.bgBlock,
            elevation: 0,
            leading: IconButton(
              icon: const Icon(
                Icons.arrow_back_ios_new_rounded,
                color: Colors.white,
                size: 18,
              ),
              onPressed: () => Navigator.of(context).pop(),
            ),
            title: const Text(
              'Quản lý Download',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            centerTitle: false,
            bottom: PreferredSize(
              preferredSize: const Size.fromHeight(62),
              child: Container(
                height: 50,
                margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: AppTheme.bgSearch,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppTheme.borderColor),
                ),
                child: TabBar(
                  dividerColor: Colors.transparent,
                  indicatorSize: TabBarIndicatorSize.tab,
                  indicator: BoxDecoration(
                    color: AppTheme.googleBlue.withValues(alpha: 0.24),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: AppTheme.googleBlue.withValues(alpha: 0.7),
                    ),
                  ),
                  indicatorPadding: EdgeInsets.zero,
                  labelColor: Colors.white,
                  unselectedLabelColor: Colors.white54,
                  labelStyle: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                  ),
                  unselectedLabelStyle: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                  tabs: [
                    Tab(text: 'Đang tải (${activeTasks.length})'),
                    Tab(text: 'Đã tải (${completedTasks.length})'),
                    Tab(text: 'Đã hủy (${cancelledTasks.length})'),
                  ],
                ),
              ),
            ),
          ),
          body: TabBarView(
            children: [
              _buildTaskList(
                context,
                downloadProvider,
                activeTasks,
                'Không có tác vụ đang xử lý.',
              ),
              _buildCompletedList(context, downloadProvider, completedTasks),
              _buildTaskList(
                context,
                downloadProvider,
                cancelledTasks,
                'Chưa có tác vụ đã hủy.',
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTaskList(
    BuildContext context,
    DownloadProvider provider,
    List<DownloadTaskModel> tasks,
    String emptyText,
  ) {
    if (tasks.isEmpty) {
      return Center(
        child: Text(
          emptyText,
          style: const TextStyle(color: Colors.white54, fontSize: 13),
        ),
      );
    }
    return ListView.separated(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: const EdgeInsets.all(16),
      itemCount: tasks.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder:
          (_, index) => _buildTaskCard(context, provider, tasks[index]),
    );
  }

  Widget _buildCompletedList(
    BuildContext context,
    DownloadProvider provider,
    List<DownloadTaskModel> tasks,
  ) {
    if (tasks.isEmpty) return _buildEmptyState(context);
    const groups = [
      ('File nén', 'archive'),
      ('Video', 'video'),
      ('Ảnh', 'picture'),
      ('Lỗi tối ưu', 'optimization_error'),
    ];
    final widgets = <Widget>[];
    for (final group in groups) {
      final grouped =
          tasks.where((task) {
            if (group.$2 == 'optimization_error') {
              return task.errorCode == 'VIDEO_CONVERT_UNAVAILABLE';
            }
            return task.errorCode != 'VIDEO_CONVERT_UNAVAILABLE' &&
                Formatters.getFileCategory(task.filename ?? task.originalUrl) ==
                    group.$2;
          }).toList();
      if (grouped.isEmpty) continue;
      widgets.add(
        Padding(
          padding: const EdgeInsets.only(top: 10, bottom: 8),
          child: Text(
            '${group.$1} (${grouped.length})',
            style: TextStyle(
              color:
                  group.$2 == 'optimization_error'
                      ? Colors.amberAccent
                      : Colors.white54,
              fontSize: 12,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      );
      for (final task in grouped) {
        widgets.add(_buildTaskCard(context, provider, task));
        widgets.add(const SizedBox(height: 12));
      }
    }
    return ListView(padding: const EdgeInsets.all(16), children: widgets);
  }

  Widget _buildEmptyState(BuildContext context) {
    return Center(
      child: Container(
        margin: const EdgeInsets.all(24),
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(
          color: AppTheme.bgCard,
          borderRadius: BorderRadius.circular(28),
          border: Border.all(color: AppTheme.borderColor),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.3),
              blurRadius: 16,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: const Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.download_done_rounded,
              size: 48,
              color: Color(0xFF5F6368),
            ),
            SizedBox(height: 16),
            Text(
              'Danh sách tải xuống trống',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            SizedBox(height: 6),
            Text(
              'Chưa có tác vụ tải xuống nào đang diễn ra.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: Color(0xFF9AA0A6)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTaskCard(
    BuildContext context,
    DownloadProvider provider,
    DownloadTaskModel task,
  ) {
    final isExtracting =
        task.stage == 'extracting' || task.stage == 'waiting_extract';
    final isDownloading = task.stage == 'downloading';
    final isResolving = task.stage == 'resolving' || task.stage == 'queued';
    final isError = task.stage == 'error' || task.stage == 'extract_error';
    final isOptimizationError = task.errorCode == 'VIDEO_CONVERT_UNAVAILABLE';
    final isPasswordReq = DownloadProvider.needsPassword(task);
    final isCompleted = task.stage == 'completed';
    final isScanning = task.stage == 'scanning';
    final isConverting = task.stage == 'converting';
    final isVideoDecisionRequired = task.stage == 'video_decision_required';
    final isCancelledOptimization = DownloadProvider.isCancelledOptimization(
      task,
    );
    final unoptimizedCount =
        task.unoptimizedVideoCount > 0
            ? task.unoptimizedVideoCount
            : (task.videos.isNotEmpty
                ? task.videos.where((v) => v.state != 'completed').length
                : (task.convertTotal > 0
                    ? (task.convertTotal - task.convertCurrent).clamp(
                      0,
                      task.convertTotal,
                    )
                    : task.invalidVideoCount));
    final convertDisplayIndex =
        task.convertTotal > 0
            ? (task.convertCurrent + 1 > task.convertTotal
                ? task.convertTotal
                : task.convertCurrent + 1)
            : 0;

    final category = Formatters.getFileCategory(
      task.filename ?? task.originalUrl,
    );

    Color iconColor = AppTheme.googleBlue;

    if (category == 'video') {
      iconColor = AppTheme.videoPurple;
    } else if (category == 'picture') {
      iconColor = AppTheme.googleBlue;
    }

    if (isCancelledOptimization || isOptimizationError) {
      iconColor = Colors.amberAccent;
    } else if (isPasswordReq) {
      iconColor = Colors.redAccent;
    } else if (isExtracting) {
      iconColor = Colors.orangeAccent;
    } else if (isScanning) {
      iconColor = Colors.greenAccent;
    } else if (isConverting) {
      iconColor = Colors.purpleAccent;
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.bgCard,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppTheme.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              // Icon cố định: mọi tiến trình hiển thị ở thanh ngang bên dưới.
              SizedBox(
                width: 36,
                height: 36,
                child: Center(
                  child: FileTypeIcon(
                    filename: task.filename ?? task.originalUrl,
                    fallback:
                        category == 'video'
                            ? 'MP4'
                            : category == 'picture'
                            ? 'IMG'
                            : 'ZIP',
                    color: iconColor,
                    size: 24,
                  ),
                ),
              ),
              const SizedBox(width: 12),

              // Title and Info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      task.filename ?? 'Tệp nén MediaFire',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        if (isResolving) ...[
                          const Text(
                            'Đang tìm liên kết tải...',
                            style: TextStyle(
                              fontSize: 11,
                              color: AppTheme.googleBlue,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ] else if (isDownloading) ...[
                          Expanded(
                            child: Text(
                              '${Formatters.formatFileSize(task.downloadedBytes)}${(task.downloadTotalBytes ?? 0) > 0 ? ' / ${Formatters.formatFileSize(task.downloadTotalBytes)}' : ''}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 11,
                                fontFamily: 'monospace',
                                color: AppTheme.downloadSizeColor,
                              ),
                            ),
                          ),
                          if (task.downloadSpeedBytes > 0) ...[
                            Text(
                              '${Formatters.formatFileSize(task.downloadSpeedBytes)}/s',
                              style: const TextStyle(
                                fontSize: 11,
                                fontFamily: 'monospace',
                                color: AppTheme.downloadSpeedColor,
                              ),
                            ),
                          ],
                        ] else if (isExtracting) ...[
                          const Text(
                            'Đang giải nén tệp nén...',
                            style: TextStyle(
                              fontSize: 11,
                              color: Colors.orangeAccent,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ] else if (isScanning) ...[
                          const Text(
                            'Đang kiểm tra thư mục...',
                            style: TextStyle(
                              fontSize: 11,
                              color: Colors.greenAccent,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ] else if (isVideoDecisionRequired) ...[
                          const Text(
                            'Chọn chất lượng cho từng video',
                            style: TextStyle(
                              fontSize: 11,
                              color: Colors.purpleAccent,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ] else if (isConverting) ...[
                          Text(
                            '[$convertDisplayIndex/${task.convertTotal}] Đang tối ưu video...',
                            style: const TextStyle(
                              fontSize: 11,
                              color: Colors.purpleAccent,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ] else if (isCancelledOptimization) ...[
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Text(
                                'Đã tải và giải nén',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: Colors.greenAccent,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '$unoptimizedCount video chưa được tối ưu hóa',
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: Colors.amberAccent,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ] else if (isCompleted) ...[
                          Text(
                            task.convertTotal > 0
                                ? '✓ Đã giải nén - tối ưu ${task.convertTotal} video'
                                : '✓ Đã giải nén hoàn tất',
                            style: const TextStyle(
                              fontSize: 11,
                              color: Colors.greenAccent,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ] else if (isPasswordReq) ...[
                          const Text(
                            'Yêu cầu mật khẩu giải nén',
                            style: TextStyle(
                              fontSize: 11,
                              color: Colors.redAccent,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ] else if (isOptimizationError) ...[
                          const Text(
                            '⚠ Đã giải nén — chưa tối ưu được video',
                            style: TextStyle(
                              fontSize: 11,
                              color: Colors.amberAccent,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ] else if (isError) ...[
                          Text(
                            '${task.failureStage != null ? '[${task.failureStage}] ' : ''}${task.error ?? 'Gặp lỗi trong quá trình xử lý'}',
                            style: const TextStyle(
                              fontSize: 11,
                              color: Colors.redAccent,
                            ),
                          ),
                        ] else if (task.stage == 'cancelled') ...[
                          const Text(
                            '⊘ Đã hủy',
                            style: TextStyle(
                              fontSize: 11,
                              color: Colors.white54,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),

              // A failed download stays here with its .part file. Reload asks
              // Go to continue it; X deletes that temporary file.
              if (DownloadProvider.isRetryableDownload(task)) ...[
                IconButton(
                  icon: const Icon(
                    Icons.refresh_rounded,
                    color: AppTheme.googleBlue,
                    size: 18,
                  ),
                  onPressed:
                      _retrySubmissions.contains(task.taskId)
                          ? null
                          : () async {
                            setState(() => _retrySubmissions.add(task.taskId));
                            await provider.retryTask(task.taskId);
                            if (!mounted) return;
                            setState(
                              () => _retrySubmissions.remove(task.taskId),
                            );
                          },
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
                const SizedBox(width: 4),
              ],
              if (DownloadProvider.canCancelDownload(task))
                IconButton(
                  icon: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.05),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.close_rounded,
                      color: Colors.white70,
                      size: 16,
                    ),
                  ),
                  onPressed:
                      _cancelSubmissions.contains(task.taskId)
                          ? null
                          : () async {
                            setState(() => _cancelSubmissions.add(task.taskId));
                            await provider.cancelTask(task.taskId);
                            if (!mounted) return;
                            setState(
                              () => _cancelSubmissions.remove(task.taskId),
                            );
                          },
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  tooltip: 'Hủy tác vụ',
                ),
              if (!DownloadProvider.canCancelDownload(task))
                IconButton(
                  icon: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.05),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.close_rounded,
                      color: Colors.white54,
                      size: 16,
                    ),
                  ),
                  onPressed: () => provider.deleteTask(task.taskId),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  tooltip: 'Xóa tác vụ',
                ),
            ],
          ),

          // Mọi tiến trình dùng thanh ngang. Tải có phần trăm; các công đoạn
          // còn lại dùng thanh chạy vô hạn, không vẽ vòng quanh icon.
          if (isDownloading ||
              isResolving ||
              isExtracting ||
              isScanning ||
              isConverting) ...[
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(99),
              child: LinearProgressIndicator(
                minHeight: 4,
                value:
                    isDownloading
                        ? ((task.downloadPercent ?? 0.0) / 100.0).clamp(
                          0.0,
                          1.0,
                        )
                        : null,
                color:
                    isConverting
                        ? Colors.purpleAccent
                        : isScanning
                        ? Colors.greenAccent
                        : isExtracting
                        ? Colors.orangeAccent
                        : AppTheme.googleBlue,
                backgroundColor: AppTheme.bgBlock,
              ),
            ),
          ],

          if (task.stage == 'video_decision_required') ...[
            const SizedBox(height: 12),
            Builder(
              builder: (context) {
                final decisionVideos =
                    task.videos
                        .where((v) => v.allowedQualities.isNotEmpty)
                        .toList();
                final allSelected =
                    decisionVideos.isNotEmpty &&
                    decisionVideos.every((v) {
                      final val =
                          _pendingDecisions['${task.taskId}:${v.id}'] ??
                          (v.selectedQuality.isNotEmpty
                              ? v.selectedQuality
                              : null);
                      return val != null && val.isNotEmpty;
                    });
                final isSubmitting = _applySubmissions.contains(task.taskId);

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (final video in decisionVideos)
                      Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.purple.withValues(alpha: .08),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: Colors.purple.withValues(alpha: .35),
                          ),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    video.displayName,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '${video.width}×${video.height} • ${Formatters.formatFileSize(video.sourceSizeBytes)}',
                                    style: const TextStyle(
                                      color: Colors.white54,
                                      fontSize: 10,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            DropdownButton<String>(
                              value:
                                  _pendingDecisions['${task.taskId}:${video.id}'] ??
                                  (video.selectedQuality.isNotEmpty
                                      ? video.selectedQuality
                                      : null),
                              hint: const Text(
                                'Chọn...',
                                style: TextStyle(
                                  color: Colors.white54,
                                  fontSize: 11,
                                ),
                              ),
                              dropdownColor: AppTheme.bgCard,
                              underline: const SizedBox(),
                              icon: const Icon(
                                Icons.arrow_drop_down,
                                color: Colors.purpleAccent,
                                size: 18,
                              ),
                              style: const TextStyle(
                                color: Colors.purpleAccent,
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                              ),
                              items:
                                  video.allowedQualities.map((quality) {
                                    return DropdownMenuItem<String>(
                                      value: quality,
                                      child: Text(quality.toUpperCase()),
                                    );
                                  }).toList(),
                              onChanged:
                                  isSubmitting
                                      ? null
                                      : (selected) {
                                        if (selected != null) {
                                          setState(() {
                                            _pendingDecisions['${task.taskId}:${video.id}'] =
                                                selected;
                                          });
                                        }
                                      },
                            ),
                          ],
                        ),
                      ),
                    const SizedBox(height: 4),
                    Align(
                      alignment: Alignment.centerRight,
                      child: ElevatedButton(
                        onPressed:
                            (!allSelected || isSubmitting)
                                ? null
                                : () async {
                                  final decisions = <String, String>{};
                                  for (final v in decisionVideos) {
                                    final chosen =
                                        _pendingDecisions['${task.taskId}:${v.id}'] ??
                                        v.selectedQuality;
                                    if (chosen.isNotEmpty) {
                                      decisions[v.id] = chosen;
                                    }
                                  }
                                  setState(
                                    () => _applySubmissions.add(task.taskId),
                                  );
                                  final ok = await provider.applyVideoDecisions(
                                    task.taskId,
                                    decisions,
                                  );
                                  if (!context.mounted) return;
                                  setState(
                                    () => _applySubmissions.remove(task.taskId),
                                  );
                                  if (!ok) {
                                    AppToast.showError(
                                      context,
                                      'Không thể áp dụng lựa chọn video',
                                    );
                                  }
                                },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.purpleAccent.shade700,
                          foregroundColor: Colors.white,
                          disabledBackgroundColor: Colors.purple.withValues(
                            alpha: .25,
                          ),
                          disabledForegroundColor: Colors.white38,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 8,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        child:
                            isSubmitting
                                ? const SizedBox(
                                  width: 14,
                                  height: 14,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                                : const Text(
                                  'Áp dụng',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                      ),
                    ),
                  ],
                );
              },
            ),
          ],

          // Password Input Field when required
          if (isPasswordReq) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _getController(task.taskId),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontFamily: 'monospace',
                    ),
                    decoration: InputDecoration(
                      hintText: 'Nhập mật khẩu tệp ZIP/RAR...',
                      hintStyle: const TextStyle(
                        color: Colors.white38,
                        fontSize: 12,
                      ),
                      filled: true,
                      fillColor: AppTheme.bgBlock,
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 8,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(
                          color: AppTheme.borderColor,
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed:
                      _passwordSubmissions.contains(task.taskId)
                          ? null
                          : () async {
                            final pwd = _getController(task.taskId).text.trim();
                            if (pwd.isEmpty) return;
                            setState(
                              () => _passwordSubmissions.add(task.taskId),
                            );
                            await provider.submitPassword(task.taskId, pwd);
                            if (!context.mounted) return;
                            _getController(task.taskId).clear();
                            setState(
                              () => _passwordSubmissions.remove(task.taskId),
                            );
                            AppToast.showSuccess(
                              context,
                              'Đã gửi mật khẩu giải nén!',
                            );
                          },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.googleBlue,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  child: Text(
                    _passwordSubmissions.contains(task.taskId)
                        ? 'Đang gửi...'
                        : 'Thử giải nén',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
