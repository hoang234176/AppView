import 'dart:async' as java_timer;
import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import '../api/api_config.dart';
import '../api/download_api.dart';
import '../providers/app_state_provider.dart';
import '../providers/download_provider.dart';
import '../theme/app_theme.dart';
import 'app_select_menu.dart';
import 'config_api_dialog.dart';
import 'folder_picker_view.dart';

Widget _buildPreviewImage(
  String url, {
  double? width,
  double? height,
  BoxFit fit = BoxFit.cover,
  Widget? errorWidget,
}) {
  final clean = url.trim();
  if (clean.isEmpty) {
    return errorWidget ?? const SizedBox();
  }
  if (clean.startsWith('data:image/')) {
    final commaIndex = clean.indexOf(',');
    if (commaIndex != -1) {
      try {
        final b64 = clean.substring(commaIndex + 1);
        final bytes = base64Decode(b64);
        return Image.memory(
          bytes,
          width: width,
          height: height,
          fit: fit,
          errorBuilder: (_, __, ___) => errorWidget ?? const SizedBox(),
        );
      } catch (_) {
        return errorWidget ?? const SizedBox();
      }
    }
  }

  String finalUrl = clean;
  if (clean.startsWith('/')) {
    final host = ApiConfig.serverHost.trim().isNotEmpty ? ApiConfig.serverHost : 'localhost';
    finalUrl = 'http://$host:${ApiConfig.pythonDownloadPort}$clean';
  }

  return Image.network(
    finalUrl,
    width: width,
    height: height,
    fit: fit,
    errorBuilder: (_, __, ___) => errorWidget ?? const SizedBox(),
  );
}

class DownloadMediaDialog extends StatefulWidget {
  final String currentPath;
  const DownloadMediaDialog({super.key, required this.currentPath});

  static Future<void> show(BuildContext context, String currentPath) =>
      showDialog<void>(
        context: context,
        builder: (_) => DownloadMediaDialog(currentPath: currentPath),
      );

  @override
  State<DownloadMediaDialog> createState() => _DownloadMediaDialogState();
}

class _DownloadMediaDialogState extends State<DownloadMediaDialog> {
  final _url = TextEditingController();
  CancelToken? _previewCancel;
  MediaDownloadPreview? _preview;
  int? _quality;
  String _mediaTypeTab = 'video';
  List<int> _selectedIndices = [];
  List<int> _selectedVideoIndices = [];
  bool _busy = false;
  String? _error;
  late String _destination;
  bool _isPlatformsExpanded = false;
  final Map<String, String> _activeTaskIds = {};
  final Set<String> _downloadedTypes = {};
  final Set<String> _downloadingTypes = {};
  java_timer.Timer? _closeTimer;

