import './SearchPill.css';
import SearchIcon from '../../../../assets/icons/SearchIcon';
import useSearchPill from '../../../../hooks/useSearchPill';

function SearchPill() {
  const {
    isSearchOpen,
    inputValue,
    searchInputRef,
    handleOpenSearch,
    handleInputChange,
    handleBlurSearch,
    handleKeyDownSearch,
  } = useSearchPill();

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
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleBlurSearch}
        onKeyDown={handleKeyDownSearch}
        tabIndex={isSearchOpen ? 0 : -1}
        aria-label="Tìm kiếm trong thư mục hiện tại"
      />
    </div>
  );
}

export default SearchPill;
