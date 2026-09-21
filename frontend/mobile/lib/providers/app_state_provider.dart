import 'dart:async';
import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../models/folder_item.dart';
import '../models/picture_item.dart';
import '../models/video_item.dart';
import '../models/tree_node.dart';
import '../models/api_result.dart';
import '../api/folder_api.dart';
import '../api/download_api.dart';
import '../api/api_config.dart';
import '../services/filesystem_events_service.dart';
import '../utils/formatters.dart';

class TransferProgress {
  final String action;
  final String destFolder;
  final String destDrive;
  final int percent;
  final String status; // 'running', 'completed', 'failed'
  final String message;
  final String currentFile;

  TransferProgress({
    required this.action,
    required this.destFolder,
    required this.destDrive,
    required this.percent,
    required this.status,
    required this.message,
    this.currentFile = '',
  });

  TransferProgress copyWith({
    String? action,
    String? destFolder,
    String? destDrive,
    int? percent,
    String? status,
    String? message,
    String? currentFile,
  }) {
    return TransferProgress(
      action: action ?? this.action,
      destFolder: destFolder ?? this.destFolder,
      destDrive: destDrive ?? this.destDrive,
      percent: percent ?? this.percent,
      status: status ?? this.status,
      message: message ?? this.message,
      currentFile: currentFile ?? this.currentFile,
    );
  }
}

class AppStateProvider extends ChangeNotifier {
  AppStateProvider() {
    _filesystemEvents = FilesystemEventsService(
      onEvent: _handleFilesystemEvent,
      onConnected: _scheduleCanonicalRefresh,
      onStorageInfo: _handleStorageInfo,
      onBatchJobProgress: _handleBatchJobProgress,
    );
  }

  String _currentPath = '';
  List<FolderItem> _folders = [];
  List<PictureItem> _pictures = [];
  List<VideoItem> _videos = [];
  List<TreeNode> _treeData = [];
  List<DriveInfoModel> _drives = [];
  String _activeDrive = ApiConfig.activeDrive;

  bool _isLoading = false;
  bool _isServerConnected = false;
  ApiErrorInfo? _errorInfo;

  String _searchQuery = '';

  CancelToken? _activeCancelToken;
  late final FilesystemEventsService _filesystemEvents;
  Timer? _filesystemRefreshTimer;
  bool _disposed = false;

  TransferProgress? _transferProgress;
  Timer? _transferPollTimer;

  // Getters
  TransferProgress? get transferProgress => _transferProgress;
  String get currentPath => _currentPath;
  List<FolderItem> get folders => _folders;
  List<PictureItem> get pictures => _pictures;
  List<VideoItem> get videos => _videos;
  List<TreeNode> get treeData => _treeData;
  List<DriveInfoModel> get drives => _drives;
  String get activeDrive => _activeDrive;
  bool get isLoading => _isLoading;
  bool get isServerConnected => _isServerConnected;
  ApiErrorInfo? get errorInfo => _errorInfo;
  String get searchQuery => _searchQuery;

  // Filtered lists based on search query
  List<FolderItem> get filteredFolders {
    if (_searchQuery.trim().isEmpty) return _folders;
    final q = _searchQuery.toLowerCase().trim();
    return _folders.where((f) {
      return f.name.toLowerCase().contains(q) ||
          f.path.toLowerCase().contains(q);
    }).toList();
  }

  List<PictureItem> get filteredPictures {
    if (_searchQuery.trim().isEmpty) return _pictures;
    final q = _searchQuery.toLowerCase().trim();
    return _pictures.where((p) {
      return p.name.toLowerCase().contains(q) ||
          p.path.toLowerCase().contains(q);
    }).toList();
  }

  List<VideoItem> get filteredVideos {
    if (_searchQuery.trim().isEmpty) return _videos;
    final q = _searchQuery.toLowerCase().trim();
    return _videos.where((v) {
      return v.name.toLowerCase().contains(q) ||
          v.path.toLowerCase().contains(q);
    }).toList();
  }

  int _totalFolders = 0;
  int _totalPictures = 0;
  int _totalVideos = 0;

  int get totalFolders => _totalFolders;
  int get totalPictures => _totalPictures;
  int get totalVideos => _totalVideos;

  bool get hasContent =>
      filteredFolders.isNotEmpty ||
      filteredPictures.isNotEmpty ||
      filteredVideos.isNotEmpty;

