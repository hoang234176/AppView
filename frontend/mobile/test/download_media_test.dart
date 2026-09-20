import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/api/download_api.dart';
import 'package:mobile/providers/app_state_provider.dart';
import 'package:mobile/widgets/download_media_dialog.dart';
import 'package:provider/provider.dart';

void main() {
  test('preview consumes normalized resolutions and optional metadata', () {
    final preview = MediaDownloadPreview.fromJson({
      'source': 'youtube',
      'title': 'Video',
      'qualities': [2160, 1080, 720],
    });
    expect(preview.qualities, [2160, 1080, 720]);
    expect(preview.qualities.first, 2160);
    expect(preview.thumbnail, '');
    expect(preview.uploader, '');
    expect(preview.hasVideo, isTrue);
  });

  test('preview identifies video posts even without has_video field', () {
    final previewVideo = MediaDownloadPreview.fromJson({
      'source': 'facebook',
      'type': 'video',
      'title': 'FB Video',
    });
    expect(previewVideo.hasVideo, isTrue);

    final previewText = MediaDownloadPreview.fromJson({
      'source': 'facebook',
      'type': 'post',
      'title': 'Status only',
      'content': 'Hello world',
      'has_video': false,
    });
    expect(previewText.hasVideo, isFalse);
    expect(previewText.images.isEmpty, isTrue);
  });

  testWidgets('media entry is separate and validates URL before preview', (
    tester,
  ) async {
    final appState = AppStateProvider();
    await tester.pumpWidget(
      ChangeNotifierProvider<AppStateProvider>.value(
        value: appState,
        child: const MaterialApp(
          home: DownloadMediaDialog(currentPath: '/Ảnh/Test'),
        ),
      ),
    );
    expect(find.text('Tải ảnh/video'), findsOneWidget);
    expect(find.text('Dán liên kết MXH'), findsOneWidget);
    expect(find.text('Tiếp tục'), findsOneWidget);
    expect(find.text('Chọn thư mục lưu trữ:'), findsOneWidget);
    expect(find.byType(TextField), findsOneWidget);
    expect(
      tester.widget<TextField>(find.byType(TextField)).obscureText,
      isFalse,
    );
    expect(find.textContaining('MediaFire'), findsNothing);
    await tester.enterText(find.byType(TextField), 'invalid-url');
    await tester.tap(find.text('Tiếp tục'));
    await tester.pump();
    expect(find.text('Liên kết không hợp lệ.'), findsOneWidget);
    expect(find.byType(DropdownButton<int>), findsNothing);
  });
}
