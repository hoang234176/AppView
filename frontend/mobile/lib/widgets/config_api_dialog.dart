import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../providers/settings_provider.dart';
import '../providers/app_state_provider.dart';
import '../api/api_config.dart';
import '../api/download_api.dart';
import '../api/cache_api.dart';
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
  bool _isLoadingStorage = false;
  bool _isCheckingConnection = false;
  bool _isConnected = false;

  // Collapsible Accordion States
  bool _openSection1 = false;
  bool _openSection2 = false;
  bool _openSection3 = false;

  // Social Cookies State (YouTube)
  String _cookieStatus = 'loading'; // 'loading', 'none', 'valid', 'expired'
  bool _isYoutubeCardOpen = false;
  bool _isCookieInputOpen = false;
  static const List<String> _cookieFieldKeys = [
    'LOGIN_INFO',
    'SID',
    'HSID',
    'SSID',
    'SAPISID',
    '__Secure-1PSID',
    '__Secure-3PSID',
  ];
  final Map<String, TextEditingController> _cookieControllers = {
    for (final key in _cookieFieldKeys) key: TextEditingController(),
  };
  bool _isVerifyingCookie = false;
  bool _isSavingCookie = false;
  bool _isCookieVerified = false;
  String? _cookieVerifyMsg;
  bool _cookieVerifySuccess = false;

  // Social Cookies State (TikTok)
  String _tiktokCookieStatus = 'loading'; // 'loading', 'none', 'valid', 'expired'
  bool _isTiktokCardOpen = false;
  bool _isTiktokCookieInputOpen = false;
  static const List<String> _tiktokCookieFieldKeys = [
    'sessionid',
    'sessionid_ss',
    'sid_guard',
    'tt_chain_token',
  ];
  final Map<String, TextEditingController> _tiktokCookieControllers = {
    for (final key in _tiktokCookieFieldKeys) key: TextEditingController(),
  };
  bool _isVerifyingTiktokCookie = false;
  bool _isSavingTiktokCookie = false;
  bool _isTiktokCookieVerified = false;
  String? _tiktokCookieVerifyMsg;
  bool _tiktokCookieVerifySuccess = false;

  // Social Cookies State (Facebook)
  String _fbCookieStatus = 'loading'; // 'loading', 'none', 'valid', 'expired'
  bool _isFbCardOpen = false;
  bool _isFbCookieInputOpen = false;
  static const List<String> _fbCookieFieldKeys = [
    'c_user',
    'xs',
    'datr',
    'fr',
    'sb',
    'presence',
  ];
  final Map<String, TextEditingController> _fbCookieControllers = {
    for (final key in _fbCookieFieldKeys) key: TextEditingController(),
  };
  bool _isVerifyingFbCookie = false;
  bool _isSavingFbCookie = false;
  bool _isFbCookieVerified = false;
  String? _fbCookieVerifyMsg;
  bool _fbCookieVerifySuccess = false;

  // Social Cookies State (Instagram)
  String _igCookieStatus = 'loading'; // 'loading', 'none', 'valid', 'expired'
  bool _isIgCardOpen = false;
  bool _isIgCookieInputOpen = false;
  static const List<String> _igCookieFieldKeys = [
    'sessionid',
    'ds_user_id',
    'csrftoken',
    'mid',
    'ig_did',
    'datr',
  ];
  final Map<String, TextEditingController> _igCookieControllers = {
    for (final key in _igCookieFieldKeys) key: TextEditingController(),
  };
  bool _isVerifyingIgCookie = false;
  bool _isSavingIgCookie = false;
  bool _isIgCookieVerified = false;
  String? _igCookieVerifyMsg;
  bool _igCookieVerifySuccess = false;

  CacheInfoData? _cacheInfo;

  @override
  void initState() {
    super.initState();
    final settings = context.read<SettingsProvider>();
    _hostController = TextEditingController(text: settings.serverHost);
    _loadCacheInfo();
    _fetchCookieStatus();
    _fetchTiktokCookieStatus();
    _fetchFbCookieStatus();
    _fetchIgCookieStatus();
    _checkCurrentConnectionAndLoadStorage();
  }

  @override
  void dispose() {
    _hostController.dispose();
    for (final c in _cookieControllers.values) {
      c.dispose();
    }
    for (final c in _tiktokCookieControllers.values) {
      c.dispose();
    }
    for (final c in _fbCookieControllers.values) {
      c.dispose();
    }
    for (final c in _igCookieControllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _fetchCookieStatus() async {
    setState(() {
      _cookieStatus = 'loading';
    });
    final res = await DownloadApi.getCookieStatus('youtube');
    if (!mounted) return;
    if (res['success'] == true && res['data'] is Map) {
      final data = res['data'] as Map;
      if (data['exists'] == true) {
        setState(() => _cookieStatus = 'valid');
      } else {
        setState(() => _cookieStatus = 'none');
      }
    } else {
      setState(() => _cookieStatus = 'none');
    }
  }

  Future<void> _handleVerifyCookie() async {
    setState(() {
      _isVerifyingCookie = true;
      _cookieVerifyMsg = null;
    });

    Map<String, String>? fields;
    if (_isCookieInputOpen) {
      final hasAny = _cookieControllers.values.any(
        (c) => c.text.trim().isNotEmpty,
      );
      if (!hasAny) {
        setState(() {
          _isVerifyingCookie = false;
          _cookieVerifySuccess = false;
          _cookieVerifyMsg = 'Vui lòng nhập ít nhất một token cookie.';
        });
        return;
      }
      fields = _cookieControllers.map((k, v) => MapEntry(k, v.text.trim()));
    }

    final res = await DownloadApi.verifyCookies(
      platform: 'youtube',
      fields: fields,
    );
    if (!mounted) return;

    setState(() {
      _isVerifyingCookie = false;
      if (res['success'] == true &&
          res['data'] is Map &&
          res['data']['valid'] == true) {
        _isCookieVerified = true;
        _cookieStatus = 'valid';
        _cookieVerifySuccess = true;
        _cookieVerifyMsg =
            res['data']['message']?.toString() ?? '✓ Cookie hợp lệ!';
      } else {
        _isCookieVerified = false;
        if (!_isCookieInputOpen) {
          _cookieStatus = 'expired';
        }
        _cookieVerifySuccess = false;
        final msg =
            res['data'] is Map ? res['data']['message']?.toString() : null;
        _cookieVerifyMsg =
            msg ??
            res['message']?.toString() ??
            'Cookie không hợp lệ hoặc đã hết hạn.';
      }
    });
  }

  Future<void> _handleSaveCookie() async {
    if (!_isCookieVerified || _isSavingCookie) return;
    setState(() {
      _isSavingCookie = true;
      _cookieVerifyMsg = null;
    });

    final fields = _cookieControllers.map(
      (k, v) => MapEntry(k, v.text.trim()),
    );
    final res = await DownloadApi.saveCookies(
      platform: 'youtube',
      fields: fields,
    );
    if (!mounted) return;

    setState(() {
      _isSavingCookie = false;
      if (res['success'] == true) {
        _isCookieInputOpen = false;
        _isCookieVerified = false;
        _cookieStatus = 'valid';
        _cookieVerifySuccess = true;
        _cookieVerifyMsg = 'Đã lưu cookie thành công!';
        AppToast.showSuccess(context, 'Đã lưu cookie YouTube thành công!');
      } else {
        _cookieVerifySuccess = false;
        _cookieVerifyMsg =
            res['message']?.toString() ?? 'Không thể lưu cookie.';
        AppToast.showError(context, _cookieVerifyMsg!);
      }
    });
  }

  Future<void> _fetchTiktokCookieStatus() async {
    setState(() {
      _tiktokCookieStatus = 'loading';
    });
    final res = await DownloadApi.getCookieStatus('tiktok');
    if (!mounted) return;
    if (res['success'] == true && res['data'] is Map) {
      final data = res['data'] as Map;
      if (data['exists'] == true) {
        setState(() => _tiktokCookieStatus = 'valid');
      } else {
        setState(() => _tiktokCookieStatus = 'none');
      }
    } else {
      setState(() => _tiktokCookieStatus = 'none');
    }
  }

  Future<void> _handleVerifyTiktokCookie() async {
    setState(() {
      _isVerifyingTiktokCookie = true;
      _tiktokCookieVerifyMsg = null;
    });

    Map<String, String>? fields;

    if (_isTiktokCookieInputOpen) {
      final hasAny = _tiktokCookieControllers.values.any(
        (c) => c.text.trim().isNotEmpty,
      );
      if (!hasAny) {
        setState(() {
          _isVerifyingTiktokCookie = false;
          _tiktokCookieVerifySuccess = false;
          _tiktokCookieVerifyMsg =
              'Vui lòng nhập ít nhất một token cookie (khuyên dùng sessionid).';
        });
        return;
      }
      fields = _tiktokCookieControllers.map(
        (k, v) => MapEntry(k, v.text.trim()),
      );
    }

    final res = await DownloadApi.verifyCookies(
      platform: 'tiktok',
      fields: fields,
    );
    if (!mounted) return;

    setState(() {
      _isVerifyingTiktokCookie = false;
      if (res['success'] == true &&
          res['data'] is Map &&
          res['data']['valid'] == true) {
        _isTiktokCookieVerified = true;
        _tiktokCookieStatus = 'valid';
        _tiktokCookieVerifySuccess = true;
        _tiktokCookieVerifyMsg =
            res['data']['message']?.toString() ?? '✓ Cookie hợp lệ!';
      } else {
        _isTiktokCookieVerified = false;
        if (!_isTiktokCookieInputOpen) {
          _tiktokCookieStatus = 'expired';
        }
        _tiktokCookieVerifySuccess = false;
        final msg =
            res['data'] is Map ? res['data']['message']?.toString() : null;
        _tiktokCookieVerifyMsg =
            msg ??
            res['message']?.toString() ??
            'Cookie không hợp lệ hoặc đã hết hạn.';
      }
    });
  }

  Future<void> _handleSaveTiktokCookie() async {
    if (!_isTiktokCookieVerified || _isSavingTiktokCookie) return;
    setState(() {
      _isSavingTiktokCookie = true;
      _tiktokCookieVerifyMsg = null;
    });

    final fields = _tiktokCookieControllers.map(
      (k, v) => MapEntry(k, v.text.trim()),
    );

    final res = await DownloadApi.saveCookies(
      platform: 'tiktok',
      fields: fields,
    );
    if (!mounted) return;

    setState(() {
      _isSavingTiktokCookie = false;
      if (res['success'] == true) {
        _isTiktokCookieInputOpen = false;
        _isTiktokCookieVerified = false;
        _tiktokCookieStatus = 'valid';
        _tiktokCookieVerifySuccess = true;
        _tiktokCookieVerifyMsg = 'Đã lưu cookie thành công!';
        AppToast.showSuccess(context, 'Đã lưu cookie TikTok thành công!');
      } else {
        _tiktokCookieVerifySuccess = false;
        _tiktokCookieVerifyMsg =
            res['message']?.toString() ?? 'Không thể lưu cookie.';
        AppToast.showError(context, _tiktokCookieVerifyMsg!);
      }
    });
  }

  Future<void> _fetchFbCookieStatus() async {
    setState(() {
      _fbCookieStatus = 'loading';
    });
    final res = await DownloadApi.getCookieStatus('facebook');
    if (!mounted) return;
    if (res['success'] == true && res['data'] is Map) {
      final data = res['data'] as Map;
      if (data['exists'] == true) {
        setState(() => _fbCookieStatus = 'valid');
      } else {
        setState(() => _fbCookieStatus = 'none');
      }
    } else {
      setState(() => _fbCookieStatus = 'none');
    }
  }

  Future<void> _handleVerifyFbCookie() async {
    setState(() {
      _isVerifyingFbCookie = true;
      _fbCookieVerifyMsg = null;
    });

    Map<String, String>? fields;

    if (_isFbCookieInputOpen) {
      final hasAny = _fbCookieControllers.values.any(
        (c) => c.text.trim().isNotEmpty,
      );
      if (!hasAny) {
        setState(() {
          _isVerifyingFbCookie = false;
          _fbCookieVerifySuccess = false;
          _fbCookieVerifyMsg =
              'Vui lòng nhập ít nhất c_user và xs từ cookie Facebook.';
        });
        return;
      }
      fields = _fbCookieControllers.map(
        (k, v) => MapEntry(k, v.text.trim()),
      );
    }

    final res = await DownloadApi.verifyCookies(
      platform: 'facebook',
      fields: fields,
    );
    if (!mounted) return;

    setState(() {
      _isVerifyingFbCookie = false;
      if (res['success'] == true &&
          res['data'] is Map &&
          res['data']['valid'] == true) {
        _isFbCookieVerified = true;
        _fbCookieStatus = 'valid';
        _fbCookieVerifySuccess = true;
        _fbCookieVerifyMsg =
            res['data']['message']?.toString() ?? '✓ Cookie Facebook hợp lệ!';
      } else {
        _isFbCookieVerified = false;
        if (!_isFbCookieInputOpen) {
          _fbCookieStatus = 'expired';
        }
        _fbCookieVerifySuccess = false;
        final msg =
            res['data'] is Map ? res['data']['message']?.toString() : null;
        _fbCookieVerifyMsg =
            msg ??
            res['message']?.toString() ??
            'Cookie không hợp lệ hoặc đã hết hạn.';
      }
    });
  }

  Future<void> _handleSaveFbCookie() async {
    if (!_isFbCookieVerified || _isSavingFbCookie) return;
    setState(() {
      _isSavingFbCookie = true;
      _fbCookieVerifyMsg = null;
    });

    final fields = _fbCookieControllers.map(
      (k, v) => MapEntry(k, v.text.trim()),
    );

    final res = await DownloadApi.saveCookies(
      platform: 'facebook',
      fields: fields,
    );
    if (!mounted) return;

    setState(() {
      _isSavingFbCookie = false;
      if (res['success'] == true) {
        _isFbCookieInputOpen = false;
        _isFbCookieVerified = false;
        _fbCookieStatus = 'valid';
        _fbCookieVerifySuccess = true;
        _fbCookieVerifyMsg = 'Đã lưu cookie thành công!';
        AppToast.showSuccess(context, 'Đã lưu cookie Facebook thành công!');
      } else {
        _fbCookieVerifySuccess = false;
        _fbCookieVerifyMsg =
            res['message']?.toString() ?? 'Không thể lưu cookie.';
        AppToast.showError(context, _fbCookieVerifyMsg!);
      }
    });
  }

  Future<void> _fetchIgCookieStatus() async {
    setState(() {
      _igCookieStatus = 'loading';
    });
    final res = await DownloadApi.getCookieStatus('instagram');
    if (!mounted) return;
    if (res['success'] == true && res['data'] is Map) {
      final data = res['data'] as Map;
      if (data['exists'] == true) {
        setState(() => _igCookieStatus = 'valid');
      } else {
        setState(() => _igCookieStatus = 'none');
      }
    } else {
      setState(() => _igCookieStatus = 'none');
    }
  }

  Future<void> _handleVerifyIgCookie() async {
    setState(() {
      _isVerifyingIgCookie = true;
      _igCookieVerifyMsg = null;
    });

    Map<String, String>? fields;

    if (_isIgCookieInputOpen) {
      final hasAny = _igCookieControllers.values.any(
        (c) => c.text.trim().isNotEmpty,
      );
      if (!hasAny) {
        setState(() {
          _isVerifyingIgCookie = false;
          _igCookieVerifySuccess = false;
          _igCookieVerifyMsg =
              'Vui lòng nhập ít nhất sessionid và ds_user_id từ cookie Instagram.';
        });
        return;
      }
      fields = _igCookieControllers.map(
        (k, v) => MapEntry(k, v.text.trim()),
      );
    }

    final res = await DownloadApi.verifyCookies(
      platform: 'instagram',
      fields: fields,
    );
    if (!mounted) return;

    setState(() {
      _isVerifyingIgCookie = false;
      if (res['success'] == true &&
          res['data'] is Map &&
          res['data']['valid'] == true) {
        _isIgCookieVerified = true;
        _igCookieStatus = 'valid';
        _igCookieVerifySuccess = true;
        _igCookieVerifyMsg =
            res['data']['message']?.toString() ?? '✓ Cookie Instagram hợp lệ!';
      } else {
        _isIgCookieVerified = false;
        if (!_isIgCookieInputOpen) {
          _igCookieStatus = 'expired';
        }
        _igCookieVerifySuccess = false;
        final msg =
            res['data'] is Map ? res['data']['message']?.toString() : null;
        _igCookieVerifyMsg =
            msg ??
            res['message']?.toString() ??
            'Cookie không hợp lệ hoặc đã hết hạn.';
      }
    });
  }

  Future<void> _handleSaveIgCookie() async {
    if (!_isIgCookieVerified || _isSavingIgCookie) return;
    setState(() {
      _isSavingIgCookie = true;
      _igCookieVerifyMsg = null;
    });

    final fields = _igCookieControllers.map(
      (k, v) => MapEntry(k, v.text.trim()),
    );

    final res = await DownloadApi.saveCookies(
      platform: 'instagram',
      fields: fields,
    );
    if (!mounted) return;

    setState(() {
      _isSavingIgCookie = false;
      if (res['success'] == true) {
        _isIgCookieInputOpen = false;
        _isIgCookieVerified = false;
        _igCookieStatus = 'valid';
        _igCookieVerifySuccess = true;
        _igCookieVerifyMsg = 'Đã lưu cookie thành công!';
        AppToast.showSuccess(context, 'Đã lưu cookie Instagram thành công!');
      } else {
        _igCookieVerifySuccess = false;
        _igCookieVerifyMsg =
            res['message']?.toString() ?? 'Không thể lưu cookie.';
        AppToast.showError(context, _igCookieVerifyMsg!);
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
      _fetchCookieStatus();
      _fetchTiktokCookieStatus();
      _fetchFbCookieStatus();
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
        _fetchCookieStatus();
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
                                  Icons.dns_rounded,
                                  size: 16,
                                  color: AppTheme.googleBlue,
                                ),
                                SizedBox(width: 6),
                                Text(
                                  'Storage',
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
                              Column(
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
                        onToggle:
                            () =>
                                setState(() => _openSection2 = !_openSection2),
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
                                              const Text(
                                                'YouTube',
                                                style: TextStyle(
                                                  fontSize: 13,
                                                  fontWeight: FontWeight.bold,
                                                  color: Colors.white,
                                                ),
                                              ),
                                            ],
                                          ),
                                          Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
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

                                                // Layer 2: Sliding Input Container
                                                AnimatedSize(
                                                  duration: const Duration(milliseconds: 200),
                                                  curve: Curves.easeInOut,
                                                  alignment: Alignment.topCenter,
                                                  child:
                                                      _isCookieInputOpen
                                                          ? Padding(
                                                            padding: const EdgeInsets.only(
                                                              top: 12,
                                                            ),
                                                            child: Column(
                                                              crossAxisAlignment:
                                                                  CrossAxisAlignment.start,
                                                              children: [
                                                                const Text(
                                                                  'Nhập các giá trị cookie từ tài khoản YouTube của bạn:',
                                                                  style: TextStyle(
                                                                    fontSize: 11,
                                                                    color: Colors.white70,
                                                                  ),
                                                                ),
                                                                const SizedBox(height: 10),
                                                                ..._cookieFieldKeys.map((
                                                                  key,
                                                                ) {
                                                                  return Padding(
                                                                    padding:
                                                                        const EdgeInsets.only(
                                                                          bottom: 8,
                                                                        ),
                                                                    child: Column(
                                                                      crossAxisAlignment:
                                                                          CrossAxisAlignment
                                                                              .start,
                                                                      children: [
                                                                        Text(
                                                                          key,
                                                                          style:
                                                                              const TextStyle(
                                                                                fontSize: 10,
                                                                                fontFamily:
                                                                                    'monospace',
                                                                                color:
                                                                                    Colors
                                                                                        .white60,
                                                                                fontWeight:
                                                                                    FontWeight
                                                                                        .w600,
                                                                              ),
                                                                        ),
                                                                        const SizedBox(
                                                                          height: 4,
                                                                        ),
                                                                        TextField(
                                                                          controller:
                                                                              _cookieControllers[key],
                                                                          onChanged: (_) {
                                                                            if (_isCookieVerified ||
                                                                                _cookieVerifyMsg !=
                                                                                    null) {
                                                                              setState(() {
                                                                                _isCookieVerified =
                                                                                    false;
                                                                                _cookieVerifyMsg =
                                                                                    null;
                                                                              });
                                                                            }
                                                                          },
                                                                          style:
                                                                              const TextStyle(
                                                                                fontSize: 11,
                                                                                color:
                                                                                    Colors
                                                                                        .white,
                                                                                fontFamily:
                                                                                    'monospace',
                                                                              ),
                                                                          decoration:
                                                                              InputDecoration(
                                                                                hintText:
                                                                                    'Nhập $key',
                                                                                hintStyle:
                                                                                    TextStyle(
                                                                                      fontSize:
                                                                                          10,
                                                                                      color: Colors
                                                                                          .white
                                                                                          .withValues(
                                                                                            alpha:
                                                                                                0.2,
                                                                                          ),
                                                                                    ),
                                                                                contentPadding:
                                                                                    const EdgeInsets
                                                                                        .symmetric(
                                                                                      horizontal:
                                                                                          12,
                                                                                      vertical:
                                                                                          10,
                                                                                    ),
                                                                                isDense: true,
                                                                                filled: true,
                                                                                fillColor:
                                                                                    AppTheme
                                                                                        .bgInput,
                                                                                border: OutlineInputBorder(
                                                                                  borderRadius:
                                                                                      BorderRadius.circular(
                                                                                        14,
                                                                                      ),
                                                                                  borderSide: const BorderSide(
                                                                                    color:
                                                                                        AppTheme
                                                                                            .borderColor,
                                                                                  ),
                                                                                ),
                                                                                enabledBorder: OutlineInputBorder(
                                                                                  borderRadius:
                                                                                      BorderRadius.circular(
                                                                                        14,
                                                                                      ),
                                                                                  borderSide: const BorderSide(
                                                                                    color:
                                                                                        AppTheme
                                                                                            .borderColor,
                                                                                  ),
                                                                                ),
                                                                                focusedBorder: OutlineInputBorder(
                                                                                  borderRadius:
                                                                                      BorderRadius.circular(
                                                                                        14,
                                                                                      ),
                                                                                  borderSide: const BorderSide(
                                                                                    color:
                                                                                        Colors
                                                                                            .redAccent,
                                                                                    width: 1.5,
                                                                                  ),
                                                                                ),
                                                                                suffixIconConstraints:
                                                                                    const BoxConstraints(
                                                                                  minWidth: 0,
                                                                                  minHeight: 0,
                                                                                ),
                                                                                suffixIcon:
                                                                                    Padding(
                                                                                  padding:
                                                                                      const EdgeInsets.only(right: 6),
                                                                                  child: Row(
                                                                                    mainAxisSize:
                                                                                        MainAxisSize
                                                                                            .min,
                                                                                    children: [
                                                                                      if ((_cookieControllers[key]?.text.isNotEmpty ?? false))
                                                                                        IconButton(
                                                                                          icon: const Icon(
                                                                                            Icons.clear_rounded,
                                                                                            size: 15,
                                                                                          ),
                                                                                          color: Colors.white54,
                                                                                          splashRadius: 14,
                                                                                          padding: EdgeInsets.zero,
                                                                                          constraints: const BoxConstraints(
                                                                                            minWidth: 26,
                                                                                            minHeight: 26,
                                                                                          ),
                                                                                          tooltip: 'Xóa',
                                                                                          onPressed: () {
                                                                                            setState(() {
                                                                                              _cookieControllers[key]?.clear();
                                                                                              _isCookieVerified = false;
                                                                                              _cookieVerifyMsg = null;
                                                                                            });
                                                                                          },
                                                                                        ),
                                                                                      Material(
                                                                                        color: Colors.redAccent.withValues(alpha: 0.10),
                                                                                        borderRadius: BorderRadius.circular(6),
                                                                                        child: InkWell(
                                                                                          onTap: () async {
                                                                                            final data = await Clipboard.getData(Clipboard.kTextPlain);
                                                                                            if (data?.text != null && data!.text!.trim().isNotEmpty) {
                                                                                              setState(() {
                                                                                                _cookieControllers[key]?.text = data.text!.trim();
                                                                                                _isCookieVerified = false;
                                                                                                _cookieVerifyMsg = null;
                                                                                              });
                                                                                            }
                                                                                          },
                                                                                          borderRadius: BorderRadius.circular(6),
                                                                                          child: Container(
                                                                                            padding: const EdgeInsets.all(5),
                                                                                            decoration: BoxDecoration(
                                                                                              borderRadius: BorderRadius.circular(6),
                                                                                              border: Border.all(
                                                                                                color: Colors.redAccent.withValues(alpha: 0.30),
                                                                                              ),
                                                                                            ),
                                                                                            child: const Icon(
                                                                                              Icons.content_paste_rounded,
                                                                                              size: 13,
                                                                                              color: Colors.redAccent,
                                                                                            ),
                                                                                          ),
                                                                                        ),
                                                                                      ),
                                                                                    ],
                                                                                  ),
                                                                                ),
                                                                              ),
                                                                        ),
                                                                      ],
                                                                    ),
                                                                  );
                                                                }),
                                                              ],
                                                            ),
                                                          )
                                                          : const SizedBox.shrink(),
                                                ),

                                                // Feedback message
                                                if (_cookieVerifyMsg != null) ...[
                                                  const SizedBox(height: 10),
                                                  Container(
                                                    padding: const EdgeInsets.all(8),
                                                    decoration: BoxDecoration(
                                                      color:
                                                          _cookieVerifySuccess
                                                              ? Colors.green.withValues(
                                                                alpha: 0.1,
                                                              )
                                                              : Colors.red.withValues(
                                                                alpha: 0.1,
                                                              ),
                                                      borderRadius: BorderRadius.circular(8),
                                                      border: Border.all(
                                                        color:
                                                            _cookieVerifySuccess
                                                                ? Colors.green.withValues(
                                                                  alpha: 0.3,
                                                                )
                                                                : Colors.red.withValues(
                                                                  alpha: 0.3,
                                                                ),
                                                      ),
                                                    ),
                                                    child: Row(
                                                      children: [
                                                        Icon(
                                                          _cookieVerifySuccess
                                                              ? Icons.check_circle_rounded
                                                              : Icons.error_outline_rounded,
                                                          size: 14,
                                                          color:
                                                              _cookieVerifySuccess
                                                                  ? Colors.greenAccent
                                                                  : Colors.redAccent,
                                                        ),
                                                        const SizedBox(width: 6),
                                                        Expanded(
                                                          child: Text(
                                                            _cookieVerifyMsg!,
                                                            style: TextStyle(
                                                              fontSize: 11,
                                                              fontWeight: FontWeight.w600,
                                                              color:
                                                                  _cookieVerifySuccess
                                                                      ? Colors.greenAccent
                                                                      : Colors.redAccent,
                                                            ),
                                                          ),
                                                        ),
                                                      ],
                                                    ),
                                                  ),
                                                ],

                                                const SizedBox(height: 10),
                                                const Divider(
                                                  height: 1,
                                                  color: AppTheme.borderColor,
                                                ),
                                                const SizedBox(height: 10),

                                                // Action Buttons
                                                Row(
                                                  mainAxisAlignment:
                                                      MainAxisAlignment.spaceBetween,
                                                  children: [
                                                    if (_isCookieInputOpen)
                                                      TextButton(
                                                        onPressed: () {
                                                          setState(() {
                                                            _isCookieInputOpen = false;
                                                            _isCookieVerified = false;
                                                            _cookieVerifyMsg = null;
                                                          });
                                                        },
                                                        style: TextButton.styleFrom(
                                                          padding: const EdgeInsets.symmetric(
                                                            horizontal: 10,
                                                            vertical: 6,
                                                          ),
                                                          minimumSize: Size.zero,
                                                        ),
                                                        child: const Text(
                                                          'Hủy',
                                                          style: TextStyle(
                                                            fontSize: 11,
                                                            fontWeight: FontWeight.w600,
                                                            color: Colors.white60,
                                                          ),
                                                        ),
                                                      )
                                                    else
                                                      const SizedBox.shrink(),
                                                    Row(
                                                      mainAxisSize: MainAxisSize.min,
                                                      children: [
                                                        ElevatedButton.icon(
                                                          onPressed:
                                                              _isVerifyingCookie
                                                                  ? null
                                                                  : _handleVerifyCookie,
                                                          icon:
                                                              _isVerifyingCookie
                                                                  ? const SizedBox(
                                                                    width: 12,
                                                                    height: 12,
                                                                    child: CircularProgressIndicator(
                                                                      strokeWidth: 2,
                                                                      color: Colors.white,
                                                                    ),
                                                                  )
                                                                  : const Icon(
                                                                    Icons.refresh_rounded,
                                                                    size: 13,
                                                                  ),
                                                          label: Text(
                                                            _isVerifyingCookie
                                                                ? 'Đang kiểm tra...'
                                                                : 'Kiểm tra cookie',
                                                            style: const TextStyle(
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
                                                        const SizedBox(width: 8),
                                                        if (_isCookieInputOpen)
                                                          ElevatedButton.icon(
                                                            onPressed:
                                                                (!_isCookieVerified ||
                                                                        _isSavingCookie)
                                                                    ? null
                                                                    : _handleSaveCookie,
                                                            icon:
                                                                _isSavingCookie
                                                                    ? const SizedBox(
                                                                      width: 12,
                                                                      height: 12,
                                                                      child: CircularProgressIndicator(
                                                                        strokeWidth: 2,
                                                                        color: Colors.white,
                                                                      ),
                                                                    )
                                                                    : const Icon(
                                                                      Icons.check_rounded,
                                                                      size: 13,
                                                                    ),
                                                            label: Text(
                                                              _isSavingCookie
                                                                  ? 'Đang lưu...'
                                                                  : 'Lưu cookie',
                                                              style: const TextStyle(
                                                                fontSize: 11,
                                                                fontWeight: FontWeight.bold,
                                                              ),
                                                            ),
                                                            style: ElevatedButton.styleFrom(
                                                              backgroundColor:
                                                                  _isCookieVerified
                                                                      ? Colors.redAccent
                                                                      : Colors.white12,
                                                              foregroundColor:
                                                                  _isCookieVerified
                                                                      ? Colors.white
                                                                      : Colors.white38,
                                                              disabledBackgroundColor:
                                                                  Colors.white10,
                                                              disabledForegroundColor:
                                                                  Colors.white24,
                                                              padding:
                                                                  const EdgeInsets.symmetric(
                                                                    horizontal: 12,
                                                                    vertical: 7,
                                                                  ),
                                                              minimumSize: Size.zero,
                                                            ),
                                                          )
                                                        else
                                                          ElevatedButton.icon(
                                                            onPressed: () {
                                                              setState(() {
                                                                _isCookieInputOpen = true;
                                                                _isCookieVerified = false;
                                                                _cookieVerifyMsg = null;
                                                              });
                                                            },
                                                            icon: const Icon(
                                                              Icons.cookie_rounded,
                                                              size: 14,
                                                            ),
                                                            label: const Text(
                                                              'Nhập cookie',
                                                              style: TextStyle(
                                                                fontSize: 11,
                                                                fontWeight: FontWeight.bold,
                                                              ),
                                                            ),
                                                            style: ElevatedButton.styleFrom(
                                                              backgroundColor:
                                                                  Colors.redAccent,
                                                              foregroundColor: Colors.white,
                                                              padding:
                                                                  const EdgeInsets.symmetric(
                                                                    horizontal: 12,
                                                                    vertical: 7,
                                                                  ),
                                                              minimumSize: Size.zero,
                                                            ),
                                                          ),
                                                      ],
                                                    ),
                                                  ],
                                                ),
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
                      const Text(
                        'TikTok',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
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

                        // Sliding Input Container
                        AnimatedSize(
                          duration: const Duration(milliseconds: 200),
                          curve: Curves.easeInOut,
                          alignment: Alignment.topCenter,
                          child: _isTiktokCookieInputOpen
                              ? Padding(
                                  padding: const EdgeInsets.only(top: 12),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      const Text(
                                        'Nhập các giá trị cookie từ tài khoản TikTok của bạn:',
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: Colors.white70,
                                        ),
                                      ),
                                      const SizedBox(height: 10),
                                      ..._tiktokCookieFieldKeys.map((key) {
                                        final isRequired =
                                            key == 'sessionid' ||
                                                key == 'sessionid_ss';
                                        final isRecommended =
                                            key == 'sid_guard';
                                        final subtitle = isRequired
                                            ? '(bắt buộc)'
                                            : isRecommended
                                                ? '(khuyên dùng)'
                                                : '(tùy chọn)';
                                        return Padding(
                                          padding:
                                              const EdgeInsets.only(bottom: 8),
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Row(
                                                children: [
                                                  Text(
                                                    key,
                                                    style: const TextStyle(
                                                      fontSize: 10,
                                                      fontFamily: 'monospace',
                                                      color: Colors.white70,
                                                      fontWeight:
                                                          FontWeight.w600,
                                                    ),
                                                  ),
                                                  const SizedBox(width: 4),
                                                  Text(
                                                    subtitle,
                                                    style: TextStyle(
                                                      fontSize: 9,
                                                      color: isRequired
                                                          ? Colors.redAccent
                                                              .withValues(
                                                                alpha: 0.8,
                                                              )
                                                          : Colors.white38,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                              const SizedBox(height: 4),
                                              TextField(
                                                controller:
                                                    _tiktokCookieControllers[
                                                      key
                                                    ],
                                                onChanged: (_) {
                                                  if (_isTiktokCookieVerified ||
                                                      _tiktokCookieVerifyMsg !=
                                                          null) {
                                                    setState(() {
                                                      _isTiktokCookieVerified =
                                                          false;
                                                      _tiktokCookieVerifyMsg =
                                                          null;
                                                    });
                                                  }
                                                },
                                                style: const TextStyle(
                                                  fontSize: 11,
                                                  color: Colors.white,
                                                  fontFamily: 'monospace',
                                                ),
                                                decoration: InputDecoration(
                                                  hintText: 'Nhập $key',
                                                  hintStyle: TextStyle(
                                                    fontSize: 10,
                                                    color: Colors.white
                                                        .withValues(
                                                          alpha: 0.2,
                                                        ),
                                                  ),
                                                  contentPadding:
                                                      const EdgeInsets
                                                          .symmetric(
                                                    horizontal: 12,
                                                    vertical: 10,
                                                  ),
                                                  isDense: true,
                                                  filled: true,
                                                  fillColor:
                                                      AppTheme.bgInput,
                                                  border: OutlineInputBorder(
                                                    borderRadius:
                                                        BorderRadius.circular(
                                                      14,
                                                    ),
                                                    borderSide:
                                                        const BorderSide(
                                                      color:
                                                          AppTheme.borderColor,
                                                    ),
                                                  ),
                                                  enabledBorder:
                                                      OutlineInputBorder(
                                                    borderRadius:
                                                        BorderRadius.circular(
                                                      14,
                                                    ),
                                                    borderSide:
                                                        const BorderSide(
                                                      color:
                                                          AppTheme.borderColor,
                                                    ),
                                                  ),
                                                  focusedBorder:
                                                      OutlineInputBorder(
                                                    borderRadius:
                                                        BorderRadius.circular(
                                                      14,
                                                    ),
                                                    borderSide:
                                                        const BorderSide(
                                                      color:
                                                          Colors.cyanAccent,
                                                      width: 1.5,
                                                    ),
                                                  ),
                                                  suffixIconConstraints:
                                                      const BoxConstraints(
                                                    minWidth: 0,
                                                    minHeight: 0,
                                                  ),
                                                  suffixIcon: Padding(
                                                    padding:
                                                        const EdgeInsets.only(
                                                      right: 6,
                                                    ),
                                                    child: Row(
                                                      mainAxisSize:
                                                          MainAxisSize.min,
                                                      children: [
                                                        if ((_tiktokCookieControllers[key]
                                                                ?.text
                                                                .isNotEmpty ??
                                                            false))
                                                          IconButton(
                                                            icon: const Icon(
                                                              Icons
                                                                  .clear_rounded,
                                                              size: 15,
                                                            ),
                                                            color:
                                                                Colors.white54,
                                                            splashRadius: 14,
                                                            padding:
                                                                EdgeInsets
                                                                    .zero,
                                                            constraints:
                                                                const BoxConstraints(
                                                              minWidth: 26,
                                                              minHeight: 26,
                                                            ),
                                                            tooltip: 'Xóa',
                                                            onPressed: () {
                                                              setState(() {
                                                                _tiktokCookieControllers[key]
                                                                    ?.clear();
                                                                _isTiktokCookieVerified =
                                                                    false;
                                                                _tiktokCookieVerifyMsg =
                                                                    null;
                                                              });
                                                            },
                                                          ),
                                                        Material(
                                                          color: Colors
                                                              .cyanAccent
                                                              .withValues(
                                                                alpha: 0.10,
                                                              ),
                                                          borderRadius:
                                                              BorderRadius
                                                                  .circular(
                                                                    6,
                                                                  ),
                                                          child: InkWell(
                                                            onTap: () async {
                                                              final data =
                                                                  await Clipboard.getData(
                                                                Clipboard
                                                                    .kTextPlain,
                                                              );
                                                              if (data
                                                                          ?.text !=
                                                                      null &&
                                                                  data!
                                                                      .text!
                                                                      .trim()
                                                                      .isNotEmpty) {
                                                                setState(() {
                                                                  _tiktokCookieControllers[key]
                                                                          ?.text =
                                                                      data.text!
                                                                          .trim();
                                                                  _isTiktokCookieVerified =
                                                                      false;
                                                                  _tiktokCookieVerifyMsg =
                                                                      null;
                                                                });
                                                              }
                                                            },
                                                            borderRadius:
                                                              BorderRadius
                                                                  .circular(
                                                                    6,
                                                                  ),
                                                            child: Container(
                                                              padding:
                                                                  const EdgeInsets
                                                                      .all(5),
                                                              decoration:
                                                                  BoxDecoration(
                                                                borderRadius:
                                                                    BorderRadius
                                                                        .circular(
                                                                          6,
                                                                        ),
                                                                border:
                                                                    Border.all(
                                                                  color: Colors
                                                                      .cyanAccent
                                                                      .withValues(
                                                                        alpha:
                                                                            0.30,
                                                                      ),
                                                                ),
                                                              ),
                                                              child: const Icon(
                                                                Icons
                                                                    .content_paste_rounded,
                                                                size: 13,
                                                                color: Colors
                                                                    .cyanAccent,
                                                              ),
                                                            ),
                                                          ),
                                                        ),
                                                      ],
                                                    ),
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                        );
                                      }),
                                    ],
                                  ),
                                )
                              : const SizedBox.shrink(),
                        ),

                        // Feedback message
                        if (_tiktokCookieVerifyMsg != null) ...[
                          const SizedBox(height: 10),
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: _tiktokCookieVerifySuccess
                                  ? Colors.green.withValues(alpha: 0.1)
                                  : Colors.red.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: _tiktokCookieVerifySuccess
                                    ? Colors.green.withValues(alpha: 0.3)
                                    : Colors.red.withValues(alpha: 0.3),
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  _tiktokCookieVerifySuccess
                                      ? Icons.check_circle_rounded
                                      : Icons.error_outline_rounded,
                                  size: 14,
                                  color: _tiktokCookieVerifySuccess
                                      ? Colors.greenAccent
                                      : Colors.redAccent,
                                ),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                    _tiktokCookieVerifyMsg!,
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: _tiktokCookieVerifySuccess
                                          ? Colors.greenAccent
                                          : Colors.redAccent,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],

                        const SizedBox(height: 10),
                        const Divider(
                          height: 1,
                          color: AppTheme.borderColor,
                        ),
                        const SizedBox(height: 10),

                        // Action Buttons
                        Row(
                          mainAxisAlignment:
                              MainAxisAlignment.spaceBetween,
                          children: [
                            if (_isTiktokCookieInputOpen)
                              TextButton(
                                onPressed: () {
                                  setState(() {
                                    _isTiktokCookieInputOpen = false;
                                    _isTiktokCookieVerified = false;
                                    _tiktokCookieVerifyMsg = null;
                                  });
                                },
                                style: TextButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 6,
                                  ),
                                  minimumSize: Size.zero,
                                ),
                                child: const Text(
                                  'Hủy',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.white60,
                                  ),
                                ),
                              )
                            else
                              const SizedBox.shrink(),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                ElevatedButton.icon(
                                  onPressed: _isVerifyingTiktokCookie
                                      ? null
                                      : _handleVerifyTiktokCookie,
                                  icon: _isVerifyingTiktokCookie
                                      ? const SizedBox(
                                          width: 12,
                                          height: 12,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            color: Colors.white,
                                          ),
                                        )
                                      : const Icon(
                                          Icons.refresh_rounded,
                                          size: 13,
                                        ),
                                  label: Text(
                                    _isVerifyingTiktokCookie
                                        ? 'Đang kiểm tra...'
                                        : 'Kiểm tra cookie',
                                    style: const TextStyle(
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
                                const SizedBox(width: 8),
                                if (_isTiktokCookieInputOpen)
                                  ElevatedButton.icon(
                                    onPressed: (!_isTiktokCookieVerified ||
                                            _isSavingTiktokCookie)
                                        ? null
                                        : _handleSaveTiktokCookie,
                                    icon: _isSavingTiktokCookie
                                        ? const SizedBox(
                                            width: 12,
                                            height: 12,
                                            child:
                                                CircularProgressIndicator(
                                              strokeWidth: 2,
                                              color: Colors.white,
                                            ),
                                          )
                                        : const Icon(
                                            Icons.check_rounded,
                                            size: 13,
                                          ),
                                    label: Text(
                                      _isSavingTiktokCookie
                                          ? 'Đang lưu...'
                                          : 'Lưu cookie',
                                      style: const TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: _isTiktokCookieVerified
                                          ? Colors.cyanAccent.shade700
                                          : Colors.white12,
                                      foregroundColor: _isTiktokCookieVerified
                                          ? Colors.white
                                          : Colors.white38,
                                      disabledBackgroundColor:
                                          Colors.white10,
                                      disabledForegroundColor:
                                          Colors.white24,
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 12,
                                        vertical: 7,
                                      ),
                                      minimumSize: Size.zero,
                                    ),
                                  )
                                else
                                  ElevatedButton.icon(
                                    onPressed: () {
                                      setState(() {
                                        _isTiktokCookieInputOpen = true;
                                        _isTiktokCookieVerified = false;
                                        _tiktokCookieVerifyMsg = null;
                                      });
                                    },
                                    icon: const Icon(
                                      Icons.cookie_rounded,
                                      size: 14,
                                    ),
                                    label: const Text(
                                      'Nhập cookie',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor:
                                          Colors.cyanAccent.shade700,
                                      foregroundColor: Colors.white,
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 12,
                                        vertical: 7,
                                      ),
                                      minimumSize: Size.zero,
                                    ),
                                  ),
                              ],
                            ),
                          ],
                        ),
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
                      const Text(
                        'Facebook',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
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

                        // Sliding Input Container
                        AnimatedSize(
                          duration: const Duration(milliseconds: 200),
                          curve: Curves.easeInOut,
                          alignment: Alignment.topCenter,
                          child: _isFbCookieInputOpen
                              ? Padding(
                                  padding: const EdgeInsets.only(top: 12),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      const Text(
                                        'Nhập các giá trị cookie từ tài khoản Facebook của bạn:',
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: Colors.white70,
                                        ),
                                      ),
                                      const SizedBox(height: 10),
                                      ..._fbCookieFieldKeys.map((key) {
                                        final isRequired =
                                            key == 'c_user' || key == 'xs';
                                        final isRecommended =
                                            key == 'datr' || key == 'fr';
                                        final subtitle = isRequired
                                            ? '(bắt buộc)'
                                            : isRecommended
                                                ? '(khuyên dùng)'
                                                : '(tùy chọn)';
                                        return Padding(
                                          padding:
                                              const EdgeInsets.only(bottom: 8),
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Row(
                                                children: [
                                                  Text(
                                                    key,
                                                    style: const TextStyle(
                                                      fontSize: 10,
                                                      fontFamily: 'monospace',
                                                      color: Colors.white70,
                                                      fontWeight:
                                                          FontWeight.w600,
                                                    ),
                                                  ),
                                                  const SizedBox(width: 4),
                                                  Text(
                                                    subtitle,
                                                    style: TextStyle(
                                                      fontSize: 9,
                                                      color: isRequired
                                                          ? Colors.redAccent
                                                              .withValues(
                                                                alpha: 0.8,
                                                              )
                                                          : Colors.white38,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                              const SizedBox(height: 4),
                                              TextField(
                                                controller:
                                                    _fbCookieControllers[key],
                                                onChanged: (_) {
                                                  if (_isFbCookieVerified ||
                                                      _fbCookieVerifyMsg !=
                                                          null) {
                                                    setState(() {
                                                      _isFbCookieVerified =
                                                          false;
                                                      _fbCookieVerifyMsg =
                                                          null;
                                                    });
                                                  }
                                                },
                                                style: const TextStyle(
                                                  fontSize: 11,
                                                  color: Colors.white,
                                                  fontFamily: 'monospace',
                                                ),
                                                decoration: InputDecoration(
                                                  hintText: 'Nhập $key',
                                                  hintStyle: TextStyle(
                                                    fontSize: 10,
                                                    color: Colors.white
                                                        .withValues(
                                                          alpha: 0.2,
                                                        ),
                                                  ),
                                                  contentPadding:
                                                      const EdgeInsets.symmetric(
                                                    horizontal: 12,
                                                    vertical: 10,
                                                  ),
                                                  isDense: true,
                                                  filled: true,
                                                  fillColor: AppTheme.bgInput,
                                                  border: OutlineInputBorder(
                                                    borderRadius:
                                                        BorderRadius.circular(14),
                                                    borderSide: const BorderSide(
                                                      color: AppTheme.borderColor,
                                                    ),
                                                  ),
                                                  enabledBorder: OutlineInputBorder(
                                                    borderRadius:
                                                        BorderRadius.circular(14),
                                                    borderSide: const BorderSide(
                                                      color: AppTheme.borderColor,
                                                    ),
                                                  ),
                                                  focusedBorder: OutlineInputBorder(
                                                    borderRadius:
                                                        BorderRadius.circular(14),
                                                    borderSide: const BorderSide(
                                                      color: Color(0xFF1877F2),
                                                      width: 1.5,
                                                    ),
                                                  ),
                                                  suffixIconConstraints:
                                                      const BoxConstraints(
                                                    minWidth: 0,
                                                    minHeight: 0,
                                                  ),
                                                  suffixIcon: Padding(
                                                    padding: const EdgeInsets.only(
                                                      right: 6,
                                                    ),
                                                    child: Row(
                                                      mainAxisSize:
                                                          MainAxisSize.min,
                                                      children: [
                                                        if ((_fbCookieControllers[key]
                                                                ?.text
                                                                .isNotEmpty ??
                                                            false))
                                                          IconButton(
                                                            icon: const Icon(
                                                              Icons.clear_rounded,
                                                              size: 15,
                                                            ),
                                                            color: Colors.white54,
                                                            splashRadius: 14,
                                                            padding: EdgeInsets.zero,
                                                            constraints:
                                                                const BoxConstraints(
                                                              minWidth: 26,
                                                              minHeight: 26,
                                                            ),
                                                            tooltip: 'Xóa',
                                                            onPressed: () {
                                                              setState(() {
                                                                _fbCookieControllers[key]
                                                                    ?.clear();
                                                                _isFbCookieVerified =
                                                                    false;
                                                                _fbCookieVerifyMsg =
                                                                    null;
                                                              });
                                                            },
                                                          ),
                                                        Material(
                                                          color: const Color(0xFF1877F2)
                                                              .withValues(
                                                            alpha: 0.10,
                                                          ),
                                                          borderRadius:
                                                              BorderRadius.circular(6),
                                                          child: InkWell(
                                                            onTap: () async {
                                                              final data =
                                                                  await Clipboard.getData(
                                                                Clipboard.kTextPlain,
                                                              );
                                                              if (data?.text != null &&
                                                                  data!.text!
                                                                      .trim()
                                                                      .isNotEmpty) {
                                                                setState(() {
                                                                  _fbCookieControllers[key]
                                                                          ?.text =
                                                                      data.text!.trim();
                                                                  _isFbCookieVerified =
                                                                      false;
                                                                  _fbCookieVerifyMsg =
                                                                      null;
                                                                });
                                                              }
                                                            },
                                                            borderRadius:
                                                                BorderRadius.circular(6),
                                                            child: Container(
                                                              padding:
                                                                  const EdgeInsets.all(5),
                                                              decoration: BoxDecoration(
                                                                borderRadius:
                                                                    BorderRadius.circular(6),
                                                                border: Border.all(
                                                                  color: const Color(0xFF1877F2)
                                                                      .withValues(
                                                                    alpha: 0.30,
                                                                  ),
                                                                ),
                                                              ),
                                                              child: const Icon(
                                                                Icons.content_paste_rounded,
                                                                size: 13,
                                                                color: Color(0xFF1877F2),
                                                              ),
                                                            ),
                                                          ),
                                                        ),
                                                      ],
                                                    ),
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                        );
                                      }),
                                    ],
                                  ),
                                )
                              : const SizedBox.shrink(),
                        ),

                        // Feedback message
                        if (_fbCookieVerifyMsg != null) ...[
                          const SizedBox(height: 10),
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: _fbCookieVerifySuccess
                                  ? Colors.green.withValues(alpha: 0.1)
                                  : Colors.red.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: _fbCookieVerifySuccess
                                    ? Colors.green.withValues(alpha: 0.3)
                                    : Colors.red.withValues(alpha: 0.3),
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  _fbCookieVerifySuccess
                                      ? Icons.check_circle_rounded
                                      : Icons.error_outline_rounded,
                                  size: 14,
                                  color: _fbCookieVerifySuccess
                                      ? Colors.greenAccent
                                      : Colors.redAccent,
                                ),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                    _fbCookieVerifyMsg!,
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: _fbCookieVerifySuccess
                                          ? Colors.greenAccent
                                          : Colors.redAccent,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],

                        const SizedBox(height: 10),
                        const Divider(
                          height: 1,
                          color: AppTheme.borderColor,
                        ),
                        const SizedBox(height: 10),

                        // Action Buttons
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            if (_isFbCookieInputOpen)
                              TextButton(
                                onPressed: () {
                                  setState(() {
                                    _isFbCookieInputOpen = false;
                                    _isFbCookieVerified = false;
                                    _fbCookieVerifyMsg = null;
                                  });
                                },
                                style: TextButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 6,
                                  ),
                                  minimumSize: Size.zero,
                                ),
                                child: const Text(
                                  'Hủy',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.white60,
                                  ),
                                ),
                              )
                            else
                              const SizedBox.shrink(),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                ElevatedButton.icon(
                                  onPressed: _isVerifyingFbCookie
                                      ? null
                                      : _handleVerifyFbCookie,
                                  icon: _isVerifyingFbCookie
                                      ? const SizedBox(
                                          width: 12,
                                          height: 12,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            color: Colors.white,
                                          ),
                                        )
                                      : const Icon(
                                          Icons.refresh_rounded,
                                          size: 13,
                                        ),
                                  label: Text(
                                    _isVerifyingFbCookie
                                        ? 'Đang kiểm tra...'
                                        : 'Kiểm tra cookie',
                                    style: const TextStyle(
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
                                const SizedBox(width: 8),
                                if (_isFbCookieInputOpen)
                                  ElevatedButton.icon(
                                    onPressed: (!_isFbCookieVerified ||
                                            _isSavingFbCookie)
                                        ? null
                                        : _handleSaveFbCookie,
                                    icon: _isSavingFbCookie
                                        ? const SizedBox(
                                            width: 12,
                                            height: 12,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                              color: Colors.white,
                                            ),
                                          )
                                        : const Icon(
                                            Icons.check_rounded,
                                            size: 13,
                                          ),
                                    label: Text(
                                      _isSavingFbCookie
                                          ? 'Đang lưu...'
                                          : 'Lưu cookie',
                                      style: const TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: _isFbCookieVerified
                                          ? const Color(0xFF1877F2)
                                          : Colors.white12,
                                      foregroundColor: _isFbCookieVerified
                                          ? Colors.white
                                          : Colors.white38,
                                      disabledBackgroundColor: Colors.white10,
                                      disabledForegroundColor: Colors.white24,
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 12,
                                        vertical: 7,
                                      ),
                                      minimumSize: Size.zero,
                                    ),
                                  )
                                else
                                  ElevatedButton.icon(
                                    onPressed: () {
                                      setState(() {
                                        _isFbCookieInputOpen = true;
                                        _isFbCookieVerified = false;
                                        _fbCookieVerifyMsg = null;
                                      });
                                    },
                                    icon: const Icon(
                                      Icons.cookie_rounded,
                                      size: 14,
                                    ),
                                    label: const Text(
                                      'Nhập cookie',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(0xFF1877F2)
                                          .withValues(alpha: 0.2),
                                      foregroundColor: const Color(0xFF1877F2),
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
                        ),
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
                      const Text(
                        'Instagram',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
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

                        // Sliding Input Container
                        AnimatedSize(
                          duration: const Duration(milliseconds: 200),
                          curve: Curves.easeInOut,
                          alignment: Alignment.topCenter,
                          child: _isIgCookieInputOpen
                              ? Padding(
                                  padding: const EdgeInsets.only(top: 12),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      const Text(
                                        'Nhập các giá trị cookie từ tài khoản Instagram của bạn:',
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: Colors.white70,
                                        ),
                                      ),
                                      const SizedBox(height: 10),
                                      ..._igCookieFieldKeys.map((key) {
                                        final isRequired =
                                            key == 'sessionid' || key == 'ds_user_id';
                                        final isRecommended =
                                            key == 'csrftoken' ||
                                                key == 'mid' ||
                                                key == 'ig_did' ||
                                                key == 'datr';
                                        final subtitle = isRequired
                                            ? '(bắt buộc)'
                                            : isRecommended
                                                ? '(khuyên dùng)'
                                                : '(tùy chọn)';
                                        return Padding(
                                          padding:
                                              const EdgeInsets.only(bottom: 8),
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Row(
                                                children: [
                                                  Text(
                                                    key,
                                                    style: const TextStyle(
                                                      fontSize: 10,
                                                      fontFamily: 'monospace',
                                                      color: Colors.white70,
                                                      fontWeight:
                                                          FontWeight.w600,
                                                    ),
                                                  ),
                                                  const SizedBox(width: 4),
                                                  Text(
                                                    subtitle,
                                                    style: TextStyle(
                                                      fontSize: 9,
                                                      color: isRequired
                                                          ? Colors.redAccent
                                                              .withValues(
                                                                alpha: 0.8,
                                                              )
                                                          : Colors.white38,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                              const SizedBox(height: 4),
                                              TextField(
                                                controller:
                                                    _igCookieControllers[key],
                                                onChanged: (_) {
                                                  if (_isIgCookieVerified ||
                                                      _igCookieVerifyMsg !=
                                                          null) {
                                                    setState(() {
                                                      _isIgCookieVerified =
                                                          false;
                                                      _igCookieVerifyMsg =
                                                          null;
                                                    });
                                                  }
                                                },
                                                style: const TextStyle(
                                                  fontSize: 11,
                                                  color: Colors.white,
                                                  fontFamily: 'monospace',
                                                ),
                                                decoration: InputDecoration(
                                                  hintText: 'Nhập $key',
                                                  hintStyle: TextStyle(
                                                    fontSize: 10,
                                                    color: Colors.white
                                                        .withValues(
                                                          alpha: 0.2,
                                                        ),
                                                  ),
                                                  contentPadding:
                                                      const EdgeInsets.symmetric(
                                                    horizontal: 12,
                                                    vertical: 10,
                                                  ),
                                                  isDense: true,
                                                  filled: true,
                                                  fillColor: AppTheme.bgInput,
                                                  border: OutlineInputBorder(
                                                    borderRadius:
                                                        BorderRadius.circular(14),
                                                    borderSide: const BorderSide(
                                                      color: AppTheme.borderColor,
                                                    ),
                                                  ),
                                                  enabledBorder: OutlineInputBorder(
                                                    borderRadius:
                                                        BorderRadius.circular(14),
                                                    borderSide: const BorderSide(
                                                      color: AppTheme.borderColor,
                                                    ),
                                                  ),
                                                  focusedBorder: OutlineInputBorder(
                                                    borderRadius:
                                                        BorderRadius.circular(14),
                                                    borderSide: const BorderSide(
                                                      color: Color(0xFFE1306C),
                                                      width: 1.5,
                                                    ),
                                                  ),
                                                  suffixIconConstraints:
                                                      const BoxConstraints(
                                                    minWidth: 0,
                                                    minHeight: 0,
                                                  ),
                                                  suffixIcon: Padding(
                                                    padding: const EdgeInsets.only(
                                                      right: 6,
                                                    ),
                                                    child: Row(
                                                      mainAxisSize:
                                                          MainAxisSize.min,
                                                      children: [
                                                        if ((_igCookieControllers[key]
                                                                ?.text
                                                                .isNotEmpty ??
                                                            false))
                                                          IconButton(
                                                            icon: const Icon(
                                                              Icons.clear_rounded,
                                                              size: 15,
                                                            ),
                                                            color: Colors.white54,
                                                            splashRadius: 14,
                                                            padding: EdgeInsets.zero,
                                                            constraints:
                                                                const BoxConstraints(
                                                              minWidth: 26,
                                                              minHeight: 26,
                                                            ),
                                                            tooltip: 'Xóa',
                                                            onPressed: () {
                                                              setState(() {
                                                                _igCookieControllers[key]
                                                                    ?.clear();
                                                                _isIgCookieVerified =
                                                                    false;
                                                                _igCookieVerifyMsg =
                                                                    null;
                                                              });
                                                            },
                                                          ),
                                                        Material(
                                                          color: const Color(0xFFE1306C)
                                                              .withValues(
                                                            alpha: 0.10,
                                                          ),
                                                          borderRadius:
                                                              BorderRadius.circular(6),
                                                          child: InkWell(
                                                            onTap: () async {
                                                              final data =
                                                                  await Clipboard.getData(
                                                                Clipboard.kTextPlain,
                                                              );
                                                              if (data?.text != null &&
                                                                  data!.text!
                                                                      .trim()
                                                                      .isNotEmpty) {
                                                                setState(() {
                                                                  _igCookieControllers[key]
                                                                          ?.text =
                                                                      data.text!.trim();
                                                                  _isIgCookieVerified =
                                                                      false;
                                                                  _igCookieVerifyMsg =
                                                                      null;
                                                                });
                                                              }
                                                            },
                                                            borderRadius:
                                                                BorderRadius.circular(6),
                                                            child: Container(
                                                              padding:
                                                                  const EdgeInsets.all(5),
                                                              decoration: BoxDecoration(
                                                                borderRadius:
                                                                    BorderRadius.circular(6),
                                                                border: Border.all(
                                                                  color: const Color(0xFFE1306C)
                                                                      .withValues(
                                                                    alpha: 0.30,
                                                                  ),
                                                                ),
                                                              ),
                                                              child: const Icon(
                                                                Icons.content_paste_rounded,
                                                                size: 13,
                                                                color: Color(0xFFE1306C),
                                                              ),
                                                            ),
                                                          ),
                                                        ),
                                                      ],
                                                    ),
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                        );
                                      }),
                                    ],
                                  ),
                                )
                              : const SizedBox.shrink(),
                        ),

                        // Feedback message
                        if (_igCookieVerifyMsg != null) ...[
                          const SizedBox(height: 10),
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: _igCookieVerifySuccess
                                  ? Colors.green.withValues(alpha: 0.1)
                                  : Colors.red.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: _igCookieVerifySuccess
                                    ? Colors.green.withValues(alpha: 0.3)
                                    : Colors.red.withValues(alpha: 0.3),
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  _igCookieVerifySuccess
                                      ? Icons.check_circle_rounded
                                      : Icons.error_outline_rounded,
                                  size: 16,
                                  color: _igCookieVerifySuccess
                                      ? Colors.greenAccent
                                      : Colors.redAccent,
                                ),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                    _igCookieVerifyMsg!,
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: _igCookieVerifySuccess
                                          ? Colors.greenAccent
                                          : Colors.redAccent,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],

                        const SizedBox(height: 10),
                        const Divider(
                          height: 1,
                          color: AppTheme.borderColor,
                        ),
                        const SizedBox(height: 10),

                        // Action Buttons
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            if (_isIgCookieInputOpen)
                              TextButton(
                                onPressed: () {
                                  setState(() {
                                    _isIgCookieInputOpen = false;
                                    _isIgCookieVerified = false;
                                    _igCookieVerifyMsg = null;
                                  });
                                },
                                style: TextButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 6,
                                  ),
                                  minimumSize: Size.zero,
                                ),
                                child: const Text(
                                  'Hủy',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.white60,
                                  ),
                                ),
                              )
                            else
                              const SizedBox.shrink(),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                ElevatedButton.icon(
                                  onPressed: _isVerifyingIgCookie
                                      ? null
                                      : _handleVerifyIgCookie,
                                  icon: _isVerifyingIgCookie
                                      ? const SizedBox(
                                          width: 12,
                                          height: 12,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            color: Colors.white,
                                          ),
                                        )
                                      : const Icon(
                                          Icons.refresh_rounded,
                                          size: 13,
                                        ),
                                  label: Text(
                                    _isVerifyingIgCookie
                                        ? 'Đang kiểm tra...'
                                        : 'Kiểm tra cookie',
                                    style: const TextStyle(
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
                                const SizedBox(width: 8),
                                if (_isIgCookieInputOpen)
                                  ElevatedButton.icon(
                                    onPressed: (!_isIgCookieVerified ||
                                            _isSavingIgCookie)
                                        ? null
                                        : _handleSaveIgCookie,
                                    icon: _isSavingIgCookie
                                        ? const SizedBox(
                                            width: 12,
                                            height: 12,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                              color: Colors.white,
                                            ),
                                          )
                                        : const Icon(
                                            Icons.check_rounded,
                                            size: 13,
                                          ),
                                    label: Text(
                                      _isSavingIgCookie
                                          ? 'Đang lưu...'
                                          : 'Lưu cookie',
                                      style: const TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: _isIgCookieVerified
                                          ? const Color(0xFFE1306C)
                                          : Colors.white12,
                                      foregroundColor: _isIgCookieVerified
                                          ? Colors.white
                                          : Colors.white38,
                                      disabledBackgroundColor: Colors.white10,
                                      disabledForegroundColor: Colors.white24,
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 12,
                                        vertical: 7,
                                      ),
                                      minimumSize: Size.zero,
                                    ),
                                  )
                                else
                                  ElevatedButton.icon(
                                    onPressed: () {
                                      setState(() {
                                        _isIgCookieInputOpen = true;
                                        _isIgCookieVerified = false;
                                        _igCookieVerifyMsg = null;
                                      });
                                    },
                                    icon: const Icon(
                                      Icons.cookie_rounded,
                                      size: 14,
                                    ),
                                    label: const Text(
                                      'Nhập cookie',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(0xFFE1306C)
                                          .withValues(alpha: 0.2),
                                      foregroundColor: const Color(0xFFE1306C),
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
                        ),
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
