import { memo } from 'react';
import { HeaderSearch } from './HeaderSearch/HeaderSearch';
import { HeaderFilter } from './HeaderFilter/HeaderFilter';
import { HeaderDownload } from './HeaderDownload/HeaderDownload';
import { HeaderSelectBar, HeaderSelectButton } from './HeaderSelectMode/HeaderSelectMode';
import './Header.css';

/**
 * Header — Top application header assembling search, filter, download indicator, and batch actions
 */
export const Header = memo(({
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
  return (
    <header className="tahoe-block header-container sticky top-0 z-40 p-4 sm:p-5 px-4 sm:px-8 shadow-md !overflow-visible" style={{ overflow: 'visible' }}>
      <div className="header-inner max-w-7xl mx-auto flex items-center justify-between gap-3 sm:gap-6 min-h-[40px]">
        {isSelectMode ? (
          /* ================= SELECT MODE HEADER ================= */
          <HeaderSelectBar
            onExitSelectMode={onExitSelectMode}
            selectedCount={selectedCount}
            onBatchCopy={onBatchCopy}
            onBatchMove={onBatchMove}
            onBatchDelete={onBatchDelete}
          />
        ) : (
          /* ================= NORMAL MODE HEADER ================= */
          <>
            {/* Search Bar & Mobile Brand */}
            <HeaderSearch
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
            />

            {/* Action Controls */}
            <div className="header-actions-group flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {/* Filter Button & Dropdown Popover */}
              <HeaderFilter
                fileTypeFilters={fileTypeFilters}
                setFileTypeFilters={setFileTypeFilters}
                mxhFilters={mxhFilters}
                setMxhFilters={setMxhFilters}
              />

              {/* Header Download Button with Progress Ring */}
              <HeaderDownload
                onOpenDownloadPanel={onOpenDownloadPanel}
                activeDownloadCount={activeDownloadCount}
                downloadProgressPercent={downloadProgressPercent}
                isDownloadingMode={isDownloadingMode}
                hasPasswordError={hasPasswordError}
                isScanning={isScanning}
                isConverting={isConverting}
              />

              {/* Header Select Button (sau nút download) */}
              <HeaderSelectButton
                onEnterSelectMode={onEnterSelectMode}
              />
            </div>
          </>
        )}
      </div>
    </header>
  );
});

Header.displayName = 'Header';