  int _folderLimit = 20;
  int _pictureLimit = 20;
  int _videoLimit = 20;
  static const int pageSize = 20;

  int get folderLimit => _folderLimit;
  int get pictureLimit => _pictureLimit;
  int get videoLimit => _videoLimit;

  List<FolderItem> get visibleFolders => filteredFolders;
  List<PictureItem> get visiblePictures => filteredPictures;
  List<VideoItem> get visibleVideos => filteredVideos;

  bool get hasMore =>
      _totalFolders > _folders.length ||
      _totalPictures > _pictures.length ||
      _totalVideos > _videos.length;

  int get remainingCount {
    int remFolders =
        _totalFolders > _folders.length ? _totalFolders - _folders.length : 0;
    int remPictures =
        _totalPictures > _pictures.length
            ? _totalPictures - _pictures.length
            : 0;
    int remVideos =
        _totalVideos > _videos.length ? _totalVideos - _videos.length : 0;
    return remFolders + remPictures + remVideos;
  }

  int _currentPage = 1;

  // Multi-Selection State
  bool _isSelectMode = false;
  final Set<String> _selectedFolderPaths = {};
  final Set<String> _selectedPicturePaths = {};
  final Set<String> _selectedVideoPaths = {};

  bool get isSelectMode => _isSelectMode;
  Set<String> get selectedFolderPaths => _selectedFolderPaths;
  Set<String> get selectedPicturePaths => _selectedPicturePaths;
  Set<String> get selectedVideoPaths => _selectedVideoPaths;
  int get selectedFolderCount => _selectedFolderPaths.length;
  int get selectedPictureCount => _selectedPicturePaths.length;
  int get selectedVideoCount => _selectedVideoPaths.length;
  int get totalSelectedCount =>
      _selectedFolderPaths.length +
      _selectedPicturePaths.length +
      _selectedVideoPaths.length;

  bool isFolderSelected(String path) => _selectedFolderPaths.contains(path);
  bool isPictureSelected(String path) => _selectedPicturePaths.contains(path);
  bool isVideoSelected(String path) => _selectedVideoPaths.contains(path);

  bool get isAllSelected {
    final curFolders = visibleFolders;
    final curPictures = visiblePictures;
    final curVideos = visibleVideos;
    final total = curFolders.length + curPictures.length + curVideos.length;
    if (total == 0) return false;
    return _selectedFolderPaths.length >= curFolders.length &&
        _selectedPicturePaths.length >= curPictures.length &&
        _selectedVideoPaths.length >= curVideos.length;
  }

  bool get isAllFoldersSelected {
    final curFolders = visibleFolders;
    return curFolders.isNotEmpty &&
        curFolders.every((f) => _selectedFolderPaths.contains(f.path));
  }

  bool get isAllPicturesSelected {
    final curPictures = visiblePictures;
    return curPictures.isNotEmpty &&
        curPictures.every((p) => _selectedPicturePaths.contains(p.path));
  }

  bool get isAllVideosSelected {
    final curVideos = visibleVideos;
    return curVideos.isNotEmpty &&
        curVideos.every((v) => _selectedVideoPaths.contains(v.path));
  }

  void enterSelectModeWithItem({required String type, required String path}) {
    _isSelectMode = true;
    if (type == 'folder') {
      _selectedFolderPaths.add(path);
    } else if (type == 'picture') {
      _selectedPicturePaths.add(path);
    } else if (type == 'video') {
      _selectedVideoPaths.add(path);
    }
    notifyListeners();
  }

  void toggleSelectItem({required String type, required String path}) {
    if (type == 'folder') {
      if (_selectedFolderPaths.contains(path)) {
        _selectedFolderPaths.remove(path);
      } else {
        _selectedFolderPaths.add(path);
      }
    } else if (type == 'picture') {
      if (_selectedPicturePaths.contains(path)) {
        _selectedPicturePaths.remove(path);
      } else {
        _selectedPicturePaths.add(path);
      }
    } else if (type == 'video') {
      if (_selectedVideoPaths.contains(path)) {
        _selectedVideoPaths.remove(path);
      } else {
        _selectedVideoPaths.add(path);
      }
    }

    if (totalSelectedCount == 0) {
      _isSelectMode = false;
    }
    notifyListeners();
  }

