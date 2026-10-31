import { useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './SidebarLayout.css';
import useLayout from '../../../hooks/useLayout';
import useStorageDrives, { getPreferredActiveDriveId } from '../../../hooks/useStorageDrives';
import Loading from '../../common/Loading/Loading';
import SidebarBrand from './SidebarBrand';
import SidebarTree from './SidebarTree';
import SidebarDrives from './SidebarDrives';
import XCloseIcon from '../../../assets/icons/XCloseIcon';

function SidebarLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { drives } = useStorageDrives();

  // Phân tích driveId từ URL /:driveId hoặc /drives/:driveId nếu có
  const pathParts = location.pathname.split('/').filter(Boolean);
  let routeDriveId = null;
  if (pathParts.length > 0 && pathParts[0] !== 'settings') {
    if (pathParts[0] === 'drives' && pathParts.length > 1) {
      routeDriveId = decodeURIComponent(pathParts[1]);
    } else {
      routeDriveId = decodeURIComponent(pathParts[0]);
    }
  }
  const isSettings = location.pathname === '/settings';

  const preferredDriveId = getPreferredActiveDriveId(drives) || 'SSD';
  const currentRouteDriveId = routeDriveId || preferredDriveId;

  // Ổ đĩa active và Cây thư mục hiển thị: đồng bộ trực tiếp theo currentRouteDriveId
  const activeDriveId = currentRouteDriveId;
  const treeDriveId = activeDriveId;

  const {
    isSidebarOpen,
    isMobile,
    closeSidebar,
    sidebarWidth,
    isResizing,
    isResetting,
    startResizing,
    resetSidebarWidth,
    hasServerConnection,
    isSyncLoading,
    syncActiveDrive,
    startSyncBarrier,
  } = useLayout();

  // Kích hoạt Barrier đồng bộ khi mới vào trang hoặc khi activeDrive thay đổi
  useEffect(() => {
    if (!hasServerConnection || !activeDriveId) return;
    if (syncActiveDrive !== activeDriveId) {
      startSyncBarrier(activeDriveId);
    }
  }, [hasServerConnection, activeDriveId, syncActiveDrive, startSyncBarrier]);

  // Đồng bộ giữa URL Route /drives/:driveId và danh sách ổ đĩa
  // Ưu tiên HDD trước (nếu mount). Nếu HDD không mount thì chọn SSD. Tuyệt đối không chọn ổ offline.
  useEffect(() => {
    if (!hasServerConnection || !Array.isArray(drives) || drives.length === 0) return;
    if (isSettings) return;

    const preferredId = getPreferredActiveDriveId(drives);
    if (!preferredId) return;

    // Nếu URL đang là /drives/:driveId: kiểm tra tính hợp lệ và trạng thái mount của ổ
    if (routeDriveId) {
      const matchedDrive = drives.find(
        (d) =>
          d.id?.toUpperCase() === routeDriveId.toUpperCase() ||
          d.displayName?.toUpperCase() === routeDriveId.toUpperCase()
      );
      const isMatchedAvailable =
        matchedDrive &&
        matchedDrive.available !== false &&
        (matchedDrive.totalBytes > 0 || matchedDrive.usedPercent > 0);

      if (!isMatchedAvailable) {
        // Nếu ổ trong URL không tồn tại hoặc đang offline: redirect về ổ khả dụng ưu tiên
        navigate(`/${preferredId}`, { replace: true });
      }
      return;
    }

    // Nếu đang ở trang chủ / hoặc /contents: tự động điều hướng sang URL /:preferredId
    if (location.pathname === '/' || location.pathname === '/contents') {
      navigate(`/${preferredId}`, { replace: true });
    }
  }, [hasServerConnection, drives, routeDriveId, isSettings, location.pathname, navigate]);

  // Xử lý chuyển đổi ổ đĩa: điều hướng trực tiếp sang route mới (tuyệt đối không lưu cache / preload)
  const handleSelectDrive = useCallback((newDriveId) => {
    // Khóa click dồn dập khi đang đồng bộ
    if (isSyncLoading) return;

    // Trường hợp 1: Click vào chính ổ đĩa đang chọn
    if (newDriveId === activeDriveId) {
      // 1A. Nếu đã ở thư mục gốc (không có query path): bỏ qua, không gọi request
      if (location.pathname === `/${newDriveId}` && !location.search) {
        return;
      }
      // 1B. Nếu đang ở thư mục con: điều hướng ngay về thư mục gốc của ổ
      navigate(`/${newDriveId}`);
      return;
    }

    // Trường hợp 2: Chuyển sang ổ đĩa khác
    startSyncBarrier(newDriveId);
    navigate(`/${newDriveId}`);
  }, [isSyncLoading, activeDriveId, location.pathname, location.search, navigate, startSyncBarrier]);

  const sidebarStyle = isMobile
    ? undefined
    : {
        width: `var(--sidebar-width, ${sidebarWidth}%)`,
        minWidth: '15%',
        maxWidth: '40%',
      };

  return (
    <>
      {isMobile && isSidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      <aside
        className={`sidebar-layout ${isMobile && isSidebarOpen ? 'sidebar-layout--open' : ''} ${
          isResizing ? 'sidebar-layout--resizing' : ''
        } ${isResetting ? 'sidebar-layout--animating' : ''}`}
        style={sidebarStyle}
      >
        <div className="sidebar-header">
          <SidebarBrand />
          {isMobile && (
            <button
              type="button"
              onClick={closeSidebar}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0"
              aria-label="Đóng thanh điều hướng"
            >
              <XCloseIcon className="w-5 h-5" />
            </button>
          )}
        </div>

        {!hasServerConnection ? (
          /* Khi chưa có cấu hình server: ẩn toàn bộ cây thư mục và ổ cứng, thay bằng component Loading trực tiếp */
          <div className="sidebar-loading-container">
            <Loading text="" size="md" />
          </div>
        ) : (
          <>
            {/* Khối cây thư mục phân cấp */}
            <SidebarTree activeDriveId={treeDriveId} />

            {/* Khối ổ cứng ở đáy Sidebar */}
            <SidebarDrives activeDriveId={activeDriveId} onSelectDrive={handleSelectDrive} />
          </>
        )}

        {/* Resizer Handle (Desktop only) */}
        {!isMobile && (
          <div
            className={`sidebar-resizer ${isResizing ? 'sidebar-resizer--active' : ''}`}
            onMouseDown={startResizing}
            onDoubleClick={resetSidebarWidth}
            title="Kéo để chỉnh độ rộng (nhấp đúp để đặt lại 25%)"
            role="separator"
            aria-orientation="vertical"
          />
        )}
      </aside>
    </>
  );
}

export default SidebarLayout;
