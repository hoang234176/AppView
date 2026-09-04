import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../providers/settings_provider.dart';
import '../providers/app_state_provider.dart';
import '../api/cache_api.dart';
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
  late TextEditingController _ipController;
  late TextEditingController _portController;
  late TextEditingController _rootPathController;

  bool _isSavingServer = false;
  bool _isClearingCache = false;
  String? _errorMessage;
  String? _cacheMsg;

  // Collapsible Accordion States
  bool _openSection1 = true;
  bool _openSection2 = true;

  CacheInfoData? _cacheInfo;

  @override
  void initState() {
    super.initState();
    final settings = context.read<SettingsProvider>();
    _ipController = TextEditingController(text: settings.serverIp);
    _portController = TextEditingController(text: settings.serverPort);
    _rootPathController = TextEditingController(text: settings.rootFolderPath);

    _loadCacheInfo();
  }

  @override
  void dispose() {
    _ipController.dispose();
    _portController.dispose();
    _rootPathController.dispose();
    super.dispose();
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
    final ip = _ipController.text.trim();
    final port = _portController.text.trim();
    final rootPath = _rootPathController.text.trim();

    if (ip.isEmpty || port.isEmpty || rootPath.isEmpty) {
      setState(() {
        _errorMessage =
            'Vui lòng nhập đầy đủ tất cả các trường: IP, Cổng và Đường dẫn thư mục gốc.';
      });
      return;
    }

    setState(() {
      _isSavingServer = true;
      _errorMessage = null;
    });

    final settings = context.read<SettingsProvider>();
    final appState = context.read<AppStateProvider>();
    final success = await settings.updateServerConfig(
      ip: ip,
      port: port,
      rootFolderPath: rootPath,
    );

    if (!mounted) return;
    setState(() => _isSavingServer = false);

    if (success) {
      appState.startRealtime();
      appState.refreshAll();
      AppToast.showSuccess(context, 'Đã lưu kết nối máy chủ: $ip:$port');
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
    final appState = context.watch<AppStateProvider>();
    final isServerConnected =
        appState.errorInfo == null &&
        _ipController.text.trim().isNotEmpty &&
        _portController.text.trim().isNotEmpty;

    final Widget serverStatusTrailing = Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color:
            isServerConnected
                ? Colors.green.withValues(alpha: 0.15)
                : Colors.red.withValues(alpha: 0.15),
        shape: BoxShape.circle,
        border: Border.all(
          color: isServerConnected ? Colors.greenAccent : Colors.redAccent,
          width: 1.5,
        ),
      ),
      child: Icon(
        Icons.dns_rounded,
        size: 16,
        color: isServerConnected ? Colors.greenAccent : Colors.redAccent,
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
          constraints: const BoxConstraints(maxWidth: 520, maxHeight: 600),
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

              // Scrollable Body
              Expanded(
                child: SingleChildScrollView(
                  physics: const BouncingScrollPhysics(),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // ================= 1. CẤU HÌNH MÁY CHỦ =================
                      _buildAccordionSection(
                        isOpen: _openSection1,
                        onToggle:
                            () =>
                                setState(() => _openSection1 = !_openSection1),
                        icon: Icons.dns_rounded,
                        iconColor: AppTheme.googleBlue,
                        title: '1. Cấu hình Kết nối Máy Chủ',
                        trailing: serverStatusTrailing,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  flex: 2,
                                  child: Padding(
                                    padding: const EdgeInsets.only(top: 4),
                                    child: TextField(
                                      controller: _ipController,
                                      textInputAction: TextInputAction.next,
                                      onChanged: (_) => setState(() {}),
                                      style: TextStyle(
                                        fontSize:
                                            _ipController.text.isNotEmpty
                                                ? 13.5
                                                : 12,
                                        color: Colors.white,
                                        fontFamily: 'monospace',
                                      ),
                                      decoration: InputDecoration(
                                        labelText: 'Địa chỉ IP Máy Chủ *',
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
                                        hintText: '192.168.1.xxx',
                                        hintStyle: TextStyle(
                                          fontSize: 10,
                                          color: Colors.white.withValues(
                                            alpha: 0.2,
                                          ),
                                        ),
                                        prefixIcon: const Icon(
                                          Icons.lan_rounded,
                                          color: AppTheme.googleBlue,
                                          size: 16,
                                        ),
                                        contentPadding:
                                            const EdgeInsets.symmetric(
                                              horizontal: 12,
                                              vertical: 10,
                                            ),
                                        isDense: true,
                                        border: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(
                                            10,
                                          ),
                                          borderSide: const BorderSide(
                                            color: AppTheme.borderColor,
                                          ),
                                        ),
                                        focusedBorder: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(
                                            10,
                                          ),
                                          borderSide: const BorderSide(
                                            color: AppTheme.googleBlue,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  flex: 1,
                                  child: Padding(
                                    padding: const EdgeInsets.only(top: 4),
                                    child: TextField(
                                      controller: _portController,
                                      textInputAction: TextInputAction.next,
                                      onChanged: (_) => setState(() {}),
                                      style: TextStyle(
                                        fontSize:
                                            _portController.text.isNotEmpty
                                                ? 13.5
                                                : 12,
                                        color: Colors.white,
                                        fontFamily: 'monospace',
                                      ),
                                      decoration: InputDecoration(
                                        labelText: 'Port *',
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
                                        hintText: '8080',
                                        hintStyle: TextStyle(
                                          fontSize: 10,
                                          color: Colors.white.withValues(
                                            alpha: 0.2,
                                          ),
                                        ),
                                        contentPadding:
                                            const EdgeInsets.symmetric(
                                              horizontal: 12,
                                              vertical: 10,
                                            ),
                                        isDense: true,
                                        border: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(
                                            10,
                                          ),
                                          borderSide: const BorderSide(
                                            color: AppTheme.borderColor,
                                          ),
                                        ),
                                        focusedBorder: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(
                                            10,
                                          ),
                                          borderSide: const BorderSide(
                                            color: AppTheme.googleBlue,
                                          ),
                                        ),
                                      ),
                                      keyboardType: TextInputType.number,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),

                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: TextField(
                                controller: _rootPathController,
                                textInputAction: TextInputAction.done,
                                onSubmitted:
                                    (_) =>
                                        FocusManager.instance.primaryFocus
                                            ?.unfocus(),
                                onChanged: (_) => setState(() {}),
                                style: TextStyle(
                                  fontSize:
                                      _rootPathController.text.isNotEmpty
                                          ? 13.5
                                          : 12,
                                  color: Colors.white,
                                  fontFamily: 'monospace',
                                ),
                                decoration: InputDecoration(
                                  labelText: 'Đường dẫn gốc (PATH) *',
                                  labelStyle: const TextStyle(
                                    fontSize: 11,
                                    color: Colors.white70,
                                  ),
                                  floatingLabelStyle: const TextStyle(
                                    fontSize: 14,
                                    color: AppTheme.folderYellow,
                                    fontWeight: FontWeight.bold,
                                  ),
                                  floatingLabelBehavior:
                                      FloatingLabelBehavior.auto,
                                  hintText: '/Volumes/HDD/Albums',
                                  hintStyle: TextStyle(
                                    fontSize: 10,
                                    color: Colors.white.withValues(alpha: 0.2),
                                  ),
                                  prefixIcon: const Icon(
                                    Icons.folder_open_rounded,
                                    color: AppTheme.folderYellow,
                                    size: 16,
                                  ),
                                  contentPadding: const EdgeInsets.symmetric(
                                    horizontal: 12,
                                    vertical: 10,
                                  ),
                                  isDense: true,
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(10),
                                    borderSide: const BorderSide(
                                      color: AppTheme.borderColor,
                                    ),
                                  ),
                                  focusedBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(10),
                                    borderSide: const BorderSide(
                                      color: AppTheme.folderYellow,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 12),

                            Align(
                              alignment: Alignment.centerRight,
                              child: ElevatedButton.icon(
                                onPressed:
                                    _isSavingServer ? null : _handleSaveServer,
                                icon:
                                    _isSavingServer
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
                                label: const Text(
                                  'Lưu Máy chủ',
                                  style: TextStyle(
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

                      // ================= 2. DỌN DẸP BỘ NHỚ TẠM (COLLAPSIBLE) =================
                      _buildAccordionSection(
                        isOpen: _openSection2,
                        onToggle:
                            () =>
                                setState(() => _openSection2 = !_openSection2),
                        icon: Icons.storage_rounded,
                        iconColor: Colors.amberAccent,
                        title: '2. Dọn dẹp Bộ nhớ tạm',
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
                        Icon(
                          isOpen
                              ? Icons.keyboard_arrow_down_rounded
                              : Icons.keyboard_arrow_right_rounded,
                          color: iconColor,
                          size: 22,
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
          if (isOpen) ...[
            const Divider(height: 1, color: AppTheme.borderColor),
            Padding(padding: const EdgeInsets.all(14), child: child),
          ],
        ],
      ),
    );
  }
}