  void toggleSelectAll() {
    if (isAllSelected) {
      clearSelection();
    } else {
      selectAllCurrentFolder();
    }
  }

  void toggleSelectAllFolders() {
    if (isAllFoldersSelected) {
      for (final f in visibleFolders) {
        _selectedFolderPaths.remove(f.path);
      }
    } else {
      for (final f in visibleFolders) {
        _selectedFolderPaths.add(f.path);
      }
    }
    _isSelectMode = totalSelectedCount > 0;
    notifyListeners();
  }

  void toggleSelectAllPictures() {
    if (isAllPicturesSelected) {
      for (final p in visiblePictures) {
        _selectedPicturePaths.remove(p.path);
      }
    } else {
      for (final p in visiblePictures) {
        _selectedPicturePaths.add(p.path);
      }
    }
    _isSelectMode = totalSelectedCount > 0;
    notifyListeners();
  }

  void toggleSelectAllVideos() {
    if (isAllVideosSelected) {
      for (final v in visibleVideos) {
        _selectedVideoPaths.remove(v.path);
      }
    } else {
      for (final v in visibleVideos) {
        _selectedVideoPaths.add(v.path);
      }
    }
    _isSelectMode = totalSelectedCount > 0;
    notifyListeners();
  }

  void selectAllCurrentFolder() {
    for (final f in visibleFolders) {
      _selectedFolderPaths.add(f.path);
    }
    for (final p in visiblePictures) {
      _selectedPicturePaths.add(p.path);
    }
    for (final v in visibleVideos) {
      _selectedVideoPaths.add(v.path);
    }
    _isSelectMode = true;
    notifyListeners();
  }

  void clearSelection() {
    _selectedFolderPaths.clear();
    _selectedPicturePaths.clear();
    _selectedVideoPaths.clear();
    _isSelectMode = false;
    notifyListeners();
  }

  void exitSelectMode() {
    clearSelection();
  }

  void loadMore() {
    if (!_isServerConnected) return;
    _currentPage++;
    loadData(_currentPath, page: _currentPage, isSilent: true);
  }

  void resetLimits() {
    _currentPage = 1;
    _folderLimit = pageSize;
    _pictureLimit = pageSize;
    _videoLimit = pageSize;
  }

  void setSearchQuery(String query) {
    _searchQuery = query;
    resetLimits();
    notifyListeners();
  }

  void clearSearch() {
    _searchQuery = '';
    resetLimits();
    notifyListeners();
  }

  void navigateTo(String path) {
    if (!_isServerConnected) return;
    clearSelection();
    if (path == _currentPath) {
      refreshCurrentFolder();
      return;
    }
    _currentPath = path;
    _searchQuery = '';
    resetLimits();
    loadData(path, page: 1, isSilent: false);
  }

  void navigateBack() {
    if (_currentPath.trim().isEmpty) return;
    final parts = _currentPath.split('/').where((p) => p.isNotEmpty).toList();
    if (parts.length <= 1) {
      navigateTo('');
    } else {
      parts.removeLast();
      navigateTo(parts.join('/'));
    }
  }

  Future<void> refreshAll() async {
    if (!_isServerConnected) return;
    await refreshCurrentFolder(includeTree: true);
  }

  void removeFileLocally(String path) {
    String normalize(String p) => p.replaceAll(RegExp(r'^/+|\/+$'), '');
    final norm = normalize(path);
    final prevPicLen = _pictures.length;
    _pictures = _pictures.where((p) => normalize(p.path) != norm).toList();
    if (_pictures.length != prevPicLen) {
      _totalPictures = (_totalPictures - (prevPicLen - _pictures.length)).clamp(0, 999999);
    }
    final prevVidLen = _videos.length;
    _videos = _videos.where((v) => normalize(v.path) != norm).toList();
    if (_videos.length != prevVidLen) {
      _totalVideos = (_totalVideos - (prevVidLen - _videos.length)).clamp(0, 999999);
    }
    notifyListeners();
  }

  void removeFolderLocally(String path) {
    String normalize(String p) => p.replaceAll(RegExp(r'^/+|\/+$'), '');
    final norm = normalize(path);
    final prevLen = _folders.length;
    _folders = _folders.where((f) => normalize(f.path) != norm).toList();
    if (_folders.length != prevLen) {
      _totalFolders = (_totalFolders - (prevLen - _folders.length)).clamp(0, 999999);
    }
    loadTreeData();
    notifyListeners();
  }

