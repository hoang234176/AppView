import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('Generate App Launcher Icons', () async {
    final sizesAndroid = {
      'android/app/src/main/res/mipmap-mdpi/ic_launcher.png': 48,
      'android/app/src/main/res/mipmap-hdpi/ic_launcher.png': 72,
      'android/app/src/main/res/mipmap-xhdpi/ic_launcher.png': 96,
      'android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png': 144,
      'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png': 192,
    };

    final sizesIos = {
      'ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-20x20@1x.png': 20,
      'ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-20x20@2x.png': 40,
      'ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-20x20@3x.png': 60,
      'ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-29x29@1x.png': 29,
      'ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-29x29@2x.png': 58,
      'ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-29x29@3x.png': 87,
      'ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-40x40@1x.png': 40,
      'ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-40x40@2x.png': 80,
      'ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-40x40@3x.png': 120,
      'ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-60x60@2x.png': 120,
      'ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-60x60@3x.png': 180,
      'ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-76x76@1x.png': 76,
      'ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-76x76@2x.png': 152,
      'ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-83.5x83.5@2x.png': 167,
      'ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-1024x1024@1x.png': 1024,
    };

    final allTargets = {
      ...sizesAndroid,
      ...sizesIos,
      'assets/icons/app_icon.png': 1024,
    };

    for (final entry in allTargets.entries) {
      final size = entry.value.toDouble();
      final recorder = ui.PictureRecorder();
      final canvas = Canvas(recorder, Rect.fromLTWH(0, 0, size, size));

      _drawAppIcon(canvas, size);

      final picture = recorder.endRecording();
      final img = await picture.toImage(size.toInt(), size.toInt());
      final byteData = await img.toByteData(format: ui.ImageByteFormat.png);
      final bytes = byteData!.buffer.asUint8List();

      final file = File(entry.key);
      await file.parent.create(recursive: true);
      await file.writeAsBytes(bytes);
      // ignore: avoid_print
      print('Generated ${entry.key} ($size x $size)');
    }
  });
}

void _drawAppIcon(Canvas canvas, double size) {
  // 1. Background Fill - Elegant dark slate background
  final bgPaint = Paint()..color = const Color(0xFF18191C);
  canvas.drawRect(Rect.fromLTWH(0, 0, size, size), bgPaint);

  // 2. Subtle Gradient Circle/Rounded Backing
  final innerPadding = size * 0.12;
  final cardRect = RRect.fromRectAndRadius(
    Rect.fromLTWH(innerPadding, innerPadding, size - innerPadding * 2, size - innerPadding * 2),
    Radius.circular(size * 0.22),
  );

  final borderGradient = const LinearGradient(
    colors: [
      Color(0xFF4285F4), // Google Blue
      Color(0xFF34A853), // Google Green
      Color(0xFFFBBC05), // Google Yellow
      Color(0xFFEA4335), // Google Red
    ],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  ).createShader(cardRect.outerRect);

  final borderPaint = Paint()
    ..shader = borderGradient
    ..style = PaintingStyle.stroke
    ..strokeWidth = size * 0.035;
  canvas.drawRRect(cardRect, borderPaint);

  final innerCardPaint = Paint()..color = const Color(0xFF202124);
  canvas.drawRRect(cardRect, innerCardPaint);

  // 3. Lucide Image Icon paths scaled into center
  // Original viewBox: 0 0 24 24
  final iconSize = size * 0.52;
  final offset = (size - iconSize) / 2;
  final scale = iconSize / 24.0;

  canvas.save();
  canvas.translate(offset, offset);
  canvas.scale(scale, scale);

  final strokePaint = Paint()
    ..color = const Color(0xFF8AB4F8) // Lucide Blue-400 / Google Blue accent
    ..style = PaintingStyle.stroke
    ..strokeWidth = 2.0
    ..strokeCap = StrokeCap.round
    ..strokeJoin = StrokeJoin.round;

  // <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
  final rect = RRect.fromRectAndRadius(
    const Rect.fromLTWH(3, 3, 18, 18),
    const Radius.circular(2),
  );
  canvas.drawRRect(rect, strokePaint);

  // <circle cx="9" cy="9" r="2" />
  canvas.drawCircle(const Offset(9, 9), 2, strokePaint);

  // <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
  final path = Path();
  path.moveTo(21, 15);
  // -3.086, -3.086 relative from (21, 15) is (17.914, 11.914)
  path.lineTo(17.914, 11.914);
  // a 2 2 0 0 0 -2.828 0 -> arc to (15.086, 11.914) with radius 2
  path.arcToPoint(
    const Offset(15.086, 11.914),
    radius: const Radius.circular(2),
    clockwise: false,
  );
  path.lineTo(6, 21);
  canvas.drawPath(path, strokePaint);

  canvas.restore();
}
