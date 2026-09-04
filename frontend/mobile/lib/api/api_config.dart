import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ApiConfig {
  // Flutter has no runtime .env loader in this project. Deployment defaults
  // are public compile-time values supplied with --dart-define; a server the
  // user has saved in SharedPreferences still takes precedence.

  // Fixed ports — not user-configurable. Coordinator is always 8090; legacy
  // Python Download stays on 5002.  Storage default is 8080.
  static const String coordinatorPort = '8090';
  static const String pythonDownloadPort = '5002';
  static const String _storagePortDefault = '8080';

  static const String defaultServerHost = 'localhost';

  static const String defaultApiBaseUrl = String.fromEnvironment(
    'APPVIEW_STORAGE_API_BASE_URL',
    defaultValue: 'http://localhost:$_storagePortDefault/api/v1',
  );
  static const String defaultDownloadApiBaseUrl = String.fromEnvironment(
    'APPVIEW_DOWNLOAD_API_BASE_URL',
    defaultValue: 'http://localhost:$pythonDownloadPort/api/v1/download',
  );
  static const String defaultDownloadWsUrl = String.fromEnvironment(
    'APPVIEW_DOWNLOAD_WS_URL',
    defaultValue: 'ws://localhost:$pythonDownloadPort/api/v1/download/ws',
  );
  static const String defaultCoordinatorApiBaseUrl = String.fromEnvironment(
    'APPVIEW_COORDINATOR_API_BASE_URL',
    defaultValue: '',
  );

  // Persisted preference keys.
  // New key stores the single server host. Legacy IP and port keys are read
  // for migration but no longer written.
  static const String prefKeyServerHost = 'appview_server_host';
  static const String prefKeyLegacyServerIp = 'appview_server_ip';
  // Root path key is never read by frontend after this change; kept to avoid
  // corrupting saved settings.
  static const String prefKeyApiBaseUrl = 'appview_api_base_url';

  static String _serverHost = defaultServerHost;
  static String _currentBaseUrl = defaultApiBaseUrl;
  static bool _hasSavedServerEndpoint = false;

  static String get serverHost => _serverHost;

  // Legacy compatibility accessors.
  /// @deprecated Use serverHost instead.
  static String get serverIp => _serverHost;
  /// @deprecated Port is fixed; always returns coordinatorPort.
  static String get serverPort => coordinatorPort;
  /// @deprecated Root path belongs to Storage, not frontend. Returns ''.
  static String get rootFolderPath => '';

  static String get baseUrl => _currentBaseUrl;

  static String get downloadBaseUrl =>
      _hasSavedServerEndpoint
          ? 'http://$_serverHost:$pythonDownloadPort/api/v1/download'
          : defaultDownloadApiBaseUrl;
  static String get downloadWsUrl =>
      _hasSavedServerEndpoint
          ? 'ws://$_serverHost:$pythonDownloadPort/api/v1/download/ws'
          : defaultDownloadWsUrl;
  static String get coordinatorBaseUrl =>
      defaultCoordinatorApiBaseUrl.isNotEmpty
          ? defaultCoordinatorApiBaseUrl
          : _hasSavedServerEndpoint
          ? 'http://$_serverHost:$coordinatorPort/api/v1'
          : '';
  static String get coordinatorEventsWsUrl {
    final base = coordinatorBaseUrl.trim();
    if (base.isEmpty) return '';
    final uri = Uri.tryParse(base);
    if (uri == null || (uri.scheme != 'http' && uri.scheme != 'https')) {
      return '';
    }
    final basePath = uri.path
        .replaceFirst(RegExp(r'/api/v1/?$'), '')
        .replaceFirst(RegExp(r'/+$'), '');
    return uri
        .replace(
          scheme: uri.scheme == 'https' ? 'wss' : 'ws',
          path: '$basePath/ws/events',
          query: null,
          fragment: null,
        )
        .toString();
  }

  /// Server is configured when a non-default host has been saved.
  /// Port and root path are no longer required.
  static bool get isConfigured => _serverHost.trim().isNotEmpty;

  static Future<void> loadConfig() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      // Prefer the new host key; fall back to legacy IP for migration.
      final savedHost =
          prefs.getString(prefKeyServerHost) ??
          prefs.getString(prefKeyLegacyServerIp);
      final hasSaved = savedHost != null && savedHost.trim().isNotEmpty;
      _hasSavedServerEndpoint = hasSaved;
      _serverHost = hasSaved ? savedHost.trim() : defaultServerHost;
      _currentBaseUrl =
          _hasSavedServerEndpoint
              ? 'http://$_serverHost:$_storagePortDefault/api/v1'
              : defaultApiBaseUrl;
    } catch (_) {
      _serverHost = defaultServerHost;
      _currentBaseUrl = defaultApiBaseUrl;
      _hasSavedServerEndpoint = false;
    }
  }

  /// Validate a candidate host by performing a lightweight HTTP GET to /health on Coordinator.
  /// Does NOT persist settings. Returns a Map with 'success' and 'message'.
  static Future<Map<String, dynamic>> validateCoordinatorHost(String rawHost) async {
    final cleanHost = rawHost.trim();
    if (cleanHost.isEmpty) {
      return {
        'success': false,
        'message': 'Vui lòng nhập Server Host (hostname hoặc địa chỉ IP).',
      };
    }

    final url = 'http://$cleanHost:$coordinatorPort/health';
    final dio = Dio(BaseOptions(connectTimeout: const Duration(seconds: 5), receiveTimeout: const Duration(seconds: 5)));
    try {
      final response = await dio.get(url);
      if (response.statusCode == 200 && response.data is Map) {
        final status = response.data['status']?.toString();
        if (status == 'ok') {
          return {'success': true};
        }
      }
      return {
        'success': false,
        'message': 'Phản hồi từ $cleanHost không phải máy chủ Coordinator.',
      };
    } on DioException catch (e) {
      String msg = 'Không thể kết nối đến máy chủ $cleanHost:$coordinatorPort.';
      if (e.type == DioExceptionType.connectionTimeout || e.type == DioExceptionType.receiveTimeout) {
        msg = 'Kết nối đến $cleanHost bị quá thời gian (Timeout). Vui lòng kiểm tra địa chỉ máy chủ.';
      } else if (e.response != null) {
        msg = 'Máy chủ $cleanHost phản hồi lỗi HTTP ${e.response?.statusCode}.';
      }
      return {'success': false, 'message': msg};
    } catch (e) {
      return {'success': false, 'message': 'Không thể kết nối đến $cleanHost: $e'};
    }
  }

  /// Save the server host. Only [host] is required. Legacy [port] and
  /// [rootFolderPath] are accepted for call-site compatibility but ignored.
  static Future<bool> saveServerConfig({
    required String host,
    String port = '',
    String rootFolderPath = '',
  }) async {
    try {
      final cleanHost = host.trim().isEmpty ? defaultServerHost : host.trim();

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(prefKeyServerHost, cleanHost);
      // Write to legacy key as well so older sessions still resolve.
      await prefs.setString(prefKeyLegacyServerIp, cleanHost);

      _serverHost = cleanHost;
      _currentBaseUrl = 'http://$_serverHost:$_storagePortDefault/api/v1';
      _hasSavedServerEndpoint = true;
      await prefs.setString(prefKeyApiBaseUrl, _currentBaseUrl);

      return true;
    } catch (_) {
      return false;
    }
  }

  static Future<String> loadBaseUrl() async {
    await loadConfig();
    return _currentBaseUrl;
  }

  static void setMemoryBaseUrl(String url) {
    _currentBaseUrl = url.trim();
  }

  static Dio createDio() {
    final options = BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
      headers: const {
        'Content-Type': 'application/json',
        // X-Root-Folder-Path header is no longer sent; backend uses ROOT_PATH.
      },
    );
    return Dio(options);
  }
}
