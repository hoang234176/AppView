import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Film, HardDrive, Calendar, MoreVertical, Info, FolderInput, Trash2, Check, Copy } from 'lucide-react';
import { formatDate, formatFileSize, getVideoThumbnailUrl } from '../utils/formatters';
import { RollingNumber } from './common/RollingNumber';

const VideoCard = React.memo(({
  vid,
  idx,
  isSelected,
  isSelectMode,
  onToggleSelect,
  onOpenVideo,
  isMenuOpen,
  onToggleMenu,
  menuRef,
  onShowInfo,
  onCopyItem,
  onMoveItem,
  onDeleteItem,
}) => {
  const thumbUrl = getVideoThumbnailUrl(vid);

  return (
    <div
      onClick={() => {
        if (isSelectMode) {
          if (onToggleSelect) onToggleSelect(vid, 'video');
        } else {
          onOpenVideo(idx);
        }
      }}
      onContextMenu={(e) => {
        if (isSelectMode) return;
        e.preventDefault();
        e.stopPropagation();
        onToggleMenu(idx);
      }}
      className={`group relative bg-[#202124] border rounded-[24px] shadow-sm hover:shadow-xl cursor-pointer transition-[border-color,background-color,box-shadow] duration-150 flex flex-col hover:-translate-y-1 ${
        isSelected
          ? 'border-purple-500 ring-2 ring-purple-500/40 bg-purple-500/10'
          : 'border-[#383c42] hover:border-purple-400/80'
      } ${isMenuOpen ? 'z-[9999]' : 'z-1'}`}
    >
      {/* Select Checkbox at top-left corner */}
      {isSelectMode && (
        <div className="absolute top-2.5 left-2.5 z-20">
          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors duration-150 shadow-md ${
            isSelected
              ? 'bg-purple-500 border-purple-500 text-white scale-105'
              : 'border-white/70 bg-black/60 hover:border-white'
          }`}>
            {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
          </div>
        </div>
      )}

      <div className="relative aspect-video bg-[#121316] overflow-hidden flex items-center justify-center rounded-t-[24px]">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={vid.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full bg-[#121316] flex items-center justify-center">
            <Film className="w-10 h-10 text-gray-600" />
          </div>
        )}

        {!isSelectMode && (
          <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-purple-600/90 group-hover:bg-purple-500 text-white flex items-center justify-center shadow-lg transition-transform transform group-hover:scale-110">
              <Play className="w-6 h-6 fill-white ml-0.5" />
            </div>
          </div>
        )}

        <div className="absolute bottom-2 right-2 bg-black/85 border border-white/10 text-purple-300 font-mono text-[10px] px-2.5 py-0.5 rounded-[24px] flex items-center gap-1 z-10">
          <HardDrive className="w-3 h-3 text-purple-400" />
          <span>{vid.size > 0 ? formatFileSize(vid.size) : '45.2 MB'}</span>
        </div>
      </div>

      <div className="p-3.5 bg-[#202124] border-t border-[#383c42]/30 rounded-b-[24px] flex items-center justify-between gap-2 relative">
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-semibold text-gray-200 group-hover:text-purple-300 truncate" title={vid.name}>
            {vid.name}
          </h3>
          <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-1 font-mono">
            <Calendar className="w-3 h-3 text-gray-500" />
            <span className="truncate">{formatDate(vid.mod_time)}</span>
          </div>
        </div>

        {!isSelectMode && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu(idx);
            }}
            title="Tùy chọn"
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        )}

        {!isSelectMode && isMenuOpen && (
          <div
            ref={menuRef}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 bottom-full mb-0.5 z-[99999] bg-[#1c1d21] border border-[#383c42] rounded-[18px] p-1.5 shadow-2xl w-48 space-y-1 animate-pop-fast text-xs font-semibold select-none"
          >
            <button
              type="button"
              onClick={() => onShowInfo && onShowInfo(vid, 'video')}
              className="relative z-10 w-full flex items-center gap-2 px-3 py-2 text-gray-200 hover:text-white hover:bg-white/10 rounded-[12px] transition-colors"
            >
              <Info className="w-3.5 h-3.5 text-blue-400" />
              <span>Thông tin file</span>
            </button>

            <button
              type="button"
              onClick={() => onCopyItem && onCopyItem(vid)}
              className="w-full flex items-center gap-2 px-3 py-2 text-gray-200 hover:text-white hover:bg-blue-500/20 rounded-[12px] transition-colors"
            >
              <Copy className="w-3.5 h-3.5 text-blue-400" />
              <span>Sao chép file</span>
            </button>

            <button
              type="button"
              onClick={() => onMoveItem && onMoveItem(vid)}
              className="w-full flex items-center gap-2 px-3 py-2 text-gray-200 hover:text-white hover:bg-amber-500/20 rounded-[12px] transition-colors"
            >
              <FolderInput className="w-3.5 h-3.5 text-amber-400" />
              <span>Di chuyển file</span>
            </button>

            <button
              type="button"
              onClick={() => onDeleteItem && onDeleteItem(vid)}
              className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-[12px] transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              <span>Xóa video này</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

VideoCard.displayName = 'VideoCard';

export const VideoGrid = ({
  videos = [],
  totalCount,
  onOpenVideo,
  onShowInfo,
  onCopyItem,
  onMoveItem,
  onDeleteItem,
  isSelectMode = false,
  selectedItems = new Map(),
  onToggleSelect,
  onToggleSelectAll,
}) => {
  const [openMenuIndex, setOpenMenuIndex] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuIndex(null);
      }
    };
    if (openMenuIndex !== null) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMenuIndex]);

  const handleToggleMenu = useCallback((idx) => {
    setOpenMenuIndex((prev) => (prev === idx ? null : idx));
  }, []);

  const handleCloseMenuAndAction = useCallback((actionFn) => {
    setOpenMenuIndex(null);
    if (actionFn) actionFn();
  }, []);

  if (!videos || videos.length === 0) return null;

  const countDisplay = totalCount && totalCount > videos.length ? `${videos.length} / ${totalCount}` : videos.length;
  const isAllSelected = videos.length > 0 && videos.every((v) => selectedItems.has(`video:${v.path}`));

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-2">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <Film className="w-4 h-4 text-purple-400" /> Video <span className="text-xs font-mono text-gray-500">(<RollingNumber value={countDisplay} />)</span>
        </h2>

        {isSelectMode && (
          <div className="relative group">
            <button
              type="button"
              onClick={onToggleSelectAll}
              title={isAllSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              aria-label={isAllSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all duration-200 active:scale-90 shadow-sm ${
                isAllSelected
                  ? 'bg-purple-500 border-purple-500 text-white shadow-purple-500/20'
                  : 'bg-[#28292d] border-[#383c42] hover:border-purple-500/60 hover:bg-[#383c42] text-gray-400 hover:text-white'
              }`}
            >
              <Check className={`w-3.5 h-3.5 stroke-[2.5] transition-all ${
                isAllSelected ? 'scale-100 opacity-100' : 'scale-75 opacity-0 group-hover:opacity-60'
              }`} />
            </button>
            <div className="pointer-events-none absolute right-0 top-full mt-1.5 hidden group-hover:flex items-center whitespace-nowrap rounded-lg bg-[#18191c] px-2.5 py-1 text-[11px] font-medium text-gray-200 shadow-xl border border-[#383c42] z-30 animate-fade-in">
              {isAllSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
        {videos.map((vid, idx) => (
          <VideoCard
            key={vid.path || vid.name || idx}
            vid={vid}
            idx={idx}
            isSelected={Boolean(selectedItems.has(`video:${vid.path}`))}
            isSelectMode={isSelectMode}
            onToggleSelect={onToggleSelect}
            onOpenVideo={onOpenVideo}
            isMenuOpen={openMenuIndex === idx}
            onToggleMenu={handleToggleMenu}
            menuRef={menuRef}
            onShowInfo={(v, t) => handleCloseMenuAndAction(() => onShowInfo && onShowInfo(v, t))}
            onCopyItem={(v) => handleCloseMenuAndAction(() => onCopyItem && onCopyItem(v))}
            onMoveItem={(v) => handleCloseMenuAndAction(() => onMoveItem && onMoveItem(v))}
            onDeleteItem={(v) => handleCloseMenuAndAction(() => onDeleteItem && onDeleteItem(v))}
          />
        ))}
      </div>
    </section>
  );
};
