import 'package:dio/dio.dart';
import 'api_config.dart';

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

class DownloadApi {
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
