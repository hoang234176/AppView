import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:cached_network_image/cached_network_image.dart';

class WindowsFolderIcon extends StatelessWidget {
  final List<String> previews;
  final double size;

  const WindowsFolderIcon({
    super.key,
    required this.previews,
    this.size = 86,
  });

  static const String _backSvg = '''
<svg viewBox="0 0 100 92" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="10" y1="10" x2="90" y2="88" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#DF9600" />
      <stop offset="45%" stop-color="#C87F00" />
      <stop offset="100%" stop-color="#AF6B00" />
    </linearGradient>
  </defs>
  <path d="M12 16 C12 12.5 14.5 10 18 10 H44 C47 10 49.5 12 51.5 14.8 L53.5 17 H84 C88.4 17 92 20.6 92 25 V78 C92 82.4 88.4 86 84 86 H16 C11.6 86 8 82.4 8 78 V21 C8 19 9.8 16 12 16 Z" fill="url(#bg)" />
  <path d="M18 11 H44 C46.5 11 48.8 12.8 50.4 14.8 L52.5 17.5" stroke="#FFE699" stroke-width="1.2" stroke-linecap="round" stroke-opacity="0.75" />
</svg>
''';

  static const String _frontOpenSvg = '''
<svg viewBox="0 0 100 92" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fg" x1="15" y1="38" x2="85" y2="88" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFDE68" />
      <stop offset="35%" stop-color="#FFC728" />
      <stop offset="100%" stop-color="#EF9800" />
    </linearGradient>
    <linearGradient id="rim" x1="8" y1="42" x2="92" y2="42" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.9" />
      <stop offset="50%" stop-color="#FFEAA0" stop-opacity="0.75" />
      <stop offset="100%" stop-color="#FFD150" stop-opacity="0.4" />
    </linearGradient>
  </defs>
  <path d="M6 42 C6 39.5 8 37.5 10.5 37.5 H89.5 C92 37.5 94 39.5 94 42 L92.5 78 C92.2 82.4 88.6 86 84.2 86 H15.8 C11.4 86 7.8 82.4 7.5 78 L6 42 Z" fill="url(#fg)" />
  <path d="M8 39 H92" stroke="url(#rim)" stroke-width="1.5" stroke-linecap="round" />
</svg>
''';

  static const String _frontClosedSvg = '''
<svg viewBox="0 0 100 92" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="cg" x1="10" y1="22" x2="90" y2="88" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFE070" />
      <stop offset="25%" stop-color="#FFC928" />
      <stop offset="100%" stop-color="#F29E00" />
    </linearGradient>
    <linearGradient id="crim" x1="8" y1="26" x2="92" y2="26" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.9" />
      <stop offset="50%" stop-color="#FFEAA0" stop-opacity="0.75" />
      <stop offset="100%" stop-color="#FFD150" stop-opacity="0.4" />
    </linearGradient>
  </defs>
  <path d="M6 26 C6 23.5 8 21.5 10.5 21.5 H89.5 C92 21.5 94 23.5 94 26 L92.5 78 C92.2 82.4 88.6 86 84.2 86 H15.8 C11.4 86 7.8 82.4 7.5 78 L6 26 Z" fill="url(#cg)" />
  <path d="M8 23 H92" stroke="url(#crim)" stroke-width="1.5" stroke-linecap="round" />
</svg>
''';

  @override
  Widget build(BuildContext context) {
    final validPreviews = previews.where((p) => p.trim().isNotEmpty).take(2).toList();
    final hasPreviews = validPreviews.isNotEmpty;

    final width = size;
    final height = (size * 90) / 100;

    return SizedBox(
      width: width,
      height: height,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // 1. Back Plate
          Positioned.fill(
            child: SvgPicture.string(
              _backSvg,
              fit: BoxFit.fill,
            ),
          ),

          // 2. Photo Previews
          if (hasPreviews)
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              bottom: height * 0.20,
              child: _buildPhotos(width, height, validPreviews),
            ),

          // 3. Front Plate
          Positioned.fill(
            child: SvgPicture.string(
              hasPreviews ? _frontOpenSvg : _frontClosedSvg,
              fit: BoxFit.fill,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPhotos(double width, double height, List<String> items) {
    if (items.length == 1) {
      return Center(
        child: Transform.translate(
          offset: const Offset(0, -3),
          child: _buildPolaroidCard(
            imageUrl: items[0],
            width: width * 0.54,
            aspectRatio: 3 / 4,
          ),
        ),
      );
    }

    return Stack(
      alignment: Alignment.center,
      children: [
        // Photo 1: Left tilted
        Positioned(
          left: width * 0.10,
          child: Transform.translate(
            offset: const Offset(0, -4),
            child: Transform.rotate(
              angle: -0.10, // ~ -5.7 deg
              child: _buildPolaroidCard(
                imageUrl: items[0],
                width: width * 0.48,
                aspectRatio: 3 / 4,
              ),
            ),
          ),
        ),

        // Photo 2: Right tilted (overlapping)
        Positioned(
          right: width * 0.10,
          child: Transform.translate(
            offset: const Offset(0, -3),
            child: Transform.rotate(
              angle: 0.09, // ~ +5.1 deg
              child: _buildPolaroidCard(
                imageUrl: items[1],
                width: width * 0.50,
                aspectRatio: 3 / 4,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPolaroidCard({
    required String imageUrl,
    required double width,
    required double aspectRatio,
  }) {
    return Container(
      width: width,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(3),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.35),
            blurRadius: 5,
            offset: const Offset(0, 2.5),
          ),
        ],
      ),
      padding: const EdgeInsets.all(2),
      child: AspectRatio(
        aspectRatio: aspectRatio,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(2),
          child: CachedNetworkImage(
            imageUrl: imageUrl,
            fit: BoxFit.cover,
            placeholder: (context, url) => Container(color: const Color(0xFF28292D)),
            errorWidget: (context, url, error) => Container(color: const Color(0xFF28292D)),
          ),
        ),
      ),
    );
  }
}
