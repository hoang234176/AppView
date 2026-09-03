import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/screens/lightbox_screen.dart';
import 'package:mobile/screens/video_player_screen.dart';
import 'package:mobile/models/picture_item.dart';
import 'package:mobile/models/video_item.dart';

void main() {
  testWidgets('LightboxScreen pops on vertical swipe down', (WidgetTester tester) async {
    final pictures = [
      PictureItem(
        name: 'Test Image',
        path: '/test/image.jpg',
        url: 'http://localhost/test.jpg',
      ),
    ];

    bool popped = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => ElevatedButton(
            onPressed: () async {
              await Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => LightboxScreen(pictures: pictures),
                ),
              );
              popped = true;
            },
            child: const Text('Open Lightbox'),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open Lightbox'));
    await tester.pumpAndSettle();

    expect(find.byType(LightboxScreen), findsOneWidget);

    await tester.drag(find.byType(LightboxScreen), const Offset(0, 300));
    await tester.pumpAndSettle();

    expect(find.byType(LightboxScreen), findsNothing);
    expect(popped, isTrue);
  });

  testWidgets('VideoPlayerScreen pops on vertical swipe down', (WidgetTester tester) async {
    final videos = [
      VideoItem(
        name: 'Test Video',
        path: '/test/video.mp4',
        url: 'http://localhost/test.mp4',
      ),
    ];

    bool popped = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => ElevatedButton(
            onPressed: () async {
              await Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => VideoPlayerScreen(videos: videos),
                ),
              );
              popped = true;
            },
            child: const Text('Open Video'),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open Video'));
    await tester.pumpAndSettle();

    expect(find.byType(VideoPlayerScreen), findsOneWidget);

    await tester.drag(find.byType(VideoPlayerScreen), const Offset(0, 300));
    await tester.pumpAndSettle();

    expect(find.byType(VideoPlayerScreen), findsNothing);
    expect(popped, isTrue);
  });
}
