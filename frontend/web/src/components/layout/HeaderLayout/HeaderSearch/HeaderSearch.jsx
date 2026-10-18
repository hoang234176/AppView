import { memo } from 'react';
import { Search, X, Image as ImageIcon } from 'lucide-react';
import { useHeaderSearch } from '../../../../hooks/header';
import './HeaderSearch.css';

/**
 * HeaderSearch — Search bar with clear button and mobile brand logo
 */
export const HeaderSearch = memo(({
  searchQuery: propSearchQuery,
  setSearchQuery: propSetSearchQuery,
}) => {
  const hookData = useHeaderSearch();
  const searchQuery = propSearchQuery !== undefined ? propSearchQuery : hookData.searchQuery;
  const setSearchQuery = propSetSearchQuery || hookData.setSearchQuery;

  return (
    <>
      {/* Brand Logo (Mobile only) */}
      <div className="header-mobile-brand">
        <div className="w-9 h-9 rounded-[24px] bg-gradient-to-br from-blue-500 via-green-500 to-yellow-500 p-0.5 flex items-center justify-center shadow-md">
          <div className="w-full h-full bg-[#1c1d21] rounded-[22px] flex items-center justify-center">
            <ImageIcon className="w-4.5 h-4.5 text-blue-400" />
          </div>
        </div>
        <span className="font-extrabold text-xl text-white tracking-tight">AppView</span>
      </div>

      {/* Desktop & Tablet Search Bar */}
      <div className="header-search-container">
        <div className="google-search-bar relative flex items-center px-4 sm:px-5 py-2 sm:py-2.5 text-sm shadow-sm">
          <Search className="w-4 h-4 text-gray-400 mr-3 flex-shrink-0" />
          <input
            type="text"
            placeholder="Tìm kiếm ảnh và thư mục..."
            value={searchQuery}
            onChange={(e) => setSearchQuery && setSearchQuery(e.target.value)}
            className="header-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery && setSearchQuery('')}
              className="header-search-clear-btn"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </>
  );
});

HeaderSearch.displayName = 'HeaderSearch';