  @override
  void initState() {
    super.initState();
    _destination = widget.currentPath;
    _url.addListener(() {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _closeTimer?.cancel();
    _previewCancel?.cancel();
    _url.dispose();
    super.dispose();
  }

  Future<void> _handlePaste() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    final text = data?.text?.trim();
    if (text != null && text.isNotEmpty) {
      setState(() {
        _url.text = text;
        _error = null;
      });
    }
  }

  Future<void> _submit() async {
    if (_busy) return;
    final url = _url.text.trim();
    final parsed = Uri.tryParse(url);
    if (parsed == null ||
        !['http', 'https'].contains(parsed.scheme) ||
        parsed.host.isEmpty) {
      setState(() => _error = 'Liên kết không hợp lệ.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    if (_preview != null) {
      final photos = _preview!.images
          .where((img) =>
              img.type == 'slideshow_photo' ||
              img.type == 'post_photo' ||
              img.type == 'photo' ||
              img.type.isEmpty)
          .toList();
      final targetImages = photos.isNotEmpty ? photos : _preview!.images;
      final hasVideo = _preview!.hasVideo ||
          _preview!.source == 'youtube' ||
          _preview!.qualities.isNotEmpty ||
          _preview!.type == 'video';
      final hasImages = targetImages.isNotEmpty;
      final isTextOnly = !hasVideo && !hasImages;
      final isImages = !isTextOnly && (_mediaTypeTab == 'images' || (!hasVideo && hasImages));

      if (isImages && _selectedIndices.isEmpty) {
        setState(() {
          _busy = false;
          _error = 'Vui lòng chọn ít nhất 1 ảnh để tải xuống.';
        });
        return;
      }

      final targetDrive = context.read<AppStateProvider>().activeDrive;
      final targetMediaType = isTextOnly ? 'text' : (isImages ? 'images' : 'video');

      // 1. Multiple videos: separate download task for each selected video
      if (targetMediaType == 'video' && _preview!.videos.length > 1) {
        if (_selectedVideoIndices.isEmpty) {
          setState(() {
            _busy = false;
            _error = 'Vui lòng chọn ít nhất 1 video để tải xuống.';
          });
          return;
        }
        setState(() {
          _downloadingTypes.add('video');
        });
        String? lastJobId;
        for (final idx in _selectedVideoIndices) {
          final res = await context
              .read<DownloadProvider>()
              .startCoordinatorDownload(
                url: url,
                destination: canonicalDownloadDestination(_destination, targetDrive),
                drive: targetDrive,
                quality: _quality,
                selectedIndices: [idx],
                mediaType: 'video',
              );
          if (res['success'] == true) {
            lastJobId = res['data'] is Map ? (res['data']['id'] ?? res['data']['task_id'])?.toString() : null;
          } else {
            setState(() {
              _error = res['message'] as String? ?? 'Không thể bắt đầu tải xuống.';
            });
          }
        }
        if (!mounted) return;
        setState(() => _busy = false);
        if (lastJobId != null) {
          setState(() {
            _activeTaskIds['video'] = lastJobId ?? 'started';
          });
          if (!hasImages) {
            _closeTimer?.cancel();
            _closeTimer = java_timer.Timer(const Duration(seconds: 2), () {
              if (mounted) Navigator.of(context).pop();
            });
          } else {
            setState(() {
              _downloadedTypes.add('video');
              _downloadingTypes.remove('video');
            });
            if (_downloadedTypes.contains('video') && _downloadedTypes.contains('images')) {
              _closeTimer?.cancel();
              _closeTimer = java_timer.Timer(const Duration(seconds: 2), () {
                if (mounted) Navigator.of(context).pop();
              });
            }
          }
        }
        return;
      }

      // 2. Multiple images: separate download task for each selected image
      if (targetMediaType == 'images' && targetImages.length > 1) {
        if (_selectedIndices.isEmpty) {
          setState(() {
            _busy = false;
            _error = 'Vui lòng chọn ít nhất 1 ảnh để tải xuống.';
          });
          return;
        }
        setState(() {
          _downloadingTypes.add('images');
        });
        String? lastJobId;
        for (final idx in _selectedIndices) {
          final res = await context
              .read<DownloadProvider>()
              .startCoordinatorDownload(
                url: url,
                destination: canonicalDownloadDestination(_destination, targetDrive),
                drive: targetDrive,
                quality: null,
                selectedIndices: [idx],
                mediaType: 'images',
              );
          if (res['success'] == true) {
            lastJobId = res['data'] is Map ? (res['data']['id'] ?? res['data']['task_id'])?.toString() : null;
          } else {
            setState(() {
              _error = res['message'] as String? ?? 'Không thể bắt đầu tải xuống.';
            });
          }
        }
        if (!mounted) return;
        setState(() => _busy = false);
        if (lastJobId != null) {
          setState(() {
            _activeTaskIds['images'] = lastJobId ?? 'started';
          });
          if (!hasVideo) {
            _closeTimer?.cancel();
            _closeTimer = java_timer.Timer(const Duration(seconds: 2), () {
              if (mounted) Navigator.of(context).pop();
            });
          } else {
            setState(() {
              _downloadedTypes.add('images');
              _downloadingTypes.remove('images');
            });
            if (_downloadedTypes.contains('video') && _downloadedTypes.contains('images')) {
              _closeTimer?.cancel();
              _closeTimer = java_timer.Timer(const Duration(seconds: 2), () {
                if (mounted) Navigator.of(context).pop();
              });
            }
          }
        }
        return;
      }

      // 3. Single video / Single image / Text / Fallback
      if (isImages && _selectedIndices.isEmpty) {
        setState(() {
          _busy = false;
          _error = 'Vui lòng chọn ít nhất 1 ảnh để tải xuống.';
        });
        return;
      }

      setState(() {
        _downloadingTypes.add(targetMediaType);
      });

      final result = await context
          .read<DownloadProvider>()
          .startCoordinatorDownload(
            url: url,
            destination: canonicalDownloadDestination(_destination, targetDrive),
            drive: targetDrive,
            quality: (isImages || isTextOnly) ? null : _quality,
            selectedIndices: isImages ? _selectedIndices : null,
            mediaType: targetMediaType,
          );
      if (!mounted) return;
      setState(() => _busy = false);
      if (result['success'] == true) {
        final jobId = result['data'] is Map ? (result['data']['id'] ?? result['data']['task_id'])?.toString() : null;
        setState(() {
          _activeTaskIds[targetMediaType] = jobId ?? 'started';
        });

        final isMixed = hasVideo && hasImages;
        if (!isMixed) {
          _closeTimer?.cancel();
          _closeTimer = java_timer.Timer(const Duration(seconds: 2), () {
            if (mounted) {
              Navigator.of(context).pop();
            }
          });
        } else {
          setState(() {
            _downloadedTypes.add(targetMediaType);
            _downloadingTypes.remove(targetMediaType);
          });

          if (_downloadedTypes.contains('video') && _downloadedTypes.contains('images')) {
            setState(() {
              _downloadingTypes.add(targetMediaType);
            });
            _closeTimer?.cancel();
            _closeTimer = java_timer.Timer(const Duration(seconds: 2), () {
              if (mounted) {
                Navigator.of(context).pop();
              }
            });
          }
        }
      } else {
        setState(() {
          _downloadingTypes.remove(targetMediaType);
          _error =
              result['message'] as String? ??
              'Không thể bắt đầu tải xuống.';
        });
      }
      return;
    }
    final cancel = CancelToken();
    _previewCancel = cancel;
    try {
      final preview = await DownloadApi.previewMediaDownload(url, cancel);
      if (!mounted || cancel.isCancelled) return;
      final photos = preview.images
          .where((img) =>
              img.type == 'slideshow_photo' ||
              img.type == 'post_photo' ||
              img.type == 'photo' ||
              img.type.isEmpty)
          .toList();
      final targetImages = photos.isNotEmpty
          ? photos
          : preview.images.where((img) => img.type != 'video').toList();
      final hasImages = targetImages.isNotEmpty;
      final hasVideo = preview.hasVideo ||
          preview.videos.isNotEmpty ||
          preview.source == 'youtube' ||
          preview.qualities.isNotEmpty ||
          preview.type == 'video';

      setState(() {
        _preview = preview;
        _activeTaskIds.clear();
        _downloadedTypes.clear();
        _downloadingTypes.clear();
        _quality = preview.qualities.isNotEmpty ? preview.qualities.first : null;
        _selectedIndices = List.generate(targetImages.length, (i) => i);
        _selectedVideoIndices = List.generate(preview.videos.length, (i) => i);
        if (hasImages && !hasVideo) {
          _mediaTypeTab = 'images';
        } else {
          _mediaTypeTab = 'video';
        }
      });
    } on DioException catch (error) {
      if (!mounted || cancel.isCancelled) return;
      final detail =
          error.response?.data is Map ? error.response?.data['error'] : null;
      setState(
        () =>
            _error =
                detail is Map
                    ? detail['message'] as String?
                    : (detail is String
                        ? detail
                        : 'Không thể xem trước nội dung. Vui lòng thử lại.'),
      );
    } catch (_) {
      if (mounted) setState(() => _error = 'Dữ liệu xem trước không hợp lệ.');
    } finally {
      if (mounted && !cancel.isCancelled) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final preview = _preview;

    return PopScope(
      canPop: true,
      child: GestureDetector(
        onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
        behavior: HitTestBehavior.translucent,
        child: AlertDialog(
          backgroundColor: AppTheme.bgBlock,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(28),
            side: const BorderSide(color: AppTheme.borderColor),
          ),
          title: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: Colors.redAccent.withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: Colors.redAccent.withValues(alpha: 0.3),
                      ),
                    ),
                    child: const Icon(
                      Icons.perm_media_rounded,
                      color: Colors.redAccent,
                      size: 18,
                    ),
                  ),
                  const SizedBox(width: 10),
                  const Text(
                    'Tải ảnh/video',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
              IconButton(
                icon: const Icon(Icons.close_rounded, color: Colors.white70, size: 20),
                onPressed: () {
                  _closeTimer?.cancel();
                  _previewCancel?.cancel();
                  Navigator.of(context).pop();
                },
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                splashRadius: 18,
                tooltip: 'Đóng',
              ),
            ],
          ),
          content: SizedBox(
            width: double.maxFinite,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (_error != null) ...[
                    () {
                      final isAuthRequired = _error!.toLowerCase().contains('cookie') ||
                          _error!.toLowerCase().contains('đăng nhập') ||
                          _error!.contains('AUTH_REQUIRED');
                      return Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppTheme.errorRed.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: AppTheme.errorRed.withValues(alpha: 0.3),
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Icon(
                                  Icons.error_outline_rounded,
                                  color: AppTheme.errorRed,
                                  size: 16,
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    _error!,
                                    style: const TextStyle(
                                      color: AppTheme.errorRed,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            if (isAuthRequired) ...[
                              const SizedBox(height: 8),
                              const Divider(
                                height: 1,
                                color: Color(0x33EF4444),
                              ),
                              const SizedBox(height: 8),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text(
                                    'Cần gắn cookie để truy cập.',
                                    style: TextStyle(
                                      color: Color(0xFFFCA5A5),
                                      fontSize: 11,
                                    ),
                                  ),
                                  ElevatedButton.icon(
                                    onPressed: () {
                                      Navigator.of(context).pop();
                                      ConfigApiDialog.show(context);
                                    },
                                    icon: const Icon(Icons.settings_rounded, size: 13),
                                    label: const Text(
                                      'Cài đặt Cookie',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(0xFF2563EB),
                                      foregroundColor: Colors.white,
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 10,
                                        vertical: 6,
                                      ),
                                      minimumSize: Size.zero,
                                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      );
                    }(),
                    const SizedBox(height: 10),
                  ],

                  if (preview == null) ...[
                    const Text(
                      'Dán liên kết MXH',
                      style: TextStyle(
                        color: Colors.white70,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    TextField(
                      controller: _url,
                      autofocus: false,
                      enabled: !_busy,
                      keyboardType: TextInputType.url,
                      textInputAction: TextInputAction.done,
                      onSubmitted: (_) => FocusManager.instance.primaryFocus?.unfocus(),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontFamily: 'monospace',
                      ),
                      decoration: InputDecoration(
                        hintText: 'https://...',
                        hintStyle: const TextStyle(
                          color: Colors.white38,
                          fontSize: 12,
                        ),
                        filled: true,
                        fillColor: AppTheme.bgInput,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 11,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: AppTheme.borderColor),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: AppTheme.borderColor),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: Color(0xFFFB7185), width: 1.5), // rose-400
                        ),
                        suffixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
                        suffixIcon: Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (_url.text.isNotEmpty)
                                IconButton(
                                  icon: const Icon(Icons.clear_rounded, size: 16),
                                  color: Colors.white54,
                                  splashRadius: 14,
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(minWidth: 26, minHeight: 26),
                                  tooltip: 'Xóa',
                                  onPressed: _busy
                                      ? null
                                      : () {
                                          setState(() {
                                            _url.clear();
                                            _error = null;
                                          });
                                        },
                                ),
                              Material(
                                color: const Color(0xFFF43F5E).withValues(alpha: 0.10), // rose-500/10
                                borderRadius: BorderRadius.circular(8),
                                child: InkWell(
                                  onTap: _busy ? null : _handlePaste,
                                  borderRadius: BorderRadius.circular(8),
                                  child: Container(
                                    padding: const EdgeInsets.all(6),
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(
                                        color: const Color(0xFFF43F5E).withValues(alpha: 0.20),
                                      ),
                                    ),
                                    child: const Icon(
                                      Icons.content_paste_rounded,
                                      size: 14,
                                      color: Color(0xFFFB7185), // rose-400
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    _buildSupportedPlatforms(),
                    const SizedBox(height: 12),
                    FolderPickerView(
                      destination: _destination,
                      onChanged: (newDest) => setState(() => _destination = newDest),
                      disabled: _busy,
                      accentColor: AppTheme.googleBlue,
                      height: 180,
                    ),
                  ] else ...[
                    // Post Preview Card (Facebook / TikTok / YouTube)
                    () {
                      final photos = preview.images
                          .where((img) =>
                              img.type == 'slideshow_photo' ||
                              img.type == 'post_photo' ||
                              img.type == 'photo' ||
                              img.type.isEmpty)
                          .toList();
                      final targetImages = photos.isNotEmpty ? photos : preview.images;
                      final hasImages = targetImages.isNotEmpty;
                      final hasVideo = preview.hasVideo ||
                          preview.source == 'youtube' ||
                          preview.qualities.isNotEmpty ||
                          preview.type == 'video';
                      final isFacebook = preview.source == 'facebook';
                      final isTikTok = preview.source == 'tiktok';
                      final isInstagram = preview.source == 'instagram';
                      final isTelegram = preview.source == 'telegram';
                      final isX = preview.source == 'x' || preview.source == 'twitter';
                      final accentColor = isTelegram
                          ? const Color(0xFF38BDF8)
                          : isX
                          ? const Color(0xFFE7E9EA)
                          : (isInstagram
                              ? const Color(0xFFE1306C)
                              : (isFacebook
                                  ? const Color(0xFF1877F2)
                                  : (isTikTok ? const Color(0xFF22D3EE) : Colors.redAccent)));

                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Unified Post Card (Instagram / Facebook / TikTok / YouTube / Telegram / X)
                          () {
                            final platformName = isTelegram
                                ? 'Telegram'
                                : isX
                                ? 'X (Twitter)'
                                : (isInstagram
                                    ? 'Instagram'
                                    : (isFacebook ? 'Facebook' : (isTikTok ? 'TikTok' : 'YouTube')));
                            final platformIconAsset = isTelegram
                                ? 'assets/icons/telegram.svg'
                                : isX
                                ? 'assets/icons/twitter.svg'
                                : (isInstagram
                                    ? 'assets/icons/instagram.svg'
                                    : (isFacebook
                                        ? 'assets/icons/facebook.svg'
                                        : (isTikTok ? 'assets/icons/tiktok.svg' : 'assets/icons/youtube.svg')));

                            final authorName = preview.author?.name.isNotEmpty == true
                                ? preview.author!.name
                                : (preview.uploader.isNotEmpty
                                    ? ((isTikTok || isInstagram || isX || isTelegram) && !preview.uploader.startsWith('@')
                                        ? '@${preview.uploader}'
                                        : preview.uploader)
                                    : (preview.title.isNotEmpty ? preview.title : '$platformName Post'));

                            final subtitle = preview.createdTime.isNotEmpty
                                ? preview.createdTime
                                : (isTelegram
                                    ? 'Bài viết Telegram'
                                    : isX
                                    ? 'Bài viết X (Twitter)'
                                    : (isInstagram
                                        ? 'Bài viết Instagram'
                                        : (isFacebook
                                            ? 'Bài viết Facebook'
                                            : (isTikTok ? 'Video / Ảnh TikTok' : 'Video YouTube'))));

                            final showVideoVisual = (hasVideo && _mediaTypeTab == 'video') || (hasVideo && !hasImages);
                            final showImageVisual = !showVideoVisual && hasImages;

                            return Container(
                              decoration: BoxDecoration(
                                color: const Color(0xFF202124),
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: AppTheme.borderColor),
                              ),
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(15),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    // Author header row
                                    Container(
                                      padding: const EdgeInsets.all(10),
                                      color: const Color(0xFF18191C),
                                      child: Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Expanded(
                                            child: Row(
                                              children: [
                                                if (preview.author?.avatar.isNotEmpty == true)
                                                  ClipRRect(
                                                    borderRadius: BorderRadius.circular(18),
                                                    child: _buildPreviewImage(
                                                      preview.author!.avatar,
                                                      width: 36,
                                                      height: 36,
                                                      fit: BoxFit.cover,
                                                      errorWidget: _buildAvatarFallback(
                                                        preview,
                                                        accentColor,
                                                        platformName[0],
                                                      ),
                                                    ),
                                                  )
                                                else
                                                  _buildAvatarFallback(
                                                    preview,
                                                    accentColor,
                                                    platformName[0],
                                                  ),
                                                const SizedBox(width: 10),
                                                Expanded(
                                                  child: Column(
                                                    crossAxisAlignment: CrossAxisAlignment.start,
                                                    children: [
                                                      Text(
                                                        authorName,
                                                        maxLines: 1,
                                                        overflow: TextOverflow.ellipsis,
                                                        style: const TextStyle(
                                                          color: Colors.white,
                                                          fontSize: 12.5,
                                                          fontWeight: FontWeight.bold,
                                                        ),
                                                      ),
                                                      Text(
                                                        subtitle,
                                                        maxLines: 1,
                                                        overflow: TextOverflow.ellipsis,
                                                        style: const TextStyle(
                                                          color: Colors.white54,
                                                          fontSize: 10,
                                                        ),
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 8,
                                              vertical: 3,
                                            ),
                                            decoration: BoxDecoration(
                                              color: accentColor.withValues(alpha: 0.15),
                                              borderRadius: BorderRadius.circular(12),
                                              border: Border.all(
                                                color: accentColor.withValues(alpha: 0.35),
                                              ),
                                            ),
                                            child: Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                SvgPicture.asset(
                                                  platformIconAsset,
                                                  width: 11,
                                                  height: 11,
                                                  colorFilter: ColorFilter.mode(
                                                    accentColor,
                                                    BlendMode.srcIn,
                                                  ),
                                                ),
                                                const SizedBox(width: 4),
                                                Text(
                                                  platformName,
                                                  style: TextStyle(
                                                    color: accentColor,
                                                    fontSize: 10,
                                                    fontWeight: FontWeight.bold,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),

                                    // Video thumbnail or initial review photo in card
                                    if (showVideoVisual)
                                      _buildMediaPreviewBox(
                                        imageUrl: preview.thumbnail,
                                        isVideo: true,
                                        tagColor: accentColor,
                                      )
                                    else if (showImageVisual)
                                      _buildMediaPreviewBox(
                                        imageUrl: targetImages.first.thumbnail.isNotEmpty
                                            ? targetImages.first.thumbnail
                                            : targetImages.first.url,
                                        isVideo: false,
                                        totalImages: targetImages.length,
                                        tagColor: accentColor,
                                        onTap: () {
                                          _showImagePreviewDialog(
                                            context,
                                            targetImages,
                                            0,
                                            accentColor,
                                          );
                                        },
                                      )
                                    else if (!hasVideo && !hasImages && (preview.content.isNotEmpty || preview.title.isNotEmpty))
                                      Container(
                                        width: double.infinity,
                                        padding: const EdgeInsets.all(14),
                                        decoration: const BoxDecoration(
                                          color: Color(0xFF18191C),
                                          border: Border(
                                            top: BorderSide(color: Color(0xFF383C42)),
                                          ),
                                        ),
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Row(
                                              children: const [
                                                Icon(
                                                  Icons.article_rounded,
                                                  color: Colors.white70,
                                                  size: 15,
                                                ),
                                                SizedBox(width: 6),
                                                Text(
                                                  'Nội dung bài viết:',
                                                  style: TextStyle(
                                                    color: Colors.white70,
                                                    fontSize: 11,
                                                    fontWeight: FontWeight.bold,
                                                  ),
                                                ),
                                              ],
                                            ),
                                            const SizedBox(height: 8),
                                            Container(
                                              width: double.infinity,
                                              padding: const EdgeInsets.all(10),
                                              decoration: BoxDecoration(
                                                color: Colors.black45,
                                                borderRadius: BorderRadius.circular(10),
                                                border: Border.all(color: const Color(0xFF2E3136)),
                                              ),
                                              child: Text(
                                                preview.content.isNotEmpty ? preview.content : preview.title,
                                                style: const TextStyle(
                                                  color: Colors.white,
                                                  fontSize: 12,
                                                  height: 1.4,
                                                ),
                                                maxLines: 8,
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                            ),
                                            const SizedBox(height: 8),
                                            Row(
                                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                              children: const [
                                                Text(
                                                  'Định dạng: .txt',
                                                  style: TextStyle(
                                                    color: Color(0xFF34D399),
                                                    fontSize: 10,
                                                    fontFamily: 'monospace',
                                                    fontWeight: FontWeight.bold,
                                                  ),
                                                ),
                                                Text(
                                                  'Sẽ lưu thành tệp văn bản',
                                                  style: TextStyle(
                                                    color: Colors.white38,
                                                    fontSize: 10,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ],
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                            );
                          }(),
                          const SizedBox(height: 12),

                          // Segmented control when BOTH video and images are available
                          if (hasVideo && hasImages) ...[
                            Row(
                              children: [
                                Expanded(
                                  child: InkWell(
                                    onTap: () =>
                                        setState(() => _mediaTypeTab = 'video'),
                                    borderRadius: BorderRadius.circular(10),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                        vertical: 8,
                                      ),
                                      decoration: BoxDecoration(
                                        color: _mediaTypeTab == 'video'
                                            ? accentColor.withValues(alpha: 0.18)
                                            : Colors.transparent,
                                        borderRadius: BorderRadius.circular(10),
                                        border: Border.all(
                                          color: _mediaTypeTab == 'video'
                                              ? accentColor
                                                  .withValues(alpha: 0.4)
                                              : AppTheme.borderColor,
                                        ),
                                      ),
                                      alignment: Alignment.center,
                                      child: Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.center,
                                        children: [
                                          Icon(
                                            Icons.videocam_rounded,
                                            size: 15,
                                            color: _mediaTypeTab == 'video'
                                                ? accentColor
                                                : Colors.white60,
                                          ),
                                          const SizedBox(width: 5),
                                          Text(
                                            'Tải Video',
                                            style: TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.bold,
                                              color: _mediaTypeTab == 'video'
                                                  ? Colors.white
                                                  : Colors.white60,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: InkWell(
                                    onTap: () => setState(
                                      () => _mediaTypeTab = 'images',
                                    ),
                                    borderRadius: BorderRadius.circular(10),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                        vertical: 8,
                                      ),
                                      decoration: BoxDecoration(
                                        color: _mediaTypeTab == 'images'
                                            ? accentColor
                                                .withValues(alpha: 0.18)
                                            : Colors.transparent,
                                        borderRadius: BorderRadius.circular(10),
                                        border: Border.all(
                                          color: _mediaTypeTab == 'images'
                                              ? accentColor
                                                  .withValues(alpha: 0.4)
                                              : AppTheme.borderColor,
                                        ),
                                      ),
                                      alignment: Alignment.center,
                                      child: Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.center,
                                        children: [
                                          Icon(
                                            Icons.photo_library_rounded,
                                            size: 15,
                                            color: _mediaTypeTab == 'images'
                                                ? accentColor
                                                : Colors.white60,
                                          ),
                                          const SizedBox(width: 5),
                                          Text(
                                            'Tải Ảnh (${targetImages.length})',
                                            style: TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.bold,
                                              color: _mediaTypeTab == 'images'
                                                  ? Colors.white
                                                  : Colors.white60,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                          ],

                          // Image list if tab is images or if post only has images
                          if ((_mediaTypeTab == 'images' ||
                                  (!hasVideo && hasImages)) &&
                              hasImages) ...[
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                const Text(
                                  'Danh sách ảnh:',
                                  style: TextStyle(
                                    color: Colors.white70,
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                Text(
                                  'Đã chọn: ${_selectedIndices.length}/${targetImages.length}',
                                  style: TextStyle(
                                    color: accentColor,
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Container(
                              height: 76,
                              padding: const EdgeInsets.all(4),
                              decoration: BoxDecoration(
                                color: AppTheme.bgInput,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: AppTheme.borderColor),
                              ),
                              child: ListView.separated(
                                scrollDirection: Axis.horizontal,
                                itemCount: targetImages.length,
                                separatorBuilder: (_, __) =>
                                    const SizedBox(width: 6),
                                itemBuilder: (context, idx) {
                                  final img = targetImages[idx];
                                  final isSelected =
                                      _selectedIndices.contains(idx);
                                  final imageUrl = img.thumbnail.isNotEmpty
                                      ? img.thumbnail
                                      : img.url;
                                  return GestureDetector(
                                    onTap: () {
                                      _showImagePreviewDialog(
                                        context,
                                        targetImages,
                                        idx,
                                        accentColor,
                                      );
                                    },
                                    child: Container(
                                      width: 68,
                                      height: 68,
                                      decoration: BoxDecoration(
                                        borderRadius: BorderRadius.circular(10),
                                        border: Border.all(
                                          color: isSelected
                                              ? accentColor
                                              : AppTheme.borderColor,
                                          width: isSelected ? 2 : 1,
                                        ),
                                      ),
                                      padding: EdgeInsets.all(isSelected ? 2 : 1),
                                      child: ClipRRect(
                                        borderRadius: BorderRadius.circular(
                                          isSelected ? 8 : 9,
                                        ),
                                        child: Stack(
                                        fit: StackFit.expand,
                                        children: [
                                          Opacity(
                                            opacity: isSelected ? 1.0 : 0.45,
                                            child: _buildPreviewImage(
                                              imageUrl,
                                              fit: BoxFit.cover,
                                              errorWidget: Container(
                                                color: Colors.black38,
                                                child: const Icon(
                                                  Icons.broken_image_rounded,
                                                  color: Colors.white30,
                                                  size: 20,
                                                ),
                                              ),
                                            ),
                                          ),
                                          Positioned(
                                            top: 0,
                                            right: 0,
                                            child: GestureDetector(
                                              behavior: HitTestBehavior.opaque,
                                              onTap: () {
                                                setState(() {
                                                  if (isSelected) {
                                                    _selectedIndices.remove(idx);
                                                  } else {
                                                    _selectedIndices.add(idx);
                                                    _selectedIndices.sort();
                                                  }
                                                });
                                              },
                                              child: Container(
                                                width: 30,
                                                height: 30,
                                                alignment: Alignment.topRight,
                                                padding: const EdgeInsets.only(
                                                  top: 2,
                                                  right: 2,
                                                ),
                                                child: Container(
                                                  padding: const EdgeInsets.all(2),
                                                  decoration: BoxDecoration(
                                                    color: isSelected
                                                        ? accentColor
                                                        : Colors.black
                                                            .withValues(alpha: 0.65),
                                                    shape: BoxShape.circle,
                                                    border: Border.all(
                                                      color: isSelected
                                                          ? Colors.white
                                                          : Colors.white38,
                                                      width: 1,
                                                    ),
                                                  ),
                                                  child: Icon(
                                                    Icons.check,
                                                    size: 10,
                                                    color: isSelected
                                                        ? Colors.white
                                                        : Colors.white70,
                                                  ),
                                                ),
                                              ),
                                            ),
                                          ),
                                          Positioned(
                                            bottom: 0,
                                            left: 0,
                                            right: 0,
                                            child: Container(
                                              color: Colors.black
                                                  .withValues(alpha: 0.65),
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                vertical: 1,
                                              ),
                                              child: Text(
                                                '#${idx + 1}',
                                                textAlign: TextAlign.center,
                                                style: const TextStyle(
                                                  color: Colors.white70,
                                                  fontSize: 9,
                                                  fontFamily: 'monospace',
                                                ),
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                );
                                },
                              ),
                            ),
                            const SizedBox(height: 6),
                            // Button positioned BELOW square cards: Chọn tất cả
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                InkWell(
                                  onTap: () {
                                    setState(() {
                                      if (_selectedIndices.length ==
                                          targetImages.length) {
                                        _selectedIndices.clear();
                                      } else {
                                        _selectedIndices = List.generate(
                                          targetImages.length,
                                          (i) => i,
                                        );
                                      }
                                    });
                                  },
                                  borderRadius: BorderRadius.circular(8),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 10,
                                      vertical: 5,
                                    ),
                                    decoration: BoxDecoration(
                                      color: accentColor.withValues(alpha: 0.12),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(
                                        color: accentColor.withValues(alpha: 0.3),
                                      ),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(
                                          Icons.done_all_rounded,
                                          size: 14,
                                          color: accentColor,
                                        ),
                                        const SizedBox(width: 4),
                                        Text(
                                          _selectedIndices.length ==
                                                  targetImages.length
                                              ? 'Bỏ chọn tất cả'
                                              : 'Chọn tất cả',
                                          style: TextStyle(
                                            color: accentColor,
                                            fontSize: 11,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                                Text(
                                  _selectedIndices.isEmpty
                                      ? 'Chưa chọn ảnh nào'
                                      : 'Sẽ tải ${_selectedIndices.length} ảnh',
                                  style: const TextStyle(
                                    color: Colors.white54,
                                    fontSize: 11,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                          ],

                          // Multiple Videos Selector
                          if ((_mediaTypeTab == 'video' ||
                                  (!hasImages && hasVideo)) &&
                              preview.videos.length > 1) ...[
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'Danh sách video (${preview.videos.length}):',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                Text(
                                  'Đã chọn ${_selectedVideoIndices.length}/${preview.videos.length}',
                                  style: const TextStyle(
                                    color: Colors.white70,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Container(
                              height: 76,
                              padding: const EdgeInsets.all(4),
                              decoration: BoxDecoration(
                                color: AppTheme.bgInput,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: AppTheme.borderColor),
                              ),
                              child: ListView.separated(
                                scrollDirection: Axis.horizontal,
                                itemCount: preview.videos.length,
                                separatorBuilder: (_, _) =>
                                    const SizedBox(width: 8),
                                itemBuilder: (context, idx) {
                                  final vid = preview.videos[idx];
                                  final isSelected =
                                      _selectedVideoIndices.contains(idx);
                                  final durMin = (vid.duration / 60).floor();
                                  final durSec = vid.duration % 60;
                                  final durStr = vid.duration > 0
                                      ? '${durMin.toString().padLeft(2, '0')}:${durSec.toString().padLeft(2, '0')}'
                                      : '';

                                  return InkWell(
                                    borderRadius: BorderRadius.circular(10),
                                    onTap: () {
                                      setState(() {
                                        if (isSelected) {
                                          _selectedVideoIndices.remove(idx);
                                        } else {
                                          _selectedVideoIndices.add(idx);
                                          _selectedVideoIndices.sort();
                                        }
                                      });
                                    },
                                    child: Container(
                                      width: 68,
                                      height: 68,
                                      decoration: BoxDecoration(
                                        borderRadius: BorderRadius.circular(10),
                                        border: Border.all(
                                          color: isSelected
                                              ? accentColor
                                              : AppTheme.borderColor,
                                          width: isSelected ? 2 : 1,
                                        ),
                                      ),
                                      padding:
                                          EdgeInsets.all(isSelected ? 2 : 1),
                                      child: ClipRRect(
                                        borderRadius: BorderRadius.circular(
                                          isSelected ? 8 : 9,
                                        ),
                                        child: Stack(
                                          fit: StackFit.expand,
                                          children: [
                                            Opacity(
                                              opacity: isSelected ? 1.0 : 0.45,
                                              child: vid.thumbnail.isNotEmpty
                                                  ? _buildPreviewImage(
                                                      vid.thumbnail,
                                                      fit: BoxFit.cover,
                                                      errorWidget: Container(
                                                        color: Colors.black38,
                                                        child: const Icon(
                                                          Icons
                                                              .videocam_rounded,
                                                          color:
                                                              Colors.white30,
                                                          size: 20,
                                                        ),
                                                      ),
                                                    )
                                                  : Container(
                                                      color: Colors.black38,
                                                      child: const Icon(
                                                        Icons
                                                            .videocam_rounded,
                                                        color: Colors.white30,
                                                        size: 20,
                                                      ),
                                                    ),
                                            ),
                                            Center(
                                              child: Container(
                                                padding:
                                                    const EdgeInsets.all(3),
                                                decoration: const BoxDecoration(
                                                  color: Colors.black45,
                                                  shape: BoxShape.circle,
                                                ),
                                                child: const Icon(
                                                  Icons.play_arrow_rounded,
                                                  size: 14,
                                                  color: Colors.white,
                                                ),
                                              ),
                                            ),
                                            Positioned(
                                              top: 0,
                                              right: 0,
                                              child: GestureDetector(
                                                behavior:
                                                    HitTestBehavior.opaque,
                                                onTap: () {
                                                  setState(() {
                                                    if (isSelected) {
                                                      _selectedVideoIndices
                                                          .remove(idx);
                                                    } else {
                                                      _selectedVideoIndices
                                                          .add(idx);
                                                      _selectedVideoIndices
                                                          .sort();
                                                    }
                                                  });
                                                },
                                                child: Container(
                                                  width: 30,
                                                  height: 30,
                                                  alignment:
                                                      Alignment.topRight,
                                                  padding:
                                                      const EdgeInsets.only(
                                                    top: 2,
                                                    right: 2,
                                                  ),
                                                  child: Container(
                                                    padding:
                                                        const EdgeInsets.all(
                                                            2),
                                                    decoration:
                                                        BoxDecoration(
                                                      color: isSelected
                                                          ? accentColor
                                                          : Colors.black
                                                              .withValues(
                                                                  alpha: 0.65),
                                                      shape: BoxShape.circle,
                                                      border: Border.all(
                                                        color: isSelected
                                                            ? Colors.white
                                                            : Colors.white38,
                                                        width: 1,
                                                      ),
                                                    ),
                                                    child: Icon(
                                                      Icons.check,
                                                      size: 10,
                                                      color: isSelected
                                                          ? Colors.white
                                                          : Colors.white70,
                                                    ),
                                                  ),
                                                ),
                                              ),
                                            ),
                                            Positioned(
                                              bottom: 0,
                                              left: 0,
                                              right: 0,
                                              child: Container(
                                                color: Colors.black
                                                    .withValues(alpha: 0.65),
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                  vertical: 1,
                                                ),
                                                child: Text(
                                                  durStr.isNotEmpty
                                                      ? durStr
                                                      : '#${idx + 1}',
                                                  textAlign: TextAlign.center,
                                                  style: const TextStyle(
                                                    color: Colors.white70,
                                                    fontSize: 9,
                                                    fontFamily: 'monospace',
                                                  ),
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ),
                            const SizedBox(height: 6),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                InkWell(
                                  onTap: () {
                                    setState(() {
                                      if (_selectedVideoIndices.length ==
                                          preview.videos.length) {
                                        _selectedVideoIndices.clear();
                                      } else {
                                        _selectedVideoIndices = List.generate(
                                          preview.videos.length,
                                          (i) => i,
                                        );
                                      }
                                    });
                                  },
                                  borderRadius: BorderRadius.circular(8),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 10,
                                      vertical: 5,
                                    ),
                                    decoration: BoxDecoration(
                                      color:
                                          accentColor.withValues(alpha: 0.12),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(
                                        color:
                                            accentColor.withValues(alpha: 0.3),
                                      ),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(
                                          Icons.done_all_rounded,
                                          size: 14,
                                          color: accentColor,
                                        ),
                                        const SizedBox(width: 4),
                                        Text(
                                          _selectedVideoIndices.length ==
                                                  preview.videos.length
                                              ? 'Bỏ chọn tất cả'
                                              : 'Chọn tất cả',
                                          style: TextStyle(
                                            color: accentColor,
                                            fontSize: 11,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                                Text(
                                  _selectedVideoIndices.isEmpty
                                      ? 'Chưa chọn video nào'
                                      : 'Sẽ tải ${_selectedVideoIndices.length} video (.mp4)',
                                  style: const TextStyle(
                                    color: Colors.white54,
                                    fontSize: 11,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                          ],

                          // Video quality selector (single video only)
                          if ((_mediaTypeTab == 'video' ||
                                  (!hasImages && hasVideo)) &&
                              preview.videos.length <= 1 &&
                              preview.qualities.isNotEmpty) ...[
                            Row(
                              children: [
                                const Expanded(
                                  child: Text(
                                    'Chất lượng tải xuống:',
                                    style: TextStyle(
                                      color: Colors.white70,
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                                AppSelectMenu<int>(
                                  items: preview.qualities
                                      .map((q) => AppSelectItem<int>(
                                            value: q,
                                            label: '${q}p',
                                          ))
                                      .toList(),
                                  value: _quality,
                                  onChanged: (val) =>
                                      setState(() => _quality = val),
                                  disabled: _busy,
                                  accent: AppSelectAccent.blue,
                                  size: AppSelectSize.sm,
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                          ],
                        ],
                      );
                    }(),

                    // Destination indicator
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 7,
                      ),
                      decoration: BoxDecoration(
                        color: AppTheme.bgCard.withValues(alpha: 0.5),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppTheme.borderColor),
                      ),
                      child: Row(
                        children: [
                          const Text(
                            'Vị trí lưu:',
                            style: TextStyle(color: Colors.white54, fontSize: 11),
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              _destination.isEmpty
                                  ? 'Thư viện gốc (Root)'
                                  : '/$_destination',
                              textAlign: TextAlign.right,
                              style: const TextStyle(
                                color: Colors.amber,
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                fontFamily: 'monospace',
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  if (_busy) ...[
                    const SizedBox(height: 12),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(99),
                      child: const LinearProgressIndicator(
                        minHeight: 4,
                        color: AppTheme.googleBlue,
                        backgroundColor: AppTheme.bgCard,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Center(
                      child: Text(
                        preview == null ? 'Đang xem trước...' : 'Đang bắt đầu...',
                        style: const TextStyle(
                          color: Colors.white54,
                          fontSize: 11,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          actions: [
            if (preview != null)
              TextButton(
                onPressed:
                    _busy
                        ? null
                        : () => setState(() {
                              _preview = null;
                              _error = null;
                            }),
                child: const Text('Quay lại'),
              )
            else
              TextButton(
                onPressed:
                    _busy
                        ? null
                        : () {
                            _previewCancel?.cancel();
                            Navigator.of(context).pop();
                          },
                child: const Text('Hủy'),
              ),
            () {
              final tasks = context.watch<DownloadProvider>().tasks;
              String getStatusForType(String typeKey) {
                if (_downloadingTypes.contains(typeKey)) return 'downloading';
                if (_downloadedTypes.contains(typeKey)) return 'completed';
                final taskId = _activeTaskIds[typeKey];
                if (taskId == null) return 'idle';
                if (taskId == 'started') return 'downloading';
                final found = tasks.where((t) => t.taskId == taskId).firstOrNull;
                if (found == null) return 'downloading';
                if (found.stage == 'completed') return 'completed';
                if (found.stage == 'error' || found.stage == 'failed') return 'error';
                return 'downloading';
              }

              final videoStatus = getStatusForType('video');
              final imagesStatus = getStatusForType('images');
              final textStatus = getStatusForType('text');

              if (preview != null) {
                final hasVideo = preview.hasVideo ||
                    preview.source == 'youtube' ||
                    preview.qualities.isNotEmpty ||
                    preview.type == 'video';
                final photos = preview.images
                    .where((img) =>
                        img.type == 'slideshow_photo' ||
                        img.type == 'post_photo' ||
                        img.type == 'photo' ||
                        img.type.isEmpty)
                    .toList();
                final targetImages = photos.isNotEmpty
                    ? photos
                    : preview.images.where((img) => img.type != 'video').toList();
                final hasImages = targetImages.isNotEmpty;
                final isTextOnly = !hasVideo && !hasImages;

                // Auto close when download jobs are actually completed in background
                if (isTextOnly && textStatus == 'completed') {
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    if (mounted) Navigator.of(context).pop();
                  });
                } else if (!hasImages && hasVideo && videoStatus == 'completed') {
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    if (mounted) Navigator.of(context).pop();
                  });
                } else if (!hasVideo && hasImages && imagesStatus == 'completed') {
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    if (mounted) Navigator.of(context).pop();
                  });
                } else if (hasVideo && hasImages && videoStatus == 'completed' && imagesStatus == 'completed') {
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    if (mounted) Navigator.of(context).pop();
                  });
                }

                final currentStatus = isTextOnly
                    ? textStatus
                    : (_mediaTypeTab == 'images' || (!hasVideo && hasImages))
                    ? imagesStatus
                    : videoStatus;

                if (currentStatus == 'completed') {
                  return ElevatedButton.icon(
                    onPressed: null,
                    icon: const Icon(Icons.check_rounded, size: 16, color: Colors.white54),
                    label: const Text('Tải xong'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2A2B2F),
                      foregroundColor: Colors.white54,
                      disabledBackgroundColor: const Color(0xFF2A2B2F),
                      disabledForegroundColor: Colors.white54,
                      textStyle: const TextStyle(fontWeight: FontWeight.bold),
                      side: const BorderSide(color: Color(0xFF383C42)),
                    ),
                  );
                }

                if (currentStatus == 'downloading' || _busy) {
                  return ElevatedButton(
                    onPressed: null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.googleBlue.withValues(alpha: 0.7),
                      foregroundColor: AppTheme.bgBlock,
                      disabledBackgroundColor: AppTheme.googleBlue.withValues(alpha: 0.7),
                      disabledForegroundColor: AppTheme.bgBlock,
                      textStyle: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppTheme.bgBlock,
                          ),
                        ),
                        SizedBox(width: 8),
                        Text('Đang tải...'),
                      ],
                    ),
                  );
                }
              }

              return ElevatedButton(
                onPressed: _busy ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.googleBlue,
                  foregroundColor: AppTheme.bgBlock,
                  textStyle: const TextStyle(fontWeight: FontWeight.bold),
                ),
                child: Text(
                  _busy
                      ? (preview == null ? 'Đang xem trước...' : 'Đang tải...')
                      : preview == null
                      ? 'Tiếp tục'
                      : () {
                          final hasVideo = preview.hasVideo ||
                              preview.source == 'youtube' ||
                              preview.qualities.isNotEmpty ||
                              preview.type == 'video';
                          final photos = preview.images
                              .where((img) =>
                                  img.type == 'slideshow_photo' ||
                                  img.type == 'post_photo' ||
                                  img.type == 'photo' ||
                                  img.type.isEmpty)
                              .toList();
                          final targetImages = photos.isNotEmpty
                              ? photos
                              : preview.images.where((img) => img.type != 'video').toList();
                          final hasImages = targetImages.isNotEmpty;
                          final isTextOnly = !hasVideo && !hasImages;

                          if (isTextOnly) return 'Tải bài viết (.txt)';
                          if (_mediaTypeTab == 'images' || (!hasVideo && hasImages)) {
                            return targetImages.length > 1
                                ? 'Tải ${targetImages.length} ảnh'
                                : 'Tải ảnh';
                          }
                          return 'Tải Video';
                        }(),
                ),
              );
            }(),
          ],
        ),
      ),
    );
  }

  Widget _buildAvatarFallback(MediaDownloadPreview preview, Color color, String defaultInitial) {
    final name = preview.author?.name.isNotEmpty == true
        ? preview.author!.name
        : (preview.uploader.isNotEmpty ? preview.uploader : preview.title);
    final cleanName = name.replaceFirst(RegExp(r'^@'), '').trim();
    final initial = cleanName.isNotEmpty ? cleanName[0].toUpperCase() : defaultInitial;
    return Container(
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.2),
        shape: BoxShape.circle,
        border: Border.all(
          color: color.withValues(alpha: 0.4),
        ),
      ),
      alignment: Alignment.center,
      child: Text(
        initial,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.bold,
          fontSize: 14,
        ),
      ),
    );
  }

  Widget _buildMediaPreviewBox({
    required String imageUrl,
    required bool isVideo,
    int totalImages = 0,
    VoidCallback? onTap,
    String? platformTag,
    Color? tagColor,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 220,
        width: double.infinity,
        color: Colors.black,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Blurred backdrop for portrait/landscape fitting without awkward empty space
            if (imageUrl.trim().isNotEmpty)
              Opacity(
                opacity: 0.35,
                child: _buildPreviewImage(
                  imageUrl,
                  fit: BoxFit.cover,
                  errorWidget: const SizedBox(),
                ),
              ),
            // Centered media fit vertically/contained (respecting portrait and landscape)
            if (imageUrl.trim().isNotEmpty)
              Center(
                child: _buildPreviewImage(
                  imageUrl,
                  fit: BoxFit.contain,
                  errorWidget: const Center(
                    child: Icon(
                      Icons.broken_image_rounded,
                      color: Colors.white30,
                      size: 36,
                    ),
                  ),
                ),
              )
            else
              Center(
                child: Icon(
                  isVideo ? Icons.videocam_rounded : Icons.photo_library_rounded,
                  color: Colors.white24,
                  size: 44,
                ),
              ),
            // Top-right Expand / Zoom icon (if clickable for preview)
            if (onTap != null)
              Positioned(
                top: 8,
                right: 8,
                child: Container(
                  padding: const EdgeInsets.all(5),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.65),
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white24),
                  ),
                  child: const Icon(
                    Icons.fullscreen_rounded,
                    size: 16,
                    color: Colors.white,
                  ),
                ),
              ),
            // Platform tag (e.g. TikTok / YouTube)
            if (platformTag != null)
              Positioned(
                top: 8,
                left: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.75),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
                  ),
                  child: Text(
                    platformTag,
                    style: TextStyle(
                      color: tagColor ?? Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            // Bottom status badge
            Positioned(
              bottom: 8,
              right: 8,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.75),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.15),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      isVideo ? Icons.videocam_rounded : Icons.photo_library_rounded,
                      size: 13,
                      color: isVideo ? (tagColor ?? const Color(0xFF1877F2)) : const Color(0xFF22D3EE),
                    ),
                    const SizedBox(width: 4.5),
                    Text(
                      isVideo
                          ? 'Video'
                          : (totalImages > 1 ? '$totalImages ảnh • Xem trước' : 'Xem trước ảnh'),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showImagePreviewDialog(
    BuildContext context,
    List<MediaImageItem> targetImages,
    int initialIndex,
    Color accentColor,
  ) {
    if (targetImages.isEmpty) return;

    showGeneralDialog<void>(
      context: context,
      barrierDismissible: false,
      barrierColor: Colors.transparent,
      transitionDuration: const Duration(milliseconds: 200),
      pageBuilder: (dialogContext, anim, secondaryAnim) {
        return _PhotoPreviewDialog(
          images: targetImages,
          initialIndex: initialIndex,
          accentColor: accentColor,
          selectedIndices: _selectedIndices,
          onToggleSelection: (idx) {
            setState(() {
              if (_selectedIndices.contains(idx)) {
                _selectedIndices.remove(idx);
              } else {
                _selectedIndices.add(idx);
                _selectedIndices.sort();
              }
            });
          },
        );
      },
      transitionBuilder: (dialogContext, anim, secondaryAnim, child) {
        return FadeTransition(
          opacity: CurvedAnimation(parent: anim, curve: Curves.easeOut),
          child: child,
        );
      },
    );
  }

  Widget _buildSupportedPlatforms() {
    final cleanUrl = _url.text.trim().toLowerCase();
    final isFb = cleanUrl.isNotEmpty &&
        (cleanUrl.contains('facebook.com') ||
            cleanUrl.contains('fb.watch') ||
            cleanUrl.contains('fb.com') ||
            cleanUrl.contains('fb.me'));
    final isTt = cleanUrl.isNotEmpty && cleanUrl.contains('tiktok.com');
    final isYt = cleanUrl.isNotEmpty &&
        (cleanUrl.contains('youtube.com') || cleanUrl.contains('youtu.be'));
    final isIg = cleanUrl.isNotEmpty &&
        (cleanUrl.contains('instagram.com') || cleanUrl.contains('instagr.am'));
    final isTg = cleanUrl.isNotEmpty &&
        (cleanUrl.contains('t.me') || cleanUrl.contains('telegram.me'));
    final isX = cleanUrl.isNotEmpty &&
        (cleanUrl.contains('x.com') ||
            cleanUrl.contains('twitter.com') ||
            cleanUrl.contains('t.co'));

    final platforms = [
      _SupportedPlatform(
        id: 'facebook',
        name: 'Facebook',
        iconAsset: 'assets/icons/facebook.svg',
        color: const Color(0xFF1877F2),
        isActive: isFb,
      ),
      _SupportedPlatform(
        id: 'tiktok',
        name: 'TikTok',
        iconAsset: 'assets/icons/tiktok.svg',
        color: const Color(0xFF22D3EE),
        isActive: isTt,
      ),
      _SupportedPlatform(
        id: 'youtube',
        name: 'YouTube',
        iconAsset: 'assets/icons/youtube.svg',
        color: const Color(0xFFEF4444),
        isActive: isYt,
      ),
      _SupportedPlatform(
        id: 'instagram',
        name: 'Instagram',
        iconAsset: 'assets/icons/instagram.svg',
        color: const Color(0xFFE1306C),
        isActive: isIg,
      ),
      _SupportedPlatform(
        id: 'telegram',
        name: 'Telegram',
        iconAsset: 'assets/icons/telegram.svg',
        color: const Color(0xFF38BDF8),
        isActive: isTg,
      ),
      _SupportedPlatform(
        id: 'x',
        name: 'X (Twitter)',
        iconAsset: 'assets/icons/twitter.svg',
        color: const Color(0xFFE7E9EA),
        isActive: isX,
      ),
    ];

    final sortedPlatforms = List<_SupportedPlatform>.from(platforms);
    sortedPlatforms.sort((a, b) {
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      return 0;
    });

    const initialVisibleCount = 6;
    final hasMore = sortedPlatforms.length > initialVisibleCount;
    final displayedPlatforms = (_isPlatformsExpanded || !hasMore)
        ? sortedPlatforms
        : sortedPlatforms.take(initialVisibleCount).toList();

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 4.0),
            child: Text(
              'Hỗ trợ:',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: Colors.white.withValues(alpha: 0.5),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: AnimatedSize(
              duration: const Duration(milliseconds: 200),
              curve: Curves.easeInOut,
              alignment: Alignment.topCenter,
              child: Wrap(
                spacing: 6,
                runSpacing: 6,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  for (final platform in displayedPlatforms)
                    _buildPlatformBadge(platform),
                  if (hasMore)
                    InkWell(
                      onTap: () {
                        setState(() {
                          _isPlatformsExpanded = !_isPlatformsExpanded;
                        });
                      },
                      borderRadius: BorderRadius.circular(6),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 3.5,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.15),
                          ),
                        ),
                        child: Icon(
                          _isPlatformsExpanded
                              ? Icons.keyboard_arrow_up_rounded
                              : Icons.keyboard_arrow_down_rounded,
                          size: 14,
                          color: Colors.white70,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPlatformBadge(_SupportedPlatform platform) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3.5),
      decoration: BoxDecoration(
        color: platform.isActive
            ? platform.color.withValues(alpha: 0.18)
            : Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(
          color: platform.isActive
              ? platform.color.withValues(alpha: 0.5)
              : Colors.white.withValues(alpha: 0.08),
          width: 1,
        ),
        boxShadow: platform.isActive
            ? [
                BoxShadow(
                  color: platform.color.withValues(alpha: 0.25),
                  blurRadius: 4,
                  offset: const Offset(0, 1),
                ),
              ]
            : null,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SvgPicture.asset(
            platform.iconAsset,
            width: 12,
            height: 12,
            colorFilter: ColorFilter.mode(
              platform.isActive
                  ? platform.color
                  : Colors.white.withValues(alpha: 0.45),
              BlendMode.srcIn,
            ),
          ),
          const SizedBox(width: 4),
          Text(
            platform.name,
            style: TextStyle(
              fontSize: 10.5,
              fontWeight: platform.isActive ? FontWeight.bold : FontWeight.w600,
              color: platform.isActive
                  ? platform.color
                  : Colors.white.withValues(alpha: 0.45),
            ),
          ),
        ],
      ),
    );
  }
}

class _SupportedPlatform {
  final String id;
  final String name;
  final String iconAsset;
  final Color color;
  final bool isActive;

  const _SupportedPlatform({
    required this.id,
    required this.name,
    required this.iconAsset,
    required this.color,
    required this.isActive,
  });
}

class _PhotoPreviewDialog extends StatefulWidget {
  final List<MediaImageItem> images;
  final int initialIndex;
  final Color accentColor;
  final List<int> selectedIndices;
  final void Function(int index) onToggleSelection;

  const _PhotoPreviewDialog({
    required this.images,
    required this.initialIndex,
    required this.accentColor,
    required this.selectedIndices,
    required this.onToggleSelection,
  });

  @override
  State<_PhotoPreviewDialog> createState() => _PhotoPreviewDialogState();
}

class _PhotoPreviewDialogState extends State<_PhotoPreviewDialog>
    with SingleTickerProviderStateMixin {
  late final PageController _pageController;
  late int _currentIndex;
  double _dragOffsetY = 0.0;
  AnimationController? _resetAnimController;
  Animation<double>? _resetAnim;
  final Map<int, TransformationController> _transformControllers = {};

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    _pageController = PageController(initialPage: widget.initialIndex);
  }

  TransformationController _getController(int index) {
    return _transformControllers.putIfAbsent(index, () {
      final c = TransformationController();
      c.addListener(() {
        if (mounted) setState(() {});
      });
      return c;
    });
  }

  bool get _isCurrentZoomed {
    final c = _transformControllers[_currentIndex];
    if (c == null) return false;
    return c.value.getMaxScaleOnAxis() > 1.05;
  }

  void _animateReset() {
    final startY = _dragOffsetY;
    _resetAnimController?.dispose();
    final controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 200),
    );
    _resetAnimController = controller;
    _resetAnim = Tween<double>(begin: startY, end: 0.0).animate(
      CurvedAnimation(parent: controller, curve: Curves.easeOutCubic),
    )..addListener(() {
        setState(() {
          _dragOffsetY = _resetAnim!.value;
        });
      });
    controller.forward();
  }

  @override
  void dispose() {
    _pageController.dispose();
    _resetAnimController?.dispose();
    for (final c in _transformControllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isSelected = widget.selectedIndices.contains(_currentIndex);
    final dragFraction = (_dragOffsetY.abs() / 320.0).clamp(0.0, 1.0);
    final bgOpacity = (1.0 - dragFraction * 0.75).clamp(0.0, 1.0);
    final scaleFactor = (1.0 - dragFraction * 0.15).clamp(0.85, 1.0);
    final uiOpacity = (1.0 - dragFraction * 2.5).clamp(0.0, 1.0);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: GestureDetector(
        behavior: HitTestBehavior.translucent,
        onVerticalDragStart: _isCurrentZoomed
            ? null
            : (_) {
                _resetAnimController?.stop();
              },
        onVerticalDragUpdate: _isCurrentZoomed
            ? null
            : (details) {
                setState(() {
                  _dragOffsetY += details.delta.dy;
                });
              },
        onVerticalDragEnd: _isCurrentZoomed
            ? null
            : (details) {
                final velocity = details.primaryVelocity ?? 0;
                if (_dragOffsetY.abs() > 80 || velocity.abs() > 500) {
                  Navigator.of(context).pop();
                } else {
                  _animateReset();
                }
              },
        child: Container(
          color: Colors.black.withValues(alpha: bgOpacity),
          child: Stack(
            fit: StackFit.expand,
            children: [
              // Photo PageView
              Transform.translate(
                offset: Offset(0, _dragOffsetY),
                child: Transform.scale(
                  scale: scaleFactor,
                  child: PageView.builder(
                    controller: _pageController,
                    itemCount: widget.images.length,
                    physics: _isCurrentZoomed
                        ? const NeverScrollableScrollPhysics()
                        : const BouncingScrollPhysics(),
                    onPageChanged: (idx) {
                      setState(() {
                        _currentIndex = idx;
                      });
                    },
                    itemBuilder: (context, idx) {
                      final img = widget.images[idx];
                      final url = img.url.isNotEmpty ? img.url : img.thumbnail;
                      return Center(
                        child: InteractiveViewer(
                          transformationController: _getController(idx),
                          panEnabled: true,
                          minScale: 1.0,
                          maxScale: 4.0,
                          clipBehavior: Clip.none,
                          child: _buildPreviewImage(
                            url,
                            fit: BoxFit.contain,
                            errorWidget: const Center(
                              child: Icon(
                                Icons.broken_image_rounded,
                                color: Colors.white30,
                                size: 48,
                              ),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),

              // Left / Right touch navigation zones (if > 1 image and not zoomed)
              if (widget.images.length > 1 && !_isCurrentZoomed) ...[
                Positioned(
                  left: 0,
                  top: 100,
                  bottom: 100,
                  width: MediaQuery.of(context).size.width * 0.15,
                  child: GestureDetector(
                    behavior: HitTestBehavior.translucent,
                    onTap: _currentIndex > 0
                        ? () {
                            _pageController.previousPage(
                              duration: const Duration(milliseconds: 250),
                              curve: Curves.easeInOut,
                            );
                          }
                        : null,
                  ),
                ),
                Positioned(
                  right: 0,
                  top: 100,
                  bottom: 100,
                  width: MediaQuery.of(context).size.width * 0.15,
                  child: GestureDetector(
                    behavior: HitTestBehavior.translucent,
                    onTap: _currentIndex < widget.images.length - 1
                        ? () {
                            _pageController.nextPage(
                              duration: const Duration(milliseconds: 250),
                              curve: Curves.easeInOut,
                            );
                          }
                        : null,
                  ),
                ),
              ],

              // Pinned Top Header Toolbar
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: Opacity(
                  opacity: uiOpacity,
                  child: SafeArea(
                    bottom: false,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.black.withValues(alpha: 0.65),
                            Colors.transparent,
                          ],
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 5,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.18),
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                child: Text(
                                  '${_currentIndex + 1} / ${widget.images.length}',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              GestureDetector(
                                onTap: () {
                                  widget.onToggleSelection(_currentIndex);
                                  setState(() {});
                                },
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 12,
                                    vertical: 6,
                                  ),
                                  decoration: BoxDecoration(
                                    color: isSelected
                                        ? widget.accentColor
                                        : Colors.white.withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(16),
                                    border: Border.all(
                                      color: isSelected
                                          ? widget.accentColor
                                          : Colors.white24,
                                    ),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        Icons.check,
                                        size: 14,
                                        color: isSelected
                                            ? Colors.white
                                            : Colors.white70,
                                      ),
                                      const SizedBox(width: 5),
                                      Text(
                                        isSelected ? 'Đã chọn tải' : 'Chọn ảnh này',
                                        style: TextStyle(
                                          color: isSelected
                                              ? Colors.white
                                              : Colors.white70,
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                          GestureDetector(
                            onTap: () => Navigator.of(context).pop(),
                            child: Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.18),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.close_rounded,
                                color: Colors.white,
                                size: 20,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),

              // Pinned Bottom Dots Indicator
              if (widget.images.length > 1)
                Positioned(
                  bottom: 0,
                  left: 0,
                  right: 0,
                  child: Opacity(
                    opacity: uiOpacity,
                    child: SafeArea(
                      top: false,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 20,
                          vertical: 14,
                        ),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.bottomCenter,
                            end: Alignment.topCenter,
                            colors: [
                              Colors.black.withValues(alpha: 0.65),
                              Colors.transparent,
                            ],
                          ),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: List.generate(
                            widget.images.length > 10 ? 10 : widget.images.length,
                            (i) {
                              final active = i == _currentIndex ||
                                  (widget.images.length > 10 &&
                                      i == 9 &&
                                      _currentIndex >= 9);
                              return Container(
                                width: active ? 16 : 6,
                                height: 6,
                                margin: const EdgeInsets.symmetric(
                                  horizontal: 2.5,
                                ),
                                decoration: BoxDecoration(
                                  color: active
                                      ? widget.accentColor
                                      : Colors.white24,
                                  borderRadius: BorderRadius.circular(3),
                                ),
                              );
                            },
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
