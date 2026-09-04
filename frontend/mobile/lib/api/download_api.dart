import 'package:dio/dio.dart';
import 'api_config.dart';

String canonicalDownloadDestination(String selectedPath) {
  final selected = selectedPath
      .trim()
      .replaceFirst(RegExp(r'^/+'), '')
      .replaceFirst(RegExp(r'/+$'), '');
  return selected.isEmpty ? '/' : '/$selected';
}

class VideoOptimizationModel {
  final String id, displayName, resolutionClass, selectedQuality, state;
  final int width, height, sourceSizeBytes;
  final List<String> allowedQualities;
  final Map<String, int> estimates;
  const VideoOptimizationModel({
    required this.id,
    required this.displayName,
    required this.resolutionClass,
    required this.width,
    required this.height,
    required this.sourceSizeBytes,
    required this.allowedQualities,
    required this.estimates,
    this.selectedQuality = '',
    this.state = '',
  });
  factory VideoOptimizationModel.fromJson(Map<String, dynamic> json) =>
      VideoOptimizationModel(
        id: json['id']?.toString() ?? '',
        displayName: json['displayName']?.toString() ?? '',
        resolutionClass: json['resolutionClass']?.toString() ?? '',
        width: (json['width'] as num?)?.toInt() ?? 0,
        height: (json['height'] as num?)?.toInt() ?? 0,
        sourceSizeBytes: (json['sourceSizeBytes'] as num?)?.toInt() ?? 0,
        allowedQualities:
            (json['allowedQualities'] as List? ?? const [])
                .map((e) => e.toString())
                .toList(),
        estimates: (json['estimates'] as Map? ?? const {}).map(
          (k, v) => MapEntry(k.toString(), (v as num).toInt()),
        ),
        selectedQuality: json['selectedQuality']?.toString() ?? '',
        state: json['state']?.toString() ?? '',
      );
}

class DownloadTaskModel {
  final String taskId;
  final String originalUrl;
  final String? resolvedUrl;
  final String? filename;
  final String destination;
  final String stage;
  final int downloadedBytes;
  final int? downloadTotalBytes;
  final double? downloadPercent;
  final int downloadSpeedBytes;
  final double? extractedPercent;
  final String? error;
  final String? errorCode;
  final bool passwordRequired;
  final int convertTotal;
  final int convertCurrent;
  final String? cancelledFromStage;
  final String? failureStage;
  final bool coordinatorJob;
  final bool archiveDownloaded, archiveExtracted;
  final int totalVideoCount, invalidVideoCount;
  final List<VideoOptimizationModel> videos;

  DownloadTaskModel({
    required this.taskId,
    required this.originalUrl,
    this.resolvedUrl,
    this.filename,
    required this.destination,
    required this.stage,
    this.downloadedBytes = 0,
    this.downloadTotalBytes,
    this.downloadPercent,
    this.downloadSpeedBytes = 0,
    this.extractedPercent,
    this.error,
    this.errorCode,
    this.passwordRequired = false,
    this.convertTotal = 0,
    this.convertCurrent = 0,
    this.cancelledFromStage,
    this.failureStage,
    this.coordinatorJob = false,
    this.archiveDownloaded = false,
    this.archiveExtracted = false,
    this.totalVideoCount = 0,
    this.invalidVideoCount = 0,
    this.videos = const [],
  });

  factory DownloadTaskModel.fromJson(Map<String, dynamic> json) {
    return DownloadTaskModel(
      taskId: json['task_id'] ?? '',
      originalUrl: json['original_url'] ?? '',
      resolvedUrl: json['resolved_url'],
      filename: json['filename'],
      destination: json['destination'] ?? '',
      stage: json['stage'] ?? 'queued',
      downloadedBytes: json['downloaded_bytes'] ?? 0,
      downloadTotalBytes: json['download_total_bytes'],
      downloadPercent:
          json['download_percent'] != null
              ? (json['download_percent'] as num).toDouble()
              : null,
      downloadSpeedBytes:
          json['speed_bytes'] ?? json['download_speed_bytes'] ?? 0,
      extractedPercent:
          json['extracted_percent'] != null
              ? (json['extracted_percent'] as num).toDouble()
              : null,
      error: json['error'],
      errorCode: json['error_code'],
      passwordRequired: json['password_required'] ?? false,
      convertTotal: json['convert_total'] ?? 0,
      convertCurrent: json['convert_current'] ?? 0,
      cancelledFromStage: json['cancelled_from_stage'],
      failureStage: json['failure_stage'],
    );
  }

