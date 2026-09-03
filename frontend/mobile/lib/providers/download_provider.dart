import 'package:flutter/material.dart';
import '../api/download_api.dart';
import '../services/download_websocket_service.dart';

class DownloadProvider extends ChangeNotifier {
  List<DownloadTaskModel> _tasks = [];
  DownloadSummaryModel? _summary;
  DownloadWebSocketService? _wsService;

  VoidCallback? onRefreshGrid;

  List<DownloadTaskModel> get tasks => _tasks;
  DownloadSummaryModel? get summary => _summary;

  int get activeCount =>
      _summary?.activeCount ??
      _tasks
          .where(
            (t) => [
              'queued',
              'resolving',
              'downloading',
              'waiting_extract',
              'extracting',
              'scanning',
              'converting',
              'password_required',
            ].contains(t.stage),
          )
          .length;
  bool get isDownloadingMode => (_summary?.downloadingCount ?? 0) > 0;
  double get aggregatePercent =>
      isDownloadingMode
          ? (_summary?.downloadPercent ?? 0.0)
          : (_summary?.extractPercent ?? 0.0);

  bool get hasPasswordError => _tasks.any((t) => t.stage == 'password_required');
  bool get isScanning => _tasks.any((t) => t.stage == 'scanning');
  bool get isConverting => _tasks.any((t) => t.stage == 'converting');

  void init() {
    fetchInitialData();
    _wsService = DownloadWebSocketService(onEvent: _handleWsEvent);
    _wsService?.connect();
  }

  Future<void> fetchInitialData() async {
    final taskList = await DownloadApi.fetchTasks();
    final sum = await DownloadApi.fetchSummary();
    _tasks = taskList;
    _summary = sum;
    notifyListeners();
  }

  void _handleWsEvent(Map<String, dynamic> event) {
    final type = event['type'];
    if (type == 'init_state') {
      if (event['tasks'] is List) {
        _tasks =
            (event['tasks'] as List)
                .whereType<Map<String, dynamic>>()
                .map((node) => DownloadTaskModel.fromJson(node))
                .toList();
      }
      if (event['summary'] is Map<String, dynamic>) {
        _summary = DownloadSummaryModel.fromJson(event['summary']);
      }
      notifyListeners();
    } else if (type == 'task_created' &&
        event['task'] is Map<String, dynamic>) {
      final newTask = DownloadTaskModel.fromJson(event['task']);
      _tasks.removeWhere((t) => t.taskId == newTask.taskId);
      _tasks.insert(0, newTask);
      notifyListeners();
    } else if (type == 'task_stage_changed') {
      final taskId = event['task_id'] ?? '';
      final stage = event['stage'] ?? '';
      final filename = event['filename'];

      final index = _tasks.indexWhere((t) => t.taskId == taskId);
      if (index != -1) {
        final existing = _tasks[index];
        _tasks[index] = DownloadTaskModel(
          taskId: existing.taskId,
          originalUrl: existing.originalUrl,
          resolvedUrl: existing.resolvedUrl,
          filename: filename ?? existing.filename,
          destination: existing.destination,
          stage: stage,
          downloadedBytes: existing.downloadedBytes,
          downloadTotalBytes: existing.downloadTotalBytes,
          downloadPercent: existing.downloadPercent,
          downloadSpeedBytes: existing.downloadSpeedBytes,
          extractedPercent: existing.extractedPercent,
          error: event['error'] ?? existing.error,
          errorCode: event['error_code'] ?? existing.errorCode,
          passwordRequired: event['password_required'] ?? (stage == 'password_required'),
          convertTotal: event['conversion']?['total'] ?? existing.convertTotal,
          convertCurrent: event['conversion']?['current'] ?? existing.convertCurrent,
          cancelledFromStage: event['cancelled_from_stage'] ?? existing.cancelledFromStage,
        );
        notifyListeners();
      }

      if (stage == 'completed') {
        onRefreshGrid?.call();
      }
    } else if (type == 'task_progress') {
      final taskId = event['task_id'] ?? '';
      final index = _tasks.indexWhere((t) => t.taskId == taskId);
      if (index != -1) {
        final existing = _tasks[index];
        _tasks[index] = DownloadTaskModel(
          taskId: existing.taskId,
          originalUrl: existing.originalUrl,
          resolvedUrl: existing.resolvedUrl,
          filename: event['filename'] ?? existing.filename,
          destination: existing.destination,
          stage: event['stage'] ?? existing.stage,
          downloadedBytes:
              event['downloaded_bytes'] ?? existing.downloadedBytes,
          downloadTotalBytes:
              event['total_bytes'] ?? existing.downloadTotalBytes,
          downloadPercent:
              event['percent'] != null
                  ? (event['percent'] as num).toDouble()
                  : existing.downloadPercent,
          downloadSpeedBytes:
              event['speed_bytes'] ?? existing.downloadSpeedBytes,
          extractedPercent:
              event['extracted_percent'] != null
                  ? (event['extracted_percent'] as num).toDouble()
                  : existing.extractedPercent,
          error: existing.error,
          errorCode: existing.errorCode,
          passwordRequired: event['stage'] != null
              ? event['stage'] == 'password_required'
              : existing.passwordRequired,
          convertTotal: event['conversion']?['total'] ?? existing.convertTotal,
          convertCurrent: event['conversion']?['current'] ?? existing.convertCurrent,
          cancelledFromStage: existing.cancelledFromStage,
        );
        notifyListeners();
      }
    } else if (type == 'task_password_required') {
      final taskId = event['task_id'] ?? '';
      final index = _tasks.indexWhere((t) => t.taskId == taskId);
      if (index != -1) {
        final existing = _tasks[index];
        _tasks[index] = DownloadTaskModel(
          taskId: existing.taskId,
          originalUrl: existing.originalUrl,
          resolvedUrl: existing.resolvedUrl,
          filename: existing.filename,
          destination: existing.destination,
          stage: 'password_required',
          downloadedBytes: existing.downloadedBytes,
          downloadTotalBytes: existing.downloadTotalBytes,
          downloadPercent: existing.downloadPercent,
          downloadSpeedBytes: existing.downloadSpeedBytes,
          extractedPercent: existing.extractedPercent,
          error: event['error'] ?? 'Mật khẩu không chính xác.',
          errorCode: 'PASSWORD_REQUIRED',
          passwordRequired: true,
          convertTotal: existing.convertTotal,
          convertCurrent: existing.convertCurrent,
          cancelledFromStage: existing.cancelledFromStage,
        );
        notifyListeners();
      }
    } else if (type == 'summary_updated') {
      _summary = DownloadSummaryModel.fromJson(event);
      notifyListeners();
    }
  }

  Future<void> retryTask(String taskId) async {
    await DownloadApi.retryTask(taskId);
  }

  Future<void> submitPassword(String taskId, String pwd) async {
    await DownloadApi.submitPassword(taskId, pwd);
  }

  Future<void> cancelTask(String taskId) async {
    await DownloadApi.cancelTask(taskId);
  }

  Future<void> deleteTask(String taskId) async {
    _tasks.removeWhere((t) => t.taskId == taskId);
    notifyListeners();
    await DownloadApi.deleteTask(taskId);
  }

  @override
  void dispose() {
    _wsService?.disconnect();
    super.dispose();
  }
}
