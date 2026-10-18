import { memo, useState, useEffect, useRef } from 'react';
import {
  Funnel,
  RotateCcw,
  Folder,
  Film,
  Image as ImageIcon,
} from 'lucide-react';
import {
  FacebookIcon,
  TikTokIcon,
  YouTubeIcon,
  InstagramIcon,
  TelegramIcon,
  XIcon,
} from './SocialIcons';
import { useHeaderFilter } from '../../../../hooks/header';

const FILE_TYPE_OPTIONS = [
  { key: 'folder', label: 'Thư mục', icon: Folder, colorClass: 'text-amber-400' },
  { key: 'video', label: 'Video', icon: Film, colorClass: 'text-purple-400' },
  { key: 'picture', label: 'Hình ảnh', icon: ImageIcon, colorClass: 'text-blue-400' },
];

const MXH_OPTIONS = [
  { key: 'youtube', label: 'YouTube', icon: YouTubeIcon, colorClass: 'text-[#FF0000]' },
  { key: 'tiktok', label: 'TikTok', icon: TikTokIcon, colorClass: 'text-[#00F2FE]' },
  { key: 'facebook', label: 'Facebook', icon: FacebookIcon, colorClass: 'text-[#1877F2]' },
  { key: 'instagram', label: 'Instagram', icon: InstagramIcon, colorClass: 'text-[#E4405F]' },
  { key: 'telegram', label: 'Telegram', icon: TelegramIcon, colorClass: 'text-[#24A1DE]' },
  { key: 'x', label: 'X', icon: XIcon, colorClass: 'text-[#E7E9EA]' },
];

/**
 * HeaderFilter — Filter button and popover dropdown for file types and social media
 */
export const HeaderFilter = memo(({
  fileTypeFilters: propFileTypeFilters,
  setFileTypeFilters: propSetFileTypeFilters,
  mxhFilters: propMxhFilters,
  setMxhFilters: propSetMxhFilters,
}) => {
  const hookData = useHeaderFilter();
  const fileTypeFilters = propFileTypeFilters !== undefined ? propFileTypeFilters : hookData.fileTypeFilters;
  const setFileTypeFilters = propSetFileTypeFilters || hookData.setFileTypeFilters;
  const mxhFilters = propMxhFilters !== undefined ? propMxhFilters : hookData.mxhFilters;
  const setMxhFilters = propSetMxhFilters || hookData.setMxhFilters;

  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef(null);

  const isFilterActive = (fileTypeFilters && fileTypeFilters.size > 0) || (mxhFilters && mxhFilters.size > 0);

  const handleToggleFileType = (key) => {
    if (!setFileTypeFilters) return;
    setFileTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleToggleMxh = (key) => {
    if (!setMxhFilters) return;
    setMxhFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target)) {
        setFilterMenuOpen(false);
      }
    };
    if (filterMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [filterMenuOpen]);

  return (
    <div className="relative z-50" ref={filterMenuRef}>
      <button
        type="button"
        onClick={() => setFilterMenuOpen((prev) => !prev)}
        title="Bộ lọc hiển thị"
        className={`group relative flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-200 active:scale-95 shadow-sm ${
          isFilterActive
            ? 'border-blue-500/80 bg-blue-500/15 text-blue-400'
            : filterMenuOpen
              ? 'border-blue-500 text-white bg-[#383c42]'
              : 'border-[#383c42] bg-[#28292d] text-gray-300 hover:text-white hover:border-[#8ab4f8]/60'
        }`}
      >
        <Funnel className="h-4.5 w-4.5 transition-colors" />
        {isFilterActive && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-400 shadow-sm" />
        )}
      </button>

      {filterMenuOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-[#1c1d21] border border-[#383c42] rounded-[20px] p-3 shadow-2xl space-y-3 z-[99999] animate-pop-fast text-xs font-semibold select-none">
          {/* Header with Title & Reset Button */}
          <div className="flex items-center justify-between pb-1.5 border-b border-[#383c42]/60">
            <div className="flex items-center gap-1.5 text-white font-bold text-sm">
              <Funnel className="w-4 h-4 text-blue-400" />
              <span>Bộ lọc hiển thị</span>
            </div>
            {isFilterActive && (
              <button
                type="button"
                onClick={() => {
                  if (setFileTypeFilters) setFileTypeFilters(new Set());
                  if (setMxhFilters) setMxhFilters(new Set());
                }}
                className="flex items-center gap-1 text-[11px] font-bold text-red-400 hover:text-red-300 hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Đặt lại</span>
              </button>
            )}
          </div>

          {/* Section 1: Loại tập tin */}
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-1.5 px-0.5">
              Loại tập tin
            </div>
            <div className="grid grid-cols-2 gap-1">
              {FILE_TYPE_OPTIONS.map((opt) => {
                const IconComp = opt.icon;
                const isSelected = fileTypeFilters && fileTypeFilters.has(opt.key);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => handleToggleFileType(opt.key)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-[12px] text-xs font-semibold transition-colors text-left ${
                      isSelected
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50 shadow-sm'
                        : 'text-gray-300 hover:text-white hover:bg-white/10 border border-transparent'
                    }`}
                  >
                    <IconComp className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-blue-400' : opt.colorClass || 'text-gray-400'}`} />
                    <span className="truncate flex-1">{opt.label}</span>
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Mạng xã hội */}
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-1.5 px-0.5">
              Mạng xã hội
            </div>
            <div className="grid grid-cols-2 gap-1">
              {MXH_OPTIONS.map((opt) => {
                const IconComp = opt.icon;
                const isSelected = mxhFilters && mxhFilters.has(opt.key);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => handleToggleMxh(opt.key)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-[12px] text-xs font-semibold transition-colors text-left ${
                      isSelected
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50 shadow-sm'
                        : 'text-gray-300 hover:text-white hover:bg-white/10 border border-transparent'
                    }`}
                  >
                    <IconComp className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-blue-400' : opt.colorClass || 'text-gray-400'}`} />
                    <span className="truncate flex-1">{opt.label}</span>
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

HeaderFilter.displayName = 'HeaderFilter';
