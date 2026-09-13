import 'package:dio/dio.dart';
import 'api_config.dart';

String canonicalDownloadDestination(String selectedPath) {
  final selected = selectedPath
      .trim()
      .replaceFirst(RegExp(r'^/+'), '')
      .replaceFirst(RegExp(r'/+$'), '');
  return selected.isEmpty ? '/' : '/$selected';
}

class MediaImageItem {
  final String id;
  final String url;
  final String label;
  final String type;
  final String thumbnail;
  final int width;
  final int height;

  MediaImageItem({
    this.id = '',
    required this.url,
    this.label = '',
    this.type = 'slideshow_photo',
    this.thumbnail = '',
    this.width = 0,
    this.height = 0,
  });

  factory MediaImageItem.fromJson(Map<String, dynamic> json) {
    return MediaImageItem(
      id: json['id']?.toString() ?? '',
      url: json['url']?.toString() ?? '',
      label: json['label']?.toString() ?? '',
      type: json['type']?.toString() ?? 'slideshow_photo',
      thumbnail: json['thumbnail']?.toString() ?? '',
      width: (json['width'] as num?)?.toInt() ?? 0,
      height: (json['height'] as num?)?.toInt() ?? 0,
    );
  }
}

class MediaAuthorInfo {
  final String id;
  final String name;
  final String avatar;
  final String url;

  const MediaAuthorInfo({
    this.id = '',
    this.name = '',
    this.avatar = '',
    this.url = '',
  });

  factory MediaAuthorInfo.fromJson(Map<String, dynamic> json) {
    return MediaAuthorInfo(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      avatar: json['avatar']?.toString() ?? '',
      url: json['url']?.toString() ?? '',
    );
  }
}

class MediaReactionsInfo {
  final int likes;
  final int comments;
  final int shares;

  const MediaReactionsInfo({
    this.likes = 0,
    this.comments = 0,
    this.shares = 0,
  });

  factory MediaReactionsInfo.fromJson(Map<String, dynamic> json) {
    return MediaReactionsInfo(
      likes: (json['likes'] as num?)?.toInt() ?? 0,
      comments: (json['comments'] as num?)?.toInt() ?? 0,
      shares: (json['shares'] as num?)?.toInt() ?? 0,
    );
  }
}

class MediaDownloadPreview {
  final String source, title, thumbnail, uploader, type;
  final List<int> qualities;
  final List<MediaImageItem> images;
  final bool hasVideo;
  final bool hasAudio;
  final String content;
  final String createdTime;
  final MediaAuthorInfo? author;
  final MediaReactionsInfo? reactions;

  MediaDownloadPreview.fromJson(Map<String, dynamic> json)
    : source = json['source'] as String? ?? '',
      type = json['type'] as String? ?? 'video',
      title = json['title'] as String? ?? '',
      thumbnail = json['thumbnail'] as String? ?? '',
      uploader = json['uploader'] as String? ?? '',
      content = json['content'] as String? ?? '',
      createdTime = json['created_time'] as String? ?? '',
      author = json['author'] is Map
          ? MediaAuthorInfo.fromJson(Map<String, dynamic>.from(json['author'] as Map))
          : null,
      reactions = json['reactions'] is Map
          ? MediaReactionsInfo.fromJson(Map<String, dynamic>.from(json['reactions'] as Map))
          : null,
      qualities = (json['qualities'] as List? ?? const []).cast<int>(),
      images = ((json['images'] as List? ?? const [])
          .whereType<Map>()
          .map((m) => MediaImageItem.fromJson(Map<String, dynamic>.from(m)))
          .toList()),
      hasVideo = json['has_video'] == true,
      hasAudio = json['has_audio'] == true;
}

