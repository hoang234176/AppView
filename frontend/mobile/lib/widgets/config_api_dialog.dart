import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../providers/settings_provider.dart';
import '../providers/app_state_provider.dart';
import '../api/api_config.dart';
import '../api/download_api.dart';
import '../api/cache_api.dart';
import '../services/filesystem_events_service.dart';
import '../utils/formatters.dart';
import 'app_toast.dart';

class ConfigApiDialog extends StatefulWidget {
  const ConfigApiDialog({super.key});

  static Future<void> show(BuildContext context) {
    return showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => const ConfigApiDialog(),
    );
  }

  @override
  State<ConfigApiDialog> createState() => _ConfigApiDialogState();
}

class _ConfigApiDialogState extends State<ConfigApiDialog> {
  late TextEditingController _hostController;

  bool _isSavingServer = false;
  bool _isClearingCache = false;
  String? _errorMessage;
  String? _cacheMsg;
  StorageInfoModel? _storageInfo;
  StreamSubscription<Map<String, dynamic>>? _storageSubscription;
  bool _isLoadingStorage = false;
  bool _isCheckingConnection = false;
  bool _isConnected = false;

  static bool _hasAutoCheckedCookiesOnMobile = false;

  // Collapsible Accordion States
  bool _openSection1 = false;
  bool _openSection2 = false;
  bool _openSection3 = false;

  // Social Cookies State (YouTube)
  String _cookieStatus = 'none'; // 'loading', 'none', 'valid', 'expired'
  bool _isYoutubeCardOpen = false;
  bool _isVerifyingCookie = false;
  String? _cookieVerifyMsg;
  bool _cookieVerifySuccess = false;
  Timer? _youtubeTimer;

  // Social Cookies State (TikTok)
  String _tiktokCookieStatus = 'none'; // 'loading', 'none', 'valid', 'expired'
  bool _isTiktokCardOpen = false;
  bool _isVerifyingTiktokCookie = false;
  String? _tiktokCookieVerifyMsg;
  bool _tiktokCookieVerifySuccess = false;
  Timer? _tiktokTimer;

  // Social Cookies State (Facebook)
  String _fbCookieStatus = 'none'; // 'loading', 'none', 'valid', 'expired'
  bool _isFbCardOpen = false;
  bool _isVerifyingFbCookie = false;
  String? _fbCookieVerifyMsg;
  bool _fbCookieVerifySuccess = false;
  Timer? _fbTimer;

  // Social Cookies State (Instagram)
  String _igCookieStatus = 'none'; // 'loading', 'none', 'valid', 'expired'
  bool _isIgCardOpen = false;
  bool _isVerifyingIgCookie = false;
  String? _igCookieVerifyMsg;
  bool _igCookieVerifySuccess = false;
  Timer? _igTimer;

  // Social Cookies State (X / Twitter)
  String _xCookieStatus = 'none'; // 'loading', 'none', 'valid', 'expired'
  bool _isXCardOpen = false;
  bool _isVerifyingXCookie = false;
  String? _xCookieVerifyMsg;
  bool _xCookieVerifySuccess = false;
  Timer? _xTimer;

  CacheInfoData? _cacheInfo;

  @override
  void initState() {
    super.initState();
    final settings = context.read<SettingsProvider>();
    _hostController = TextEditingController(text: settings.serverHost);
    _storageSubscription = StorageRealtimeBus.events.listen((raw) {
      if (mounted) {
        setState(() {
          _storageInfo = StorageInfoModel.fromJson(raw);
          _isLoadingStorage = false;
        });
      }
    });
    _loadCacheInfo();
    _checkCurrentConnectionAndLoadStorage();
  }

  @override
  void dispose() {
    _storageSubscription?.cancel();
    _hostController.dispose();
    _youtubeTimer?.cancel();
    _tiktokTimer?.cancel();
    _fbTimer?.cancel();
    _igTimer?.cancel();
    _xTimer?.cancel();
    super.dispose();
  }


  Future<void> _handleVerifyCookie() async {
    _youtubeTimer?.cancel();
    setState(() {
      _isVerifyingCookie = true;
      _cookieVerifyMsg = null;
    });

    final res = await DownloadApi.verifyCookies(platform: 'youtube');
    if (!mounted) return;

    setState(() {
      _isVerifyingCookie = false;
      if (res['success'] == true &&
          res['data'] is Map &&
          res['data']['valid'] == true) {
        _cookieStatus = 'valid';
        _cookieVerifySuccess = true;
        _cookieVerifyMsg =
            res['data']['message']?.toString() ?? '✓ Cookie hợp lệ!';
      } else {
        _cookieStatus = 'expired';
        _cookieVerifySuccess = false;
        final msg =
            res['data'] is Map ? res['data']['message']?.toString() : null;
        _cookieVerifyMsg =
            msg ??
            res['message']?.toString() ??
            'Cookie không hợp lệ hoặc đã hết hạn.';
      }
    });

    _youtubeTimer = Timer(const Duration(seconds: 5), () {
      if (mounted) {
        setState(() {
          _cookieVerifyMsg = null;
        });
      }
    });
  }


  Future<void> _handleVerifyTiktokCookie() async {
    _tiktokTimer?.cancel();
    setState(() {
      _isVerifyingTiktokCookie = true;
      _tiktokCookieVerifyMsg = null;
    });

    final res = await DownloadApi.verifyCookies(platform: 'tiktok');
    if (!mounted) return;

    setState(() {
      _isVerifyingTiktokCookie = false;
      if (res['success'] == true &&
          res['data'] is Map &&
          res['data']['valid'] == true) {
        _tiktokCookieStatus = 'valid';
        _tiktokCookieVerifySuccess = true;
        _tiktokCookieVerifyMsg =
            res['data']['message']?.toString() ?? '✓ Cookie hợp lệ!';
      } else {
        _tiktokCookieStatus = 'expired';
        _tiktokCookieVerifySuccess = false;
        final msg =
            res['data'] is Map ? res['data']['message']?.toString() : null;
        _tiktokCookieVerifyMsg =
            msg ??
            res['message']?.toString() ??
            'Cookie không hợp lệ hoặc đã hết hạn.';
      }
    });

    _tiktokTimer = Timer(const Duration(seconds: 5), () {
      if (mounted) {
        setState(() {
          _tiktokCookieVerifyMsg = null;
        });
      }
    });
  }


