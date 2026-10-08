import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:video_player/video_player.dart';
import '../theme/app_theme.dart';
import '../models/video_item.dart';
import '../utils/formatters.dart';

class VideoPlayerScreen extends StatefulWidget {
  final List<VideoItem> videos;
  final int initialIndex;

  const VideoPlayerScreen({
    super.key,
    required this.videos,
    this.initialIndex = 0,
  });

  @override
  State<VideoPlayerScreen> createState() => _VideoPlayerScreenState();
}

class _VideoPlayerScreenState extends State<VideoPlayerScreen> {
  late int _currentIndex;
  late PageController _pageController;
  late TransformationController _transformationController;
  double? _dragValue;
  VideoPlayerController? _controller;
  bool _isBuffering = true;
  bool _hasError = false;
  bool _hasFirstFrame = false;
  bool _isDraggingTimeline = false;
  bool _showControls = true;
  Timer? _hideControlsTimer;
  double _horizontalDragOffset = 0.0;
  bool _isReplaying = false;
  DateTime _lastPlayerUiUpdate = DateTime.fromMillisecondsSinceEpoch(0);

  @override
  void initState() {
    super.initState();
    _transformationController = TransformationController();
    _currentIndex = widget.initialIndex;
    _pageController = PageController(initialPage: _currentIndex);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    _initializeVideo();
  }

  @override
  void dispose() {
    _hideControlsTimer?.cancel();
    _controller?.dispose();
    _pageController.dispose();
    _transformationController.dispose();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
    super.dispose();
  }

  Future<void> _initializeVideo() async {
    _hideControlsTimer?.cancel();
    _dragValue = null;
    _horizontalDragOffset = 0.0;
    _isReplaying = false;
    _transformationController.value = Matrix4.identity();
    final currentVid = widget.videos[_currentIndex];
    final streamUrl = Formatters.getVideoStreamUrl('', currentVid);

    if (_controller != null) {
      await _controller!.dispose();
      _controller = null;
    }

    setState(() {
      _isBuffering = true;
      _hasFirstFrame = false;
    });

    if (streamUrl.isEmpty) {
      setState(() => _isBuffering = false);
      return;
    }

    try {
      final controller = VideoPlayerController.networkUrl(Uri.parse(streamUrl));
      await controller.initialize();
      controller.play();

      controller.addListener(() {
        if (!mounted) return;
        final isBuffering = controller.value.isBuffering;
        final hasEnded =
            controller.value.duration > Duration.zero &&
            !controller.value.isPlaying &&
            controller.value.position >= controller.value.duration;
        if (hasEnded && !_isReplaying) {
          unawaited(_replayFromStart(controller));
        }
        final hasFirstFrame =
            _hasFirstFrame ||
            (controller.value.isPlaying &&
                controller.value.position > Duration.zero);
        // Không rebuild toàn bộ InteractiveViewer theo từng frame video. Khi
        // xoay, các rebuild 30/60 lần mỗi giây làm Texture bị khựng rõ rệt.
        // Timeline chỉ cần làm mới 5 lần/giây khi controls đang hiện.
        final now = DateTime.now();
        final shouldRefreshTimeline =
            _showControls &&
            now.difference(_lastPlayerUiUpdate) >=
                const Duration(milliseconds: 250);
        if (_isBuffering != isBuffering ||
            _hasFirstFrame != hasFirstFrame ||
            shouldRefreshTimeline) {
          _lastPlayerUiUpdate = now;
          setState(() {
            _isBuffering = isBuffering;
            _hasFirstFrame = hasFirstFrame;
          });
        }
      });

      setState(() {
        _controller = controller;
        _isBuffering = false;
        _hasFirstFrame = false;
        _hasError = false;
      });

      _startHideControlsTimer();
    } catch (e) {
      if (mounted) {
        setState(() {
          _isBuffering = false;
          _hasError = true;
        });
      }
    }
  }

  void _startHideControlsTimer() {
    _hideControlsTimer?.cancel();
    _hideControlsTimer = Timer(const Duration(seconds: 3), () {
      if (mounted && (_controller?.value.isPlaying ?? false)) {
        setState(() {
          _showControls = false;
        });
      }
    });
  }

  void _togglePlay() {
    if (_controller == null || !_controller!.value.isInitialized) return;
    setState(() {
      if (_controller!.value.isPlaying) {
        _controller!.pause();
        _hideControlsTimer?.cancel();
      } else {
        _controller!.play();
        _startHideControlsTimer();
      }
    });
  }

  Future<void> _replayFromStart(VideoPlayerController controller) async {
    if (_isReplaying) return;
    _isReplaying = true;
    try {
      await controller.seekTo(Duration.zero);
      await controller.play();
    } finally {
      _isReplaying = false;
    }
  }

