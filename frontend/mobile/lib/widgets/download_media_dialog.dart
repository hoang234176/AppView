import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/download_api.dart';
import '../providers/download_provider.dart';
import '../theme/app_theme.dart';
import 'app_select_menu.dart';
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
  bool _busy = false;
  String? _error;
  late String _destination;

  @override
  void initState() {
    super.initState();
    _destination = widget.currentPath;
  }

  @override
  void dispose() {
    _previewCancel?.cancel();
    _url.dispose();
    super.dispose();
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
      final result = await context
          .read<DownloadProvider>()
          .startCoordinatorDownload(
            url: url,
            destination: canonicalDownloadDestination(_destination),
            quality: _quality,
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
      setState(() {
        _preview = preview;
        _quality = preview.qualities.isNotEmpty ? preview.qualities.first : null;
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
                    : 'Không thể xem trước video. Vui lòng thử lại.',
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
            borderRadius: BorderRadius.circular(24),
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
                  Icons.movie_creation_outlined,
                  color: Colors.redAccent,
                  size: 18,
                ),
              ),
              const SizedBox(width: 10),
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Tải ảnh/video',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  Text(
                    'YouTube',
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.white54,
                      fontWeight: FontWeight.normal,
                    ),
                  ),
                ],
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
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppTheme.errorRed.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: AppTheme.errorRed.withValues(alpha: 0.3),
                        ),
                      ),
                      child: Text(
                        _error!,
                        style: const TextStyle(
                          color: AppTheme.errorRed,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                  ],

                  if (preview == null) ...[
                    const Text(
                      'Liên kết YouTube:',
                      style: TextStyle(
                        color: Colors.white70,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    TextField(
                      controller: _url,
                      autofocus: true,
                      enabled: !_busy,
                      keyboardType: TextInputType.url,
                      textInputAction: TextInputAction.done,
                      onSubmitted: (_) => _submit(),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontFamily: 'monospace',
                      ),
                      decoration: InputDecoration(
                        hintText: 'https://www.youtube.com/watch?v=...',
                        hintStyle: const TextStyle(
                          color: Colors.white38,
                          fontSize: 12,
                        ),
                        filled: true,
                        fillColor: AppTheme.bgCard,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: AppTheme.borderColor),
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
                    // Compact YouTube Preview Card
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
                                      color: Colors.black.withValues(alpha: 0.75),
                                      borderRadius: BorderRadius.circular(6),
                                      border: Border.all(
                                        color: Colors.white.withValues(alpha: 0.15),
                                      ),
                                    ),
                                    child: const Text(
                                      'YouTube',
                                      style: TextStyle(
                                        color: Colors.redAccent,
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
                              crossAxisAlignment: CrossAxisAlignment.start,
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
                    const SizedBox(height: 12),

                    // AppView styled quality selector
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
                              .map((q) => AppSelectItem<int>(value: q, label: '${q}p'))
                              .toList(),
                          value: _quality,
                          onChanged: (val) => setState(() => _quality = val),
                          disabled: _busy,
                          accent: AppSelectAccent.blue,
                          size: AppSelectSize.sm,
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),

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
}