  Future<void> _handleVerifyFbCookie() async {
    _fbTimer?.cancel();
    setState(() {
      _isVerifyingFbCookie = true;
      _fbCookieVerifyMsg = null;
    });

    final res = await DownloadApi.verifyCookies(platform: 'facebook');
    if (!mounted) return;

    setState(() {
      _isVerifyingFbCookie = false;
      if (res['success'] == true &&
          res['data'] is Map &&
          res['data']['valid'] == true) {
        _fbCookieStatus = 'valid';
        _fbCookieVerifySuccess = true;
        _fbCookieVerifyMsg =
            res['data']['message']?.toString() ?? '✓ Cookie Facebook hợp lệ!';
      } else {
        _fbCookieStatus = 'expired';
        _fbCookieVerifySuccess = false;
        final msg =
            res['data'] is Map ? res['data']['message']?.toString() : null;
        _fbCookieVerifyMsg =
            msg ??
            res['message']?.toString() ??
            'Cookie không hợp lệ hoặc đã hết hạn.';
      }
    });

    _fbTimer = Timer(const Duration(seconds: 5), () {
      if (mounted) {
        setState(() {
          _fbCookieVerifyMsg = null;
        });
      }
    });
  }

  Future<void> _handleVerifyIgCookie() async {
    _igTimer?.cancel();
    setState(() {
      _isVerifyingIgCookie = true;
      _igCookieVerifyMsg = null;
    });

    final res = await DownloadApi.verifyCookies(platform: 'instagram');
    if (!mounted) return;

    setState(() {
      _isVerifyingIgCookie = false;
      if (res['success'] == true &&
          res['data'] is Map &&
          res['data']['valid'] == true) {
        _igCookieStatus = 'valid';
        _igCookieVerifySuccess = true;
        _igCookieVerifyMsg =
            res['data']['message']?.toString() ?? '✓ Cookie Instagram hợp lệ!';
      } else {
        _igCookieStatus = 'expired';
        _igCookieVerifySuccess = false;
        final msg =
            res['data'] is Map ? res['data']['message']?.toString() : null;
        _igCookieVerifyMsg =
            msg ??
            res['message']?.toString() ??
            'Cookie không hợp lệ hoặc đã hết hạn.';
      }
    });

    _igTimer = Timer(const Duration(seconds: 5), () {
      if (mounted) {
        setState(() {
          _igCookieVerifyMsg = null;
        });
      }
    });
  }

  Future<void> _handleVerifyXCookie() async {
    _xTimer?.cancel();
    setState(() {
      _isVerifyingXCookie = true;
      _xCookieVerifyMsg = null;
    });

    final res = await DownloadApi.verifyCookies(platform: 'x');
    if (!mounted) return;

    setState(() {
      _isVerifyingXCookie = false;
      if (res['success'] == true &&
          res['data'] is Map &&
          res['data']['valid'] == true) {
        _xCookieStatus = 'valid';
        _xCookieVerifySuccess = true;
        _xCookieVerifyMsg =
            res['data']['message']?.toString() ?? '✓ Cookie X (Twitter) hợp lệ!';
      } else {
        _xCookieStatus = 'expired';
        _xCookieVerifySuccess = false;
        final msg =
            res['data'] is Map ? res['data']['message']?.toString() : null;
        _xCookieVerifyMsg =
            msg ??
            res['message']?.toString() ??
            'Cookie không hợp lệ hoặc đã hết hạn.';
      }
    });

    _xTimer = Timer(const Duration(seconds: 5), () {
      if (mounted) {
        setState(() {
          _xCookieVerifyMsg = null;
        });
      }
    });
  }

  Future<void> _checkCurrentConnectionAndLoadStorage() async {
    final host = _hostController.text.trim();
    if (host.isEmpty) return;

    setState(() {
      _isCheckingConnection = true;
    });

    final valRes = await ApiConfig.validateCoordinatorHost(host);
    if (!mounted) return;

    if (valRes['success'] == true) {
      setState(() {
        _isCheckingConnection = false;
        _isConnected = true;
        _isLoadingStorage = true;
      });
      final storageData = await DownloadApi.fetchCoordinatorStorageInfo();
      if (!mounted) return;
      setState(() {
        _storageInfo = storageData;
        _isLoadingStorage = false;
      });
    } else {
      await context.read<AppStateProvider>().stopRealtimeAndClearState(
        valRes['message']?.toString() ?? 'Không thể kết nối máy chủ.',
      );
      if (!mounted) return;
      setState(() {
        _isCheckingConnection = false;
        _isConnected = false;
        _storageInfo = null;
      });
    }
  }

  Future<void> _loadCacheInfo() async {
    final res = await CacheApi.getCacheInfo();
    if (mounted && res.success && res.data != null) {
      setState(() {
        _cacheInfo = res.data;
      });
    }
  }

  // Save Server Config (Section 1)
  Future<void> _handleSaveServer() async {
    final host = _hostController.text.trim();

    if (host.isEmpty) {
      setState(() {
        _errorMessage = 'Vui lòng nhập Server Host (hostname hoặc địa chỉ IP).';
      });
      return;
    }

    setState(() {
      _isSavingServer = true;
      _isCheckingConnection = true;
      _errorMessage = null;
    });

    final settings = context.read<SettingsProvider>();
    final appState = context.read<AppStateProvider>();
    final valRes = await ApiConfig.validateCoordinatorHost(host);
    if (!mounted) return;

    if (valRes['success'] != true) {
      await settings.updateServerConfig(host: host);
      if (!mounted) return;
      await appState.stopRealtimeAndClearState(
        'Lỗi kết nối máy chủ: ${valRes['message'] ?? 'Không thể kết nối.'}',
      );
      if (!mounted) return;
      setState(() {
        _isSavingServer = false;
        _isCheckingConnection = false;
        _isConnected = false;
        _errorMessage = valRes['message'] ?? 'Không thể kết nối đến máy chủ.';
      });
      return;
    }
    final success = await settings.updateServerConfig(host: host);

    if (!mounted) return;

    if (success) {
      appState.markServerConnected();
      setState(() {
        _isSavingServer = false;
        _isCheckingConnection = false;
        _isConnected = true;
        _isLoadingStorage = true;
      });

      await appState.restartRealtime();
      if (!mounted) return;
      appState.refreshAll();

      final storageData = await DownloadApi.fetchCoordinatorStorageInfo();
      if (mounted) {
        setState(() {
          _storageInfo = storageData;
          _isLoadingStorage = false;
        });
        AppToast.showSuccess(context, 'Đã lưu & kết nối máy chủ: $host');
      }
    } else {
      setState(() {
        _isSavingServer = false;
        _isCheckingConnection = false;
        _errorMessage = 'Không thể lưu cấu hình máy chủ.';
      });
    }
  }

