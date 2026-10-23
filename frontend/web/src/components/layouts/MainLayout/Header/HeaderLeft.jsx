import { useLocation } from 'react-router-dom';
import useLayout from '../../../../hooks/useLayout';
import NavPill from './NavPill';

function HeaderLeft() {
  const { toggleSidebar, isMobile, isHeaderTitleVisible } = useLayout();
  const location = useLocation();
  const isSettings = location.pathname === '/settings';

  return (
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

      {/* Tiêu đề trang trượt mờ sau nút < > (dành cho Settings) */}
      {isSettings && (
        <span
          className={`header-left-title ${isHeaderTitleVisible ? 'header-left-title--visible' : ''}`}
        >
          Settings
        </span>
      )}
    </div>
  );
}

export default HeaderLeft;
