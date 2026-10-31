import { useLocation, useParams } from 'react-router-dom';
import useLayout from '../../../../hooks/useLayout';
import NavPill from './NavPill';
import MenuIcon from '../../../../assets/icons/MenuIcon';

function HeaderLeft() {
  const { toggleSidebar, isMobile, isHeaderTitleVisible } = useLayout();
  const location = useLocation();
  const { driveId } = useParams();
  const isSettings = location.pathname === '/settings';

  // Xác định tiêu đề hiển thị bên cạnh nút < >:
  // - Khi ở Settings: hiển thị "Settings"
  // - Khi ở ổ đĩa / thư mục: nếu có path con thì chỉ lấy tên thư mục con cuối cùng, ngược lại lấy tên ổ đĩa
  let displayTitle = driveId || 'SSD';
  if (!isSettings) {
    const queryParams = new URLSearchParams(location.search);
    const currentPath = queryParams.get('path');
    if (currentPath && currentPath.trim() !== '') {
      const segments = currentPath.trim().split('/').filter(Boolean);
      if (segments.length > 0) {
        displayTitle = segments[segments.length - 1];
      }
    }
  }

  return (
    <div className="header-left-zone">
      {isMobile && (
        <button
          type="button"
          onClick={toggleSidebar}
          className="p-1.5 -ml-1 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Mở thanh điều hướng"
        >
          <MenuIcon className="w-5 h-5" />
        </button>
      )}

      {/* Viên thuốc điều hướng lùi / tiến */}
      <NavPill />

      {/* Tiêu đề ổ đĩa / thư mục con bên cạnh nút < > */}
      {isSettings ? (
        <span
          className={`header-left-title ${isHeaderTitleVisible ? 'header-left-title--visible' : ''}`}
        >
          Settings
        </span>
      ) : (
        <span
          className="header-left-title header-left-title--drive"
          title={displayTitle}
        >
          {displayTitle}
        </span>
      )}
    </div>
  );
}

export default HeaderLeft;
