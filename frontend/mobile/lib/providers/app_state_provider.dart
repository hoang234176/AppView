import 'dart:async';
import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../models/folder_item.dart';
import '../models/picture_item.dart';
import '../models/video_item.dart';
import '../models/tree_node.dart';
import '../models/api_result.dart';
import '../api/folder_api.dart';
import '../api/api_config.dart';
import '../services/filesystem_events_service.dart';

class AppStateProvider extends ChangeNotifier {
  AppStateProvider() {
    _filesystemEvents = FilesystemEventsService(
      onEvent: _handleFilesystemEvent,
      onConnected: _scheduleCanonicalRefresh,
    );
  }

  String _currentPath = '';
  List<FolderItem> _folders = [];
  List<PictureItem> _pictures = [];
  List<VideoItem> _videos = [];
  List<TreeNode> _treeData = [];

  bool _isLoading = false;
  ApiErrorInfo? _errorInfo;

  String _searchQuery = '';

  CancelToken? _activeCancelToken;
  late final FilesystemEventsService _filesystemEvents;
  Timer? _filesystemRefreshTimer;
  bool _disposed = false;

  // Getters
  String get currentPath => _currentPath;
  List<FolderItem> get folders => _folders;
  List<PictureItem> get pictures => _pictures;
  List<VideoItem> get videos => _videos;
  List<TreeNode> get treeData => _treeData;
  bool get isLoading => _isLoading;
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

  void loadMore() {
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
    await refreshCurrentFolder(includeTree: true);
  }

  Future<void> refreshCurrentFolder({bool includeTree = true}) async {
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
    _filesystemEvents.start();
  }

  void _handleFilesystemEvent(Map<String, dynamic> event) {
    final type = event['type']?.toString();
    final oldPath =
        event['oldPath']?.toString() ?? event['path']?.toString() ?? '';
    final newPath =
        event['newPath']?.toString() ?? event['path']?.toString() ?? '';
    final oldParentPath =
        event['oldParentPath']?.toString() ?? _parentPath(oldPath);
    var nextPath = _currentPath;

    if (type == 'folder_deleted' &&
        _isSameOrDescendant(_currentPath, oldPath)) {
      nextPath = oldParentPath;
    } else if ((type == 'folder_moved' || type == 'folder_renamed') &&
        _isSameOrDescendant(_currentPath, oldPath)) {
      nextPath = _replacePathPrefix(_currentPath, oldPath, newPath);
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
        refreshCurrentFolder(includeTree: true);
      }
    });
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
        message:
            'Vui lòng nhập đầy đủ IP, Cổng (Port) và Đường dẫn thư mục gốc (Root Path) trong bảng cấu hình máy chủ để bắt đầu.',
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
    _filesystemEvents.dispose();
    super.dispose();
  }
}
