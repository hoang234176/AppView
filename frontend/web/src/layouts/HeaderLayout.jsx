import { memo } from 'react';
import {
  HeaderSearch,
  HeaderFilter,
  HeaderDownload,
  HeaderSelectBar,
  HeaderSelectButton,
} from '../components/layout/HeaderLayout';
import { useHeaderSelectMode } from '../hooks/header';
import './HeaderLayout.css';

/**
 * HeaderLayout — Area 2: Top Header Bar
 * Houses search input, filter options, active download counters, and select mode controls.
 */
export const HeaderLayout = memo(() => {
  const { isSelectMode } = useHeaderSelectMode();

  return (
    <header className="tahoe-block header-container">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 sm:gap-6 min-h-[40px]">
        {isSelectMode ? (
          /* ================= SELECT MODE HEADER ================= */
          <HeaderSelectBar />
        ) : (
          /* ================= NORMAL MODE HEADER ================= */
          <>
            {/* Search Bar & Mobile Brand */}
            <HeaderSearch />

            {/* Action Controls */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {/* Filter Button & Dropdown Popover */}
              <HeaderFilter />

              {/* Header Download Button with Progress Ring */}
              <HeaderDownload />

              {/* Header Select Button (sau nút download) */}
              <HeaderSelectButton />
            </div>
          </>
        )}
      </div>
    </header>
  );
});

HeaderLayout.displayName = 'HeaderLayout';
