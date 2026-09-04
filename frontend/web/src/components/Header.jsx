import React from 'react';
import {
  Search, 
  X, 
  Image as ImageIcon,
  Menu,
} from 'lucide-react';

export const Header = ({ 
  searchQuery, 
  setSearchQuery, 
  onOpenMobileTree,
  onOpenDownloadPanel,
  activeDownloadCount = 0,
  downloadProgressPercent = 0,
  isDownloadingMode = true,
  hasPasswordError = false,
  isScanning = false,
  isConverting = false,
}) => {
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
    <header className="tahoe-block sticky top-0 z-30 p-4 sm:p-5 px-4 sm:px-8 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 sm:gap-6">
        
        {/* Mobile Hamburger & Brand Logo */}
        <div className="flex md:hidden items-center gap-2 flex-shrink-0">
          <button
            onClick={onOpenMobileTree}
            className="p-2 rounded-full bg-[#28292d] hover:bg-[#383c42] text-gray-300 hover:text-white transition-colors border border-[#383c42]"
            title="Mở danh mục thư mục"
          >
            <Menu className="w-5 h-5 text-blue-400" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[24px] bg-gradient-to-br from-blue-500 via-green-500 to-yellow-500 p-0.5 flex items-center justify-center shadow-md">
              <div className="w-full h-full bg-[#1c1d21] rounded-[22px] flex items-center justify-center">
                <ImageIcon className="w-4.5 h-4.5 text-blue-400" />
              </div>
            </div>
            <span className="font-extrabold text-xl text-white tracking-tight">AppView</span>
          </div>
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
        </div>
      </div>
    </header>
  );
};
