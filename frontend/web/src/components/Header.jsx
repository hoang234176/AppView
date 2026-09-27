import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  X,
  Image as ImageIcon,
  CheckCircle2,
  MoreVertical,
  Copy,
  FolderInput,
  Trash2,
  Funnel,
  Folder,
  Film,
  RotateCcw,
} from 'lucide-react';
import { RollingNumber } from './common/RollingNumber';

const FacebookIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={`${className} fill-current`} viewBox="0 0 24 24">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const TikTokIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={`${className} fill-current`} viewBox="0 0 24 24">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
  </svg>
);

const YouTubeIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={`${className} fill-current`} viewBox="0 0 24 24">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

const InstagramIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={`${className} fill-current`} viewBox="0 0 24 24">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

const TelegramIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={`${className} fill-current`} viewBox="0 0 24 24">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.121l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.458c.538-.196 1.006.128.832.943z"/>
  </svg>
);

const XIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={`${className} fill-current`} viewBox="0 0 24 24">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

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

export const Header = ({
  searchQuery,
  setSearchQuery,
  onOpenDownloadPanel,
  activeDownloadCount = 0,
  downloadProgressPercent = 0,
  isDownloadingMode = true,
  hasPasswordError = false,
  isScanning = false,
  isConverting = false,
  // Select mode props
  isSelectMode = false,
  onEnterSelectMode,
  onExitSelectMode,
  selectedCount = 0,
  onBatchCopy,
  onBatchMove,
  onBatchDelete,
  // Filter props (multi-select)
  fileTypeFilters = new Set(),
  setFileTypeFilters,
  mxhFilters = new Set(),
  setMxhFilters,
}) => {
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef(null);

  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef(null);

  const isFilterActive = fileTypeFilters.size > 0 || mxhFilters.size > 0;

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
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setMoreMenuOpen(false);
      }
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target)) {
        setFilterMenuOpen(false);
      }
    };
    if (moreMenuOpen || filterMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [moreMenuOpen, filterMenuOpen]);

  const radius = 17;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (downloadProgressPercent / 100) * circumference;

  // Màu ring và icon download theo từng stage
  const ringColorClass = activeDownloadCount > 0
    ? hasPasswordError
      ? 'text-amber-500'
      : isConverting
        ? 'text-purple-500'
        : isScanning
          ? 'text-emerald-500'
          : isDownloadingMode
            ? 'text-blue-500'
            : 'text-orange-500'
    : 'text-[#383c42]';

  const iconColorClass = activeDownloadCount > 0
    ? hasPasswordError
      ? 'text-amber-400'
      : isConverting
        ? 'text-purple-400'
        : isScanning
          ? 'text-emerald-400'
          : isDownloadingMode
            ? 'text-blue-400'
            : 'text-orange-400'
    : 'text-gray-300 group-hover:text-white';

  // Chỉ spin khi đang giải nén / scanning / converting
  const shouldSpin = !isDownloadingMode && activeDownloadCount > 0;

  return (
    <header className="tahoe-block sticky top-0 z-40 p-4 sm:p-5 px-4 sm:px-8 shadow-md !overflow-visible" style={{ overflow: 'visible' }}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 sm:gap-6 min-h-[40px]">

        {isSelectMode ? (
          /* ================= SELECT MODE HEADER ================= */
          <div className="flex-1 flex items-center justify-between gap-3 animate-fade-in">
            {/* Left: Button X to exit select mode + Count of selected items */}
            <div className="flex items-center gap-3.5">
              <button
                type="button"
                onClick={onExitSelectMode}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[#383c42] bg-[#28292d] text-gray-300 hover:text-white hover:border-red-500/60 hover:bg-red-500/10 transition-all duration-200 active:scale-95 shadow-sm"
                title="Thoát chế độ chọn"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Đã chọn <span className="text-blue-400 font-mono text-base sm:text-lg"><RollingNumber value={selectedCount} /></span> mục
                </span>
              </div>
            </div>

            {/* Right: 3-dots Menu Button */}
            <div className="relative z-50" ref={moreMenuRef}>
              <button
                type="button"
                onClick={() => setMoreMenuOpen((prev) => !prev)}
                title="Tùy chọn thao tác"
                className={`flex h-10 w-10 items-center justify-center rounded-full border border-[#383c42] bg-[#28292d] text-gray-300 hover:text-white hover:border-[#8ab4f8] transition-all duration-200 active:scale-95 shadow-sm ${
                  moreMenuOpen ? 'border-blue-500 text-white bg-[#383c42]' : ''
                }`}
              >
                <MoreVertical className="h-5 w-5" />
              </button>

              {moreMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-[#1c1d21] border border-[#383c42] rounded-[18px] p-1.5 shadow-2xl space-y-1 z-[99999] animate-pop-fast text-xs font-semibold select-none">
                  <button
                    type="button"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      if (onBatchCopy) onBatchCopy();
                    }}
                    disabled={selectedCount === 0}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-gray-200 hover:text-white hover:bg-white/10 disabled:opacity-35 disabled:hover:bg-transparent rounded-[12px] transition-colors"
                  >
                    <Copy className="w-4 h-4 text-blue-400" />
                    <span>Sao chép</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      if (onBatchMove) onBatchMove();
                    }}
                    disabled={selectedCount === 0}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-gray-200 hover:text-white hover:bg-amber-500/20 disabled:opacity-35 disabled:hover:bg-transparent rounded-[12px] transition-colors"
                  >
                    <FolderInput className="w-4 h-4 text-amber-400" />
                    <span>Di chuyển</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      if (onBatchDelete) onBatchDelete();
                    }}
                    disabled={selectedCount === 0}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 disabled:opacity-35 disabled:hover:bg-transparent rounded-[12px] transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                    <span>Xóa</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ================= NORMAL MODE HEADER ================= */
          <>
            {/* Brand Logo (Mobile only) */}
            <div className="flex md:hidden items-center gap-2.5 flex-shrink-0">
              <div className="w-9 h-9 rounded-[24px] bg-gradient-to-br from-blue-500 via-green-500 to-yellow-500 p-0.5 flex items-center justify-center shadow-md">
                <div className="w-full h-full bg-[#1c1d21] rounded-[22px] flex items-center justify-center">
                  <ImageIcon className="w-4.5 h-4.5 text-blue-400" />
                </div>
              </div>
              <span className="font-extrabold text-xl text-white tracking-tight">AppView</span>
            </div>

            {/* Search Bar */}
            <div className="hidden sm:block flex-1 max-w-2xl">
              <div className="google-search-bar relative flex items-center px-4 sm:px-5 py-2 sm:py-2.5 text-sm shadow-sm">
                <Search className="w-4 h-4 text-gray-400 mr-3 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Tìm kiếm ảnh và thư mục..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-white placeholder-gray-400 focus:outline-none text-xs sm:text-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="p-1 text-gray-400 hover:text-white rounded-full hover:bg-white/10 ml-2"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Action Controls */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">

              {/* Filter Button & Dropdown Popover */}
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
                          const isSelected = fileTypeFilters.has(opt.key);
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
                          const isSelected = mxhFilters.has(opt.key);
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

              {/* Header Download Button with Progress Ring */}
              <button
                onClick={onOpenDownloadPanel}
                title="Quản lý Download"
                className={`group relative flex h-10 w-10 items-center justify-center rounded-full border border-[#383c42] bg-[#28292d] transition-colors duration-200 active:scale-95 ${activeDownloadCount === 0 ? 'download-header-idle' : ''}`}
              >
                {activeDownloadCount > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <svg
                      viewBox="0 0 40 40"
                      className={`w-10 h-10 ${shouldSpin ? 'google-spinner-svg' : '-rotate-90'}`}
                    >
                      <circle
                        cx="20"
                        cy="20"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="2.5"
                        fill="transparent"
                        className="text-[#383c42]"
                      />
                      <circle
                        cx="20"
                        cy="20"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="2.5"
                        fill="transparent"
                        strokeDasharray={isDownloadingMode ? circumference : undefined}
                        strokeDashoffset={isDownloadingMode ? strokeDashoffset : undefined}
                        strokeLinecap="round"
                        className={`transition-all duration-300 ${ringColorClass} ${shouldSpin ? 'google-spinner-circle' : ''}`}
                      />
                    </svg>
                  </div>
                )}

                {/* Download SVG icon — đồng bộ với Mobile */}
                <svg
                  viewBox="0 0 24 24"
                  className={`relative z-10 h-5 w-5 overflow-visible transition-colors ${iconColorClass}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {/* Mũi tên chuyển động độc lập khi đang tải; khay chữ U đứng yên */}
                  <g className={activeDownloadCount > 0 && isDownloadingMode ? 'download-header-arrow' : ''}>
                    <path d="M12 3v10" />
                    <path d="m8.5 9.5 3.5 3.5 3.5-3.5" />
                  </g>
                  <path d="M4 15.5v3A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-3" />
                </svg>

                {/* Badge cảnh báo khi có tác vụ cần người dùng xử lý. */}
                {hasPasswordError && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-amber-400 text-[7px] font-black text-[#1c1d21] leading-none" />
                )}
              </button>

              {/* Header Select Button (sau nút download) */}
              <button
                type="button"
                onClick={onEnterSelectMode}
                title="Chọn nhiều mục"
                className="group flex h-10 w-10 items-center justify-center rounded-full border border-[#383c42] bg-[#28292d] text-gray-300 hover:text-white hover:border-[#8ab4f8]/60 transition-colors duration-200 active:scale-95 shadow-sm"
              >
                <CheckCircle2 className="h-5 w-5 text-gray-300 group-hover:text-white transition-colors" />
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
};
