import './Header.css';
import useLayout from '../../../../hooks/useLayout';
import NavPill from './NavPill';
import FilterButton from './FilterButton';
import MoreButton from './MoreButton';
import DownloadButton from './DownloadButton';
import SearchPill from './SearchPill';

function Header() {
  const { toggleSidebar, isMobile } = useLayout();

  return (
    <header className="main-header">
      {/* Khu vực bên trái (tối đa 40% chiều rộng): nút mobile + viên thuốc điều hướng + tên folder sau này */}
      <div className="header-left-zone">
        {isMobile && (
          <button
            type="button"
            onClick={toggleSidebar}
            className="p-1.5 -ml-1 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Mở thanh điều hướng"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        {/* Viên thuốc điều hướng lùi / tiến */}
        <NavPill />
      </div>

      {/* Khu vực bên phải (tối đa 60% chiều rộng, dồn về sát phải): các nút hành động */}
      <div className="header-right-zone">
        <FilterButton />
        <MoreButton />
        <DownloadButton />
        <SearchPill />
      </div>
    </header>
  );
}

export default Header;
