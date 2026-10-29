import { useState, useCallback, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './SidebarLayout.css';
import useLayout from '../../../hooks/useLayout';
import useStorageDrives, { getPreferredActiveDriveId } from '../../../hooks/useStorageDrives';
import Loading from '../../common/Loading/Loading';
import SidebarBrand from './SidebarBrand';
import SidebarTree from './SidebarTree';
import SidebarDrives from './SidebarDrives';

function SidebarLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { drives } = useStorageDrives();

  // Phân tích driveId từ URL /drives/:driveId nếu có
  const driveMatch = location.pathname.match(/^\/drives\/([^/]+)/);
  const routeDriveId = driveMatch ? decodeURIComponent(driveMatch[1]) : null;
  const isSettings = location.pathname === '/settings';

  const preferredDriveId = getPreferredActiveDriveId(drives) || 'SSD';
  const currentRouteDriveId = routeDriveId || preferredDriveId;

  const [pendingDriveId, setPendingDriveId] = useState(null);
  const [previousRouteDriveId, setPreviousRouteDriveId] = useState(currentRouteDriveId);
  const [isTreeLoading, setIsTreeLoading] = useState(false);
  const driveTimeoutRef = useRef(null);

  // Ổ đĩa active hiển thị viền xanh: ưu tiên pendingDriveId (khi đang chuyển đổi) hoặc currentRouteDriveId
  const activeDriveId = pendingDriveId || currentRouteDriveId;
  // Cây thư mục hiển thị: giữ cây cũ trong lúc 400ms loading overlay, sau đó cập nhật theo route mới
  const treeDriveId = isTreeLoading ? previousRouteDriveId : currentRouteDriveId;

  const {
    isSidebarOpen,
    isMobile,
    closeSidebar,
    sidebarWidth,
    isResizing,
    startResizing,
    resetSidebarWidth,
    showContentLoading,
    hideContentLoading,
    hasServerConnection,
  } = useLayout();

  // Dọn dẹp timer khi component unmount
  useEffect(() => {
    return () => {
      if (driveTimeoutRef.current) {
        clearTimeout(driveTimeoutRef.current);
      }
    };
  }, []);

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
        navigate(`/drives/${preferredId}`, { replace: true });
      }
      return;
    }

    // Nếu đang ở trang chủ / hoặc /contents: tự động điều hướng sang URL /drives/:preferredId
    if (location.pathname === '/' || location.pathname === '/contents') {
      navigate(`/drives/${preferredId}`, { replace: true });
    }
  }, [hasServerConnection, drives, routeDriveId, isSettings, location.pathname, navigate]);

  // Xử lý chuyển đổi ổ đĩa với hiệu ứng mượt 400ms và cập nhật URL
  const handleSelectDrive = useCallback((newDriveId) => {
    // Nếu click vào ổ đang mở: không làm gì
    if (newDriveId === activeDriveId && location.pathname === `/drives/${newDriveId}`) return;

    // 1. Nhảy viền xanh active ngay lập tức trên nút ổ đĩa
    setPendingDriveId(newDriveId);
    setPreviousRouteDriveId(currentRouteDriveId);

    // 2. Bật loading overlay phủ lên SidebarTree và main-content
    setIsTreeLoading(true);
    showContentLoading();

    if (driveTimeoutRef.current) {
      clearTimeout(driveTimeoutRef.current);
    }

    driveTimeoutRef.current = setTimeout(() => {
      // 3. Sau 400ms: cập nhật dữ liệu cây thư mục sang ổ mới, tắt overlay và chuyển route URL
      setPendingDriveId(null);
      setIsTreeLoading(false);
      hideContentLoading();
      navigate(`/drives/${newDriveId}`);
    }, 400);
  }, [activeDriveId, location.pathname, currentRouteDriveId, navigate, showContentLoading, hideContentLoading]);

  const sidebarStyle = isMobile
    ? undefined
    : {
        width: `var(--sidebar-width, ${sidebarWidth}%)`,
        minWidth: '15%',
        maxWidth: '60%',
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
        }`}
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
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
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
            <SidebarTree activeDriveId={treeDriveId} isLoading={isTreeLoading} />

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