  void removeBatchItemsLocally(List<Map<String, dynamic>> items) {
    String normalize(String p) => p.replaceAll(RegExp(r'^/+|\/+$'), '');
    final delPaths = items.map((it) => normalize(it['path']?.toString() ?? '')).toSet();

    final prevFolderLen = _folders.length;
    _folders = _folders.where((f) => !delPaths.contains(normalize(f.path))).toList();
    if (_folders.length != prevFolderLen) {
      _totalFolders = (_totalFolders - (prevFolderLen - _folders.length)).clamp(0, 999999);
      loadTreeData();
    }

    final prevPicLen = _pictures.length;
    _pictures = _pictures.where((p) => !delPaths.contains(normalize(p.path))).toList();
    if (_pictures.length != prevPicLen) {
      _totalPictures = (_totalPictures - (prevPicLen - _pictures.length)).clamp(0, 999999);
    }

    final prevVidLen = _videos.length;
    _videos = _videos.where((v) => !delPaths.contains(normalize(v.path))).toList();
    if (_videos.length != prevVidLen) {
      _totalVideos = (_totalVideos - (prevVidLen - _videos.length)).clamp(0, 999999);
    }

    notifyListeners();
  }

  void startTransfer({
    required String action,
    required String destFolder,
    required String destDrive,
    required List<Map<String, dynamic>> items,
  }) async {
    _transferPollTimer?.cancel();
    _transferPollTimer = null;

    final destDisplay = destFolder.isNotEmpty ? '/$destFolder' : '/ (Gốc)';
    _transferProgress = TransferProgress(
      action: action,
      destFolder: destDisplay,
      destDrive: destDrive,
      percent: 0,
      status: 'running',
      message: action == 'copy' ? 'Đang sao chép đến $destDisplay...' : 'Đang di chuyển đến $destDisplay...',
    );
    notifyListeners();

    final result = await FolderApi.executeBatchItems(
      action: action,
      items: items,
      destFolder: destFolder,
      srcDrive: _activeDrive,
      destDrive: destDrive,
    );

    if (!result.success) {
      _transferProgress = _transferProgress?.copyWith(
        status: 'failed',
        message: result.errorInfo?.message ?? (result.message.isNotEmpty ? result.message : 'Thao tác thất bại'),
      );
      notifyListeners();
      Timer(const Duration(seconds: 4), () {
        if (_transferProgress?.status == 'failed') {
          _transferProgress = null;
          notifyListeners();
        }
      });
      return;
    }

    final job = result.data?['job'];
    if (job is Map) {
      final status = job['status']?.toString() ?? 'completed';
      final percent = (job['percent'] as num?)?.toInt() ?? 100;
      final msg = job['message']?.toString() ?? 'Thao tác hoàn tất';

      if (status == 'completed') {
        _transferProgress = _transferProgress?.copyWith(
          percent: percent,
          status: 'completed',
          message: msg,
        );
        notifyListeners();
        refreshAll();
        Timer(const Duration(seconds: 3), () {
          _transferProgress = null;
          notifyListeners();
        });
        return;
      }

      final jobId = job['id']?.toString();
      if (jobId != null && jobId.isNotEmpty) {
        _transferPollTimer = Timer.periodic(const Duration(milliseconds: 400), (timer) async {
          final pollJob = await FolderApi.fetchBatchJobStatus(jobId);
          if (pollJob != null) {
            final pollStatus = pollJob['status']?.toString() ?? 'running';
            final pollPct = (pollJob['percent'] as num?)?.toInt() ?? 0;
            final pollMsg = pollJob['message']?.toString() ?? '';
            final pollFile = pollJob['current_file']?.toString() ?? '';

            _transferProgress = _transferProgress?.copyWith(
              percent: pollPct,
              status: pollStatus,
              message: pollMsg.isNotEmpty ? pollMsg : _transferProgress?.message,
              currentFile: pollFile,
            );
            notifyListeners();

            if (pollStatus == 'completed') {
              timer.cancel();
              _transferPollTimer = null;
              _transferProgress = null;
              notifyListeners();
              refreshAll();
            } else if (pollStatus == 'failed') {
              timer.cancel();
              _transferPollTimer = null;
              Timer(const Duration(seconds: 4), () {
                _transferProgress = null;
                notifyListeners();
              });
            }
          }
        });
      }
    }
  }

