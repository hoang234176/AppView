import { memo } from 'react';
import './HeaderDownload.css';

/**
 * HeaderDownload — Circular SVG progress ring button with falling arrow and status badge
 */
export const HeaderDownload = memo(({
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
    <button
      type="button"
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
        <span className="download-header-badge" />
      )}
    </button>
  );
});

HeaderDownload.displayName = 'HeaderDownload';
