import 'dart:async';

import 'package:flutter/foundation.dart';

import '../api/download_api.dart';
import '../services/filesystem_events_service.dart';

/// Holds parent Coordinator jobs created during this app session. The legacy
/// Python Download WebSocket remains available for compatibility only; new
/// submissions use the Coordinator parent job as their source of truth.
class DownloadProvider extends ChangeNotifier {
  final List<DownloadTaskModel> _tasks = [];
  final Map<String, Timer> _pollers = {};
  bool _disposed = false;
  Timer? _refreshTimer;
  StreamSubscription<void>? _realtimeSubscription;

  VoidCallback? onRefreshGrid;

  List<DownloadTaskModel> get tasks => List.unmodifiable(_tasks);
  int get activeCount => _tasks.where((task) => isActiveDownload(task)).length;
  static bool isCancelledOptimization(DownloadTaskModel task) =>
      task.optimizationCancelled ||
      (task.stage == 'cancelled' &&
          (task.cancelledFromStage == 'converting' ||
              task.cancelledFromStage == 'video_decision_required')) ||
      (task.stage == 'completed' &&
          (task.optimizationCancelled ||
              (task.cancelledFromStage != null &&
                  task.cancelledFromStage!.isNotEmpty)));

  static String downloadGroup(DownloadTaskModel task) =>
      (task.stage == 'completed' || isCancelledOptimization(task))
          ? 'completed'
          : task.stage == 'cancelled'
          ? 'cancelled'
          : 'active';
  static bool isActiveDownload(DownloadTaskModel task) =>
      downloadGroup(task) == 'active';
  static bool isRetryableDownload(DownloadTaskModel task) =>
      const {'error', 'failed', 'interrupted'}.contains(task.stage) &&
      task.errorCode != 'VIDEO_CONVERT_UNAVAILABLE';
  static bool needsPassword(DownloadTaskModel task) =>
      task.passwordRequired || task.stage == 'password_required';
  static bool canCancelDownload(DownloadTaskModel task) =>
      downloadGroup(task) == 'active';
  static bool needsDownloadAttention(DownloadTaskModel task) =>
      task.passwordRequired ||
      const {
		'video_decision_required',
        'password_required',
        'error',
        'failed',
        'interrupted',
      }.contains(task.stage);
  bool get hasDownloadAttention => _tasks.any(needsDownloadAttention);
  bool get isDownloadingMode =>
      _tasks.any((task) => task.stage == 'downloading');
  double get aggregatePercent {
    for (final task in _tasks) {
      if (task.stage == 'downloading') return task.downloadPercent ?? 0;
    }
    return 0;
  }

  bool get hasPasswordError => hasDownloadAttention;
  bool get isScanning => _tasks.any((task) => task.stage == 'scanning');
  bool get isConverting => _tasks.any((task) => task.stage == 'converting');

  void init() {
    refreshCanonicalHistory();
    _realtimeSubscription = DownloadRealtimeBus.events.listen(
      (_) => scheduleCanonicalRefresh(),
    );
  }

  Future<void> refreshCanonicalHistory() async {
    final tasks = await DownloadApi.fetchCoordinatorDownloads();
    if (_disposed || tasks == null) return;
    _tasks
      ..clear()
      ..addAll(tasks);
    notifyListeners();
  }

  void scheduleCanonicalRefresh({bool immediate = false}) {
    _refreshTimer?.cancel();
    _refreshTimer = Timer(
      Duration(milliseconds: immediate ? 0 : 200),
      refreshCanonicalHistory,
    );
  }

  Future<bool> submitVideoDecision(String jobId, String videoId, String quality) async {
    final ok = await DownloadApi.submitVideoDecision(jobId, videoId, quality);
    if (ok) scheduleCanonicalRefresh(immediate: true);
    return ok;
  }

  Future<bool> applyVideoDecisions(String jobId, Map<String, String> decisions) async {
    final ok = await DownloadApi.applyVideoDecisions(jobId, decisions);
    if (ok) scheduleCanonicalRefresh(immediate: true);
    return ok;
  }