  Future<void> refreshCurrentFolder({bool includeTree = true}) async {
    if (!_isServerConnected) return;
    if (includeTree) {
      await Future.wait([
        loadTreeData(),
        loadData(_currentPath, page: 1, isSilent: false),
      ]);
      return;
    }
    await loadData(_currentPath, page: 1, isSilent: false);
  }

  void startRealtime() {
    if (!_isServerConnected) return;
    _filesystemEvents.start();
  }

  void markServerConnected() {
    _isServerConnected = true;
    _activeDrive = ApiConfig.activeDrive;
    loadDrives();
    notifyListeners();
  }

  Future<void> loadDrives() async {
    if (!_isServerConnected) return;
    final result = await FolderApi.fetchDrives();
    if (result.success && result.data != null && result.data!.isNotEmpty) {
      _drives = result.data!;
      final exists = _drives.any((d) => d.id == _activeDrive);
      if (!exists && _drives.isNotEmpty) {
        _activeDrive = _drives.first.id;
        ApiConfig.setActiveDrive(_activeDrive);
      }
      notifyListeners();
    }
  }

  Future<void> selectDrive(String driveId) async {
    if (driveId == _activeDrive) return;
    clearSelection();
    _activeDrive = driveId;
    await ApiConfig.saveActiveDrive(driveId);
    _currentPath = '';
    _searchQuery = '';
    resetLimits();
    notifyListeners();
    await Future.wait([
      loadTreeData(),
      loadData('', page: 1, isSilent: false),
    ]);
  }

  /// Tear down and reconnect the realtime socket to the updated host.
  Future<void> restartRealtime() async {
    if (!_isServerConnected) return;
    await _filesystemEvents.restart();
  }

  /// Stop realtime connection and clear server-backed state when connection fails.
  Future<void> stopRealtimeAndClearState(String errorMessage) async {
    _activeCancelToken?.cancel();
    await _filesystemEvents.dispose();
    _isServerConnected = false;
    _treeData = [];
    _folders = [];
    _pictures = [];
    _videos = [];
    _totalFolders = 0;
    _totalPictures = 0;
    _totalVideos = 0;
    _errorInfo = ApiErrorInfo(status: 500, message: errorMessage);
    notifyListeners();
  }

  void _handleBatchJobProgress(Map<String, dynamic> job) {
    if (_disposed) return;
    final status = job['status']?.toString() ?? 'running';
    final pct = (job['percent'] as num?)?.toInt() ?? 0;
    final msg = job['message']?.toString() ?? '';
    final curFile = job['current_file']?.toString() ?? '';
    final action = job['action']?.toString() ?? 'copy';
    final destFolder = job['dest_folder']?.toString() ?? '';
    final destDrive = job['dest_drive']?.toString() ?? _activeDrive;

    final destDisplay = destFolder.isNotEmpty ? '/$destFolder' : '/ (Gốc)';

    _transferProgress = (_transferProgress ?? TransferProgress(
      action: action,
      destFolder: destDisplay,
      destDrive: destDrive,
      percent: 0,
      status: status,
      message: msg,
    )).copyWith(
      action: action,
      percent: pct,
      status: status,
      message: msg.isNotEmpty ? msg : _transferProgress?.message,
      currentFile: curFile,
    );
    notifyListeners();

    if (status == 'completed') {
      _transferProgress = null;
      notifyListeners();
    } else if (status == 'failed') {
      Timer(const Duration(seconds: 4), () {
        if (_transferProgress?.status == 'failed') {
          _transferProgress = null;
          notifyListeners();
        }
      });
    }
  }

