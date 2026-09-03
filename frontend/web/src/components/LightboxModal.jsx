import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Play, 
  Pause, 
  Info,
  Calendar,
  Folder,
  Maximize2,
  Minimize2,
  RotateCcw
} from 'lucide-react';
import { formatDate, getPictureUrl } from '../utils/formatters';

export const LightboxModal = memo(({ 
  pictures = [], 
  currentIndex, 
  onClose, 
  onSelectIndex,
  totalPictures,
  hasMore,
  isLoadingMore,
  onLoadMore
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const currentPic = pictures[currentIndex];
  const containerRef = useRef(null);
  const imageRef = useRef(null);
  const lastTapRef = useRef(0);

  // Reset zoom and position when image index changes
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex]);

  // Lock background scroll when Lightbox modal is active
  useEffect(() => {
    const originalStyle = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  // Preload adjacent images (Next & Prev) in the background
  useEffect(() => {
    if (!pictures || pictures.length <= 1) return;
    const nextIdx = (currentIndex + 1) % pictures.length;
    const prevIdx = (currentIndex - 1 + pictures.length) % pictures.length;
    
    const nextUrl = getPictureUrl(pictures[nextIdx]) || pictures[nextIdx]?.url;
    const prevUrl = getPictureUrl(pictures[prevIdx]) || pictures[prevIdx]?.url;

    if (nextUrl) {
      const imgNext = new Image();
      imgNext.src = nextUrl;
    }
    if (prevUrl) {
      const imgPrev = new Image();
      imgPrev.src = prevUrl;
    }
  }, [currentIndex, pictures]);

  // Native fullscreen change listener
  useEffect(() => {
    const handleFSChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      setIsFullscreen(true);
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      setIsFullscreen(false);
      if (document.exitFullscreen && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }, [isFullscreen]);

  // Auto-fetch next batch of pictures in the background when approaching the end of current list
  useEffect(() => {
    if (hasMore && !isLoadingMore && onLoadMore && pictures.length > 0) {
      if (currentIndex >= pictures.length - 3) {
        onLoadMore();
      }
    }
  }, [currentIndex, pictures.length, hasMore, isLoadingMore, onLoadMore]);

  // Navigation handlers
  const handlePrev = useCallback(() => {
    if (isFullscreen) return;
    if (currentIndex > 0) {
      onSelectIndex(currentIndex - 1);
    }
  }, [currentIndex, onSelectIndex, isFullscreen]);

  const handleNext = useCallback(() => {
    if (isFullscreen) return;
    if (currentIndex < pictures.length - 1) {
      onSelectIndex(currentIndex + 1);
    } else if (hasMore && onLoadMore) {
      onLoadMore();
    }
  }, [currentIndex, pictures.length, onSelectIndex, isFullscreen, hasMore, onLoadMore]);

  // Keyboard navigation listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      }
      if (!isFullscreen) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') handlePrev();
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, onClose, handlePrev, handleNext]);

  // Slideshow timer effect
  useEffect(() => {
    let interval = null;
    if (isPlaying && !isFullscreen) {
      interval = setInterval(() => {
        handleNext();
      }, 3500);
    }
    return () => clearInterval(interval);
  }, [isPlaying, isFullscreen, handleNext]);

  if (!currentPic) return null;

  // Zoom limit 6.0 (600%)
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.35, 6.0));
  const handleZoomOut = () => {
    setZoom((z) => {
      const newZoom = Math.max(z - 0.35, 1);
      if (newZoom === 1) setPosition({ x: 0, y: 0 });
      return newZoom;
    });
  };

  const handleRotate = () => setRotation((r) => (r + 90) % 360);
  
  const handleResetZoom = () => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  // Non-passive wheel event listener for smooth zooming without console warnings
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.deltaY < 0) {
        setZoom((z) => Math.min(z + 0.25, 6.0));
      } else {
        setZoom((z) => {
          const newZoom = Math.max(z - 0.25, 1);
          if (newZoom === 1) setPosition({ x: 0, y: 0 });
          return newZoom;
        });
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Interactive Image Pan Dragging when Zoomed
  const handleMouseDown = (e) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || zoom <= 1) return;
    e.preventDefault();
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Double tap / double click to toggle Fullscreen
  const handleDoubleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFullscreen();
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      toggleFullscreen();
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 bg-[#0c0d10] flex flex-col justify-between select-none animate-fade-in"
    >
      
      {/* Responsive Mobile-Optimized Top Control Bar */}
      {!isFullscreen && (
        <div className="relative z-10 px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-gradient-to-b from-black/90 via-black/70 to-transparent">
          {/* Row 1: Index counter, Title, and Close Button */}
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="bg-[#8ab4f8]/20 border border-[#8ab4f8]/40 text-[#8ab4f8] font-mono text-xs px-2.5 py-1 rounded-[24px] flex-shrink-0">
                {currentIndex + 1} / {totalPictures || pictures.length}
              </span>
              <h2 className="text-xs sm:text-sm font-semibold text-white truncate max-w-[200px] sm:max-w-md" title={currentPic.name}>
                {currentPic.name}
              </h2>
            </div>

            {/* Mobile prominent Close Button */}
            <button 
              onClick={onClose}
              className="sm:hidden p-1.5 rounded-full bg-white/10 hover:bg-red-500/80 text-white transition-colors flex-shrink-0"
              title="Đóng (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Row 2: Action Control Buttons */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2">
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className={`p-2 rounded-full text-gray-300 hover:text-white hover:bg-white/10 transition-colors ${isPlaying ? 'bg-[#8ab4f8] text-black font-bold' : ''}`}
              title={isPlaying ? 'Tạm dừng chiếu' : 'Trình chiếu tự động'}
            >
              {isPlaying ? <Pause className="w-4.5 h-4.5 sm:w-5 sm:h-5" /> : <Play className="w-4.5 h-4.5 sm:w-5 sm:h-5" />}
            </button>
            
            <button 
              onClick={handleZoomIn}
              className="p-2 rounded-full text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
              title="Phóng to (tối đa 600%)"
            >
              <ZoomIn className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
            </button>
            
            <button 
              onClick={handleZoomOut}
              className="p-2 rounded-full text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
              title="Thu nhỏ"
            >
              <ZoomOut className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
            </button>

            {zoom > 1 && (
              <button 
                onClick={handleResetZoom}
                className="p-2 rounded-full text-yellow-400 hover:bg-white/10 transition-colors"
                title="Đặt lại kích thước ban đầu"
              >
                <RotateCcw className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              </button>
            )}

            <button 
              onClick={handleRotate}
              className="p-2 rounded-full text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
              title="Xoay 90 độ"
            >
              <RotateCw className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
            </button>

            <button 
              onClick={() => setShowInfo(!showInfo)}
              className={`p-2 rounded-full text-gray-300 hover:text-white hover:bg-white/10 transition-colors ${showInfo ? 'bg-white/15 text-white' : ''}`}
              title="Thông tin chi tiết"
            >
              <Info className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
            </button>

            {/* Desktop Close Button */}
            <button 
              onClick={onClose}
              className="hidden sm:flex p-2 rounded-full bg-[#202124] hover:bg-red-500/80 text-white transition-colors ml-2"
              title="Đóng (ESC)"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>
      )}

      {/* Main Image Display Area with Double Click / Double Tap to Fullscreen */}
      <div 
        className="relative flex-1 flex items-center justify-center overflow-hidden p-2 sm:p-4"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={(e) => {
          if (zoom > 1 && e.touches.length === 1) {
            setIsDragging(true);
            setDragStart({
              x: e.touches[0].clientX - position.x,
              y: e.touches[0].clientY - position.y
            });
          }
        }}
        onTouchMove={(e) => {
          if (isDragging && zoom > 1 && e.touches.length === 1) {
            setPosition({
              x: e.touches[0].clientX - dragStart.x,
              y: e.touches[0].clientY - dragStart.y
            });
          }
        }}
        onTouchEnd={handleTouchEnd}
      >
        <img
          ref={imageRef}
          src={getPictureUrl(currentPic) || currentPic.url}
          alt={currentPic.name}
          onDoubleClick={handleDoubleClick}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
            transition: isDragging ? 'none' : 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
            cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
          }}
          className={`${
            isFullscreen ? 'max-h-screen max-w-screen' : 'max-h-[80vh] max-w-[95vw] sm:max-h-[82vh] sm:max-w-[90vw]'
          } object-contain rounded-lg shadow-2xl select-none`}
          draggable={false}
        />

        {/* Prev / Next Navigation Arrows */}
        {!isFullscreen && pictures.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); handlePrev(); }}
              className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 p-2.5 sm:p-3 rounded-full bg-black/65 hover:bg-[#8ab4f8] text-white hover:text-black transition-all border border-white/10 shadow-lg"
              title="Ảnh trước"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); handleNext(); }}
              className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 p-2.5 sm:p-3 rounded-full bg-black/65 hover:bg-[#8ab4f8] text-white hover:text-black transition-all border border-white/10 shadow-lg"
              title="Ảnh tiếp theo"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </>
        )}
      </div>

      {/* Lightbox Bottom Info Drawer */}
      {!isFullscreen && showInfo && (
        <div className="relative z-10 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 sm:p-4 px-4 sm:px-8 flex items-center justify-between text-xs text-gray-300">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
              <span>{formatDate(currentPic.mod_time)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Folder className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-400" />
              <span className="font-mono text-gray-400 truncate max-w-[200px] sm:max-w-md">{currentPic.path}</span>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Toggle Button - Hidden on Mobile, Displayed only on Desktop */}
      <button 
        onClick={toggleFullscreen}
        className="hidden sm:block fixed bottom-6 right-6 z-50 p-3.5 rounded-full bg-black/85 hover:bg-[#8ab4f8] text-white hover:text-black border border-white/20 shadow-2xl transition-all hover:scale-110 active:scale-95"
        title={isFullscreen ? 'Thoát toàn màn hình (ESC)' : 'Xem toàn màn hình'}
      >
        {isFullscreen ? (
          <Minimize2 className="w-5 h-5" />
        ) : (
          <Maximize2 className="w-5 h-5 text-blue-400 group-hover:text-black" />
        )}
      </button>

    </div>
  );
});
