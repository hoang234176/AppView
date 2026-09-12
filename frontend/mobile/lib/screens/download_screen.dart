import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../providers/download_provider.dart';
import '../api/download_api.dart';
import '../utils/formatters.dart';
import '../widgets/app_toast.dart';
import '../widgets/file_type_icon.dart';
import '../widgets/app_select_menu.dart';
import '../widgets/folder_picker_view.dart';

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
  bool _isSubmitting = false;
  bool _obscurePassword = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _urlController = TextEditingController();
    _pwdController = TextEditingController();
    _selectedDest = widget.currentPath;
  }

  @override
  void dispose() {
    _urlController.dispose();
    _pwdController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    final url = _urlController.text.trim();
    if (url.isEmpty) {
      setState(() => _errorMessage = 'Vui lòng nhập liên kết tải xuống.');
      return;
    }
    final parsed = Uri.tryParse(url);
    if (parsed == null || !['http', 'https'].contains(parsed.scheme) ||
        !(parsed.host == 'mediafire.com' || parsed.host.endsWith('.mediafire.com'))) {
      setState(() => _errorMessage = 'Vui lòng nhập liên kết MediaFire hợp lệ.');
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
              'Tải file nén',
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
                  'Liên kết MediaFire:',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                TextField(
                  controller: _urlController,
                  autofocus: false,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => FocusManager.instance.primaryFocus?.unfocus(),
                  onChanged: (_) => setState(() {}),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontFamily: 'monospace',
                  ),
                  decoration: InputDecoration(
                    hintText: 'https://www.mediafire.com/...',
                    hintStyle: const TextStyle(
                      color: Colors.white38,
                      fontSize: 12,
                    ),
                    filled: true,
                    fillColor: AppTheme.bgInput,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 10,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: const BorderSide(color: AppTheme.borderColor),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: const BorderSide(color: AppTheme.borderColor),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: const BorderSide(color: AppTheme.googleBlue, width: 1.5),
                    ),
                    suffixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
                    suffixIcon: Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (_urlController.text.isNotEmpty)
                            IconButton(
                              icon: const Icon(Icons.clear_rounded, size: 16),
                              color: Colors.white54,
                              splashRadius: 14,
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(minWidth: 26, minHeight: 26),
                              tooltip: 'Xóa',
                              onPressed: _isSubmitting
                                  ? null
                                  : () {
                                      setState(() {
                                        _urlController.clear();
                                        _errorMessage = null;
                                      });
                                    },
                            ),
                          Material(
                            color: const Color(0xFF3B82F6).withValues(alpha: 0.10), // blue-500/10
                            borderRadius: BorderRadius.circular(8),
                            child: InkWell(
                              onTap: _isSubmitting
                                  ? null
                                  : () async {
                                      final data = await Clipboard.getData(Clipboard.kTextPlain);
                                      if (data?.text != null && data!.text!.trim().isNotEmpty) {
                                        setState(() {
                                          _urlController.text = data.text!.trim();
                                          _errorMessage = null;
                                        });
                                      }
                                    },
                              borderRadius: BorderRadius.circular(8),
                              child: Container(
                                padding: const EdgeInsets.all(6),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(
                                    color: const Color(0xFF3B82F6).withValues(alpha: 0.20),
                                  ),
                                ),
                                child: const Icon(
                                  Icons.content_paste_rounded,
                                  size: 14,
                                  color: Color(0xFF60A5FA), // blue-400
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),

                FolderPickerView(
                  destination: _selectedDest,
                  onChanged: (newDest) => setState(() => _selectedDest = newDest),
                  disabled: _isSubmitting,
                  accentColor: AppTheme.googleBlue,
                  height: 180,
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
                    fillColor: AppTheme.bgInput,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 10,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: const BorderSide(color: AppTheme.borderColor),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: const BorderSide(color: AppTheme.borderColor),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: const BorderSide(color: AppTheme.googleBlue, width: 1.5),
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
        tasks
            .where(
              (task) =>
                  task.stage == 'cancelled' &&
                  !DownloadProvider.isCancelledOptimization(task),
            )
            .toList();
    final completedTasks =
        tasks
            .where(
              (task) =>
                  !DownloadProvider.isActiveDownload(task) &&
                  !isRetryableDownloadError(task) &&
                  (task.stage == 'completed' ||
                      DownloadProvider.isCancelledOptimization(task)),
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
    final category = Formatters.getFileCategory(
      task.filename ?? task.originalUrl,
    );
    final isMedia =
        task.source == 'youtube' ||
        task.source == 'tiktok' ||
        task.source == 'facebook' ||
        (!task.archiveDownloaded &&
            !task.archiveExtracted &&
            (category == 'video' || category == 'picture'));
    final unoptimizedCount =
        task.unoptimizedVideoCount > 0
            ? task.unoptimizedVideoCount
            : (task.videos.isNotEmpty
                ? task.videos
                    .where(
                      (v) =>
                          v.optimizationRequired && v.state != 'completed',
                    )
                    .length
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
                      task.filename ??
                          (task.source == 'facebook'
                              ? 'Bài viết Facebook'
                              : (task.source == 'tiktok'
                                  ? 'Video TikTok'
                                  : (task.source == 'youtube'
                                      ? 'Video YouTube'
                                      : 'Tệp nén MediaFire'))),
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
                              Text(
                                isMedia
                                    ? 'Đã tải video gốc'
                                    : 'Đã tải và giải nén',
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: Colors.greenAccent,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                              if (unoptimizedCount > 0) ...[
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
                            ],
                          ),
                        ] else if (isCompleted) ...[
                          Text(
                            isMedia
                                ? (task.convertTotal > 0
                                    ? '✓ Đã tải và tối ưu video'
                                    : '✓ Đã tải hoàn tất')
                                : (task.convertTotal > 0
                                    ? '✓ Đã giải nén - tối ưu ${task.convertTotal} video'
                                    : '✓ Đã giải nén hoàn tất'),
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
                          Text(
                            isMedia
                                ? '⚠ Đã tải — chưa tối ưu được video'
                                : '⚠ Đã giải nén — chưa tối ưu được video',
                            style: const TextStyle(
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
                            AppSelectMenu<String>(
                              items: video.allowedQualities
                                  .map((q) => AppSelectItem<String>(
                                        value: q,
                                        label: q.toUpperCase(),
                                      ))
                                  .toList(),
                              value: _pendingDecisions['${task.taskId}:${video.id}'] ??
                                  (video.selectedQuality.isNotEmpty
                                      ? video.selectedQuality
                                      : null),
                              onChanged: (selected) {
                                setState(() {
                                  _pendingDecisions['${task.taskId}:${video.id}'] = selected;
                                });
                              },
                              disabled: isSubmitting,
                              accent: AppSelectAccent.purple,
                              size: AppSelectSize.sm,
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