  void _handleFilesystemEvent(Map<String, dynamic> event) {
    final eventDrive = event['drive']?.toString();
    if (eventDrive != null &&
        eventDrive.isNotEmpty &&
        eventDrive.toUpperCase() != _activeDrive.toUpperCase()) {
      return;
    }
    final type = event['type']?.toString();
    final oldPath =
        event['oldPath']?.toString() ?? event['path']?.toString() ?? '';
    final newPath =
        event['newPath']?.toString() ?? event['path']?.toString() ?? '';
    final oldParentPath =
        event['oldParentPath']?.toString() ?? _parentPath(oldPath);
    final newParentPath =
        event['newParentPath']?.toString() ??
        event['parentPath']?.toString() ??
        _parentPath(newPath);

    String normalize(String p) => p.replaceAll(RegExp(r'^/+|\/+$'), '');
    final normCurrent = normalize(_currentPath);
    final normOldParent = normalize(oldParentPath);
    final normNewParent = normalize(newParentPath);
    final normOld = normalize(oldPath);
    final normNew = normalize(newPath);

    // 1. File Created - Incremental prepend without reloading entire folder
    if (type == 'file_created') {
      if (normCurrent == normNewParent || normCurrent == normOldParent) {
        final rawItem = event['item'];
        if (rawItem is Map) {
          final itemMap = Map<String, dynamic>.from(rawItem);
          final itemType = itemMap['type']?.toString() ?? '';
          final name = itemMap['name']?.toString() ?? '';
          final isVid = itemType == 'video' ||
              RegExp(r'\.(mp4|mkv|webm|avi|mov|flv|wmv|m4v)$', caseSensitive: false).hasMatch(name);

          if (isVid) {
            final rawVideo = VideoItem.fromJson(itemMap);
            final vid = VideoItem(
              name: rawVideo.name,
              path: rawVideo.path,
              type: rawVideo.type,
              url: Formatters.getVideoStreamUrl(ApiConfig.baseUrl, rawVideo),
              thumbnailUrl: Formatters.getVideoThumbnailUrl(ApiConfig.baseUrl, rawVideo),
              modTime: rawVideo.modTime,
              size: rawVideo.size,
              width: rawVideo.width,
              height: rawVideo.height,
              extension: rawVideo.extension,
              resolution: rawVideo.resolution,
            );
            _videos = [vid, ..._videos.where((v) => normalize(v.path) != normNew)];
            _totalVideos++;
          } else {
            final rawPicture = PictureItem.fromJson(itemMap);
            final pic = PictureItem(
              name: rawPicture.name,
              path: rawPicture.path,
              type: rawPicture.type,
              url: Formatters.getPictureUrl(ApiConfig.baseUrl, rawPicture),
              thumbnailUrl: Formatters.getThumbnailUrl(ApiConfig.baseUrl, rawPicture),
              modTime: rawPicture.modTime,
              size: rawPicture.size,
              width: rawPicture.width,
              height: rawPicture.height,
              extension: rawPicture.extension,
            );
            _pictures = [pic, ..._pictures.where((p) => normalize(p.path) != normNew)];
            _totalPictures++;
          }
          notifyListeners();
          return;
        }
      } else {
        return;
      }
    }

    // 2. File Deleted - Incremental filter without reloading entire folder
    if (type == 'file_deleted') {
      if (normCurrent == normOldParent || normCurrent == normNewParent) {
        final prevPicLen = _pictures.length;
        _pictures = _pictures.where((p) => normalize(p.path) != normOld).toList();
        if (_pictures.length != prevPicLen) {
          _totalPictures = (_totalPictures - 1).clamp(0, 999999);
        }

        final prevVidLen = _videos.length;
        _videos = _videos.where((v) => normalize(v.path) != normOld).toList();
        if (_videos.length != prevVidLen) {
          _totalVideos = (_totalVideos - 1).clamp(0, 999999);
        }
        notifyListeners();
        return;
      }
      return;
    }

    // 3. File Moved
    if (type == 'file_moved') {
      if (normCurrent == normOldParent) {
        final prevPicLen = _pictures.length;
        _pictures = _pictures.where((p) => normalize(p.path) != normOld).toList();
        if (_pictures.length != prevPicLen) _totalPictures = (_totalPictures - 1).clamp(0, 999999);

        final prevVidLen = _videos.length;
        _videos = _videos.where((v) => normalize(v.path) != normOld).toList();
        if (_videos.length != prevVidLen) _totalVideos = (_totalVideos - 1).clamp(0, 999999);
      }
      if (normCurrent == normNewParent) {
        final rawItem = event['item'];
        if (rawItem is Map) {
          final itemMap = Map<String, dynamic>.from(rawItem);
          final itemType = itemMap['type']?.toString() ?? '';
          final name = itemMap['name']?.toString() ?? '';
          final isVid = itemType == 'video' ||
              RegExp(r'\.(mp4|mkv|webm|avi|mov|flv|wmv|m4v)$', caseSensitive: false).hasMatch(name);

          if (isVid) {
            final vid = VideoItem.fromJson(itemMap);
            _videos = [vid, ..._videos.where((v) => normalize(v.path) != normNew)];
            _totalVideos++;
          } else {
            final pic = PictureItem.fromJson(itemMap);
            _pictures = [pic, ..._pictures.where((p) => normalize(p.path) != normNew)];
            _totalPictures++;
          }
        }
      }
      notifyListeners();
      return;
    }

    // 4. Batch Items Deleted
    if (type == 'items_deleted') {
      final pathsRaw = event['paths'];
      final delSet = <String>{};
      if (pathsRaw is List) {
        for (final p in pathsRaw) {
          delSet.add(normalize(p.toString()));
        }
      }
      if (delSet.isNotEmpty) {
        final prevFoldLen = _folders.length;
        _folders = _folders.where((f) => !delSet.contains(normalize(f.path))).toList();
        _totalFolders = (_totalFolders - (prevFoldLen - _folders.length)).clamp(0, 999999);

        final prevPicLen = _pictures.length;
        _pictures = _pictures.where((p) => !delSet.contains(normalize(p.path))).toList();
        _totalPictures = (_totalPictures - (prevPicLen - _pictures.length)).clamp(0, 999999);

        final prevVidLen = _videos.length;
        _videos = _videos.where((v) => !delSet.contains(normalize(v.path))).toList();
        _totalVideos = (_totalVideos - (prevVidLen - _videos.length)).clamp(0, 999999);
      }
      loadTreeData();
      notifyListeners();
      return;
    }

    // 5. Folder Created - Incremental add & Tree sync
    if (type == 'folder_created') {
      loadTreeData();
      if (normCurrent == normNewParent) {
        final rawItem = event['item'];
        if (rawItem is Map) {
          final f = FolderItem.fromJson(Map<String, dynamic>.from(rawItem));
          _folders = [f, ..._folders.where((x) => normalize(x.path) != normNew)];
        } else {
          final folderName = newPath.split('/').last;
          final f = FolderItem(name: folderName, path: newPath);
          _folders = [f, ..._folders.where((x) => normalize(x.path) != normNew)];
        }
        _totalFolders++;
        notifyListeners();
        return;
      }
      return;
    }

    // 6. Folder Deleted - Navigate out or filter & Tree sync
    if (type == 'folder_deleted') {
      loadTreeData();
      if (_isSameOrDescendant(_currentPath, oldPath)) {
        _currentPath = oldParentPath;
        _searchQuery = '';
        resetLimits();
        notifyListeners();
        _scheduleCanonicalRefresh();
        return;
      } else if (normCurrent == normOldParent) {
        _folders = _folders.where((f) => normalize(f.path) != normOld).toList();
        _totalFolders = (_totalFolders - 1).clamp(0, 999999);
        notifyListeners();
        return;
      }
      return;
    }

    // 7. Folder Moved / Renamed - Tree sync
    if (type == 'folder_moved' || type == 'folder_renamed') {
      loadTreeData();
      if (_isSameOrDescendant(_currentPath, oldPath)) {
        _currentPath = _replacePathPrefix(_currentPath, oldPath, newPath);
        _searchQuery = '';
        resetLimits();
        notifyListeners();
        _scheduleCanonicalRefresh();
        return;
      } else if (normCurrent == normOldParent || normCurrent == normNewParent) {
        _scheduleCanonicalRefresh();
        return;
      }
      return;
    }

    // 8. Batch Items Moved / Copied - Tree sync
    if (type == 'items_moved' || type == 'items_copied') {
      loadTreeData();
      if (normCurrent == normNewParent || normCurrent == normOldParent) {
        _scheduleCanonicalRefresh();
      }
      return;
    }

    var nextPath = _currentPath;
    if (_isSameOrDescendant(_currentPath, oldPath)) {
      nextPath = oldParentPath;
    }

    if (nextPath != _currentPath) {
      _currentPath = nextPath;
      _searchQuery = '';
      resetLimits();
      notifyListeners();
    }
    _scheduleCanonicalRefresh();
  }

