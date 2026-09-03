import React, { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon, Calendar, HardDrive, MoreVertical, Info, FolderInput, Trash2 } from 'lucide-react';
import { formatDate, formatFileSize, getThumbnailUrl, getPictureUrl } from '../utils/formatters';

export const PictureGrid = ({ pictures = [], totalCount, onOpenLightbox, onShowInfo, onMoveItem, onDeleteItem }) => {
  const [failedImages, setFailedImages] = useState({});
  const [openMenuIndex, setOpenMenuIndex] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    setFailedImages({});
  }, [pictures]);

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

  if (!pictures || pictures.length === 0) return null;

  const countDisplay = totalCount && totalCount > pictures.length ? `${pictures.length} / ${totalCount}` : pictures.length;

  const handleImageError = (index, e, pic) => {
    const fullUrl = getPictureUrl(pic);
    if (fullUrl && e.target.src !== fullUrl) {
      e.target.src = fullUrl;
    } else {
      setFailedImages((prev) => ({ ...prev, [index]: true }));
    }
  };

  const renderActionMenu = (pic, idx) => {
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
            if (onShowInfo) onShowInfo(pic, 'picture');
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
            if (onMoveItem) onMoveItem(pic);
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
            if (onDeleteItem) onDeleteItem(pic, false);
          }}
          className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-[12px] transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5 text-red-400" />
          <span>Xóa ảnh này</span>
        </button>
      </div>
    );
  };

  return (
    <section className="max-w-7xl mx-auto px-6 sm:px-8 pt-4 pb-2 mb-2">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-blue-400" /> Hình Ảnh <span className="text-xs font-mono text-gray-500">({countDisplay})</span>
        </h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
        {pictures.map((pic, idx) => {
          const thumbUrl = getThumbnailUrl(pic);

          return (
            <div
              key={pic.path || pic.name || idx}
              onClick={() => onOpenLightbox(idx)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpenMenuIndex(openMenuIndex === idx ? null : idx);
              }}
              className={`group relative bg-[#202124] border border-[#383c42] hover:border-[#8ab4f8] rounded-[24px] shadow-sm hover:shadow-xl cursor-pointer transition-all duration-300 flex flex-col hover:-translate-y-1 ${
                openMenuIndex === idx ? 'z-[9999]' : 'z-1'
              }`}
            >
              <div className="relative aspect-[4/3] bg-[#18191c] overflow-hidden flex items-center justify-center rounded-t-[24px]">
                {failedImages[idx] ? (
                  <div className="flex flex-col items-center justify-center p-3 text-center text-gray-500">
                    <ImageIcon className="w-8 h-8 mb-1 stroke-[1.5]" />
                    <span className="text-[10px]">Lỗi tải ảnh</span>
                  </div>
                ) : (
                  <img
                    src={thumbUrl}
                    alt={pic.name}
                    loading="lazy"
                    onError={(e) => handleImageError(idx, e, pic)}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                )}

                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

                <div className="absolute bottom-2 right-2 bg-black/85 border border-white/10 text-blue-300 font-mono text-[10px] px-2.5 py-0.5 rounded-[24px] flex items-center gap-1 z-10">
                  <HardDrive className="w-3 h-3 text-blue-400" />
                  <span>{pic.size > 0 ? formatFileSize(pic.size) : '2.4 MB'}</span>
                </div>
              </div>

              <div className="p-3.5 bg-[#202124] border-t border-[#383c42]/30 rounded-b-[24px] flex items-center justify-between gap-2 relative">
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs font-semibold text-gray-200 group-hover:text-[#8ab4f8] truncate" title={pic.name}>
                    {pic.name}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-1 font-mono">
                    <Calendar className="w-3 h-3 text-gray-500" />
                    <span className="truncate">{formatDate(pic.mod_time)}</span>
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

                {renderActionMenu(pic, idx)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
