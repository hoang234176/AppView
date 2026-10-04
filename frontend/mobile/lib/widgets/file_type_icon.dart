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

/// Biểu tượng các thẻ xếp chồng biểu thị gói nén chia nhiều phần (multipart archive).
class MultipartArchiveIcon extends StatelessWidget {
  final Color color;
  final double size;
  final String label;

  const MultipartArchiveIcon({
    super.key,
    this.color = const Color(0xFF818CF8),
    this.size = 24,
    this.label = 'PARTS',
  });

  @override
  Widget build(BuildContext context) => SizedBox(
    width: size,
    height: size,
    child: CustomPaint(
      painter: _MultipartArchiveIconPainter(label: label, color: color),
    ),
  );
}

class _MultipartArchiveIconPainter extends CustomPainter {
  final String label;
  final Color color;

  const _MultipartArchiveIconPainter({required this.label, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.width / 24;
    canvas.save();
    canvas.scale(scale);

    // Deepest card (opacity 0.35)
    final backCard = Path()
      ..moveTo(8.5, 2.5)
      ..lineTo(16.5, 2.5)
      ..lineTo(20.5, 7.0)
      ..lineTo(20.5, 16.5)
      ..quadraticBezierTo(20.5, 18.0, 19.0, 18.0)
      ..lineTo(8.5, 18.0);
    canvas.drawPath(backCard, Paint()..color = const Color(0xFF13141A)..style = PaintingStyle.fill);
    final backPaint = Paint()
      ..color = color.withValues(alpha: 0.45)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.3
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(backCard, backPaint);

    // Middle card (opacity 0.75)
    final midCard = Path()
      ..moveTo(6.0, 5.0)
      ..lineTo(14.0, 5.0)
      ..lineTo(18.0, 9.5)
      ..lineTo(18.0, 19.5)
      ..quadraticBezierTo(18.0, 21.0, 16.5, 21.0)
      ..lineTo(6.0, 21.0)
      ..quadraticBezierTo(4.5, 21.0, 4.5, 19.5)
      ..lineTo(4.5, 6.5)
      ..quadraticBezierTo(4.5, 5.0, 6.0, 5.0);
    canvas.drawPath(midCard, Paint()..color = const Color(0xFF1A1C24)..style = PaintingStyle.fill);
    final midPaint = Paint()
      ..color = color.withValues(alpha: 0.75)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(midCard, midPaint);

    // Front card (main layer)
    final frontCard = Path()
      ..moveTo(3.75, 7.5)
      ..lineTo(11.75, 7.5)
      ..lineTo(15.75, 12.0)
      ..lineTo(15.75, 21.5)
      ..quadraticBezierTo(15.75, 23.25, 14.0, 23.25)
      ..lineTo(3.75, 23.25)
      ..quadraticBezierTo(2.0, 23.25, 2.0, 21.5)
      ..lineTo(2.0, 9.25)
      ..quadraticBezierTo(2.0, 7.5, 3.75, 7.5);
    canvas.drawPath(frontCard, Paint()..color = const Color(0xFF222530)..style = PaintingStyle.fill);
    final frontPaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.7
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(frontCard, frontPaint);

    // Front card corner fold
    final foldPaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..strokeJoin = StrokeJoin.round;
    final fold = Path()
      ..moveTo(11.75, 7.75)
      ..lineTo(11.75, 11.0)
      ..quadraticBezierTo(11.75, 12.25, 13.0, 12.25)
      ..lineTo(16.25, 12.25);
    canvas.drawPath(fold, foldPaint);

    // Banner background rect
    canvas.drawRRect(
      RRect.fromRectAndRadius(const Rect.fromLTWH(0.5, 14.5, 14.0, 6.5), const Radius.circular(1.25)),
      Paint()..color = color,
    );

    // Text "PARTS"
    final text = TextPainter(
      text: TextSpan(
        text: label,
        style: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w800,
          fontSize: 3.8,
        ),
      ),
      textDirection: TextDirection.ltr,
      maxLines: 1,
    )..layout(maxWidth: 13.0);
    text.paint(canvas, Offset(7.5 - text.width / 2, 17.75 - text.height / 2));

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _MultipartArchiveIconPainter old) =>
      old.label != label || old.color != color;
}

/// Nhãn Multipart (X part) nhỏ gọn với icon thẻ xếp chồng mini.
class MultipartBadge extends StatelessWidget {
  final int count;
  final Color? color;

  const MultipartBadge({
    super.key,
    this.count = 0,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final badgeColor = color ?? const Color(0xFF818CF8);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
      decoration: BoxDecoration(
        color: badgeColor.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(5),
        border: Border.all(
          color: badgeColor.withValues(alpha: 0.35),
          width: 0.8,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 10,
            height: 10,
            child: CustomPaint(
              painter: _MiniStackedCardsPainter(color: badgeColor),
            ),
          ),
          const SizedBox(width: 3.5),
          Text(
            count > 0 ? 'Multipart ($count part)' : 'Multipart',
            style: TextStyle(
              color: badgeColor,
              fontSize: 9.5,
              fontWeight: FontWeight.w700,
              height: 1.1,
            ),
          ),
        ],
      ),
    );
  }
}

class _MiniStackedCardsPainter extends CustomPainter {
  final Color color;

  const _MiniStackedCardsPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.width / 16;
    canvas.save();
    canvas.scale(scale);

    // Deepest card
    final p1 = Paint()
      ..color = color.withValues(alpha: 0.4)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.1
      ..strokeJoin = StrokeJoin.round;
    final c1 = Path()
      ..moveTo(5.5, 1.5)
      ..lineTo(11.5, 1.5)
      ..lineTo(14.5, 5.0)
      ..lineTo(14.5, 11.5)
      ..quadraticBezierTo(14.5, 12.5, 13.5, 12.5)
      ..lineTo(5.5, 12.5);
    canvas.drawPath(c1, p1);

    // Mid card
    final p2 = Paint()
      ..color = color.withValues(alpha: 0.7)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2
      ..strokeJoin = StrokeJoin.round;
    final c2 = Path()
      ..moveTo(3.5, 3.5)
      ..lineTo(9.5, 3.5)
      ..lineTo(12.5, 7.0)
      ..lineTo(12.5, 13.5)
      ..quadraticBezierTo(12.5, 14.5, 11.5, 14.5)
      ..lineTo(3.5, 14.5)
      ..quadraticBezierTo(2.5, 14.5, 2.5, 13.5)
      ..lineTo(2.5, 4.5)
      ..quadraticBezierTo(2.5, 3.5, 3.5, 3.5);
    canvas.drawPath(c2, p2);

    // Front card
    final p3 = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.3
      ..strokeJoin = StrokeJoin.round;
    final c3 = Path()
      ..moveTo(1.5, 5.5)
      ..lineTo(7.5, 5.5)
      ..lineTo(10.5, 9.0)
      ..lineTo(10.5, 15.5)
      ..quadraticBezierTo(10.5, 16.5, 9.5, 16.5)
      ..lineTo(1.5, 16.5)
      ..quadraticBezierTo(0.5, 16.5, 0.5, 15.5)
      ..lineTo(0.5, 6.5)
      ..quadraticBezierTo(0.5, 5.5, 1.5, 5.5);
    canvas.drawPath(c3, p3);

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _MiniStackedCardsPainter old) => old.color != color;
}