  // Clear Cache (Section 2)
  Future<void> _handleClearCache() async {
    final appState = context.read<AppStateProvider>();
    setState(() {
      _isClearingCache = true;
      _cacheMsg = 'Đang dọn dẹp...';
    });
    final res = await CacheApi.clearCache();
    await appState.refreshAll();
    await _loadCacheInfo();

    if (!mounted) return;
    setState(() => _isClearingCache = false);

    if (res.success) {
      final msg = 'Đã dọn dẹp sạch sẽ bộ nhớ tạm';
      setState(() => _cacheMsg = msg);
      AppToast.showSuccess(context, msg);
    } else {
      final err =
          res.message.isNotEmpty ? res.message : 'Không thể dọn dẹp cache!';
      setState(() => _cacheMsg = err);
      AppToast.showError(context, err);
    }
  }

  @override
  Widget build(BuildContext context) {
    final Widget serverStatusTrailing = Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color:
            _isCheckingConnection
                ? Colors.amber.withValues(alpha: 0.15)
                : _isConnected
                ? Colors.green.withValues(alpha: 0.15)
                : Colors.red.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color:
              _isCheckingConnection
                  ? Colors.amberAccent
                  : _isConnected
                  ? Colors.greenAccent
                  : Colors.redAccent,
          width: 1,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            _isCheckingConnection
                ? Icons.sync_rounded
                : _isConnected
                ? Icons.check_circle_rounded
                : Icons.error_outline_rounded,
            size: 12,
            color:
                _isCheckingConnection
                    ? Colors.amberAccent
                    : _isConnected
                    ? Colors.greenAccent
                    : Colors.redAccent,
          ),
          const SizedBox(width: 4),
          Text(
            _isCheckingConnection
                ? 'Đang kiểm tra...'
                : _isConnected
                ? 'Connected'
                : 'Chưa kết nối',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.bold,
              color:
                  _isCheckingConnection
                      ? Colors.amberAccent
                      : _isConnected
                      ? Colors.greenAccent
                      : Colors.redAccent,
            ),
          ),
        ],
      ),
    );

    return GestureDetector(
      onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
      behavior: HitTestBehavior.translucent,
      child: Dialog(
        backgroundColor: AppTheme.bgBlock,
        insetPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
        shape: RoundedRectangleBorder(
          borderRadius: AppTheme.borderRadius,
          side: const BorderSide(color: AppTheme.borderColor),
        ),
        child: Container(
          constraints: const BoxConstraints(maxWidth: 520, maxHeight: 580),
          padding: const EdgeInsets.all(18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Row(
                    children: [
                      Icon(
                        Icons.settings_suggest_rounded,
                        color: AppTheme.googleBlue,
                        size: 24,
                      ),
                      SizedBox(width: 10),
                      Text(
                        'Cài đặt Hệ Thống',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close, color: Colors.grey, size: 20),
                    splashRadius: 18,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                ],
              ),
              // Scrollable Body
              Expanded(
                child: SingleChildScrollView(
                  physics: const BouncingScrollPhysics(),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Storage Info Card (from Coordinator)
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppTheme.bgCard,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: AppTheme.borderColor),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Row(
                              children: [
                                Icon(
                                  Icons.storage_rounded,
                                  size: 16,
                                  color: AppTheme.googleBlue,
                                ),
                                SizedBox(width: 6),
                                Text(
                                  'Ổ đĩa lưu trữ',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            if (_isLoadingStorage)
                              const Row(
                                children: [
                                  SizedBox(
                                    width: 12,
                                    height: 12,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: AppTheme.googleBlue,
                                    ),
                                  ),
                                  SizedBox(width: 8),
                                  Text(
                                    'Đang tải thông tin Storage...',
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: Colors.white54,
                                    ),
                                  ),
                                ],
                              )
                            else if (_storageInfo != null)
                              _storageInfo!.drives.isNotEmpty
                                  ? Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        for (int i = 0; i < _storageInfo!.drives.length; i++) ...[
                                          if (i > 0) const SizedBox(height: 10),
                                          Builder(
                                            builder: (context) {
                                              final d = _storageInfo!.drives[i];
                                              final isConn = d.isConnected;
                                              final p = isConn ? d.usedPercent.round() : 0;
                                              final isDanger = isConn && p >= 91;
                                              final isWarning = isConn && p >= 75 && !isDanger;
                                              final statusColor = !isConn || isDanger
                                                  ? const Color(0xFFEF4444)
                                                  : isWarning
                                                      ? const Color(0xFFF97316)
                                                      : AppTheme.googleBlue;

                                              return Container(
                                                padding: const EdgeInsets.all(12),
                                                decoration: BoxDecoration(
                                                  color: AppTheme.bgBlock,
                                                  borderRadius: BorderRadius.circular(16),
                                                  border: Border.all(color: AppTheme.borderColor),
                                                ),
                                                child: Column(
                                                  crossAxisAlignment: CrossAxisAlignment.start,
                                                  children: [
                                                    Row(
                                                      children: [
                                                        Container(
                                                          padding: const EdgeInsets.all(6),
                                                          decoration: BoxDecoration(
                                                            color: statusColor.withValues(alpha: 0.15),
                                                            borderRadius: BorderRadius.circular(10),
                                                          ),
                                                          child: Icon(
                                                            isConn ? Icons.storage_rounded : Icons.link_off_rounded,
                                                            size: 16,
                                                            color: statusColor,
                                                          ),
                                                        ),
                                                        const SizedBox(width: 8),
                                                        Expanded(
                                                          child: Text(
                                                            d.name.isNotEmpty ? d.name : d.id,
                                                            style: const TextStyle(
                                                              fontSize: 13,
                                                              fontWeight: FontWeight.bold,
                                                              color: Colors.white,
                                                            ),
                                                          ),
                                                        ),
                                                        Container(
                                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                                          decoration: BoxDecoration(
                                                            color: statusColor.withValues(alpha: 0.2),
                                                            borderRadius: BorderRadius.circular(12),
                                                            border: Border.all(
                                                              color: statusColor.withValues(alpha: 0.4),
                                                            ),
                                                          ),
                                                          child: Text(
                                                            isConn ? '$p%' : 'Ngắt kết nối',
                                                            style: TextStyle(
                                                              fontSize: 11.5,
                                                              fontWeight: FontWeight.bold,
                                                              color: statusColor,
                                                            ),
                                                          ),
                                                        ),
                                                      ],
                                                    ),
                                                    const SizedBox(height: 10),
                                                    if (isConn) ...[
                                                      ClipRRect(
                                                        borderRadius: BorderRadius.circular(6),
                                                        child: LinearProgressIndicator(
                                                          value: (d.usedPercent / 100).clamp(0.0, 1.0),
                                                          minHeight: 7,
                                                          backgroundColor: AppTheme.bgInput,
                                                          valueColor: AlwaysStoppedAnimation<Color>(statusColor),
                                                        ),
                                                      ),
                                                      const SizedBox(height: 8),
                                                      Row(
                                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                                        children: [
                                                          Text.rich(
                                                            TextSpan(
                                                              text: 'Đã dùng: ',
                                                              style: const TextStyle(
                                                                fontSize: 11,
                                                                color: Colors.white70,
                                                              ),
                                                              children: [
                                                                TextSpan(
                                                                  text: Formatters.formatFileSize(d.usedBytes),
                                                                  style: TextStyle(
                                                                    fontSize: 11,
                                                                    fontWeight: FontWeight.w600,
                                                                    color: statusColor,
                                                                  ),
                                                                ),
                                                              ],
                                                            ),
                                                          ),
                                                          Text.rich(
                                                            TextSpan(
                                                              text: 'Còn trống: ',
                                                              style: const TextStyle(
                                                                fontSize: 11,
                                                                color: Colors.white70,
                                                              ),
                                                              children: [
                                                                TextSpan(
                                                                  text: Formatters.formatFileSize(d.availableBytes),
                                                                  style: const TextStyle(
                                                                    fontSize: 11,
                                                                    fontWeight: FontWeight.bold,
                                                                    color: Color(0xFF34D399),
                                                                  ),
                                                                ),
                                                              ],
                                                            ),
                                                          ),
                                                        ],
                                                      ),
                                                    ] else ...[
                                                      const Padding(
                                                        padding: EdgeInsets.symmetric(vertical: 4),
                                                        child: Row(
                                                          children: [
                                                            Icon(Icons.link_off_rounded, size: 14, color: Color(0xFFF87171)),
                                                            SizedBox(width: 6),
                                                            Text(
                                                              'Ổ đĩa đã ngắt kết nối',
                                                              style: TextStyle(
                                                                fontSize: 11,
                                                                color: Color(0xFFF87171),
                                                              ),
                                                            ),
                                                          ],
                                                        ),
                                                      ),
                                                    ],
                                                  ],
                                                ),
                                              );
                                            },
                                          ),
                                        ],
                                      ],
                                    )
                                  : Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          mainAxisAlignment:
                                              MainAxisAlignment.spaceBetween,
                                          children: [
                                            Text(
                                              _storageInfo!.displayName,
                                              style: const TextStyle(
                                                fontSize: 12,
                                                fontWeight: FontWeight.bold,
                                                color: Colors.white,
                                              ),
                                            ),
                                            Text(
                                              '${_storageInfo!.usedPercent.round()}%',
                                              style: const TextStyle(
                                                fontSize: 12,
                                                fontWeight: FontWeight.bold,
                                                color: AppTheme.googleBlue,
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 6),
                                        ClipRRect(
                                          borderRadius: BorderRadius.circular(4),
                                          child: LinearProgressIndicator(
                                            value: (
                                              _storageInfo!.usedPercent / 100
                                            ).clamp(0.0, 1.0),
                                            minHeight: 6,
                                            backgroundColor: AppTheme.bgBlock,
                                            valueColor:
                                                const AlwaysStoppedAnimation<Color>(
                                                  AppTheme.googleBlue,
                                                ),
                                          ),
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          '${Formatters.formatFileSize(_storageInfo!.usedBytes)} / ${Formatters.formatFileSize(_storageInfo!.totalBytes)} đã dùng • ${Formatters.formatFileSize(_storageInfo!.availableBytes)} còn trống',
                                          style: const TextStyle(
                                            fontSize: 11,
                                            color: Colors.white54,
                                          ),
                                        ),
                                      ],
                                    )
                            else
                              Text(
                                _isConnected
                                    ? 'Đang chờ Storage local kết nối...'
                                    : 'Chưa kết nối máy chủ Coordinator.',
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: Colors.white38,
                                ),
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),

                      if (_errorMessage != null) ...[
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: Colors.red.withValues(alpha: 0.1),
                            border: Border.all(
                              color: Colors.red.withValues(alpha: 0.3),
                            ),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            _errorMessage!,
                            style: const TextStyle(
                              color: Colors.redAccent,
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                      ],

                      // ================= 1. CẤU HÌNH MÁY CHỦ =================
                      _buildAccordionSection(
                        isOpen: _openSection1,
                        onToggle:
                            () =>
                                setState(() => _openSection1 = !_openSection1),
                        icon: Icons.wifi_rounded,
                        iconColor: AppTheme.googleBlue,
                        title: '1. Kết nối Máy Chủ',
                        trailing: serverStatusTrailing,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: TextField(
                                controller: _hostController,
                                textInputAction: TextInputAction.done,
                                onSubmitted:
                                    (_) =>
                                        FocusManager.instance.primaryFocus
                                            ?.unfocus(),
                                onChanged: (_) => setState(() {}),
                                style: TextStyle(
                                  fontSize:
                                      _hostController.text.isNotEmpty
                                          ? 13.5
                                          : 12,
                                  color: Colors.white,
                                  fontFamily: 'monospace',
                                ),
                                decoration: InputDecoration(
                                  labelText: 'Server Host *',
                                  labelStyle: const TextStyle(
                                    fontSize: 11,
                                    color: Colors.white70,
                                  ),
                                  floatingLabelStyle: const TextStyle(
                                    fontSize: 14,
                                    color: AppTheme.googleBlue,
                                    fontWeight: FontWeight.bold,
                                  ),
                                  floatingLabelBehavior:
                                      FloatingLabelBehavior.auto,
                                  hintText:
                                      'HOANGs-MacBook-Pro.local or 192.168.1.x',
                                  hintStyle: TextStyle(
                                    fontSize: 10,
                                    color: Colors.white.withValues(alpha: 0.2),
                                  ),
                                  prefixIcon: const Icon(
                                    Icons.lan_rounded,
                                    color: AppTheme.googleBlue,
                                    size: 16,
                                  ),
                                  contentPadding: const EdgeInsets.symmetric(
                                    horizontal: 16,
                                    vertical: 12,
                                  ),
                                  isDense: true,
                                  filled: true,
                                  fillColor: AppTheme.bgInput,
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(14),
                                    borderSide: const BorderSide(
                                      color: AppTheme.borderColor,
                                    ),
                                  ),
                                  enabledBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(14),
                                    borderSide: const BorderSide(
                                      color: AppTheme.borderColor,
                                    ),
                                  ),
                                  focusedBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(14),
                                    borderSide: const BorderSide(
                                      color: AppTheme.googleBlue,
                                      width: 1.5,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 8),
                            const Padding(
                              padding: EdgeInsets.only(left: 4),
                              child: Text(
                                'Nhập hostname .local hoặc địa chỉ IP. Port và đường dẫn được cấu hình tự động.',
                                style: TextStyle(
                                  fontSize: 10,
                                  color: Colors.white38,
                                ),
                              ),
                            ),
                            const SizedBox(height: 12),

                            Align(
                              alignment: Alignment.centerRight,
                              child: ElevatedButton.icon(
                                onPressed:
                                    (_isSavingServer || _isCheckingConnection)
                                        ? null
                                        : _handleSaveServer,
                                icon:
                                    (_isSavingServer || _isCheckingConnection)
                                        ? const SizedBox(
                                          width: 14,
                                          height: 14,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            color: Colors.white,
                                          ),
                                        )
                                        : const Icon(
                                          Icons.save_rounded,
                                          size: 14,
                                        ),
                                label: Text(
                                  (_isSavingServer || _isCheckingConnection)
                                      ? 'Đang kiểm tra...'
                                      : 'Lưu & Kết nối',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppTheme.googleBlue,
                                  foregroundColor: Colors.white,
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 16,
                                    vertical: 8,
                                  ),
                                  minimumSize: Size.zero,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),

                      // ================= 2. COOKIE MXH (COLLAPSIBLE) =================
                      _buildAccordionSection(
                        isOpen: _openSection2,
                        onToggle: () {
                          final nextState = !_openSection2;
                          setState(() => _openSection2 = nextState);
                          if (nextState && !_hasAutoCheckedCookiesOnMobile) {
                            _hasAutoCheckedCookiesOnMobile = true;
                            // Independently verify each platform without waiting or blocking
                            _handleVerifyCookie();
                            _handleVerifyTiktokCookie();
                            _handleVerifyFbCookie();
                            _handleVerifyIgCookie();
                            _handleVerifyXCookie();
                          }
                        },
                        icon: Icons.cookie_rounded,
                        iconColor: Colors.amberAccent,
                        title: '2. Cookie MXH',
                        trailing: null,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // YouTube Card
                            Container(
                              decoration: BoxDecoration(
                                color: AppTheme.bgCard,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(
                                  color: AppTheme.borderColor.withValues(alpha: 0.6),
                                ),
                              ),
                              clipBehavior: Clip.antiAlias,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  // Layer 0: Platform Header Row (Clickable)
                                  InkWell(
                                    onTap: () {
                                      setState(() {
                                        _isYoutubeCardOpen = !_isYoutubeCardOpen;
                                      });
                                    },
                                    child: Padding(
                                      padding: const EdgeInsets.all(12),
                                      child: Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.spaceBetween,
                                        children: [
                                          Row(
                                            children: [
                                              Container(
                                                width: 32,
                                                height: 32,
                                                decoration: BoxDecoration(
                                                  color: Colors.red.withValues(
                                                    alpha: 0.15,
                                                  ),
                                                  shape: BoxShape.circle,
                                                  border: Border.all(
                                                    color: Colors.red.withValues(
                                                      alpha: 0.3,
                                                    ),
                                                  ),
                                                ),
                                                alignment: Alignment.center,
                                                child: SvgPicture.asset(
                                                  'assets/icons/youtube.svg',
                                                  width: 18,
                                                  height: 18,
                                                ),
                                              ),
                                              const SizedBox(width: 10),
                                              Column(
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  const Text(
                                                    'YouTube',
                                                    style: TextStyle(
                                                      fontSize: 13,
                                                      fontWeight: FontWeight.bold,
                                                      color: Colors.white,
                                                    ),
                                                  ),
                                                  if (_isVerifyingCookie) ...[
                                                    const SizedBox(height: 2),
                                                    Row(
                                                      mainAxisSize: MainAxisSize.min,
                                                      children: [
                                                        const SizedBox(
                                                          width: 9,
                                                          height: 9,
                                                          child: CircularProgressIndicator(
                                                            strokeWidth: 1.5,
                                                            color: Colors.blueAccent,
                                                          ),
                                                        ),
                                                        const SizedBox(width: 4),
                                                        Text(
                                                          'Đang kiểm tra...',
                                                          style: TextStyle(
                                                            fontSize: 10,
                                                            color: Colors.blueAccent.withValues(alpha: 0.9),
                                                            fontWeight: FontWeight.w500,
                                                          ),
                                                        ),
                                                      ],
                                                    ),
                                                  ],
                                                ],
                                              ),
                                            ],
                                          ),
                                          Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              if (!_isVerifyingCookie)
                                                _buildCookieStatusBadge(),
                                              const SizedBox(width: 6),
                                              Icon(
                                                _isYoutubeCardOpen
                                                    ? Icons.keyboard_arrow_up_rounded
                                                    : Icons.keyboard_arrow_down_rounded,
                                                color: Colors.white54,
                                                size: 20,
                                              ),
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),

                                  // Layer 1: Body Container
                                  AnimatedSize(
                                    duration: const Duration(milliseconds: 200),
                                    curve: Curves.easeInOut,
                                    alignment: Alignment.topCenter,
                                    child: _isYoutubeCardOpen
                                        ? Padding(
                                            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                const Divider(
                                                  height: 1,
                                                  color: AppTheme.borderColor,
                                                ),

                                                // Feedback message with smooth animation
                                                _buildAnimatedVerifyBanner(
                                                  message: _cookieVerifyMsg,
                                                  isSuccess: _cookieVerifySuccess,
                                                ),

                                                // Action Buttons - hidden while verifying
                                                if (!_isVerifyingCookie) ...[
                                                  const SizedBox(height: 10),
                                                  const Divider(
                                                    height: 1,
                                                    color: AppTheme.borderColor,
                                                  ),
                                                  const SizedBox(height: 10),
                                                  Row(
                                                    mainAxisAlignment: MainAxisAlignment.end,
                                                    children: [
                                                      ElevatedButton.icon(
                                                        onPressed: _handleVerifyCookie,
                                                        icon: const Icon(
                                                          Icons.refresh_rounded,
                                                          size: 13,
                                                        ),
                                                        label: const Text(
                                                          'Kiểm tra youtube.txt',
                                                          style: TextStyle(
                                                            fontSize: 11,
                                                            fontWeight: FontWeight.bold,
                                                          ),
                                                        ),
                                                        style: ElevatedButton.styleFrom(
                                                          backgroundColor: Colors.white
                                                              .withValues(alpha: 0.1),
                                                          foregroundColor: Colors.white,
                                                          padding:
                                                              const EdgeInsets.symmetric(
                                                                horizontal: 10,
                                                                vertical: 7,
                                                              ),
                                                          minimumSize: Size.zero,
                                                        ),
                                                      ),
                                                    ],
                                                  ),
                                                ],
                                              ],
                                            ),
                                          )
                                        : const SizedBox.shrink(),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 10),

                            // TikTok Card
                            _buildTikTokCard(),
                            const SizedBox(height: 10),

                            // Facebook Card
                            _buildFacebookCard(),
                            const SizedBox(height: 10),

                            // Instagram Card
                            _buildInstagramCard(),
                            const SizedBox(height: 10),

                            // X (Twitter) Card
                            _buildXCard(),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),

                      // ================= 3. DỌN DẸP BỘ NHỚ TẠM (COLLAPSIBLE) =================
                      _buildAccordionSection(
                        isOpen: _openSection3,
                        onToggle:
                            () =>
                                setState(() => _openSection3 = !_openSection3),
                        icon: Icons.storage_rounded,
                        iconColor: Colors.amberAccent,
                        title: '3. Dọn dẹp Bộ nhớ tạm',
                        trailing: null,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: AppTheme.bgCard,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: Colors.amber.withValues(alpha: 0.2),
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      const Icon(
                                        Icons.memory_rounded,
                                        size: 16,
                                        color: Colors.amberAccent,
                                      ),
                                      const SizedBox(width: 6),
                                      Expanded(
                                        child: Text(
                                          'Bộ nhớ tạm ứng dụng: ${_cacheInfo?.formattedSize ?? "Đang tính..."}',
                                          style: const TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.bold,
                                            color: Colors.amberAccent,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Bao gồm ${_cacheInfo?.fileCount ?? 0} tệp dữ liệu lưu tạm trên bộ nhớ thiết bị.',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: Colors.white70,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 12),

                            if (_cacheMsg != null) ...[
                              Padding(
                                padding: const EdgeInsets.only(
                                  left: 8,
                                  bottom: 10,
                                ),
                                child: Row(
                                  children: [
                                    Icon(
                                      _cacheMsg!.contains('không') ||
                                              _cacheMsg!.contains('Lỗi')
                                          ? Icons.error_outline_rounded
                                          : Icons.check_circle_rounded,
                                      size: 16,
                                      color:
                                          _cacheMsg!.contains('không') ||
                                                  _cacheMsg!.contains('Lỗi')
                                              ? Colors.redAccent
                                              : Colors.greenAccent,
                                    ),
                                    const SizedBox(width: 6),
                                    Expanded(
                                      child: Text(
                                        _cacheMsg!,
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                          color:
                                              _cacheMsg!.contains('không') ||
                                                      _cacheMsg!.contains('Lỗi')
                                                  ? Colors.redAccent
                                                  : Colors.greenAccent,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],

                            Align(
                              alignment: Alignment.centerRight,
                              child: ElevatedButton.icon(
                                onPressed:
                                    _isClearingCache ? null : _handleClearCache,
                                icon:
                                    _isClearingCache
                                        ? const SizedBox(
                                          width: 12,
                                          height: 12,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            color: Colors.black,
                                          ),
                                        )
                                        : const Icon(
                                          Icons.refresh_rounded,
                                          size: 14,
                                        ),
                                label: const Text(
                                  'Dọn dẹp Cache',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.amber,
                                  foregroundColor: Colors.black,
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 14,
                                    vertical: 8,
                                  ),
                                  minimumSize: Size.zero,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCookieStatusBadge([String? status]) {
    final effectiveStatus = status ?? _cookieStatus;
    Color bg;
    Color border;
    Color text;
    Widget icon;
    String label;

    switch (effectiveStatus) {
      case 'valid':
        bg = Colors.green.withValues(alpha: 0.15);
        border = Colors.greenAccent.withValues(alpha: 0.4);
        text = Colors.greenAccent;
        icon = const Icon(
          Icons.check_rounded,
          size: 11,
          color: Colors.greenAccent,
        );
        label = 'Hợp lệ';
        break;
      case 'expired':
        bg = Colors.red.withValues(alpha: 0.15);
        border = Colors.redAccent.withValues(alpha: 0.4);
        text = Colors.redAccent;
        icon = const Icon(
          Icons.error_outline_rounded,
          size: 11,
          color: Colors.redAccent,
        );
        label = 'Hết hạn / Lỗi';
        break;
      case 'loading':
        bg = Colors.blue.withValues(alpha: 0.15);
        border = Colors.blueAccent.withValues(alpha: 0.4);
        text = Colors.blueAccent;
        icon = const SizedBox(
          width: 9,
          height: 9,
          child: CircularProgressIndicator(
            strokeWidth: 1.5,
            color: Colors.blueAccent,
          ),
        );
        label = 'Đang tải...';
        break;
      default:
        bg = Colors.white.withValues(alpha: 0.08);
        border = Colors.white.withValues(alpha: 0.15);
        text = Colors.white54;
        icon = const SizedBox.shrink();
        label = 'Chưa có cookie';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (effectiveStatus != 'none') ...[icon, const SizedBox(width: 4)],
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.bold,
              color: text,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAnimatedVerifyBanner({
    required String? message,
    required bool isSuccess,
  }) {
    return AnimatedSize(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOutCubic,
      alignment: Alignment.topCenter,
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 300),
        switchInCurve: Curves.easeOutCubic,
        switchOutCurve: Curves.easeInCubic,
        transitionBuilder: (child, animation) {
          return FadeTransition(
            opacity: animation,
            child: SizeTransition(
              sizeFactor: animation,
              alignment: Alignment.topCenter,
              child: child,
            ),
          );
        },
        child: message != null
            ? Padding(
                key: ValueKey<String>(message),
                padding: const EdgeInsets.only(top: 10),
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: isSuccess
                        ? Colors.green.withValues(alpha: 0.1)
                        : Colors.red.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: isSuccess
                          ? Colors.green.withValues(alpha: 0.3)
                          : Colors.red.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        isSuccess
                            ? Icons.check_circle_rounded
                            : Icons.error_outline_rounded,
                        size: 14,
                        color: isSuccess
                            ? Colors.greenAccent
                            : Colors.redAccent,
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          message,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: isSuccess
                                ? Colors.greenAccent
                                : Colors.redAccent,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              )
            : const SizedBox.shrink(key: ValueKey<String>('empty')),
      ),
    );
  }

  Widget _buildTikTokCard() {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.bgCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppTheme.borderColor.withValues(alpha: 0.6),
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Platform Header Row (Clickable)
          InkWell(
            onTap: () {
              setState(() {
                _isTiktokCardOpen = !_isTiktokCardOpen;
              });
            },
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: Colors.cyanAccent.withValues(alpha: 0.15),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: Colors.cyanAccent.withValues(alpha: 0.3),
                          ),
                        ),
                        alignment: Alignment.center,
                        child: SvgPicture.asset(
                          'assets/icons/tiktok.svg',
                          width: 16,
                          height: 16,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text(
                            'TikTok',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                          if (_isVerifyingTiktokCookie) ...[
                            const SizedBox(height: 2),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const SizedBox(
                                  width: 9,
                                  height: 9,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 1.5,
                                    color: Colors.blueAccent,
                                  ),
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  'Đang kiểm tra...',
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: Colors.blueAccent.withValues(alpha: 0.9),
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (!_isVerifyingTiktokCookie)
                        _buildCookieStatusBadge(_tiktokCookieStatus),
                      const SizedBox(width: 6),
                      Icon(
                        _isTiktokCardOpen
                            ? Icons.keyboard_arrow_up_rounded
                            : Icons.keyboard_arrow_down_rounded,
                        color: Colors.white54,
                        size: 20,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          // Body Container
          AnimatedSize(
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeInOut,
            alignment: Alignment.topCenter,
            child: _isTiktokCardOpen
                ? Padding(
                    padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Divider(
                          height: 1,
                          color: AppTheme.borderColor,
                        ),

                        // Feedback message with smooth animation
                        _buildAnimatedVerifyBanner(
                          message: _tiktokCookieVerifyMsg,
                          isSuccess: _tiktokCookieVerifySuccess,
                        ),

                        // Action Buttons - hidden while verifying
                        if (!_isVerifyingTiktokCookie) ...[
                          const SizedBox(height: 10),
                          const Divider(
                            height: 1,
                            color: AppTheme.borderColor,
                          ),
                          const SizedBox(height: 10),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              ElevatedButton.icon(
                                onPressed: _handleVerifyTiktokCookie,
                                icon: const Icon(
                                  Icons.refresh_rounded,
                                  size: 13,
                                ),
                                label: const Text(
                                  'Kiểm tra tiktok.txt',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.white
                                      .withValues(alpha: 0.1),
                                  foregroundColor: Colors.white,
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 7,
                                  ),
                                  minimumSize: Size.zero,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }

  Widget _buildFacebookCard() {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.bgCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppTheme.borderColor.withValues(alpha: 0.6),
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Platform Header Row (Clickable)
          InkWell(
            onTap: () {
              setState(() {
                _isFbCardOpen = !_isFbCardOpen;
              });
            },
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: const Color(0xFF1877F2).withValues(alpha: 0.15),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: const Color(0xFF1877F2).withValues(alpha: 0.3),
                          ),
                        ),
                        alignment: Alignment.center,
                        child: SvgPicture.asset(
                          'assets/icons/facebook.svg',
                          width: 16,
                          height: 16,
                          colorFilter: const ColorFilter.mode(
                            Color(0xFF1877F2),
                            BlendMode.srcIn,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text(
                            'Facebook',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                          if (_isVerifyingFbCookie) ...[
                            const SizedBox(height: 2),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const SizedBox(
                                  width: 9,
                                  height: 9,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 1.5,
                                    color: Colors.blueAccent,
                                  ),
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  'Đang kiểm tra...',
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: Colors.blueAccent.withValues(alpha: 0.9),
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (!_isVerifyingFbCookie)
                        _buildCookieStatusBadge(_fbCookieStatus),
                      const SizedBox(width: 6),
                      Icon(
                        _isFbCardOpen
                            ? Icons.keyboard_arrow_up_rounded
                            : Icons.keyboard_arrow_down_rounded,
                        color: Colors.white54,
                        size: 20,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          // Body Container
          AnimatedSize(
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeInOut,
            alignment: Alignment.topCenter,
            child: _isFbCardOpen
                ? Padding(
                    padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Divider(
                          height: 1,
                          color: AppTheme.borderColor,
                        ),

                        // Feedback message with smooth animation
                        _buildAnimatedVerifyBanner(
                          message: _fbCookieVerifyMsg,
                          isSuccess: _fbCookieVerifySuccess,
                        ),

                        // Action Buttons - hidden while verifying
                        if (!_isVerifyingFbCookie) ...[
                          const SizedBox(height: 10),
                          const Divider(
                            height: 1,
                            color: AppTheme.borderColor,
                          ),
                          const SizedBox(height: 10),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              ElevatedButton.icon(
                                onPressed: _handleVerifyFbCookie,
                                icon: const Icon(
                                  Icons.refresh_rounded,
                                  size: 13,
                                ),
                                label: const Text(
                                  'Kiểm tra facebook.txt',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.white
                                      .withValues(alpha: 0.1),
                                  foregroundColor: Colors.white,
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 7,
                                  ),
                                  minimumSize: Size.zero,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }

  Widget _buildInstagramCard() {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.bgCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppTheme.borderColor.withValues(alpha: 0.6),
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Platform Header Row (Clickable)
          InkWell(
            onTap: () {
              setState(() {
                _isIgCardOpen = !_isIgCardOpen;
              });
            },
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: const Color(0xFFE1306C).withValues(alpha: 0.15),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: const Color(0xFFE1306C).withValues(alpha: 0.3),
                          ),
                        ),
                        alignment: Alignment.center,
                        child: SvgPicture.asset(
                          'assets/icons/instagram.svg',
                          width: 16,
                          height: 16,
                          colorFilter: const ColorFilter.mode(
                            Color(0xFFE1306C),
                            BlendMode.srcIn,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text(
                            'Instagram',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                          if (_isVerifyingIgCookie) ...[
                            const SizedBox(height: 2),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const SizedBox(
                                  width: 9,
                                  height: 9,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 1.5,
                                    color: Colors.blueAccent,
                                  ),
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  'Đang kiểm tra...',
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: Colors.blueAccent.withValues(alpha: 0.9),
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (!_isVerifyingIgCookie)
                        _buildCookieStatusBadge(_igCookieStatus),
                      const SizedBox(width: 6),
                      Icon(
                        _isIgCardOpen
                            ? Icons.keyboard_arrow_up_rounded
                            : Icons.keyboard_arrow_down_rounded,
                        color: Colors.white54,
                        size: 20,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          // Body Container
          AnimatedSize(
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeInOut,
            alignment: Alignment.topCenter,
            child: _isIgCardOpen
                ? Padding(
                    padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Divider(
                          height: 1,
                          color: AppTheme.borderColor,
                        ),

                        // Feedback message with smooth animation
                        _buildAnimatedVerifyBanner(
                          message: _igCookieVerifyMsg,
                          isSuccess: _igCookieVerifySuccess,
                        ),

                        // Action Buttons - hidden while verifying
                        if (!_isVerifyingIgCookie) ...[
                          const SizedBox(height: 10),
                          const Divider(
                            height: 1,
                            color: AppTheme.borderColor,
                          ),
                          const SizedBox(height: 10),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              ElevatedButton.icon(
                                onPressed: _handleVerifyIgCookie,
                                icon: const Icon(
                                  Icons.refresh_rounded,
                                  size: 13,
                                ),
                                label: const Text(
                                  'Kiểm tra instagram.txt',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.white
                                      .withValues(alpha: 0.1),
                                  foregroundColor: Colors.white,
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 7,
                                  ),
                                  minimumSize: Size.zero,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }

  Widget _buildXCard() {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.bgCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppTheme.borderColor.withValues(alpha: 0.6),
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Platform Header Row (Clickable)
          InkWell(
            onTap: () {
              setState(() {
                _isXCardOpen = !_isXCardOpen;
              });
            },
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: const Color(0xFFE7E9EA).withValues(alpha: 0.15),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: const Color(0xFFE7E9EA).withValues(alpha: 0.3),
                          ),
                        ),
                        alignment: Alignment.center,
                        child: SvgPicture.asset(
                          'assets/icons/twitter.svg',
                          width: 15,
                          height: 15,
                          colorFilter: const ColorFilter.mode(
                            Color(0xFFE7E9EA),
                            BlendMode.srcIn,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text(
                            'X (Twitter)',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                          if (_isVerifyingXCookie) ...[
                            const SizedBox(height: 2),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const SizedBox(
                                  width: 9,
                                  height: 9,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 1.5,
                                    color: Colors.blueAccent,
                                  ),
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  'Đang kiểm tra...',
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: Colors.blueAccent.withValues(alpha: 0.9),
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (!_isVerifyingXCookie)
                        _buildCookieStatusBadge(_xCookieStatus),
                      const SizedBox(width: 6),
                      Icon(
                        _isXCardOpen
                            ? Icons.keyboard_arrow_up_rounded
                            : Icons.keyboard_arrow_down_rounded,
                        color: Colors.white54,
                        size: 20,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          // Body Container
          AnimatedSize(
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeInOut,
            alignment: Alignment.topCenter,
            child: _isXCardOpen
                ? Padding(
                    padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Divider(
                          height: 1,
                          color: AppTheme.borderColor,
                        ),

                        // Feedback message with smooth animation
                        _buildAnimatedVerifyBanner(
                          message: _xCookieVerifyMsg,
                          isSuccess: _xCookieVerifySuccess,
                        ),

                        // Action Buttons - hidden while verifying
                        if (!_isVerifyingXCookie) ...[
                          const SizedBox(height: 10),
                          const Divider(
                            height: 1,
                            color: AppTheme.borderColor,
                          ),
                          const SizedBox(height: 10),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              ElevatedButton.icon(
                                onPressed: _handleVerifyXCookie,
                                icon: const Icon(
                                  Icons.refresh_rounded,
                                  size: 13,
                                ),
                                label: const Text(
                                  'Kiểm tra x.txt',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.white
                                      .withValues(alpha: 0.1),
                                  foregroundColor: Colors.white,
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 7,
                                  ),
                                  minimumSize: Size.zero,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }

  Widget _buildAccordionSection({
    required bool isOpen,
    required VoidCallback onToggle,
    required IconData icon,
    required Color iconColor,
    required String title,
    Widget? trailing,
    required Widget child,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.bgCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.borderColor),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          InkWell(
            onTap: onToggle,
            borderRadius: BorderRadius.circular(16),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Row(
                      children: [
                        AnimatedRotation(
                          turns: isOpen ? 0.25 : 0.0,
                          duration: const Duration(milliseconds: 200),
                          curve: Curves.easeInOut,
                          child: Icon(
                            Icons.keyboard_arrow_right_rounded,
                            color: iconColor,
                            size: 22,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Icon(icon, color: iconColor, size: 20),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            title,
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: iconColor,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (trailing != null) ...[const SizedBox(width: 8), trailing],
                ],
              ),
            ),
          ),
          AnimatedSize(
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeInOut,
            alignment: Alignment.topCenter,
            child: isOpen
                ? Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Divider(height: 1, color: AppTheme.borderColor),
                      Padding(padding: const EdgeInsets.all(14), child: child),
                    ],
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }
}
