import '../utils/client_cache_manager.dart';

class CacheInfoData {
  final int sizeBytes;
  final String formattedSize;
  final int fileCount;

  CacheInfoData({
    required this.sizeBytes,
    required this.formattedSize,
    required this.fileCount,
  });
}

class CacheApiResponse {
  final bool success;
  final String message;
  final CacheInfoData? data;

  CacheApiResponse({
    required this.success,
    required this.message,
    this.data,
  });
}

class CacheApi {
  /// Get local client device cache info (no network API call to server)
  static Future<CacheApiResponse> getCacheInfo() async {
    try {
      final info = await ClientCacheManager.getClientCacheInfo();
      return CacheApiResponse(
        success: true,
        message: 'Thành công',
        data: CacheInfoData(
          sizeBytes: info.totalSizeBytes,
          formattedSize: info.formattedSize,
          fileCount: info.fileCount,
        ),
      );
    } catch (e) {
      return CacheApiResponse(success: false, message: 'Lỗi tính toán bộ nhớ client: $e');
    }
  }

  /// Clear local client device cache (no network API call to server)
  static Future<CacheApiResponse> clearCache() async {
    try {
      final success = await ClientCacheManager.clearClientCache();
      if (success) {
        return CacheApiResponse(
          success: true,
          message: 'Đã dọn dẹp bộ nhớ tạm trên thiết bị thành công',
        );
      }
      return CacheApiResponse(success: false, message: 'Không thể xóa bộ nhớ tạm trên thiết bị');
    } catch (e) {
      return CacheApiResponse(success: false, message: 'Lỗi dọn dẹp: $e');
    }
  }
}