  factory DownloadTaskModel.fromCoordinatorJson(Map<String, dynamic> json) {
    final progress =
        json['progress'] is Map
            ? Map<String, dynamic>.from(json['progress'] as Map)
            : <String, dynamic>{};
    final downloadedBytes = (progress['downloadedBytes'] as num?)?.toInt() ?? 0;
    final totalBytes = (progress['totalBytes'] as num?)?.toInt();
    final state = json['state']?.toString() ?? 'queued';
    final rawStage =
        json['stage']?.toString() ??
        (state == 'downloading'
            ? (progress['state']?.toString() ?? 'downloading')
            : state == 'failed'
            ? 'error'
            : state);
    final stage = rawStage == 'failed' ? 'error' : rawStage;
    final error =
        json['error'] is Map
            ? Map<String, dynamic>.from(json['error'] as Map)
            : <String, dynamic>{};
    final conversion =
        progress['conversion'] is Map
            ? Map<String, dynamic>.from(progress['conversion'] as Map)
            : <String, dynamic>{};
    return DownloadTaskModel(
      taskId: json['id']?.toString() ?? '',
      originalUrl: json['url']?.toString() ?? '',
      filename:
          json['displayName']?.toString() ??
          json['filename']?.toString() ??
          progress['filename']?.toString(),
      destination: json['destination']?.toString() ?? '',
      stage: stage,
      downloadedBytes: downloadedBytes,
      downloadTotalBytes: totalBytes,
      downloadPercent:
          totalBytes != null && totalBytes > 0
              ? downloadedBytes / totalBytes * 100
              : null,
      downloadSpeedBytes: (progress['speedBytes'] as num?)?.toInt() ?? 0,
      extractedPercent: (progress['extractedPercent'] as num?)?.toDouble(),
      error: error['message']?.toString(),
      errorCode: error['code']?.toString(),
      failureStage: json['failureStage']?.toString(),
      convertTotal: (conversion['total'] as num?)?.toInt() ?? 0,
      convertCurrent: (conversion['current'] as num?)?.toInt() ?? 0,
      coordinatorJob: true,
      passwordRequired: json['passwordRequired'] == true,
      archiveDownloaded: json['archiveDownloaded'] == true,
      archiveExtracted: json['archiveExtracted'] == true,
      totalVideoCount: (json['totalVideoCount'] as num?)?.toInt() ?? 0,
      invalidVideoCount: (json['invalidVideoCount'] as num?)?.toInt() ?? 0,
      videos:
          (json['videos'] as List? ?? const [])
              .whereType<Map>()
              .map(
                (v) => VideoOptimizationModel.fromJson(
                  Map<String, dynamic>.from(v),
                ),
              )
              .toList(),
    );
  }
}

class DownloadSummaryModel {
  final int activeCount;
  final int downloadingCount;
  final int extractingCount;
  final double downloadPercent;
  final double extractPercent;

  DownloadSummaryModel({
    required this.activeCount,
    required this.downloadingCount,
    required this.extractingCount,
    required this.downloadPercent,
    required this.extractPercent,
  });

  factory DownloadSummaryModel.fromJson(Map<String, dynamic> json) {
    final dl = json['download'] ?? json['downloading'] ?? {};
    final ext = json['extract'] ?? json['extracting'] ?? {};
    return DownloadSummaryModel(
      activeCount: json['active_count'] ?? 0,
      downloadingCount: json['downloading_count'] ?? 0,
      extractingCount: json['extracting_count'] ?? 0,
      downloadPercent:
          dl['percent'] != null ? (dl['percent'] as num).toDouble() : 0.0,
      extractPercent:
          ext['percent'] != null ? (ext['percent'] as num).toDouble() : 0.0,
    );
  }
}

class StorageInfoModel {
  final String displayName;
  final int totalBytes;
  final int usedBytes;
  final int availableBytes;
  final double usedPercent;

  const StorageInfoModel({
    required this.displayName,
    required this.totalBytes,
    required this.usedBytes,
    required this.availableBytes,
    required this.usedPercent,
  });