class VideoOptimizationModel {
  final String id, displayName, resolutionClass, selectedQuality, state;
  final int width, height, sourceSizeBytes;
  final bool optimizationRequired;
  final List<String> allowedQualities;
  const VideoOptimizationModel({
    required this.id,
    required this.displayName,
    required this.resolutionClass,
    required this.width,
    required this.height,
    required this.sourceSizeBytes,
    required this.allowedQualities,
    this.optimizationRequired = false,
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
        optimizationRequired: json['optimizationRequired'] == true ||
            json['optimization_required'] == true ||
            json['optimizationNeeded'] == true,
        selectedQuality: json['selectedQuality']?.toString() ?? '',
        state: json['state']?.toString() ?? '',
      );
}

class DownloadTaskModel {
  final String taskId;
  final String originalUrl;
  final String? resolvedUrl;
  final String source;
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
  final bool optimizationCancelled;
  final int unoptimizedVideoCount;
  final List<VideoOptimizationModel> videos;

  DownloadTaskModel({
    required this.taskId,
    required this.originalUrl,
    this.resolvedUrl,
    this.source = '',
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
    this.optimizationCancelled = false,
    this.unoptimizedVideoCount = 0,
    this.videos = const [],
  });

  factory DownloadTaskModel.fromJson(Map<String, dynamic> json) {
    final optCancelled =
        json['optimization_cancelled'] == true ||
        json['optimizationCancelled'] == true;
    final unoptimized =
        (json['unoptimized_video_count'] as num?)?.toInt() ??
        (json['unoptimizedVideoCount'] as num?)?.toInt() ??
        0;
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
      optimizationCancelled: optCancelled,
      unoptimizedVideoCount: unoptimized,
      source: json['source']?.toString() ?? '',
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
    final optCancelled =
        json['optimizationCancelled'] == true ||
        json['optimization_cancelled'] == true ||
        progress['optimizationCancelled'] == true ||
        progress['optimization_cancelled'] == true;
    final unoptimized =
        (json['unoptimizedVideoCount'] as num?)?.toInt() ??
        (json['unoptimized_video_count'] as num?)?.toInt() ??
        (progress['unoptimizedVideoCount'] as num?)?.toInt() ??
        (progress['unoptimized_video_count'] as num?)?.toInt() ??
        0;
    final rawCancelledStage =
        json['cancelledFromStage']?.toString() ??
        json['cancelled_from_stage']?.toString() ??
        progress['cancelledFromStage']?.toString() ??
        progress['cancelled_from_stage']?.toString();
    final cancelledStage =
        (rawCancelledStage != null && rawCancelledStage.trim().isNotEmpty)
            ? rawCancelledStage.trim()
            : null;
    final rawSource = json['source']?.toString() ?? '';
    final url = json['url']?.toString() ?? '';
    final source = rawSource.isNotEmpty
        ? rawSource
        : (url.contains('youtube.com') || url.contains('youtu.be')
            ? 'youtube'
            : (url.contains('tiktok.com')
                ? 'tiktok'
                : (url.contains('facebook.com') ||
                        url.contains('fb.watch') ||
                        url.contains('fb.com') ||
                        url.contains('fb.me')
                    ? 'facebook'
                    : '')));
    return DownloadTaskModel(
      taskId: json['id']?.toString() ?? '',
      originalUrl: url,
      source: source,
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
      convertTotal:
          (conversion['total'] as num?)?.toInt() ??
          (json['conversionTotal'] as num?)?.toInt() ??
          0,
      convertCurrent:
          (conversion['current'] as num?)?.toInt() ??
          (json['conversionCurrent'] as num?)?.toInt() ??
          0,
      cancelledFromStage: cancelledStage,
      coordinatorJob: true,
      passwordRequired: json['passwordRequired'] == true,
      archiveDownloaded: json['archiveDownloaded'] == true,
      archiveExtracted: json['archiveExtracted'] == true,
      totalVideoCount: (json['totalVideoCount'] as num?)?.toInt() ?? 0,
      invalidVideoCount: (json['invalidVideoCount'] as num?)?.toInt() ?? 0,
      optimizationCancelled: optCancelled,
      unoptimizedVideoCount: unoptimized,
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

  static Future<Map<String, dynamic>> getCookieStatus([
    String platform = 'youtube',
  ]) async {
    try {
      final response = await _createCoordinatorDio().get(
        '/cookies/status',
        queryParameters: {'platform': platform},
      );
      return {
        'success': true,
        'data':
            response.data is Map
                ? Map<String, dynamic>.from(response.data as Map)
                : <String, dynamic>{},
      };
    } on DioException catch (e) {
      final error = e.response?.data is Map ? e.response?.data['error'] : null;
      return {
        'success': false,
        'message':
            error is String ? error : 'Không thể lấy trạng thái cookie.',
      };
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  static Future<Map<String, dynamic>> verifyCookies({
    String platform = 'youtube',
    Map<String, String>? fields,
    String? cookies,
  }) async {
    try {
      final payload = <String, dynamic>{'platform': platform};
      if (fields != null) payload['fields'] = fields;
      if (cookies != null) payload['cookies'] = cookies;
      final response = await _createCoordinatorDio().post(
        '/cookies/verify',
        data: payload,
        options: Options(receiveTimeout: const Duration(seconds: 60)),
      );
      return {
        'success': true,
        'data':
            response.data is Map
                ? Map<String, dynamic>.from(response.data as Map)
                : <String, dynamic>{},
      };
    } on DioException catch (e) {
      final data = e.response?.data;
      String message = 'Không thể xác thực cookie.';
      if (data is Map) {
        if (data['message'] is String) {
          message = data['message'] as String;
        } else if (data['error'] is String) {
          message = data['error'] as String;
        }
      }
      return {'success': false, 'message': message};
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  static Future<Map<String, dynamic>> saveCookies({
    String platform = 'youtube',
    Map<String, String>? fields,
    String? cookies,
  }) async {
    try {
      final payload = <String, dynamic>{'platform': platform};
      if (fields != null) payload['fields'] = fields;
      if (cookies != null) payload['cookies'] = cookies;
      final response = await _createCoordinatorDio().post(
        '/cookies/save',
        data: payload,
        options: Options(receiveTimeout: const Duration(seconds: 60)),
      );
      return {
        'success': true,
        'data':
            response.data is Map
                ? Map<String, dynamic>.from(response.data as Map)
                : <String, dynamic>{},
      };
    } on DioException catch (e) {
      final data = e.response?.data;
      String message = 'Không thể lưu cookie.';
      if (data is Map) {
        if (data['message'] is String) {
          message = data['message'] as String;
        } else if (data['error'] is String) {
          message = data['error'] as String;
        }
      }
      return {'success': false, 'message': message};
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  static Future<Map<String, dynamic>> startCoordinatorDownload({
    required String url,
    String destination = '',
    String? password,
    int? quality,
    List<int>? selectedIndices,
    String? mediaType,
  }) async {
    try {
      final response = await _createCoordinatorDio().post(
        '/download',
        data: {
          'url': url,
          'destination': destination,
          if (password != null && password.isNotEmpty) 'password': password,
          if (quality != null) 'quality': quality,
          if (selectedIndices != null) ...{
            'selectedIndices': selectedIndices,
            'selected_indices': selectedIndices,
          },
          if (mediaType != null && mediaType.isNotEmpty) ...{
            'mediaType': mediaType,
            'media_type': mediaType,
          },
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

  static Future<MediaDownloadPreview> previewMediaDownload(String url, CancelToken cancelToken) async {
    final response = await _createCoordinatorDio().post(
      '/download/preview',
      data: {'url': url},
      cancelToken: cancelToken,
      options: Options(receiveTimeout: const Duration(seconds: 70)),
    );
    return MediaDownloadPreview.fromJson(Map<String, dynamic>.from(response.data as Map));
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

  static Future<bool> deleteCoordinatorArchive(String jobId) async {
    try {
      final response = await _createCoordinatorDio().delete(
        '/download/${Uri.encodeComponent(jobId)}',
      );
      return response.statusCode == 200 || response.statusCode == 204;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> deleteCoordinatorDownload(String jobId) =>
      deleteCoordinatorArchive(jobId);

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
