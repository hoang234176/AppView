import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/api/download_api.dart';
import 'package:mobile/widgets/download_media_dialog.dart';

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
  });

  testWidgets('media entry is separate and validates URL before preview', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(home: DownloadMediaDialog(currentPath: '/Ảnh/Test')),
    );
    expect(find.text('Tải ảnh/video'), findsOneWidget);
    expect(find.text('Liên kết'), findsOneWidget);
    expect(find.text('Tiếp tục'), findsOneWidget);
    expect(find.text('Lưu vào: /Ảnh/Test'), findsOneWidget);
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
