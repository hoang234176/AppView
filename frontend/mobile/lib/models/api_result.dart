import 'folder_item.dart';
import 'picture_item.dart';
import 'video_item.dart';

class FolderData {
  final List<FolderItem> folders;
  final List<PictureItem> pictures;
  final List<VideoItem> videos;
  final int totalFolders;
  final int totalPictures;
  final int totalVideos;

  FolderData({
    this.folders = const [],
    this.pictures = const [],
    this.videos = const [],
    this.totalFolders = 0,
    this.totalPictures = 0,
    this.totalVideos = 0,
  });

  bool get isEmpty => folders.isEmpty && pictures.isEmpty && videos.isEmpty;
  bool get isNotEmpty => !isEmpty;
}

class ApiErrorInfo {
  final int? status;
  final String message;
  final String? details;
  final String? requestUrl;

  ApiErrorInfo({
    this.status,
    required this.message,
    this.details,
    this.requestUrl,
  });
}

class ApiResult<T> {
  final bool success;
  final bool canceled;
  final int status;
  final String message;
  final T? data;
  final ApiErrorInfo? errorInfo;

  ApiResult({
    required this.success,
    this.canceled = false,
    this.status = 200,
    this.message = '',
    this.data,
    this.errorInfo,
  });

  factory ApiResult.success(T data, {int status = 200, String message = 'Thành công'}) {
    return ApiResult(
      success: true,
      status: status,
      message: message,
      data: data,
    );
  }

  factory ApiResult.failure(ApiErrorInfo error) {
    return ApiResult(
      success: false,
      status: error.status ?? 500,
      message: error.message,
      errorInfo: error,
    );
  }

  factory ApiResult.canceled() {
    return ApiResult(
      success: false,
      canceled: true,
      message: 'Request was canceled',
    );
  }
}