  factory StorageInfoModel.fromJson(Map<String, dynamic> json) {
    return StorageInfoModel(
      displayName: json['displayName']?.toString() ?? '',
      totalBytes: (json['totalBytes'] as num?)?.toInt() ?? 0,
      usedBytes: (json['usedBytes'] as num?)?.toInt() ?? 0,
      availableBytes: (json['availableBytes'] as num?)?.toInt() ?? 0,
      usedPercent: (json['usedPercent'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class DownloadApi {
  static Dio _createCoordinatorDio() {
    final baseUrl = ApiConfig.coordinatorBaseUrl;
    if (baseUrl.trim().isEmpty) {
      throw StateError('Chưa cấu hình APPVIEW_COORDINATOR_API_BASE_URL.');
    }
    return Dio(
      BaseOptions(
        baseUrl: baseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
        headers: {'Content-Type': 'application/json'},
      ),
    );
  }

  static Future<StorageInfoModel?> fetchCoordinatorStorageInfo() async {
    try {
      final response = await _createCoordinatorDio().get('/storage');
      if (response.data is Map) {
        return StorageInfoModel.fromJson(
          Map<String, dynamic>.from(response.data as Map),
        );
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  static Future<Map<String, dynamic>> startCoordinatorDownload({
    required String url,
    String destination = '',
    String? password,
  }) async {
    try {
      final response = await _createCoordinatorDio().post(
        '/download',
        data: {
          'url': url,
          'destination': destination,
          if (password != null && password.isNotEmpty) 'password': password,
        },
      );
      return {
        'success': true,
        'data': Map<String, dynamic>.from(response.data as Map),
      };
    } on DioException catch (e) {
      final error = e.response?.data is Map ? e.response?.data['error'] : null;
      return {
        'success': false,
        'message':
            error is String
                ? error
                : error is Map
                ? error['message'] ?? 'Không thể kết nối Coordinator.'
                : 'Không thể kết nối Coordinator.',
      };
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  static Future<Map<String, dynamic>> fetchCoordinatorDownload(
    String jobId,
  ) async {
    try {
      final response = await _createCoordinatorDio().get(
        '/download/${Uri.encodeComponent(jobId)}',
      );
      return {
        'success': true,
        'data': Map<String, dynamic>.from(response.data as Map),
      };
    } on DioException catch (e) {
      final error = e.response?.data is Map ? e.response?.data['error'] : null;
      return {
        'success': false,
        'message':
            error is String
                ? error
                : error is Map
                ? error['message'] ?? 'Không thể cập nhật tiến trình tải.'
                : 'Không thể cập nhật tiến trình tải.',
      };
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  static Future<List<DownloadTaskModel>?> fetchCoordinatorDownloads() async {
    try {
      final response = await _createCoordinatorDio().get('/download');
      final jobs = response.data is Map ? response.data['jobs'] : null;
      if (jobs is! List) return <DownloadTaskModel>[];
      return jobs
          .whereType<Map>()
          .map(
            (job) => DownloadTaskModel.fromCoordinatorJson(
              Map<String, dynamic>.from(job),
            ),
          )
          .toList();
    } catch (_) {
      return null;
    }
  }

  static Future<bool> retryCoordinatorArchive(String jobId) async {
    try {
      await _createCoordinatorDio().post(
        '/download/${Uri.encodeComponent(jobId)}/retry',
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> submitCoordinatorArchivePassword(
    String jobId,
    String password,
  ) async {
    try {
      await _createCoordinatorDio().post(
        '/download/${Uri.encodeComponent(jobId)}/extract',
        data: {'password': password},
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> submitVideoDecision(
    String jobId,
    String videoId,
    String quality,
  ) async {
    try {
      await _createCoordinatorDio().post(
        '/download/${Uri.encodeComponent(jobId)}/videos/${Uri.encodeComponent(videoId)}/decision',
        data: {'quality': quality},
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> applyVideoDecisions(
    String jobId,
    Map<String, String> decisions,
  ) async {
    try {
      await _createCoordinatorDio().post(
        '/download/${Uri.encodeComponent(jobId)}/videos/apply',
        data: {'decisions': decisions},
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> cancelCoordinatorArchive(String jobId) async {
    try {
      await _createCoordinatorDio().post(
        '/download/${Uri.encodeComponent(jobId)}/cancel',
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  static Dio _createDio() {
    return Dio(
      BaseOptions(
        baseUrl: ApiConfig.downloadBaseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
        headers: {'Content-Type': 'application/json'},
      ),
    );
  }

  static Future<Map<String, dynamic>> startArchiveDownload({
    required String url,
    String destination = '',
    String? password,
  }) async {
    final dio = _createDio();
    try {
      final response = await dio.post(
        '/archive',
        data: {'url': url, 'destination': destination, 'password': password},
      );
      return {'success': true, 'data': response.data};
    } on DioException catch (e) {
      String message = 'Không thể kết nối máy chủ Download.';
      if (e.response?.data is Map && e.response?.data['error'] != null) {
        message = e.response?.data['error']['message'] ?? message;
      }
      return {'success': false, 'message': message};
    } catch (e) {
      return {'success': false, 'message': 'Lỗi: $e'};
    }
  }

  static Future<List<DownloadTaskModel>> fetchTasks() async {
    final dio = _createDio();
    try {
      final response = await dio.get('/tasks');
      if (response.data is List) {
        return (response.data as List)
            .whereType<Map<String, dynamic>>()
            .map((node) => DownloadTaskModel.fromJson(node))
            .toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  static Future<bool> retryTask(String taskId) async {
    final dio = _createDio();
    try {
      final response = await dio.post('/tasks/$taskId/retry');
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> submitPassword(String taskId, String password) async {
    final dio = _createDio();
    try {
      final response = await dio.post(
        '/tasks/$taskId/password',
        data: {'password': password},
      );
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> cancelTask(String taskId) async {
    final dio = _createDio();
    try {
      final response = await dio.post('/tasks/$taskId/cancel');
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> deleteTask(String taskId) async {
    final dio = _createDio();
    try {
      final response = await dio.delete('/tasks/$taskId');
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  static Future<DownloadSummaryModel?> fetchSummary() async {
    final dio = _createDio();
    try {
      final response = await dio.get('/summary');
      if (response.data is Map<String, dynamic>) {
        return DownloadSummaryModel.fromJson(response.data);
      }
      return null;
    } catch (_) {
      return null;
    }
  }
}
