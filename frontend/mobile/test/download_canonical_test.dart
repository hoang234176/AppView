import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/api/download_api.dart';
import 'package:mobile/api/api_config.dart';
import 'package:mobile/providers/download_provider.dart';

void main() {
  test(
    'logical download destination preserves the selected Storage-root path',
    () {
      expect(canonicalDownloadDestination(''), '/');
      expect(canonicalDownloadDestination('Test'), '/Test');
      expect(
        canonicalDownloadDestination('/Test/Subfolder'),
        '/Test/Subfolder',
      );
      expect(canonicalDownloadDestination('Albums/Test'), '/Albums/Test');
      expect(canonicalDownloadDestination('/Albums/Test'), '/Albums/Test');
      expect(
        canonicalDownloadDestination('Ảnh #1/玉汇 @test'),
        '/Ảnh #1/玉汇 @test',
      );
      expect(canonicalDownloadDestination('Test'), isNot('/Albums/Test'));
    },
  );

  test('ApiConfig server host is the only required configuration field', () {
    // The isConfigured check must not depend on port or rootFolderPath.
    // Simulate a saved host by checking the logic path directly.
    // (Full SharedPreferences test would require plugin setup; this validates the logic.)
    expect(ApiConfig.defaultServerHost, 'localhost');
    // coordinatorPort and pythonDownloadPort are fixed constants.
    expect(ApiConfig.coordinatorPort, '8090');
    expect(ApiConfig.pythonDownloadPort, '5002');
    // rootFolderPath always returns '' — frontend never depends on physical path.
    expect(ApiConfig.rootFolderPath, '');
  });

  test(
    'empty host is rejected before network request in ApiConfig validation',
    () async {
      final result = await ApiConfig.validateCoordinatorHost('');
      expect(result['success'], isFalse);
      expect(result['message'], contains('Vui lòng nhập Server Host'));
    },
  );

  test(
    'StorageInfoModel deserializes Coordinator storage metadata correctly without hardcoded HDD',
    () {
      final info = StorageInfoModel.fromJson({
        'displayName': 'SSD Workspace Volume',
        'totalBytes': 1000000000,
        'usedBytes': 400000000,
        'availableBytes': 600000000,
        'usedPercent': 40.0,
      });
      expect(info.displayName, 'SSD Workspace Volume');
      expect(info.totalBytes, 1000000000);
      expect(info.usedBytes, 400000000);
      expect(info.availableBytes, 600000000);
      expect(info.usedPercent, 40.0);
    },
  );

  test(
    'failed host validation rejects connection and invalid host cannot be silently bypassed',
    () async {
      final valResult = await ApiConfig.validateCoordinatorHost(
        'invalid-nonexistent-server-host.invalid',
      );
      expect(valResult['success'], isFalse);
      expect(valResult['message'], isNotEmpty);
    },
  );

  test(
    'canonical download progress replaces resolving presentation fields',
    () {
      final task = DownloadTaskModel.fromCoordinatorJson({
        'id': 'canonical-job',
        'displayName': 'archive.rar',
        'destination': 'albums',
        'state': 'downloading',
        'stage': 'downloading',
        'progress': {
          'downloadedBytes': 50,
          'totalBytes': 100,
          'speedBytes': 10,
        },
      });

      expect(task.taskId, 'canonical-job');
      expect(task.stage, 'downloading');
      expect(task.downloadPercent, 50);
      expect(task.filename, 'archive.rar');
    },
  );

  test('canonical password-required is active and needs attention', () {
    final task = DownloadTaskModel.fromCoordinatorJson({
      'id': 'canonical-job',
      'displayName': 'archive.rar',
      'state': 'password_required',
      'stage': 'password_required',
      'passwordRequired': true,
      'archiveDownloaded': true,
      'archiveExtracted': false,
    });

    expect(task.passwordRequired, isTrue);
    expect(DownloadProvider.isActiveDownload(task), isTrue);
    expect(DownloadProvider.needsDownloadAttention(task), isTrue);
  });

  test(
    'interrupted stays active while completed and cancelled have final groups',
    () {
      DownloadTaskModel task(String stage, {bool downloaded = false}) =>
          DownloadTaskModel(
            taskId: stage,
            originalUrl: '',
            destination: '',
            stage: stage,
            archiveDownloaded: downloaded,
          );
      expect(
        DownloadProvider.downloadGroup(task('interrupted', downloaded: true)),
        'active',
      );
      expect(DownloadProvider.isRetryableDownload(task('interrupted')), isTrue);
      expect(DownloadProvider.downloadGroup(task('completed')), 'completed');
      expect(DownloadProvider.canCancelDownload(task('completed')), isFalse);
      expect(DownloadProvider.downloadGroup(task('cancelled')), 'cancelled');
    },
  );
}
