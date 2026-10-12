import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, RotateCw, X } from 'lucide-react';
import { getVideoStreamUrl, getVideoThumbnailUrl } from '../utils/formatters';
import { RollingNumber } from './common/RollingNumber';

export const VideoPlayerModal = memo(({ videos = [], currentIndex, onClose, onSelectIndex }) => {
  const videoRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const touchStartRef = useRef(null);
  const wheelLockRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [rotation, setRotation] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [transitionVideo, setTransitionVideo] = useState(null);
  const [trackPosition, setTrackPosition] = useState(-1);
  const [trackTransitioning, setTrackTransitioning] = useState(false);

  const currentVid = videos[currentIndex];
  const streamUrl = getVideoStreamUrl(currentVid);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  useEffect(() => {
    setIsBuffering(true);
    setIsPlaying(true);
    setHasError(false);
    setCurrentTime(0);
    setDuration(0);
    setTrackPosition(-1);
    setTrackTransitioning(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.load();
    }
  }, [currentIndex, streamUrl]);

  useEffect(() => () => window.clearTimeout(controlsTimeoutRef.current), []);

  const startHideControlsTimer = useCallback(() => {
    window.clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (isPlaying && !isBuffering) setShowControls(false);
    }, 3000);
  }, [isPlaying, isBuffering]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
      startHideControlsTimer();
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      window.clearTimeout(controlsTimeoutRef.current);
    }
  }, [startHideControlsTimer]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setTransitionVideo(videos[currentIndex - 1]);
      setIsSwitching(true);
      setTrackTransitioning(true);
      setTrackPosition(0);
    }
  }, [currentIndex, videos]);

  const handleNext = useCallback(() => {
    if (currentIndex < videos.length - 1) {
      setTransitionVideo(videos[currentIndex + 1]);
      setIsSwitching(true);
      setTrackTransitioning(true);
      setTrackPosition(-2);
    }
  }, [currentIndex, videos]);

  const handleTrackTransitionEnd = (event) => {
    if (event.target !== event.currentTarget || !trackTransitioning) return;
    onSelectIndex(trackPosition === -2 ? currentIndex + 1 : currentIndex - 1);
  };

  // Media Session API integration for system media controller
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentVid) return;

    const thumbnailUrl = getVideoThumbnailUrl(currentVid);
    const artwork = thumbnailUrl
      ? [
          { src: thumbnailUrl, sizes: '96x96', type: 'image/jpeg' },
          { src: thumbnailUrl, sizes: '128x128', type: 'image/jpeg' },
          { src: thumbnailUrl, sizes: '256x256', type: 'image/jpeg' },
          { src: thumbnailUrl, sizes: '512x512', type: 'image/jpeg' },
        ]
      : [];

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentVid.name || 'Video',
      artist: 'AppView',
      album: currentVid.path ? currentVid.path.split('/').slice(0, -1).pop() || 'Media' : 'Media',
      artwork,
    });

    try {
      navigator.mediaSession.setActionHandler('previoustrack', currentIndex > 0 ? handlePrev : null);
    } catch {
      // Ignore unsupported action errors
    }

    try {
      navigator.mediaSession.setActionHandler('nexttrack', currentIndex < videos.length - 1 ? handleNext : null);
    } catch {
      // Ignore unsupported action errors
    }

    return () => {
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.setActionHandler('previoustrack', null);
          navigator.mediaSession.setActionHandler('nexttrack', null);
        } catch {
          // Ignore
        }
      }
    };
  }, [currentIndex, currentVid, handleNext, handlePrev, videos.length]);

  useEffect(() => {
    return () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === ' ') {
        event.preventDefault();
        togglePlay();
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        handlePrev();
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, onClose, togglePlay]);

  const handleTouchStart = (event) => {
    touchStartRef.current = event.touches[0]?.clientY ?? null;
  };

  const handleTouchEnd = (event) => {
    const startY = touchStartRef.current;
    const endY = event.changedTouches[0]?.clientY;
    touchStartRef.current = null;
    if (startY == null || endY == null) return;
    const deltaY = endY - startY;
    if (Math.abs(deltaY) < 50) return;
    if (deltaY < 0) handleNext();
    else handlePrev();
  };

  const handleWheel = (event) => {
    if (wheelLockRef.current || Math.abs(event.deltaY) < 20) return;
    wheelLockRef.current = true;
    if (event.deltaY > 0) handleNext();
    else handlePrev();
    window.setTimeout(() => { wheelLockRef.current = false; }, 350);
  };

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds)) return '00:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  const handleSeek = (event) => {
    const nextTime = Number(event.target.value);
    setCurrentTime(nextTime);
    if (videoRef.current) videoRef.current.currentTime = nextTime;
  };

  if (!currentVid) return null;

  const progress = duration > 0 ? Math.min(Math.max((currentTime / duration) * 100, 0), 100) : 0;
  const posterVideo = isSwitching && transitionVideo ? transitionVideo : currentVid;
  const renderPoster = (video) => {
    const url = getVideoThumbnailUrl(video);
    return url ? <img src={url} alt="" className="h-full w-full object-contain" /> : <div className="h-full w-full bg-[#070809]" />;
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      className="fixed inset-0 z-50 overflow-hidden bg-[#070809] select-none"
    >
      <div
        className="absolute inset-0 z-10 overflow-hidden"
        onClick={() => {
          if (!showControls) setShowControls(true);
          else togglePlay();
        }}
      >
        <div
          className="flex h-full w-full flex-col"
          onTransitionEnd={handleTrackTransitionEnd}
          style={{
            height: '300%',
            transform: `translateY(${trackPosition * 33.333333}%)`,
            transition: trackTransitioning ? 'transform 320ms cubic-bezier(0.22, 0.61, 0.36, 1)' : 'none',
          }}
        >
          <div className="relative h-1/3 w-full">{renderPoster(posterVideo)}</div>
          <div className="relative flex h-1/3 w-full items-center justify-center">
            <div className="absolute inset-0">{renderPoster(posterVideo)}</div>
            <video
              ref={videoRef}
              src={streamUrl}
              preload="auto"
              playsInline
              autoPlay
              onCanPlay={() => {
                setHasError(false);
                setIsBuffering(false);
                setIsSwitching(false);
                setTransitionVideo(null);
                if (isPlaying) videoRef.current?.play().catch(() => setIsPlaying(false));
              }}
              onWaiting={() => setIsBuffering(true)}
              onPlaying={() => {
                setHasError(false);
                setIsBuffering(false);
                setIsPlaying(true);
              }}
              onError={() => {
                setIsBuffering(false);
                setIsSwitching(false);
                setTransitionVideo(null);
                setHasError(true);
                setIsPlaying(false);
              }}
              onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
              onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
              onEnded={() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = 0;
                  videoRef.current.play().catch(() => setIsPlaying(false));
                }
                setCurrentTime(0);
                setIsPlaying(true);
                setShowControls(true);
              }}
              style={{
                transform: `rotate(${rotation}deg)`,
                width: rotation % 180 ? '100vh' : '100%',
                height: rotation % 180 ? '100vw' : '100%',
                maxWidth: rotation % 180 ? '100vh' : '100vw',
                maxHeight: rotation % 180 ? '100vw' : '100vh',
                objectFit: 'contain',
              }}
              className={`relative z-10 transform-gpu transition-[opacity,transform] duration-200 ease-out ${isSwitching ? 'opacity-0' : 'opacity-100'}`}
            />
            {hasError && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/85 p-4 text-center text-white">
                <X className="h-10 w-10 text-red-400" />
                <span className="text-sm font-bold">Không thể phát video này</span>
              </div>
            )}
            {isBuffering && !hasError && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/35 pointer-events-none">
                <Loader2 className="h-10 w-10 animate-spin text-purple-400" />
                <span className="rounded-[24px] bg-black/70 px-3 py-1 text-xs font-mono text-gray-200">Đang nạp video...</span>
              </div>
            )}
          </div>
          <div className="relative h-1/3 w-full">{renderPoster(posterVideo)}</div>
        </div>
      </div>

      <div className={`absolute left-0 right-0 top-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/90 via-black/60 to-transparent px-6 py-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
        <div className="flex min-w-0 items-center gap-3">
          <span className="rounded-[24px] border border-purple-400/40 bg-purple-600/30 px-3 py-1 font-mono text-xs text-purple-200">Video <RollingNumber value={currentIndex + 1} /> / <RollingNumber value={videos.length} /></span>
          <h2 className="max-w-xs truncate text-sm font-semibold text-white sm:max-w-md" title={currentVid.name}>{currentVid.name}</h2>
        </div>
        <button onClick={onClose} className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-red-500/80" title="Đóng (ESC)"><X className="h-6 w-6" /></button>
      </div>

      <div className={`absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-4 px-6 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
        <div className="flex items-end gap-3">
          <span className="w-12 font-mono text-right text-xs text-gray-300">{formatTime(currentTime)}</span>
          <div className="relative flex-1 pt-5" onClick={(event) => event.stopPropagation()}>
            {isSeeking && <span className="pointer-events-none absolute top-0 -translate-x-1/2 font-mono text-xs font-semibold text-white/80 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]" style={{ left: `${progress}%` }}>{formatTime(currentTime)}</span>}
            <input
              type="range"
              min="0"
              max={duration || 0}
              step="0.1"
              value={currentTime}
              onPointerDown={() => setIsSeeking(true)}
              onPointerUp={() => setIsSeeking(false)}
              onChange={handleSeek}
              style={{ background: `linear-gradient(to right, #a855f7 ${progress}%, #374151 ${progress}%)` }}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg accent-purple-500"
            />
          </div>
          <span className="w-12 font-mono text-xs text-gray-400">{formatTime(duration)}</span>
          <button onClick={(event) => { event.stopPropagation(); setRotation((value) => (value + 90) % 360); }} className={`rounded-full p-2 transition-colors ${rotation ? 'border border-purple-400/40 bg-purple-600/40 text-purple-300' : 'text-gray-300 hover:bg-white/10 hover:text-white'}`} title={`Xoay video 90° (Góc xoay hiện tại: ${rotation}°)`}><RotateCw className="h-5 w-5" /></button>
        </div>
      </div>
    </div>
  );
});
