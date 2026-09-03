import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ApiConfig {
  // Flutter has no runtime .env loader in this project. Deployment defaults
  // are public compile-time values supplied with --dart-define; a server the
  // user has saved in SharedPreferences still takes precedence.
  static const String defaultIp = 'localhost';
  static const String defaultPort = '8080';
  static const String defaultRootFolderPath = '';
  static const String defaultApiBaseUrl = String.fromEnvironment(
    'APPVIEW_STORAGE_API_BASE_URL',
    defaultValue: 'http://localhost:8080/api/v1',
  );
  static const String defaultDownloadApiBaseUrl = String.fromEnvironment(
    'APPVIEW_DOWNLOAD_API_BASE_URL',
    defaultValue: 'http://localhost:5002/api/v1/download',
  );
  static const String defaultDownloadWsUrl = String.fromEnvironment(
    'APPVIEW_DOWNLOAD_WS_URL',
    defaultValue: 'ws://localhost:5002/api/v1/download/ws',
  );
  static const String defaultCoordinatorApiBaseUrl = String.fromEnvironment(
    'APPVIEW_COORDINATOR_API_BASE_URL',
    defaultValue: '',
  );

  static const String pythonDownloadPort = '5002';

  static const String prefKeyServerIp = 'appview_server_ip';
  static const String prefKeyServerPort = 'appview_server_port';
  static const String prefKeyRootFolderPath = 'appview_root_folder_path';
  static const String prefKeyApiBaseUrl = 'appview_api_base_url';

  static String _serverIp = defaultIp;
  static String _serverPort = defaultPort;
  static String _rootFolderPath = defaultRootFolderPath;
  static String _currentBaseUrl = defaultApiBaseUrl;
  static bool _hasSavedServerEndpoint = false;

  static String get serverIp => _serverIp;
  static String get serverPort => _serverPort;
  static String get rootFolderPath => _rootFolderPath;
  static String get baseUrl => _currentBaseUrl;

  static String get downloadBaseUrl =>
      _hasSavedServerEndpoint
          ? 'http://$_serverIp:$pythonDownloadPort/api/v1/download'
          : defaultDownloadApiBaseUrl;
  static String get downloadWsUrl =>
      _hasSavedServerEndpoint
          ? 'ws://$_serverIp:$pythonDownloadPort/api/v1/download/ws'
          : defaultDownloadWsUrl;
  static String get coordinatorBaseUrl => defaultCoordinatorApiBaseUrl;

  static bool get isConfigured =>
      _serverIp.trim().isNotEmpty &&
      _serverPort.trim().isNotEmpty &&
      _rootFolderPath.trim().isNotEmpty;

  static Future<void> loadConfig() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedIp = prefs.getString(prefKeyServerIp);
      final savedPort = prefs.getString(prefKeyServerPort);
      final hasSavedServerEndpoint =
          savedIp != null &&
          savedIp.trim().isNotEmpty &&
          savedPort != null &&
          savedPort.trim().isNotEmpty;
      _hasSavedServerEndpoint = hasSavedServerEndpoint;
      _serverIp = hasSavedServerEndpoint ? savedIp.trim() : defaultIp;
      _serverPort = hasSavedServerEndpoint ? savedPort.trim() : defaultPort;
      _rootFolderPath =
          prefs.getString(prefKeyRootFolderPath) ?? defaultRootFolderPath;
      _currentBaseUrl =
          _hasSavedServerEndpoint
              ? 'http://$_serverIp:$_serverPort/api/v1'
              : defaultApiBaseUrl;
    } catch (_) {
      _serverIp = defaultIp;
      _serverPort = defaultPort;
      _rootFolderPath = defaultRootFolderPath;
      _currentBaseUrl = defaultApiBaseUrl;
      _hasSavedServerEndpoint = false;
    }
  }

  static Future<bool> saveServerConfig({
    required String ip,
    required String port,
    required String rootFolderPath,
  }) async {
    try {
      final cleanIp = ip.trim().isEmpty ? defaultIp : ip.trim();
      final cleanPort = port.trim().isEmpty ? defaultPort : port.trim();
      final cleanRoot = rootFolderPath.trim();

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(prefKeyServerIp, cleanIp);
      await prefs.setString(prefKeyServerPort, cleanPort);
      await prefs.setString(prefKeyRootFolderPath, cleanRoot);

      _serverIp = cleanIp;
      _serverPort = cleanPort;
      _rootFolderPath = cleanRoot;
      _currentBaseUrl = 'http://$_serverIp:$_serverPort/api/v1';
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
      headers: {
        'Content-Type': 'application/json',
        'X-Root-Folder-Path': rootFolderPath,
      },
    );
    return Dio(options);
  }
}
