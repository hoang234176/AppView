import 'package:flutter/material.dart';
import '../api/api_config.dart';

class SettingsProvider extends ChangeNotifier {
  String get serverIp => ApiConfig.serverIp;
  String get serverPort => ApiConfig.serverPort;
  String get rootFolderPath => ApiConfig.rootFolderPath;
  String get apiBaseUrl => ApiConfig.baseUrl;
  bool get isConfigured => ApiConfig.isConfigured;

  Future<void> init() async {
    await ApiConfig.loadConfig();
    notifyListeners();
  }

  Future<bool> updateServerConfig({
    required String ip,
    required String port,
    required String rootFolderPath,
  }) async {
    final success = await ApiConfig.saveServerConfig(
      ip: ip,
      port: port,
      rootFolderPath: rootFolderPath,
    );
    if (success) {
      notifyListeners();
    }
    return success;
  }
}
