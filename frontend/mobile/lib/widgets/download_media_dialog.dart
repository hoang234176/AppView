import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/download_api.dart';
import '../providers/download_provider.dart';
import '../theme/app_theme.dart';

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
            destination: canonicalDownloadDestination(widget.currentPath),
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
        _quality = preview.qualities.first;
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
      child: AlertDialog(
        backgroundColor: AppTheme.bgBlock,
        title: const Text('Tải ảnh/video'),
        content: SizedBox(
          width: 360,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (preview == null) ...[
                  const Text('Liên kết'),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _url,
                    autofocus: true,
                    enabled: !_busy,
                    keyboardType: TextInputType.url,
                    onSubmitted: (_) => _submit(),
                    decoration: const InputDecoration(
                      hintText: 'https://youtube.com/...',
                    ),
                  ),
                ] else ...[
                  const Text(
                    'YouTube',
                    style: TextStyle(color: Colors.redAccent),
                  ),
                  const SizedBox(height: 8),
                  if (preview.thumbnail.isNotEmpty)
                    AspectRatio(
                      aspectRatio: 16 / 9,
                      child: Image.network(
                        preview.thumbnail,
                        fit: BoxFit.cover,
                        errorBuilder:
                            (_, _, _) =>
                                const Icon(Icons.video_library_outlined),
                      ),
                    ),
                  const SizedBox(height: 8),
                  Text(
                    preview.title,
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  if (preview.uploader.isNotEmpty) Text(preview.uploader),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      const Expanded(child: Text('Chất lượng tải xuống')),
                      const SizedBox(width: 8),
                      DropdownButton<int>(
                        value: _quality,
                        items:
                            preview.qualities
                                .map(
                                  (value) => DropdownMenuItem(
                                    value: value,
                                    child: Text('${value}p'),
                                  ),
                                )
                                .toList(),
                        onChanged:
                            _busy
                                ? null
                                : (value) => setState(() => _quality = value),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 12),
                Text(
                  'Lưu vào: ${canonicalDownloadDestination(widget.currentPath)}',
                  style: const TextStyle(fontSize: 12),
                ),
                if (_busy) ...[
                  const SizedBox(height: 12),
                  const LinearProgressIndicator(),
                  Text(
                    preview == null ? 'Đang xem trước...' : 'Đang bắt đầu...',
                  ),
                ],
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    _error!,
                    style: const TextStyle(color: Colors.redAccent),
                  ),
                ],
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed:
                _busy && preview != null
                    ? null
                    : () {
                      _previewCancel?.cancel();
                      Navigator.of(context).pop();
                    },
            child: const Text('Hủy'),
          ),
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
            ),
          FilledButton(
            onPressed: _busy ? null : _submit,
            child: Text(preview == null ? 'Tiếp tục' : 'Tải xuống'),
          ),
        ],
      ),
    );
  }
}
