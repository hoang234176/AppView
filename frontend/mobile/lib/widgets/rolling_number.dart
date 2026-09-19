import 'package:flutter/material.dart';

class RollingNumber extends StatefulWidget {
  final dynamic value;
  final String prefix;
  final String suffix;
  final TextStyle? style;
  final Duration duration;
  final bool animateOnMount;
  final Curve curve;

  const RollingNumber({
    super.key,
    required this.value,
    this.prefix = '',
    this.suffix = '',
    this.style,
    this.duration = const Duration(milliseconds: 650),
    this.animateOnMount = false,
    this.curve = Curves.easeOutCubic,
  });

  @override
  State<RollingNumber> createState() => _RollingNumberState();
}

class _RollingNumberState extends State<RollingNumber> {
  late String _currentString;

  @override
  void initState() {
    super.initState();
    _currentString = _formatValue(widget.value);
  }

  @override
  void didUpdateWidget(covariant RollingNumber oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value != widget.value) {
      setState(() {
        _currentString = _formatValue(widget.value);
      });
    }
  }

  String _formatValue(dynamic val) {
    if (val == null) return '0';
    return val.toString();
  }

  @override
  Widget build(BuildContext context) {
    final effectiveStyle = widget.style ?? const TextStyle(fontFamily: 'monospace');
    final fontSize = effectiveStyle.fontSize ?? 14.0;
    final lineHeight = fontSize * (effectiveStyle.height ?? 1.2);

    final chars = _currentString.split('');

    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        if (widget.prefix.isNotEmpty)
          Text(
            widget.prefix,
            style: effectiveStyle,
          ),
        ...chars.asMap().entries.map((entry) {
          final idx = entry.key;
          final char = entry.value;
          final reverseIdx = chars.length - 1 - idx;
          final isDigit = int.tryParse(char) != null;

          if (!isDigit) {
            return Text(
              char,
              style: effectiveStyle,
            );
          }

          final targetNum = int.parse(char);

          return _RollingDigit(
            key: ValueKey('r-$reverseIdx'),
            targetDigit: targetNum,
            lineHeight: lineHeight,
            style: effectiveStyle,
            duration: widget.duration,
            curve: widget.curve,
            animateOnMount: widget.animateOnMount,
          );
        }),
        if (widget.suffix.isNotEmpty)
          Text(
            widget.suffix,
            style: effectiveStyle,
          ),
      ],
    );
  }
}

class _RollingDigit extends StatefulWidget {
  final int targetDigit;
  final double lineHeight;
  final TextStyle style;
  final Duration duration;
  final Curve curve;
  final bool animateOnMount;

  const _RollingDigit({
    super.key,
    required this.targetDigit,
    required this.lineHeight,
    required this.style,
    required this.duration,
    required this.curve,
    required this.animateOnMount,
  });

  @override
  State<_RollingDigit> createState() => _RollingDigitState();
}

class _RollingDigitState extends State<_RollingDigit> {
  late double _previousValue;

  @override
  void initState() {
    super.initState();
    _previousValue = widget.animateOnMount ? 0.0 : widget.targetDigit.toDouble();
  }

  @override
  void didUpdateWidget(covariant _RollingDigit oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.targetDigit != widget.targetDigit) {
      _previousValue = oldWidget.targetDigit.toDouble();
    }
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: widget.lineHeight,
      child: ClipRect(
        child: TweenAnimationBuilder<double>(
          tween: Tween<double>(
            begin: _previousValue,
            end: widget.targetDigit.toDouble(),
          ),
          duration: widget.duration,
          curve: widget.curve,
          builder: (context, animatedValue, child) {
            return Transform.translate(
              offset: Offset(0, -animatedValue * widget.lineHeight),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: List.generate(10, (digit) {
                  return SizedBox(
                    height: widget.lineHeight,
                    child: Center(
                      child: Text(
                        '$digit',
                        style: widget.style,
                      ),
                    ),
                  );
                }),
              ),
            );
          },
        ),
      ),
    );
  }
}
