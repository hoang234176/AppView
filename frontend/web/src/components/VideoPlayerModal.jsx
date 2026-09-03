import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { 
  X, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw, 
  RotateCw,
  Loader2,
  Settings,
  Gauge,
  Check
} from 'lucide-react';
import { formatDate, formatFileSize, getVideoStreamUrl } from '../utils/formatters';

export const VideoPlayerModal = memo(({ videos = [], currentIndex, onClose, onSelectIndex }) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const settingsMenuRef = useRef(null);
  const lastTimelineUpdateRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [rotation, setRotation] = useState(0);
  const [hasEnded, setHasEnded] = useState(false);

  const handleRotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  // Settings menu popover state
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [settingsSubView, setSettingsSubView] = useState('main');

  const currentVid = videos[currentIndex];
  const controlsTimeoutRef = useRef(null);

  // Lock background scroll when Video Modal is open
  useEffect(() => {
    const originalStyle = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  const streamUrl = getVideoStreamUrl(currentVid);

  // Pre-load initial video segment for buttery smooth playback
  useEffect(() => {
    setIsBuffering(true);
    setIsPlaying(true);
    setHasEnded(false);
    setCurrentTime(0);
    
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.load();
    }
  }, [currentIndex]);

  // Close settings menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target)) {
        setShowSettingsMenu(false);
        setSettingsSubView('main');
      }
    };
    if (showSettingsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettingsMenu]);

  // Fullscreen change listener (Supports Standard HTML5 AND iOS Safari WebKit Events)
  useEffect(() => {
    const handleFSChange = () => {
      const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
      setIsFullscreen(isFS);
    };

    const vid = videoRef.current;
    const handleWebkitBegin = () => setIsFullscreen(true);
    const handleWebkitEnd = () => setIsFullscreen(false);

    document.addEventListener('fullscreenchange', handleFSChange);
    document.addEventListener('webkitfullscreenchange', handleFSChange);

    if (vid) {
      vid.addEventListener('webkitbeginfullscreen', handleWebkitBegin);
      vid.addEventListener('webkitendfullscreen', handleWebkitEnd);
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleFSChange);
      document.removeEventListener('webkitfullscreenchange', handleFSChange);
      if (vid) {
        vid.removeEventListener('webkitbeginfullscreen', handleWebkitBegin);
        vid.removeEventListener('webkitendfullscreen', handleWebkitEnd);
      }
    };
  }, []);

  const toggleFullscreen = () => {
    const vid = videoRef.current;
    
    // iOS Safari iPhone compatibility: Only supports webkitEnterFullscreen directly on <video> element
    if (vid && typeof vid.webkitEnterFullscreen === 'function') {
      try {
        vid.webkitEnterFullscreen();
        return;
      } catch (err) {
        console.warn('iOS Safari webkitEnterFullscreen error:', err);
      }
    }

    // Standard Fullscreen API for Android, Chrome, Firefox, macOS Safari & iPad
    if (!containerRef.current) return;
    const container = containerRef.current;

    const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);

    if (!isFS) {
      if (container.requestFullscreen) {
        container.requestFullscreen().catch(() => {});
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  const handleCanPlay = () => {
    setHasError(false);
    setIsBuffering(false);
    if (videoRef.current && isPlaying) {
      videoRef.current.play().catch(() => setIsPlaying(false));
    }
  };

  const handleWaiting = () => {
    setIsBuffering(true);
  };

  const handlePlaying = () => {
    setHasError(false);
    setIsBuffering(false);
    setIsPlaying(true);
    setHasEnded(false);
  };

  const handleError = () => {
    setIsBuffering(false);
    setHasError(true);
    setIsPlaying(false);
  };

  // Video time & duration updates
  const handleTimeUpdate = () => {
    // Không render lại toàn bộ modal theo mỗi timeupdate của video. 5fps là
    // đủ mượt cho timeline nhưng không tranh GPU/layout với video vừa xoay.
    const now = performance.now();
    if (videoRef.current && now - lastTimelineUpdateRef.current >= 250) {
      lastTimelineUpdateRef.current = now;
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  // Play / Pause toggle
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (hasEnded) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
      setCurrentTime(0);
      setHasEnded(false);
      setIsPlaying(true);
      return;
    }
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [isPlaying, hasEnded]);

  const restartVideo = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    setCurrentTime(0);
    setHasEnded(false);
    setShowControls(true);
    videoRef.current.play().catch(() => setIsPlaying(false));
  }, []);

  // Seek bar change
  const handleSeek = (e) => {
    const seekTime = parseFloat(e.target.value);
    setCurrentTime(seekTime);
    if (videoRef.current) {
      videoRef.current.currentTime = seekTime;
    }
  };

  // Volume & Mute control
  const handleVolumeChange = (e) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    setIsMuted(newVol === 0);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      videoRef.current.muted = newVol === 0;
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const nextMuteState = !isMuted;
      setIsMuted(nextMuteState);
      videoRef.current.muted = nextMuteState;
    }
  };

  // Speed selector
  const changeSpeed = (speed) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setShowSettingsMenu(false);
    setSettingsSubView('main');
  };

  // Seek -10s / +10s
  const seekRelative = (seconds) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(Math.max(videoRef.current.currentTime + seconds, 0), duration);
    }
  };

  // Next / Prev video handlers
  const handlePrev = useCallback(() => {
    onSelectIndex((currentIndex - 1 + videos.length) % videos.length);
  }, [currentIndex, videos.length, onSelectIndex]);

  const handleNext = useCallback(() => {
    onSelectIndex((currentIndex + 1) % videos.length);
  }, [currentIndex, videos.length, onSelectIndex]);

  // Keyboard navigation & controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      }
      if (e.key === 'ArrowLeft') seekRelative(-5);
      if (e.key === 'ArrowRight') seekRelative(5);
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setVolume((v) => Math.min(v + 0.1, 1));
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setVolume((v) => Math.max(v - 0.1, 0));
      }
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, togglePlay, duration]);

  // Auto-hide controls overlay after 3s inactivity
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !isBuffering && !showSettingsMenu) setShowControls(false);
    }, 3000);
  };

  // Helper format time mm:ss
  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds)) return '00:00';
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const speedOptions = [
    { label: '0.5x', value: 0.5 },
    { label: '0.75x', value: 0.75 },
    { label: 'Bình thường (1x)', value: 1 },
    { label: '1.25x', value: 1.25 },
    { label: '1.5x', value: 1.5 },
    { label: '2x', value: 2 },
  ];

  if (!currentVid) return null;

  const progressPct = duration > 0 ? Math.min(Math.max((currentTime / duration) * 100, 0), 100) : 0;
  const volumePct = isMuted ? 0 : volume * 100;

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="fixed inset-0 z-50 bg-[#070809] select-none animate-fade-in will-change-transform transform-gpu overflow-hidden"
    >
      {/* 1. Main Video Streaming Canvas */}
      <div 
        className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden z-10"
        onClick={() => {
          if (showSettingsMenu) {
            setShowSettingsMenu(false);
            setSettingsSubView('main');
          } else setShowControls((visible) => !visible);
        }}
      >
        <video
          ref={videoRef}
          src={streamUrl}
          preload="auto"
          playsInline
          onCanPlay={handleCanPlay}
          onWaiting={handleWaiting}
          onPlaying={handlePlaying}
          onError={handleError}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => {
            setIsPlaying(false);
            setHasEnded(true);
            setShowControls(true);
          }}
          style={{
            transform: `rotate(${rotation}deg)`,
            width: (rotation === 90 || rotation === 270) ? '100vh' : '100%',
            height: (rotation === 90 || rotation === 270) ? '100vw' : '100%',
            maxHeight: (rotation === 90 || rotation === 270) ? '100vw' : '100vh',
            maxWidth: (rotation === 90 || rotation === 270) ? '100vh' : '100vw',
            objectFit: 'contain',
            transformOrigin: 'center center',
            // Chỉ giữ compositing layer khi video đang xoay, tránh giữ một
            // texture lớn trên GPU xuyên suốt lúc phát bình thường.
            willChange: rotation ? 'transform' : 'auto',
            backfaceVisibility: 'hidden',
            contain: 'paint',
          }}
          className="transform-gpu transition-transform duration-200 ease-out"
        />

        {/* Invalid Video / Error State Overlay */}
        {hasError && (
          <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center gap-3 z-30 p-4 text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center shadow-2xl">
              <X className="w-7 h-7" />
            </div>
            <span className="text-sm font-bold text-white">
              Không thể phát video này
            </span>
            <span className="text-xs text-gray-400 max-w-sm">
              Định dạng video không hợp lệ, tệp bị lỗi hoặc không được hỗ trợ phát trực tiếp trên trình duyệt.
            </span>
          </div>
        )}

        {/* Initial Segment Prebuffering Indicator Overlay */}
        {isBuffering && !hasError && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-3 pointer-events-none z-20">
            <div className="w-14 h-14 rounded-full bg-purple-600/90 text-white flex items-center justify-center shadow-2xl">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>
            <span className="text-xs font-mono text-gray-200 bg-black/70 px-3 py-1 rounded-[24px] border border-white/10">
              Đang nạp trước đoạn video...
            </span>
          </div>
        )}

        {/* Không có nút play giữa màn hình. Chỉ khi video đã phát xong mới hiện reload. */}
        {hasEnded && !isBuffering && !hasError && (
          <button
            onClick={(e) => { e.stopPropagation(); restartVideo(); }}
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/35"
            title="Phát lại video"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-600/90 text-white shadow-2xl transition-transform hover:scale-105">
              <RotateCcw className="h-8 w-8" />
            </span>
          </button>
        )}

        {/* Prev / Next Navigation Arrows */}
        {videos.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); handlePrev(); }}
              className={`absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 hover:bg-purple-500 text-white transition-all border border-white/10 shadow-lg z-30 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              title="Video trước"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); handleNext(); }}
              className={`absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 hover:bg-purple-500 text-white transition-all border border-white/10 shadow-lg z-30 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              title="Video tiếp theo"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </div>

      {/* 2. Floating Top Header Bar Overlay */}
      <div className={`absolute top-0 left-0 right-0 z-30 px-6 py-4 flex items-center justify-between bg-gradient-to-b from-black/90 via-black/60 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="bg-purple-600/30 border border-purple-400/40 text-purple-200 font-mono text-xs px-3 py-1 rounded-[24px]">
            Video {currentIndex + 1} / {videos.length}
          </span>
          <h2 className="text-sm font-semibold text-white truncate max-w-xs sm:max-w-md" title={currentVid.name}>
            {currentVid.name}
          </h2>
        </div>

        {/* Hide Close (X) button when in Fullscreen mode */}
        {!isFullscreen && (
          <div className="flex items-center gap-2">
            <button 
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-red-500/80 text-white transition-colors"
              title="Đóng (ESC)"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        )}
      </div>

      {/* 3. Floating Bottom Player Controls Drawer Overlay */}
      <div className={`absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-4 px-6 sm:px-8 space-y-3 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        
        {/* Timeline Scrubber */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-gray-300 w-12 text-right">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min="0"
            max={duration || 0}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            style={{
              background: `linear-gradient(to right, #a855f7 ${progressPct}%, #374151 ${progressPct}%)`
            }}
            className="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer accent-purple-500 transition-all duration-75"
          />
          <span className="font-mono text-xs text-gray-400 w-12">
            {formatTime(duration)}
          </span>
        </div>

        {/* Lower Toolbar Controls */}
        <div className="flex items-center justify-between gap-4">
          
          {/* Left Controls: Play, Seek -10s/+10s, Volume */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={hasEnded ? restartVideo : togglePlay}
              className="p-2.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white transition-colors shadow-md"
              title={hasEnded ? 'Phát lại video' : isPlaying ? 'Tạm dừng (Space)' : 'Phát video (Space)'}
            >
              {hasEnded ? <RotateCcw className="w-5 h-5" /> : isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
            </button>

            <button
              onClick={() => seekRelative(-10)}
              className="p-2 rounded-full text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
              title="Tua lùi 10 giây (ArrowLeft)"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            <button
              onClick={() => seekRelative(10)}
              className="p-2 rounded-full text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
              title="Tua tới 10 giây (ArrowRight)"
            >
              <RotateCw className="w-5 h-5" />
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="p-2 rounded-full text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
              >
                {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                style={{
                  background: `linear-gradient(to right, #a855f7 ${volumePct}%, #374151 ${volumePct}%)`
                }}
                className="w-16 sm:w-24 h-1.5 rounded-lg appearance-none cursor-pointer accent-purple-500 hidden sm:block transition-all duration-75"
              />
            </div>
          </div>

          {/* Right Controls: Settings Button & Fullscreen Toggle */}
          <div className="relative flex items-center gap-3" ref={settingsMenuRef}>
            
            {/* Settings Popover Dropdown Menu */}
            {showSettingsMenu && (
              <div className="absolute bottom-14 right-10 z-40 bg-[#1c1d21] border border-[#383c42] rounded-[24px] shadow-2xl p-2 w-60 animate-fade-in text-xs text-gray-200">
                {settingsSubView === 'main' ? (
                  /* Main Settings View */
                  <div className="space-y-1">
                    <button
                      onClick={() => setSettingsSubView('speed')}
                      className="w-full flex items-center justify-between p-2.5 rounded-[18px] hover:bg-[#28292d] hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <Gauge className="w-4 h-4 text-purple-400" />
                        <span className="font-semibold">Tốc độ phát</span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-400 font-mono text-[11px]">
                        <span>{playbackSpeed === 1 ? 'Bình thường' : `${playbackSpeed}x`}</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </button>
                  </div>
                ) : (
                  /* Speed Options Selection Sub-View */
                  <div className="space-y-1">
                    <button
                      onClick={() => setSettingsSubView('main')}
                      className="w-full flex items-center gap-2 p-2 border-b border-[#383c42] text-gray-300 hover:text-white font-bold transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4 text-purple-400" />
                      <span>Chọn tốc độ phát</span>
                    </button>

                    <div className="pt-1 max-h-48 overflow-y-auto custom-scrollbar space-y-0.5">
                      {speedOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => changeSpeed(opt.value)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-[16px] text-xs transition-colors ${
                            playbackSpeed === opt.value
                              ? 'bg-purple-600/30 text-purple-300 font-bold border border-purple-500/40'
                              : 'hover:bg-[#28292d] text-gray-300'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {playbackSpeed === opt.value && (
                            <Check className="w-4 h-4 text-purple-400" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Rotate 90 Degrees Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRotate();
              }}
              className={`p-2 rounded-full transition-colors ${
                rotation !== 0 ? 'bg-purple-600/40 text-purple-300 border border-purple-400/40' : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`}
              title={`Xoay video 90° (Góc xoay hiện tại: ${rotation}°)`}
            >
              <RotateCw className="w-5 h-5" />
            </button>

            {/* YouTube-style Settings Icon Button */}
            <button
              onClick={() => {
                setShowSettingsMenu(!showSettingsMenu);
                setSettingsSubView('main');
              }}
              className={`p-2 rounded-full transition-colors ${
                showSettingsMenu ? 'bg-purple-600 text-white' : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`}
              title="Cài đặt (Tốc độ phát video)"
            >
              <Settings className={`w-5 h-5 ${showSettingsMenu ? 'animate-spin-slow' : ''}`} />
            </button>

            {/* Fullscreen Toggle (Supports iOS Safari webkitEnterFullscreen and HTML5 Fullscreen API) */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-full text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
              title="Bật toàn màn hình (F)"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
});
