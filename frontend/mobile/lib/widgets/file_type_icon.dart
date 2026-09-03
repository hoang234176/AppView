import 'package:flutter/material.dart';

/// Biểu tượng file có nhãn phần mở rộng thật: ZIP, RAR, JPG, MP4…
class FileTypeIcon extends StatelessWidget {
  final String? filename;
  final String fallback;
  final Color color;
  final double size;

  const FileTypeIcon({
    super.key,
    required this.filename,
    required this.fallback,
    required this.color,
    this.size = 24,
  });

  static String labelFor(String? filename, String fallback) {
    final clean = (filename ?? '').split(RegExp(r'[?#]')).first.toLowerCase();
    final multi = RegExp(r'\.(tar\.gz|tar\.bz2|tar\.xz)$').firstMatch(clean);
    final ext = multi?.group(1) ?? (clean.contains('.') ? clean.split('.').last : '');
    if (ext.isEmpty) return fallback;
    const aliases = {'jpeg': 'JPG', 'tiff': 'TIF', 'mpeg': 'MPG'};
    return (aliases[ext] ?? ext.toUpperCase()).substring(
      0,
      (aliases[ext] ?? ext.toUpperCase()).length.clamp(0, 5).toInt(),
    );
  }

  @override
  Widget build(BuildContext context) => SizedBox(
    width: size,
    height: size,
    child: CustomPaint(
      painter: _FileTypeIconPainter(labelFor(filename, fallback), color),
    ),
  );
}

class _FileTypeIconPainter extends CustomPainter {
  final String label;
  final Color color;
  const _FileTypeIconPainter(this.label, this.color);

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.width / 24;
    canvas.save();
    canvas.scale(scale);
    final outline = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.7
      ..strokeJoin = StrokeJoin.round;
    final file = Path()
      ..moveTo(7.75, 2.75)
      ..lineTo(13.8, 2.75)
      ..lineTo(19.5, 8.5)
      ..lineTo(19.5, 19.5)
      ..quadraticBezierTo(19.5, 21, 17.75, 21)
      ..lineTo(7.75, 21)
      ..quadraticBezierTo(6, 21, 6, 19.5)
      ..lineTo(6, 4.5)
      ..quadraticBezierTo(6, 2.75, 7.75, 2.75);
    canvas.drawPath(file, outline);
    canvas.drawPath(Path()..moveTo(13.5, 2.9)..lineTo(13.5, 7.05)..quadraticBezierTo(13.5, 8.55, 15, 8.55)..lineTo(19.1, 8.55), outline);
    canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(1.4, 10.5, 15.4, 7.1), const Radius.circular(1.35)), Paint()..color = color);
    final fontSize = label.length >= 5 ? 3.6 : label.length == 4 ? 4.1 : 4.8;
    final text = TextPainter(
      text: TextSpan(text: label, style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: fontSize)),
      textDirection: TextDirection.ltr,
      maxLines: 1,
    )..layout(maxWidth: 13.4);
    text.paint(canvas, Offset(9.1 - text.width / 2, 12.05));
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _FileTypeIconPainter old) => old.label != label || old.color != color;
}
