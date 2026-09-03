import 'dart:convert';
import 'package:dio/dio.dart';
import 'api_config.dart';
import '../models/folder_item.dart';
import '../models/picture_item.dart';
import '../models/video_item.dart';
import '../models/tree_node.dart';
import '../models/api_result.dart';
import '../utils/formatters.dart';

class FolderApi {
  static Dio _createDio() {
    final baseUrl = ApiConfig.baseUrl;
    final rootPath = ApiConfig.rootFolderPath;
    final options = BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
      headers: {
        'Content-Type': 'application/json',
        'X-Root-Folder-Path': rootPath,
      },
    );
    return Dio(options);
  }

  /// Fetch folder content from backend API
  /// Endpoint: `/folder` (root) or `/folder?path=<path>`
  static Future<ApiResult<FolderData>> fetchFolderContents(
    String folderPath, {
    int? folderLimit,
    int? pictureLimit,
    int? videoLimit,
    int? page,
    CancelToken? cancelToken,
  }) async {
    final dio = _createDio();
    final baseUrl = ApiConfig.baseUrl;
    final Map<String, dynamic> queryParams = {
      'root_path': ApiConfig.rootFolderPath,
    };
    if (folderPath.trim().isNotEmpty) {
      queryParams['path'] = folderPath.trim();
    }
    if (folderLimit != null) queryParams['folder_limit'] = folderLimit;
    if (pictureLimit != null) queryParams['picture_limit'] = pictureLimit;
    if (videoLimit != null) queryParams['video_limit'] = videoLimit;
    if (page != null) queryParams['page'] = page;

    final requestUrl = '$baseUrl/folder${folderPath.isNotEmpty ? '?path=${Uri.encodeComponent(folderPath)}' : ''}';

    try {
      final response = await dio.get(
        '/folder',
        queryParameters: queryParams,
        cancelToken: cancelToken,
      );

      final resData = response.data;
      dynamic dataContainer = resData;
      if (resData is Map<String, dynamic> && resData.containsKey('data')) {
        dataContainer = resData['data'];
      }

      List<FolderItem> folders = [];
      List<PictureItem> pictures = [];
      List<VideoItem> videos = [];
      int totalFolders = 0;
      int totalPictures = 0;
      int totalVideos = 0;

      if (dataContainer is Map<String, dynamic>) {
        totalFolders = dataContainer['total_folders'] ?? 0;
        totalPictures = dataContainer['total_pictures'] ?? 0;
        totalVideos = dataContainer['total_videos'] ?? 0;

        if (dataContainer['folders'] is List) {
          folders = (dataContainer['folders'] as List)
              .whereType<Map<String, dynamic>>()
              .map((item) => FolderItem.fromJson(item))
              .toList();
        }
        if (dataContainer['pictures'] is List) {
          pictures = (dataContainer['pictures'] as List)
              .whereType<Map<String, dynamic>>()
              .map((item) {
                final pic = PictureItem.fromJson(item);
                return PictureItem(
                  name: pic.name,
                  path: pic.path,
                  type: pic.type,
                  url: pic.url ?? Formatters.getPictureUrl(baseUrl, pic),
                  thumbnailUrl: pic.thumbnailUrl ?? Formatters.getThumbnailUrl(baseUrl, pic),
                  modTime: pic.modTime,
                  size: pic.size,
                  width: pic.width,
                  height: pic.height,
                  extension: pic.extension,
                );
              })
              .toList();
        }
        if (dataContainer['videos'] is List) {
          videos = (dataContainer['videos'] as List)
              .whereType<Map<String, dynamic>>()
              .map((item) {
                final vid = VideoItem.fromJson(item);
                return VideoItem(
                  name: vid.name,
                  path: vid.path,
                  type: vid.type,
                  url: vid.url ?? Formatters.getVideoStreamUrl(baseUrl, vid),
                  thumbnailUrl: vid.thumbnailUrl ?? Formatters.getVideoThumbnailUrl(baseUrl, vid),
                  modTime: vid.modTime,
                  size: vid.size,
                  width: vid.width,
                  height: vid.height,
                  extension: vid.extension,
                  resolution: vid.resolution,
                );
              })
              .toList();
        }
      }

      if (totalFolders == 0) totalFolders = folders.length;
      if (totalPictures == 0) totalPictures = pictures.length;
      if (totalVideos == 0) totalVideos = videos.length;

      final status = (resData is Map && resData['status'] != null)
          ? int.tryParse(resData['status'].toString()) ?? response.statusCode ?? 200
          : response.statusCode ?? 200;

      final message = (resData is Map && resData['message'] != null)
          ? resData['message'].toString()
          : 'Lấy dữ liệu thành công';

      return ApiResult.success(
        FolderData(
          folders: folders,
          pictures: pictures,
          videos: videos,
          totalFolders: totalFolders,
          totalPictures: totalPictures,
          totalVideos: totalVideos,
        ),
        status: status,
        message: message,
      );
    } on DioException catch (e) {
      if (CancelToken.isCancel(e)) {
        return ApiResult.canceled();
      }

      int? statusCode = e.response?.statusCode;
      String errorMessage = 'Không thể kết nối đến máy chủ API.';
      String? errorDetails;

      if (e.response != null) {
        final resData = e.response?.data;
        if (resData is Map && resData['message'] != null) {
          errorMessage = resData['message'].toString();
        } else {
          errorMessage = 'Máy chủ phản hồi lỗi ($statusCode)';
        }
        try {
          errorDetails = const JsonEncoder.withIndent('  ').convert(resData);
        } catch (_) {
          errorDetails = resData.toString();
        }
      } else if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout ||
          e.type == DioExceptionType.connectionError) {
        errorMessage = 'Không nhận được phản hồi từ server ($requestUrl). Hãy kiểm tra địa chỉ IP ($baseUrl), kết nối Wi-Fi/LAN hoặc tường lửa.';
      } else {
        errorMessage = e.message ?? 'Đã xảy ra lỗi mạng';
      }

      return ApiResult.failure(
        ApiErrorInfo(
          status: statusCode ?? 0,
          message: errorMessage,
          details: errorDetails,
          requestUrl: requestUrl,
        ),
      );
    } catch (e) {
      return ApiResult.failure(
        ApiErrorInfo(
          status: 500,
          message: 'Lỗi không xác định: $e',
          requestUrl: requestUrl,
        ),
      );
    }
  }

  /// Fetch full nested folder tree structure from backend API
  /// Endpoint: /tree-folder
  static Future<ApiResult<List<TreeNode>>> fetchFolderTree({
    CancelToken? cancelToken,
  }) async {
    final dio = _createDio();
    try {
      final response = await dio.get(
        '/tree-folder',
        queryParameters: {
          'root_path': ApiConfig.rootFolderPath,
        },
        cancelToken: cancelToken,
      );

      final resData = response.data;
      List<TreeNode> tree = [];

      dynamic treeArray = resData;
      if (resData is Map<String, dynamic> && resData.containsKey('data')) {
        treeArray = resData['data'];
      }

      if (treeArray is List) {
        tree = treeArray
            .whereType<Map<String, dynamic>>()
            .map((node) => TreeNode.fromJson(node))
            .toList();
      }

      return ApiResult.success(tree);
    } on DioException catch (e) {
      if (CancelToken.isCancel(e)) {
        return ApiResult.canceled();
      }
      return ApiResult.failure(
        ApiErrorInfo(
          status: e.response?.statusCode ?? 0,
          message: 'Lỗi tải cây thư mục: ${e.message}',
        ),
      );
    } catch (e) {
      return ApiResult.failure(
        ApiErrorInfo(
          status: 500,
          message: 'Lỗi cây thư mục: $e',
        ),
      );
    }
  }

  /// Create new subfolder
  /// Endpoint: POST /folder
  static Future<ApiResult<bool>> createFolder(String parentPath, String folderName) async {
    final dio = _createDio();
    try {
      final response = await dio.post(
        '/folder',
        queryParameters: {
          'root_path': ApiConfig.rootFolderPath,
        },
        data: {
          'path': parentPath,
          'name': folderName,
        },
      );

      final resData = response.data;
      final message = (resData is Map && resData['message'] != null)
          ? resData['message'].toString()
          : 'Tạo thư mục mới thành công';

      return ApiResult.success(true, message: message);
    } on DioException catch (e) {
      String errorMessage = 'Không thể tạo thư mục mới.';
      if (e.response != null && e.response?.data is Map && e.response?.data['message'] != null) {
        errorMessage = e.response?.data['message'].toString() ?? errorMessage;
      }
      return ApiResult.failure(ApiErrorInfo(message: errorMessage, status: e.response?.statusCode));
    } catch (e) {
      return ApiResult.failure(ApiErrorInfo(message: 'Lỗi tạo thư mục: $e'));
    }
  }

  /// Rename existing folder
  /// Endpoint: PUT /folder/rename
  static Future<ApiResult<bool>> renameFolder(String folderPath, String newName) async {
    final dio = _createDio();
    try {
      final response = await dio.put(
        '/folder/rename',
        queryParameters: {
          'root_path': ApiConfig.rootFolderPath,
        },
        data: {
          'path': folderPath,
          'new_name': newName,
        },
      );

      final resData = response.data;
      final message = (resData is Map && resData['message'] != null)
          ? resData['message'].toString()
          : 'Đổi tên thư mục thành công';

      return ApiResult.success(true, message: message);
    } on DioException catch (e) {
      String errorMessage = 'Không thể đổi tên thư mục.';
      if (e.response != null && e.response?.data is Map && e.response?.data['message'] != null) {
        errorMessage = e.response?.data['message'].toString() ?? errorMessage;
      }
      return ApiResult.failure(ApiErrorInfo(message: errorMessage, status: e.response?.statusCode));
    } catch (e) {
      return ApiResult.failure(ApiErrorInfo(message: 'Lỗi đổi tên thư mục: $e'));
    }
  }

  /// Move file or folder to a target destination folder
  /// Endpoint: POST /item/move
  static Future<ApiResult<bool>> moveItem(String srcPath, String destFolderPath) async {
    final dio = _createDio();
    try {
      final response = await dio.post(
        '/item/move',
        queryParameters: {
          'root_path': ApiConfig.rootFolderPath,
        },
        data: {
          'src_path': srcPath,
          'dest_folder_path': destFolderPath,
        },
      );

      final resData = response.data;
      final message = (resData is Map && resData['message'] != null)
          ? resData['message'].toString()
          : 'Di chuyển đối tượng thành công';

      return ApiResult.success(true, message: message);
    } on DioException catch (e) {
      String errorMessage = 'Không thể di chuyển đối tượng.';
      if (e.response != null && e.response?.data is Map && e.response?.data['message'] != null) {
        errorMessage = e.response?.data['message'].toString() ?? errorMessage;
      }
      return ApiResult.failure(ApiErrorInfo(message: errorMessage, status: e.response?.statusCode));
    } catch (e) {
      return ApiResult.failure(ApiErrorInfo(message: 'Lỗi di chuyển: $e'));
    }
  }

  /// Delete folder
  /// Endpoint: DELETE /folder
  static Future<ApiResult<bool>> deleteFolder(String folderPath) async {
    final dio = _createDio();
    try {
      final response = await dio.delete(
        '/folder',
        queryParameters: {
          'path': folderPath,
          'root_path': ApiConfig.rootFolderPath,
        },
      );

      final resData = response.data;
      final message = (resData is Map && resData['message'] != null)
          ? resData['message'].toString()
          : 'Xóa thư mục thành công';

      return ApiResult.success(true, message: message);
    } on DioException catch (e) {
      String errorMessage = 'Không thể xóa thư mục.';
      if (e.response != null && e.response?.data is Map && (e.response?.data['message'] != null || e.response?.data['error'] != null)) {
        errorMessage = (e.response?.data['message'] ?? e.response?.data['error']).toString();
      }
      return ApiResult.failure(ApiErrorInfo(message: errorMessage, status: e.response?.statusCode));
    } catch (e) {
      return ApiResult.failure(ApiErrorInfo(message: 'Lỗi xóa thư mục: $e'));
    }
  }

  /// Delete file (image or video)
  /// Endpoint: DELETE /file
  static Future<ApiResult<bool>> deleteFile(String filePath) async {
    final dio = _createDio();
    try {
      final response = await dio.delete(
        '/file',
        queryParameters: {
          'path': filePath,
          'root_path': ApiConfig.rootFolderPath,
        },
      );

      final resData = response.data;
      final message = (resData is Map && resData['message'] != null)
          ? resData['message'].toString()
          : 'Xóa file thành công';

      return ApiResult.success(true, message: message);
    } on DioException catch (e) {
      String errorMessage = 'Không thể xóa file.';
      if (e.response != null && e.response?.data is Map && (e.response?.data['message'] != null || e.response?.data['error'] != null)) {
        errorMessage = (e.response?.data['message'] ?? e.response?.data['error']).toString();
      }
      return ApiResult.failure(ApiErrorInfo(message: errorMessage, status: e.response?.statusCode));
    } catch (e) {
      return ApiResult.failure(ApiErrorInfo(message: 'Lỗi xóa file: $e'));
    }
  }
}