  void _scheduleCanonicalRefresh() {
    _filesystemRefreshTimer?.cancel();
    _filesystemRefreshTimer = Timer(const Duration(milliseconds: 120), () {
      if (!_disposed) {
        loadDrives();
        refreshCurrentFolder(includeTree: true);
      }
    });
  }

  void _handleStorageInfo(Map<String, dynamic> info) {
    if (_disposed) return;
    final drivesRaw = info['drives'];
    if (drivesRaw is List) {
      _drives = drivesRaw
          .whereType<Map>()
          .map((item) => DriveInfoModel.fromJson(Map<String, dynamic>.from(item)))
          .toList();
      final exists = _drives.any((d) => d.id == _activeDrive);
      if (!exists && _drives.isNotEmpty) {
        _activeDrive = _drives.first.id;
        ApiConfig.setActiveDrive(_activeDrive);
      }
      notifyListeners();
    }
  }

  bool _isSameOrDescendant(String candidate, String parent) =>
      parent.isNotEmpty &&
      (candidate == parent || candidate.startsWith('$parent/'));

  String _parentPath(String path) {
    final separator = path.lastIndexOf('/');
    return separator == -1 ? '' : path.substring(0, separator);
  }

  String _replacePathPrefix(String path, String oldPrefix, String newPrefix) =>
      path == oldPrefix
          ? newPrefix
          : '$newPrefix${path.substring(oldPrefix.length)}';

