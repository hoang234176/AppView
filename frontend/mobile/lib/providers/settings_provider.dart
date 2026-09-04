import 'package:flutter/material.dart';
import '../api/api_config.dart';

class SettingsProvider extends ChangeNotifier {
  String get serverHost => ApiConfig.serverHost;
  // Legacy accessors kept for any remaining call-sites.
  /// @deprecated Use serverHost instead.
  String get serverIp => ApiConfig.serverHost;
  /// @deprecated Port is fixed; use ApiConfig.coordinatorPort.
  String get serverPort => ApiConfig.coordinatorPort;
  /// @deprecated Root path is owned by Storage, not frontend.
  String get rootFolderPath => '';
  String get apiBaseUrl => ApiConfig.baseUrl;
  bool get isConfigured => ApiConfig.isConfigured;

  Future<void> init() async {
    await ApiConfig.loadConfig();
    notifyListeners();
  }

  /// Save server configuration. Only [host] is required.
  /// [port] and [rootFolderPath] are accepted for backward compat but ignored.
  Future<bool> updateServerConfig({
    required String host,
    String port = '',
    String rootFolderPath = '',
  }) async {
    final success = await ApiConfig.saveServerConfig(host: host);
    if (success) {
      notifyListeners();
    }
    return success;
  }
}
