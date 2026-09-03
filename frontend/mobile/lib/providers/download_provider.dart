import 'dart:async';

import 'package:flutter/foundation.dart';

import '../api/download_api.dart';

/// Holds parent Coordinator jobs created during this app session. The legacy
/// Python Download WebSocket remains available for compatibility only; new
/// submissions use the Coordinator parent job as their source of truth.
class DownloadProvider extends ChangeNotifier {
  final List<DownloadTaskModel> _tasks = [];
  final Map<String, Timer> _pollers = {};
  bool _disposed = false;

  VoidCallback? onRefreshGrid;

  List<DownloadTaskModel> get tasks => List.unmodifiable(_tasks);
  int get activeCount =>
      _tasks
          .where(
            (task) =>
                !const {'completed', 'error', 'cancelled'}.contains(task.stage),
          )
          .length;
  bool get isDownloadingMode =>
      _tasks.any((task) => task.stage == 'downloading');
  double get aggregatePercent {
    for (final task in _tasks) {
      if (task.stage == 'downloading') return task.downloadPercent ?? 0;
    }
    return 0;
  }

  bool get hasPasswordError => false;
  bool get isScanning => _tasks.any((task) => task.stage == 'scanning');
  bool get isConverting => _tasks.any((task) => task.stage == 'converting');

  void init() {
    // There is intentionally no Coordinator collection endpoint. A parent ID
    // is retained after POST and then individually polled.
  }

  Future<Map<String, dynamic>> startCoordinatorDownload({
    required String url,
    String destination = '',
    String? password,
  }) async {
    final response = await DownloadApi.startCoordinatorDownload(
      url: url,
      destination: destination,
      password: password,
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
    _upsert(DownloadTaskModel.fromCoordinatorJson(job));
    _poll(jobId);
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
    if (_taskIsCoordinatorJob(taskId)) return;
    await DownloadApi.retryTask(taskId);
  }

  Future<void> submitPassword(String taskId, String pwd) async {
    if (_taskIsCoordinatorJob(taskId)) return;
    await DownloadApi.submitPassword(taskId, pwd);
  }

  Future<void> cancelTask(String taskId) async {
    if (_taskIsCoordinatorJob(taskId)) return;
    await DownloadApi.cancelTask(taskId);
  }

  Future<void> deleteTask(String taskId) async {
    final isCoordinatorJob = _taskIsCoordinatorJob(taskId);
    _tasks.removeWhere((task) => task.taskId == taskId);
    if (!_disposed) notifyListeners();
    if (!isCoordinatorJob) await DownloadApi.deleteTask(taskId);
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
    super.dispose();
  }
}
