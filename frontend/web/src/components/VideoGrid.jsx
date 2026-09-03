import React, { useState, useEffect, useRef } from 'react';
import { Play, Film, HardDrive, Calendar, MoreVertical, Info, FolderInput, Trash2 } from 'lucide-react';
import { formatDate, formatFileSize, getVideoThumbnailUrl } from '../utils/formatters';

export const VideoGrid = ({ videos = [], totalCount, onOpenVideo, onShowInfo, onMoveItem, onDeleteItem }) => {
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

  if (!videos || videos.length === 0) return null;

  const countDisplay = totalCount && totalCount > videos.length ? `${videos.length} / ${totalCount}` : videos.length;

  const renderActionMenu = (vid, idx) => {
    if (openMenuIndex !== idx) return null;

    return (
      <div
        ref={menuRef}
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 bottom-full mb-0.5 z-[99999] bg-[#1c1d21] border border-[#383c42] rounded-[18px] p-1.5 shadow-2xl w-48 space-y-1 animate-pop-fast text-xs font-semibold select-none"
      >
        <button
          type="button"
          onClick={() => {
            setOpenMenuIndex(null);
            if (onShowInfo) onShowInfo(vid, 'video');
          }}
          className="relative z-10 w-full flex items-center gap-2 px-3 py-2 text-gray-200 hover:text-white hover:bg-white/10 rounded-[12px] transition-colors"
        >
          <Info className="w-3.5 h-3.5 text-blue-400" />
          <span>Thông tin file</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setOpenMenuIndex(null);
            if (onMoveItem) onMoveItem(vid);
          }}
          className="w-full flex items-center gap-2 px-3 py-2 text-gray-200 hover:text-white hover:bg-amber-500/20 rounded-[12px] transition-colors"
        >
          <FolderInput className="w-3.5 h-3.5 text-amber-400" />
          <span>Di chuyển file</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setOpenMenuIndex(null);
            if (onDeleteItem) onDeleteItem(vid, false);
          }}
          className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-[12px] transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5 text-red-400" />
          <span>Xóa video này</span>
        </button>
      </div>
    );
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-2">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <Film className="w-4 h-4 text-purple-400" /> Video <span className="text-xs font-mono text-gray-500">({countDisplay})</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
        {videos.map((vid, idx) => {
          const thumbUrl = getVideoThumbnailUrl(vid);

          return (
            <div
              key={vid.path || vid.name || idx}
              onClick={() => onOpenVideo(idx)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpenMenuIndex(openMenuIndex === idx ? null : idx);
              }}
              className={`group relative bg-[#202124] border border-[#383c42] hover:border-purple-400/80 rounded-[24px] shadow-sm hover:shadow-xl cursor-pointer transition-all duration-300 flex flex-col hover:-translate-y-1 ${
                openMenuIndex === idx ? 'z-[9999]' : 'z-1'
              }`}
            >
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
                
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-purple-600/90 group-hover:bg-purple-500 text-white flex items-center justify-center shadow-lg transition-transform transform group-hover:scale-110">
                    <Play className="w-6 h-6 fill-white ml-0.5" />
                  </div>
                </div>

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

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuIndex(openMenuIndex === idx ? null : idx);
                  }}
                  title="Tùy chọn"
                  className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {renderActionMenu(vid, idx)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
