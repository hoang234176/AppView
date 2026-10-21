import { useState, useRef } from 'react';
import './SearchPill.css';
import SearchIcon from '../../../../assets/icons/SearchIcon';

function SearchPill() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef(null);

  const handleOpenSearch = () => {
    if (!isSearchOpen) {
      setIsSearchOpen(true);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  };

  const handleBlurSearch = (e) => {
    if (!e.target.value) {
      setIsSearchOpen(false);
    }
  };

  const handleKeyDownSearch = (e) => {
    if (e.key === 'Escape') {
      setIsSearchOpen(false);
    }
  };

  return (
    <div
      className={`header-search-pill ${isSearchOpen ? 'header-search-pill--open' : ''}`}
      onClick={handleOpenSearch}
      role="search"
    >
      <SearchIcon className="header-search-icon" />
      <input
        ref={searchInputRef}
        type="text"
        className="header-search-input"
        placeholder="Search"
        onBlur={handleBlurSearch}
        onKeyDown={handleKeyDownSearch}
        tabIndex={isSearchOpen ? 0 : -1}
        aria-label="Tìm kiếm"
      />
    </div>
  );
}

export default SearchPill;