  Future<Map<String, dynamic>> startCoordinatorDownload({
    required String url,
    String destination = '',
    String? password,
    int? quality,
    List<int>? selectedIndices,
    String? mediaType,
  }) async {
    final response = await DownloadApi.startCoordinatorDownload(
      url: url,
      destination: destination,
      password: password,
      quality: quality,
      selectedIndices: selectedIndices,
      mediaType: mediaType,
    );
    if (_disposed || response['success'] != true) return response;
    final job = response['data'] as Map<String, dynamic>?;
    final jobId = job?['id']?.toString();
    if (job == null || jobId == null || jobId.isEmpty) {
      return {
        'success': false,
        'message': 'Coordinator không trả về mã tác vụ.',
      };
    }
    scheduleCanonicalRefresh(immediate: true);
    return response;
  }

  void _poll(String jobId) {
    if (_disposed || _pollers.containsKey(jobId)) return;
    Future<void> run() async {
      final response = await DownloadApi.fetchCoordinatorDownload(jobId);
      if (_disposed) return;
      if (response['success'] != true) {
        final index = _tasks.indexWhere((task) => task.taskId == jobId);
        if (index >= 0) {
          final old = _tasks[index];
          _tasks[index] = DownloadTaskModel(
            taskId: old.taskId,
            originalUrl: old.originalUrl,
            filename: old.filename,
            destination: old.destination,
            stage: 'error',
            error:
                response['message']?.toString() ??
                'Không thể cập nhật tiến trình tải.',
            errorCode: 'COORDINATOR_POLL_FAILED',
            failureStage: 'coordinator',
            coordinatorJob: true,
          );
          notifyListeners();
        }
        _pollers.remove(jobId);
        return;
      }
      final job = response['data'] as Map<String, dynamic>;
      _upsert(DownloadTaskModel.fromCoordinatorJson(job));
      final state = job['state']?.toString();
      if (state == 'completed' || state == 'failed') {
        _pollers.remove(jobId);
        if (state == 'completed') onRefreshGrid?.call();
        return;
      }
      _pollers[jobId] = Timer(const Duration(seconds: 1), () {
        _pollers.remove(jobId);
        _poll(jobId);
      });
    }

    // Reserve the ID before the request so a rebuild cannot create a second
    // polling chain for one accepted parent job.
    _pollers[jobId] = Timer(Duration.zero, () {});
    run();
  }

  void _upsert(DownloadTaskModel task) {
    final index = _tasks.indexWhere((item) => item.taskId == task.taskId);
    if (index >= 0) {
      _tasks[index] = task;
    } else {
      _tasks.insert(0, task);
    }
    if (!_disposed) notifyListeners();
  }

  // Legacy controls remain only for legacy task UIs. New Coordinator jobs do
  // not call Python endpoints after their initial parent-job submission.
  Future<void> retryTask(String taskId) async {
    if (_taskIsCoordinatorJob(taskId)) {
      await DownloadApi.retryCoordinatorArchive(taskId);
      scheduleCanonicalRefresh(immediate: true);
      return;
    }
    await DownloadApi.retryTask(taskId);
  }

  Future<void> submitPassword(String taskId, String pwd) async {
    if (_taskIsCoordinatorJob(taskId)) {
      await DownloadApi.submitCoordinatorArchivePassword(taskId, pwd);
      scheduleCanonicalRefresh(immediate: true);
      return;
    }
    await DownloadApi.submitPassword(taskId, pwd);
  }

  Future<void> cancelTask(String taskId) async {
    if (_taskIsCoordinatorJob(taskId)) {
      await DownloadApi.cancelCoordinatorArchive(taskId);
      scheduleCanonicalRefresh(immediate: true);
      return;
    }
    await DownloadApi.cancelTask(taskId);
  }

  Future<void> deleteTask(String taskId) async {
    final isCoordinatorJob = _taskIsCoordinatorJob(taskId);
    _tasks.removeWhere((task) => task.taskId == taskId);
    if (!_disposed) notifyListeners();
    if (isCoordinatorJob) {
      await DownloadApi.deleteCoordinatorDownload(taskId);
      scheduleCanonicalRefresh(immediate: true);
    } else {
      await DownloadApi.deleteTask(taskId);
    }
  }

  bool _taskIsCoordinatorJob(String taskId) =>
      _tasks.any((task) => task.taskId == taskId && task.coordinatorJob);

  @override
  void dispose() {
    _disposed = true;
    for (final timer in _pollers.values) {
      timer.cancel();
    }
    _pollers.clear();
    _refreshTimer?.cancel();
    _realtimeSubscription?.cancel();
    super.dispose();
  }
}
