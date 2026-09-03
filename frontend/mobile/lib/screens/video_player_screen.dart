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
  late TransformationController _transformationController;
  double? _dragValue;
  VideoPlayerController? _controller;
  bool _isBuffering = true;
  bool _hasError = false;
  bool _hasEnded = false;
  bool _showControls = true;
  double _playbackSpeed = 1.0;
  bool _isMuted = false;
  final double _volume = 1.0;
  Timer? _hideControlsTimer;
  double _dragOffsetY = 0.0;
  int _rotationQuarterTurns = 0;
  DateTime _lastPlayerUiUpdate = DateTime.fromMillisecondsSinceEpoch(0);

  void _handleRotate() {
    setState(() {
      _rotationQuarterTurns = (_rotationQuarterTurns + 1) % 4;
    });
  }

  final List<double> _speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  @override
  void initState() {
    super.initState();
    _transformationController = TransformationController();
    _currentIndex = widget.initialIndex;
    _initializeVideo();
  }

  @override
  void dispose() {
    _hideControlsTimer?.cancel();
    _controller?.dispose();
    _transformationController.dispose();
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
    _dragOffsetY = 0.0;
    _transformationController.value = Matrix4.identity();
    final currentVid = widget.videos[_currentIndex];
    final streamUrl = Formatters.getVideoStreamUrl('', currentVid);

    if (_controller != null) {
      await _controller!.dispose();
      _controller = null;
    }

    setState(() {
      _isBuffering = true;
      _hasEnded = false;
    });

    if (streamUrl.isEmpty) {
      setState(() => _isBuffering = false);
      return;
    }

    try {
      final controller = VideoPlayerController.networkUrl(Uri.parse(streamUrl));
      await controller.initialize();
      controller.setPlaybackSpeed(_playbackSpeed);
      controller.setVolume(_isMuted ? 0.0 : _volume);
      controller.play();

      controller.addListener(() {
        if (!mounted) return;
        final isBuffering = controller.value.isBuffering;
        final hasEnded = controller.value.duration > Duration.zero &&
            !controller.value.isPlaying &&
            controller.value.position >= controller.value.duration;
        // Không rebuild toàn bộ InteractiveViewer theo từng frame video. Khi
        // xoay, các rebuild 30/60 lần mỗi giây làm Texture bị khựng rõ rệt.
        // Timeline chỉ cần làm mới 5 lần/giây khi controls đang hiện.
        final now = DateTime.now();
        final shouldRefreshTimeline = _showControls &&
            now.difference(_lastPlayerUiUpdate) >= const Duration(milliseconds: 250);
        if (_isBuffering != isBuffering || _hasEnded != hasEnded || shouldRefreshTimeline) {
          _lastPlayerUiUpdate = now;
          setState(() {
            _isBuffering = isBuffering;
            _hasEnded = hasEnded;
            if (hasEnded) {
              _showControls = true;
              _hideControlsTimer?.cancel();
            }
          });
        }
      });

      setState(() {
        _controller = controller;
        _isBuffering = false;
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
    if (_hasEnded) {
      _restartVideo();
      return;
    }
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

  void _restartVideo() {
    if (_controller == null || !_controller!.value.isInitialized) return;
    _controller!.seekTo(Duration.zero).then((_) => _controller!.play());
    setState(() {
      _dragValue = null;
      _hasEnded = false;
      _showControls = true;
    });
    _startHideControlsTimer();
  }

  void _seekRelative(int seconds) {
    if (_controller == null || !_controller!.value.isInitialized) return;
    final currentPosition = _dragValue != null
        ? Duration(milliseconds: _dragValue!.toInt())
        : _controller!.value.position;
    final duration = _controller!.value.duration;
    var target = currentPosition + Duration(seconds: seconds);
    if (target < Duration.zero) {
      target = Duration.zero;
    } else if (target > duration) {
      target = duration;
    }
    setState(() {
      _dragValue = target.inMilliseconds.toDouble();
      _isBuffering = true;
    });
    _controller!.seekTo(target).then((_) {
      if (mounted) {
        setState(() {
          _dragValue = null;
        });
      }
    });
    _startHideControlsTimer();
  }

  void _toggleMute() {
    if (_controller == null) return;
    setState(() {
      _isMuted = !_isMuted;
      _controller!.setVolume(_isMuted ? 0.0 : _volume);
    });
  }

  void _changePlaybackSpeed(double speed) {
    setState(() {
      _playbackSpeed = speed;
      _controller?.setPlaybackSpeed(speed);
    });
  }

  void _handlePrev() {
    if (_currentIndex > 0) {
      setState(() {
        _currentIndex--;
      });
      _initializeVideo();
    }
  }

  void _handleNext() {
    if (_currentIndex < widget.videos.length - 1) {
      setState(() {
        _currentIndex++;
      });
      _initializeVideo();
    }
  }

  void _showSpeedDialog() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.bgBlock,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  child: Text(
                    'Tốc độ phát video',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                ..._speedOptions.map((speed) {
                  final isSelected = _playbackSpeed == speed;
                  return ListTile(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    title: Text(
                      speed == 1.0 ? 'Bình thường (1.0x)' : '${speed}x',
                      style: TextStyle(
                        fontSize: 15,
                        color: isSelected ? AppTheme.videoPurple : const Color(0xFFE8EAED),
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                      ),
                    ),
                    trailing: isSelected
                        ? const Icon(Icons.check_rounded, color: AppTheme.videoPurple, size: 20)
                        : null,
                    onTap: () {
                      _changePlaybackSpeed(speed);
                      Navigator.of(ctx).pop();
                    },
                  );
                }),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final currentVid = widget.videos[_currentIndex];
    final isInitialized = _controller?.value.isInitialized ?? false;
    final isPlaying = _controller?.value.isPlaying ?? false;
    final position = _dragValue != null
        ? Duration(milliseconds: _dragValue!.toInt())
        : (_controller?.value.position ?? Duration.zero);
    final duration = _controller?.value.duration ?? Duration.zero;
    final topPadding = MediaQuery.paddingOf(context).top;
    final bottomPadding = MediaQuery.paddingOf(context).bottom;
    final opacity = (1.0 - (_dragOffsetY / 400)).clamp(0.0, 1.0);

    return Scaffold(
      backgroundColor: Color.fromRGBO(7, 8, 9, opacity),
      body: GestureDetector(
        onTap: () {
          setState(() {
            _showControls = !_showControls;
            if (_showControls && isPlaying) {
              _startHideControlsTimer();
            }
          });
        },
        onDoubleTap: () {
          if (_transformationController.value != Matrix4.identity()) {
            _transformationController.value = Matrix4.identity();
          } else {
            _transformationController.value = Matrix4.diagonal3Values(2.0, 2.0, 1.0);
          }
        },
        onVerticalDragUpdate: (details) {
          final scale = _transformationController.value.getMaxScaleOnAxis();
          if (scale <= 1.05) {
            final newOffset = _dragOffsetY + details.delta.dy;
            if (newOffset >= 0) {
              setState(() {
                _dragOffsetY = newOffset;
              });
            }
          }
        },
        onVerticalDragEnd: (details) {
          if (_dragOffsetY > 100 || (details.primaryVelocity != null && details.primaryVelocity! > 300)) {
            Navigator.of(context).pop();
          } else if (_dragOffsetY != 0.0) {
            setState(() {
              _dragOffsetY = 0.0;
            });
          }
        },
        behavior: HitTestBehavior.opaque,
        child: Transform.translate(
          offset: Offset(0, _dragOffsetY),
          child: Stack(
            fit: StackFit.expand,
            children: [
            // Main Zoomable Video Player View (Full screen edge-to-edge)
            InteractiveViewer(
              transformationController: _transformationController,
              minScale: 1.0,
              maxScale: 5.0,
              // Không raster phần video đã xoay/zoom nằm ngoài màn hình. Đây
              // giảm đáng kể overdraw với video 4K mà vẫn giữ thao tác zoom.
              clipBehavior: Clip.hardEdge,
              child: Center(
                child: isInitialized
                    ? RotatedBox(
                        quarterTurns: _rotationQuarterTurns,
                        child: AspectRatio(
                          aspectRatio: _controller!.value.aspectRatio,
                          // Giữ texture video ở repaint boundary riêng để
                          // controls/timeline không làm raster lại video.
                          child: RepaintBoundary(
                            child: VideoPlayer(_controller!),
                          ),
                        ),
                      )
                    : Container(color: Colors.black),
              ),
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
                    border: Border.all(color: Colors.redAccent.withValues(alpha: 0.3)),
                  ),
                  child: const Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.error_outline_rounded, color: Colors.redAccent, size: 44),
                      SizedBox(height: 12),
                      Text(
                        'Không thể phát video này',
                        style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
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
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.75),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
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

            // Không phủ nút play giữa video. Chỉ hiện reload sau khi phát xong.
            if (_hasEnded && !_isBuffering && isInitialized)
              Center(
                child: IconButton(
                  onPressed: _restartVideo,
                  icon: const Icon(Icons.replay_rounded, color: Colors.white, size: 34),
                  tooltip: 'Phát lại video',
                  style: IconButton.styleFrom(
                    minimumSize: const Size(64, 64),
                    backgroundColor: AppTheme.videoPurpleDeep.withValues(alpha: 0.9),
                    shape: const CircleBorder(),
                  ),
                ),
              ),

            // Top Bar Controls (No back arrow, Close X on top right)
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
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppTheme.videoPurple.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppTheme.videoPurple.withValues(alpha: 0.4)),
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
                      const SizedBox(width: 8),

                      // Close X Button on top right
                      IconButton(
                        onPressed: () => Navigator.of(context).pop(),
                        icon: const Icon(Icons.close_rounded, color: Colors.white, size: 22),
                        tooltip: 'Đóng',
                        style: IconButton.styleFrom(
                          backgroundColor: Colors.white.withValues(alpha: 0.15),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

            // Prev / Next Center Buttons
            if (_showControls && widget.videos.length > 1) ...[
              if (_currentIndex > 0)
                Positioned(
                  left: 12,
                  top: 0,
                  bottom: 0,
                  child: Center(
                    child: IconButton(
                      onPressed: _handlePrev,
                      icon: const Icon(Icons.chevron_left_rounded, color: Colors.white, size: 30),
                      style: IconButton.styleFrom(
                        backgroundColor: Colors.black.withValues(alpha: 0.6),
                        padding: const EdgeInsets.all(8),
                      ),
                    ),
                  ),
                ),
              if (_currentIndex < widget.videos.length - 1)
                Positioned(
                  right: 12,
                  top: 0,
                  bottom: 0,
                  child: Center(
                    child: IconButton(
                      onPressed: _handleNext,
                      icon: const Icon(Icons.chevron_right_rounded, color: Colors.white, size: 30),
                      style: IconButton.styleFrom(
                        backgroundColor: Colors.black.withValues(alpha: 0.6),
                        padding: const EdgeInsets.all(8),
                      ),
                    ),
                  ),
                ),
            ],

            // Bottom Timeline and Player Controls Drawer (Edge-to-edge with spacing between slider & buttons)
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
                      // Timeline Slider & Timestamps
                      Row(
                        children: [
                          Text(
                            Formatters.formatDuration(position),
                            style: const TextStyle(
                              fontSize: 13,
                              fontFamily: 'monospace',
                              color: Color(0xFFBDC1C6),
                            ),
                          ),
                          Expanded(
                            child: SliderTheme(
                              data: SliderTheme.of(context).copyWith(
                                activeTrackColor: AppTheme.videoPurple,
                                inactiveTrackColor: const Color(0xFF383C42),
                                thumbColor: AppTheme.videoPurple,
                                trackHeight: 3.5,
                                thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6.5),
                                overlayShape: const RoundSliderOverlayShape(overlayRadius: 13),
                              ),
                              child: Slider(
                                value: duration.inMilliseconds > 0
                                    ? position.inMilliseconds.clamp(0, duration.inMilliseconds).toDouble()
                                    : 0.0,
                                min: 0.0,
                                max: duration.inMilliseconds > 0 ? duration.inMilliseconds.toDouble() : 1.0,
                                onChangeStart: (val) {
                                  _hideControlsTimer?.cancel();
                                  setState(() {
                                    _dragValue = val;
                                  });
                                },
                                onChanged: (val) {
                                  _hideControlsTimer?.cancel();
                                  setState(() {
                                    _dragValue = val;
                                  });
                                },
                                onChangeEnd: (val) {
                                  final targetDuration = Duration(milliseconds: val.toInt());
                                  setState(() {
                                    _dragValue = val;
                                    _isBuffering = true;
                                  });
                                  _controller?.seekTo(targetDuration).then((_) {
                                    if (mounted) {
                                      setState(() {
                                        _dragValue = null;
                                      });
                                    }
                                  });
                                  _startHideControlsTimer();
                                },
                              ),
                            ),
                          ),
                          Text(
                            Formatters.formatDuration(duration),
                            style: const TextStyle(
                              fontSize: 13,
                              fontFamily: 'monospace',
                              color: Color(0xFF80868B),
                            ),
                          ),
                        ],
                      ),

                      // Generous vertical spacing to keep slider and action buttons distinct
                      const SizedBox(height: 12),

                      // Action Controls: Play/Pause, Seek -10/+10, Volume, Speed
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              // Play / Pause
                              IconButton(
                                onPressed: _hasEnded ? _restartVideo : _togglePlay,
                                icon: Icon(
                                  _hasEnded
                                      ? Icons.replay_rounded
                                      : isPlaying
                                          ? Icons.pause_rounded
                                          : Icons.play_arrow_rounded,
                                  color: Colors.white,
                                  size: 26,
                                ),
                                style: IconButton.styleFrom(
                                  backgroundColor: AppTheme.videoPurpleDeep,
                                ),
                              ),
                              const SizedBox(width: 8),

                              // Seek -10s
                              IconButton(
                                onPressed: () => _seekRelative(-10),
                                icon: const Icon(Icons.replay_10_rounded, color: Colors.white, size: 22),
                                tooltip: 'Lùi 10s',
                              ),

                              // Seek +10s
                              IconButton(
                                onPressed: () => _seekRelative(10),
                                icon: const Icon(Icons.forward_10_rounded, color: Colors.white, size: 22),
                                tooltip: 'Tua 10s',
                              ),
                              const SizedBox(width: 8),

                              // Mute / Unmute
                              IconButton(
                                onPressed: _toggleMute,
                                icon: Icon(
                                  _isMuted ? Icons.volume_off_rounded : Icons.volume_up_rounded,
                                  color: _isMuted ? AppTheme.errorRed : Colors.white,
                                  size: 22,
                                ),
                                tooltip: _isMuted ? 'Bật âm thanh' : 'Tắt tiếng',
                              ),

                              // Rotate 90 Degrees Button
                              IconButton(
                                onPressed: _handleRotate,
                                icon: Icon(
                                  Icons.rotate_right_rounded,
                                  color: _rotationQuarterTurns != 0 ? AppTheme.videoPurple : Colors.white,
                                  size: 22,
                                ),
                                tooltip: 'Xoay video 90°',
                              ),
                            ],
                          ),

                          // Speed indicator badge
                          InkWell(
                            onTap: _showSpeedDialog,
                            borderRadius: BorderRadius.circular(12),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: AppTheme.bgCard,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: AppTheme.borderColor),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.speed_rounded, color: AppTheme.videoPurple, size: 14),
                                  const SizedBox(width: 4),
                                  Text(
                                    _playbackSpeed == 1.0 ? '1.0x' : '${_playbackSpeed}x',
                                    style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.bold,
                                      fontFamily: 'monospace',
                                      color: Colors.white,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
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
