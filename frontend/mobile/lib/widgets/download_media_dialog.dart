import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import '../api/download_api.dart';
import '../providers/download_provider.dart';
import '../theme/app_theme.dart';
import 'app_select_menu.dart';
import 'config_api_dialog.dart';
import 'folder_picker_view.dart';

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
  bool _busy = false;
  String? _error;
  late String _destination;

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
      final isImages = _mediaTypeTab == 'images' || (!_preview!.hasVideo && targetImages.isNotEmpty);

      if (isImages && _selectedIndices.isEmpty) {
        setState(() {
          _busy = false;
          _error = 'Vui lòng chọn ít nhất 1 ảnh để tải xuống.';
        });
        return;
      }

      final result = await context
          .read<DownloadProvider>()
          .startCoordinatorDownload(
            url: url,
            destination: canonicalDownloadDestination(_destination),
            quality: isImages ? null : _quality,
            selectedIndices: isImages ? _selectedIndices : null,
            mediaType: isImages ? 'images' : 'video',
          );
      if (!mounted) return;
      setState(() => _busy = false);
      if (result['success'] == true) {
        Navigator.of(context).pop();
      } else {
        setState(
          () =>
              _error =
                  result['message'] as String? ??
                  'Không thể bắt đầu tải xuống.',
        );
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
      final targetImages = photos.isNotEmpty ? photos : preview.images;
      final hasImages = targetImages.isNotEmpty;
      final hasVideo = preview.hasVideo || preview.source == 'youtube' || preview.qualities.isNotEmpty;

      setState(() {
        _preview = preview;
        _quality = preview.qualities.isNotEmpty ? preview.qualities.first : null;
        _selectedIndices = List.generate(targetImages.length, (i) => i);
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
      canPop: !(_busy && preview != null),
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
                          preview.qualities.isNotEmpty;
                      final isFacebook = preview.source == 'facebook';
                      final isTikTok = preview.source == 'tiktok';
                      final accentColor = isFacebook
                          ? const Color(0xFF1877F2)
                          : (isTikTok ? const Color(0xFF22D3EE) : Colors.redAccent);

                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (isFacebook) ...[
                            // Facebook Post Card
                            Container(
                              decoration: BoxDecoration(
                                color: const Color(0xFF202124),
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: AppTheme.borderColor),
                              ),
                              clipBehavior: Clip.antiAlias,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  // Author header row
                                  Container(
                                    padding: const EdgeInsets.all(10),
                                    color: const Color(0xFF18191C),
                                    child: Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.spaceBetween,
                                      children: [
                                        Expanded(
                                          child: Row(
                                            children: [
                                              if (preview.author?.avatar.isNotEmpty == true)
                                                ClipRRect(
                                                  borderRadius:
                                                      BorderRadius.circular(18),
                                                  child: Image.network(
                                                    preview.author!.avatar,
                                                    width: 36,
                                                    height: 36,
                                                    fit: BoxFit.cover,
                                                    errorBuilder:
                                                        (_, __, ___) =>
                                                            _buildFbAvatarFallback(
                                                      preview,
                                                    ),
                                                  ),
                                                )
                                              else
                                                _buildFbAvatarFallback(preview),
                                              const SizedBox(width: 10),
                                              Expanded(
                                                child: Column(
                                                  crossAxisAlignment:
                                                      CrossAxisAlignment.start,
                                                  children: [
                                                    Text(
                                                      preview.author?.name.isNotEmpty == true
                                                          ? preview.author!.name
                                                          : (preview.uploader.isNotEmpty
                                                              ? preview.uploader
                                                              : (preview.title.isNotEmpty
                                                                  ? preview.title
                                                                  : 'Facebook Post')),
                                                      maxLines: 1,
                                                      overflow:
                                                          TextOverflow.ellipsis,
                                                      style: const TextStyle(
                                                        color: Colors.white,
                                                        fontSize: 12.5,
                                                        fontWeight:
                                                            FontWeight.bold,
                                                      ),
                                                    ),
                                                    Text(
                                                      preview.createdTime.isNotEmpty
                                                          ? preview.createdTime
                                                          : 'Bài viết Facebook',
                                                      maxLines: 1,
                                                      overflow:
                                                          TextOverflow.ellipsis,
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
                                            color: const Color(0xFF1877F2)
                                                .withValues(alpha: 0.15),
                                            borderRadius:
                                                BorderRadius.circular(12),
                                            border: Border.all(
                                              color: const Color(0xFF1877F2)
                                                  .withValues(alpha: 0.35),
                                            ),
                                          ),
                                          child: Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              SvgPicture.asset(
                                                'assets/icons/facebook.svg',
                                                width: 11,
                                                height: 11,
                                                colorFilter:
                                                    const ColorFilter.mode(
                                                  Color(0xFF1877F2),
                                                  BlendMode.srcIn,
                                                ),
                                              ),
                                              const SizedBox(width: 4),
                                              const Text(
                                                'Facebook',
                                                style: TextStyle(
                                                  color: Color(0xFF1877F2),
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

                                  // Post Content / Caption
                                  if (preview.content.isNotEmpty)
                                    Container(
                                      width: double.infinity,
                                      constraints: const BoxConstraints(
                                        maxHeight: 90,
                                      ),
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 10,
                                        vertical: 8,
                                      ),
                                      color: const Color(0xFF16171A),
                                      child: SingleChildScrollView(
                                        child: Text(
                                          preview.content,
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 11.5,
                                            height: 1.35,
                                          ),
                                        ),
                                      ),
                                    )
                                  else if (preview.title.isNotEmpty &&
                                      preview.title != 'Facebook Post')
                                    Container(
                                      width: double.infinity,
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 10,
                                        vertical: 6,
                                      ),
                                      color: const Color(0xFF16171A),
                                      child: Text(
                                        preview.title,
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          color: Colors.white70,
                                          fontSize: 11.5,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                    ),

                                  // Reactions bar
                                  if (preview.reactions != null &&
                                      (preview.reactions!.likes > 0 ||
                                          preview.reactions!.comments > 0 ||
                                          preview.reactions!.shares > 0))
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 10,
                                        vertical: 6,
                                      ),
                                      color: const Color(0xFF131417),
                                      child: Row(
                                        children: [
                                          if (preview.reactions!.likes > 0) ...[
                                            const Icon(
                                              Icons.thumb_up_alt_rounded,
                                              size: 13,
                                              color: Color(0xFF1877F2),
                                            ),
                                            const SizedBox(width: 4),
                                            Text(
                                              '${preview.reactions!.likes}',
                                              style: const TextStyle(
                                                color: Color(0xFF1877F2),
                                                fontSize: 11,
                                                fontWeight: FontWeight.bold,
                                              ),
                                            ),
                                            const SizedBox(width: 14),
                                          ],
                                          if (preview.reactions!.comments > 0) ...[
                                            const Icon(
                                              Icons.chat_bubble_outline_rounded,
                                              size: 13,
                                              color: Colors.white70,
                                            ),
                                            const SizedBox(width: 4),
                                            Text(
                                              '${preview.reactions!.comments}',
                                              style: const TextStyle(
                                                color: Colors.white70,
                                                fontSize: 11,
                                              ),
                                            ),
                                            const SizedBox(width: 14),
                                          ],
                                          if (preview.reactions!.shares > 0) ...[
                                            const Icon(
                                              Icons.share_rounded,
                                              size: 13,
                                              color: Colors.white70,
                                            ),
                                            const SizedBox(width: 4),
                                            Text(
                                              '${preview.reactions!.shares}',
                                              style: const TextStyle(
                                                color: Colors.white70,
                                                fontSize: 11,
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                                    ),

                                  // Video thumbnail if has_video
                                  if (preview.hasVideo &&
                                      preview.thumbnail.isNotEmpty)
                                    AspectRatio(
                                      aspectRatio: 16 / 9,
                                      child: Stack(
                                        fit: StackFit.expand,
                                        children: [
                                          Image.network(
                                            preview.thumbnail,
                                            fit: BoxFit.cover,
                                            errorBuilder:
                                                (_, __, ___) => Container(
                                              color: Colors.black38,
                                              child: const Center(
                                                child: Icon(
                                                  Icons.videocam_rounded,
                                                  color: Colors.white38,
                                                  size: 32,
                                                ),
                                              ),
                                            ),
                                          ),
                                          Center(
                                            child: Container(
                                              width: 40,
                                              height: 40,
                                              decoration: BoxDecoration(
                                                color: Colors.black
                                                    .withValues(alpha: 0.65),
                                                shape: BoxShape.circle,
                                                border: Border.all(
                                                  color: Colors.white30,
                                                ),
                                              ),
                                              child: const Icon(
                                                Icons.play_arrow_rounded,
                                                color: Color(0xFF1877F2),
                                                size: 24,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          ] else ...[
                            // TikTok / YouTube Card
                            Container(
                              decoration: BoxDecoration(
                                color: AppTheme.bgCard,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: AppTheme.borderColor),
                              ),
                              clipBehavior: Clip.antiAlias,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  if (preview.thumbnail.isNotEmpty)
                                    Stack(
                                      children: [
                                        AspectRatio(
                                          aspectRatio: 16 / 9,
                                          child: Image.network(
                                            preview.thumbnail,
                                            fit: BoxFit.cover,
                                            errorBuilder:
                                                (_, _, _) => Container(
                                              color: Colors.black26,
                                              child: const Center(
                                                child: Icon(
                                                  Icons.video_library_outlined,
                                                  color: Colors.white38,
                                                  size: 32,
                                                ),
                                              ),
                                            ),
                                          ),
                                        ),
                                        Positioned(
                                          top: 8,
                                          left: 8,
                                          child: Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 6,
                                              vertical: 2,
                                            ),
                                            decoration: BoxDecoration(
                                              color: Colors.black
                                                  .withValues(alpha: 0.75),
                                              borderRadius:
                                                  BorderRadius.circular(6),
                                              border: Border.all(
                                                color: Colors.white
                                                    .withValues(alpha: 0.15),
                                              ),
                                            ),
                                            child: Text(
                                              isTikTok ? 'TikTok' : 'YouTube',
                                              style: TextStyle(
                                                color: isTikTok
                                                    ? const Color(0xFF22D3EE)
                                                    : Colors.redAccent,
                                                fontSize: 10,
                                                fontWeight: FontWeight.bold,
                                              ),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  Padding(
                                    padding: const EdgeInsets.all(10),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          preview.title,
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 12.5,
                                            fontWeight: FontWeight.bold,
                                            height: 1.25,
                                          ),
                                        ),
                                        if (preview.uploader.isNotEmpty) ...[
                                          const SizedBox(height: 3),
                                          Text(
                                            preview.uploader,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                              color: Colors.white54,
                                              fontSize: 11,
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
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
                                            ? (isFacebook
                                                ? const Color(0xFF1877F2)
                                                    .withValues(alpha: 0.18)
                                                : Colors.redAccent
                                                    .withValues(alpha: 0.18))
                                            : Colors.transparent,
                                        borderRadius: BorderRadius.circular(10),
                                        border: Border.all(
                                          color: _mediaTypeTab == 'video'
                                              ? (isFacebook
                                                  ? const Color(0xFF1877F2)
                                                      .withValues(alpha: 0.4)
                                                  : Colors.redAccent
                                                      .withValues(alpha: 0.4))
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
                                                ? (isFacebook
                                                    ? const Color(0xFF1877F2)
                                                    : Colors.redAccent)
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
                                      clipBehavior: Clip.antiAlias,
                                      child: Stack(
                                        fit: StackFit.expand,
                                        children: [
                                          Opacity(
                                            opacity: isSelected ? 1.0 : 0.45,
                                            child: Image.network(
                                              imageUrl,
                                              fit: BoxFit.cover,
                                              errorBuilder:
                                                  (_, __, ___) => Container(
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
                                            top: 3,
                                            right: 3,
                                            child: Container(
                                              padding: const EdgeInsets.all(2),
                                              decoration: BoxDecoration(
                                                color: isSelected
                                                    ? accentColor
                                                    : Colors.black
                                                        .withValues(alpha: 0.6),
                                                shape: BoxShape.circle,
                                              ),
                                              child: Icon(
                                                Icons.check,
                                                size: 10,
                                                color: isSelected
                                                    ? Colors.white
                                                    : Colors.white54,
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

                          // Video quality selector
                          if ((_mediaTypeTab == 'video' ||
                                  (!hasImages && hasVideo)) &&
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
            ElevatedButton(
              onPressed: _busy ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.googleBlue,
                foregroundColor: AppTheme.bgBlock,
                textStyle: const TextStyle(fontWeight: FontWeight.bold),
              ),
              child: Text(preview == null ? 'Tiếp tục' : 'Tải xuống'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFbAvatarFallback(MediaDownloadPreview preview) {
    final initial = preview.uploader.isNotEmpty
        ? preview.uploader[0].toUpperCase()
        : (preview.title.isNotEmpty ? preview.title[0].toUpperCase() : 'F');
    return Container(
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        color: const Color(0xFF1877F2).withValues(alpha: 0.2),
        shape: BoxShape.circle,
        border: Border.all(
          color: const Color(0xFF1877F2).withValues(alpha: 0.4),
        ),
      ),
      alignment: Alignment.center,
      child: Text(
        initial,
        style: const TextStyle(
          color: Color(0xFF1877F2),
          fontWeight: FontWeight.bold,
          fontSize: 14,
        ),
      ),
    );
  }
}