  Future<void> loadTreeData() async {
    if (!_isServerConnected) return;
    if (!ApiConfig.isConfigured) {
      _treeData = [];
      notifyListeners();
      return;
    }
    final result = await FolderApi.fetchFolderTree();
    if (result.success && result.data != null) {
      _treeData = result.data!;
      notifyListeners();
    } else {
      _treeData = [];
      notifyListeners();
    }
  }

  Future<void> loadData(
    String path, {
    int page = 1,
    bool isSilent = false,
  }) async {
    if (!_isServerConnected) return;
    _activeCancelToken?.cancel();
    final cancelToken = CancelToken();
    _activeCancelToken = cancelToken;

    if (!ApiConfig.isConfigured) {
      _folders = [];
      _pictures = [];
      _videos = [];
      _totalFolders = 0;
      _totalPictures = 0;
      _totalVideos = 0;
      _isLoading = false;
      _errorInfo = ApiErrorInfo(
        status: 400,
        message: 'Vui lòng nhập Server Host trong phần cài đặt để bắt đầu.',
      );
      notifyListeners();
      return;
    }

    if (!isSilent) {
      _isLoading = true;
      _errorInfo = null;
      notifyListeners();
    }

    final result = await FolderApi.fetchFolderContents(
      path,
      page: page,
      folderLimit: 0,
      pictureLimit: 0,
      videoLimit: 0,
      cancelToken: cancelToken,
    );

    if (result.canceled) return;

    _isLoading = false;
    if (result.success && result.data != null) {
      if (isSilent) {
        final existingFolders = _folders.map((f) => f.path).toSet();
        final existingPictures = _pictures.map((p) => p.path).toSet();
        final existingVideos = _videos.map((v) => v.path).toSet();

        final newFolders = result.data!.folders.where(
          (f) => !existingFolders.contains(f.path),
        );
        final newPictures = result.data!.pictures.where(
          (p) => !existingPictures.contains(p.path),
        );
        final newVideos = result.data!.videos.where(
          (v) => !existingVideos.contains(v.path),
        );

        _folders = [..._folders, ...newFolders];
        _pictures = [..._pictures, ...newPictures];
        _videos = [..._videos, ...newVideos];
      } else {
        _folders = result.data!.folders;
        _pictures = result.data!.pictures;
        _videos = result.data!.videos;
      }
      _totalFolders = result.data!.totalFolders;
      _totalPictures = result.data!.totalPictures;
      _totalVideos = result.data!.totalVideos;
      _errorInfo = null;
    } else {
      if (!isSilent) {
        _folders = [];
        _pictures = [];
        _videos = [];
        _totalFolders = 0;
        _totalPictures = 0;
        _totalVideos = 0;
      }
      _errorInfo =
          result.errorInfo ??
          ApiErrorInfo(
            status: result.status,
            message:
                result.message.isNotEmpty
                    ? result.message
                    : 'Không thể lấy dữ liệu',
          );
    }
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _activeCancelToken?.cancel();
    _filesystemRefreshTimer?.cancel();
    _transferPollTimer?.cancel();
    _filesystemEvents.dispose();
    super.dispose();
  }
}