  void _resetHorizontalDrag() {
    if (_horizontalDragOffset != 0.0 && mounted) {
      setState(() => _horizontalDragOffset = 0.0);
    }
  }

  void _handleHorizontalDragEnd(DragEndDetails details) {
    final scale = _transformationController.value.getMaxScaleOnAxis();
    final velocity = details.primaryVelocity ?? 0.0;
    if (scale <= 1.05 && (_horizontalDragOffset > 100 || velocity > 300)) {
      Navigator.of(context).pop();
    } else {
      _resetHorizontalDrag();
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentVid = widget.videos[_currentIndex];
    final isInitialized = _controller?.value.isInitialized ?? false;
    final isPlaying = _controller?.value.isPlaying ?? false;
    final position =
        _dragValue != null
            ? Duration(milliseconds: _dragValue!.toInt())
            : (_controller?.value.position ?? Duration.zero);
    final duration = _controller?.value.duration ?? Duration.zero;
    final topPadding = MediaQuery.paddingOf(context).top;
    final bottomPadding = MediaQuery.paddingOf(context).bottom;

    return Scaffold(
      backgroundColor: const Color(0xFF070809),
      body: GestureDetector(
        onTap: () {
          if (!_showControls) {
            setState(() => _showControls = true);
            if (isPlaying) _startHideControlsTimer();
          } else {
            _togglePlay();
          }
        },
        onDoubleTap: () {
          if (_transformationController.value != Matrix4.identity()) {
            _transformationController.value = Matrix4.identity();
          } else {
            _transformationController.value = Matrix4.diagonal3Values(
              2.0,
              2.0,
              1.0,
            );
          }
        },
        onHorizontalDragUpdate: (details) {
          if (_transformationController.value.getMaxScaleOnAxis() <= 1.05) {
            setState(() {
              _horizontalDragOffset = (_horizontalDragOffset + details.delta.dx)
                  .clamp(0.0, double.infinity);
            });
          }
        },
        onHorizontalDragEnd: _handleHorizontalDragEnd,
        behavior: HitTestBehavior.opaque,
        child: Transform.translate(
          offset: Offset(_horizontalDragOffset, 0),
          child: Stack(
            fit: StackFit.expand,
            children: [
              // Vertical feed: each swipe snaps to exactly one video.
              PageView.builder(
                controller: _pageController,
                scrollDirection: Axis.vertical,
                itemCount: widget.videos.length,
                onPageChanged: (index) {
                  if (index == _currentIndex) return;
                  setState(() => _currentIndex = index);
                  _initializeVideo();
                },
                itemBuilder: (context, index) {
                  final thumbnail = widget.videos[index].thumbnailUrl ?? '';
                  final poster =
                      thumbnail.isEmpty
                          ? const ColoredBox(color: Colors.black)
                          : Image.network(
                            thumbnail,
                            fit: BoxFit.contain,
                            errorBuilder:
                                (context, error, stackTrace) =>
                                    const ColoredBox(color: Colors.black),
                          );
                  if (index != _currentIndex) return poster;

                  if (!isInitialized) {
                    return poster;
                  }

                  return Stack(
                    fit: StackFit.expand,
                    children: [
                      poster,
                      AnimatedOpacity(
                        opacity: _hasFirstFrame ? 1.0 : 0.0,
                        duration: const Duration(milliseconds: 120),
                        child: InteractiveViewer(
                          transformationController: _transformationController,
                          minScale: 1.0,
                          maxScale: 5.0,
                          clipBehavior: Clip.hardEdge,
                          child: Center(
                            child: AspectRatio(
                              aspectRatio: _controller!.value.aspectRatio,
                              child: RepaintBoundary(
                                child: VideoPlayer(_controller!),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  );
                },
              ),

              // Error state indicator
              if (_hasError)
                Center(
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 32),
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: const Color(0xFF18191C).withValues(alpha: 0.95),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: Colors.redAccent.withValues(alpha: 0.3),
                      ),
                    ),
                    child: const Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.error_outline_rounded,
                          color: Colors.redAccent,
                          size: 44,
                        ),
                        SizedBox(height: 12),
                        Text(
                          'Không thể phát video này',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        SizedBox(height: 6),
                        Text(
                          'Định dạng video không hợp lệ, tệp bị lỗi hoặc không hỗ trợ phát trực tiếp trên ứng dụng.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.white70, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ),

              // Buffering indicator
              if (_isBuffering && !_hasError)
                Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.75),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.15),
                      ),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            color: AppTheme.videoPurple,
                            strokeWidth: 2.5,
                          ),
                        ),
                        SizedBox(width: 12),
                        Text(
                          'Đang tải video streaming...',
                          style: TextStyle(
                            fontSize: 14,
                            fontFamily: 'monospace',
                            color: Color(0xFFE8EAED),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

              // Top bar controls show only the current video information.
              if (_showControls)
                Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  child: Container(
                    padding: EdgeInsets.only(
                      top: topPadding + 8,
                      left: 12,
                      right: 12,
                      bottom: 12,
                    ),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.black.withValues(alpha: 0.85),
                          Colors.black.withValues(alpha: 0.4),
                          Colors.transparent,
                        ],
                      ),
                    ),
                    child: Row(
                      children: [
                        // Video counter badge
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: AppTheme.videoPurple.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: AppTheme.videoPurple.withValues(
                                alpha: 0.4,
                              ),
                            ),
                          ),
                          child: Text(
                            'Video ${_currentIndex + 1} / ${widget.videos.length}',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              fontFamily: 'monospace',
                              color: AppTheme.videoPurple,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),

                        // Video Name
                        Expanded(
                          child: Text(
                            currentVid.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

              // The timeline is the only remaining bottom control.
              if (_showControls)
                Positioned(
                  bottom: 0,
                  left: 0,
                  right: 0,
                  child: Container(
                    padding: EdgeInsets.only(
                      left: 16,
                      right: 16,
                      top: 16,
                      bottom: bottomPadding + 12,
                    ),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.bottomCenter,
                        end: Alignment.topCenter,
                        colors: [
                          Colors.black.withValues(alpha: 0.95),
                          Colors.black.withValues(alpha: 0.6),
                          Colors.transparent,
                        ],
                      ),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        LayoutBuilder(
                          builder: (context, constraints) {
                            final max =
                                duration.inMilliseconds > 0
                                    ? duration.inMilliseconds.toDouble()
                                    : 1.0;
                            final value =
                                position.inMilliseconds
                                    .clamp(0, duration.inMilliseconds)
                                    .toDouble();
                            final fraction =
                                duration.inMilliseconds > 0 ? value / max : 0.0;
                            const labelWidth = 56.0;
                            final labelLeft = (fraction * constraints.maxWidth -
                                    labelWidth / 2)
                                .clamp(0.0, constraints.maxWidth - labelWidth);

                            return SizedBox(
                              height: 48,
                              child: Stack(
                                clipBehavior: Clip.none,
                                children: [
                                  Positioned(
                                    top: 8,
                                    left: 0,
                                    right: 0,
                                    child: SliderTheme(
                                      data: SliderTheme.of(context).copyWith(
                                        activeTrackColor: AppTheme.videoPurple,
                                        inactiveTrackColor: const Color(
                                          0xFF383C42,
                                        ),
                                        thumbColor: AppTheme.videoPurple,
                                        trackHeight: 3.5,
                                        thumbShape: const RoundSliderThumbShape(
                                          enabledThumbRadius: 6.5,
                                        ),
                                        overlayShape:
                                            const RoundSliderOverlayShape(
                                              overlayRadius: 13,
                                            ),
                                      ),
                                      child: Slider(
                                        value: value,
                                        min: 0.0,
                                        max: max,
                                        onChangeStart: (val) {
                                          _hideControlsTimer?.cancel();
                                          setState(() {
                                            _dragValue = val;
                                            _isDraggingTimeline = true;
                                          });
                                        },
                                        onChanged: (val) {
                                          _hideControlsTimer?.cancel();
                                          setState(() {
                                            _dragValue = val;
                                          });
                                        },
                                        onChangeEnd: (val) {
                                          final targetDuration = Duration(
                                            milliseconds: val.toInt(),
                                          );
                                          final controller = _controller;
                                          final seekToEnd =
                                              controller != null &&
                                              duration > Duration.zero &&
                                              val >=
                                                  duration.inMilliseconds - 250;
                                          setState(() {
                                            _dragValue = val;
                                            _isDraggingTimeline = false;
                                            _isBuffering = true;
                                          });
                                          final seekFuture =
                                              seekToEnd
                                                  ? _replayFromStart(controller)
                                                  : controller?.seekTo(
                                                    targetDuration,
                                                  );
                                          seekFuture?.then((_) {
                                            if (mounted) {
                                              setState(() {
                                                _dragValue = null;
                                                _isBuffering = false;
                                              });
                                            }
                                          });
                                          _startHideControlsTimer();
                                        },
                                      ),
                                    ),
                                  ),
                                  if (_isDraggingTimeline)
                                    Positioned(
                                      top: -2,
                                      left: labelLeft,
                                      width: labelWidth,
                                      child: IgnorePointer(
                                        child: Text(
                                          Formatters.formatDuration(position),
                                          textAlign: TextAlign.center,
                                          style: TextStyle(
                                            color: Colors.white.withValues(
                                              alpha: 0.78,
                                            ),
                                            fontSize: 11,
                                            fontWeight: FontWeight.w600,
                                            shadows: const [
                                              Shadow(
                                                color: Colors.black54,
                                                blurRadius: 3,
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
