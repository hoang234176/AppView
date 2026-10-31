import { useState, useCallback, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './SidebarLayout.css';
import useLayout from '../../../hooks/useLayout';
import useStorageDrives, { getPreferredActiveDriveId } from '../../../hooks/useStorageDrives';
import { getFolderTreeApi, getFolderContentsApi } from '../../../api/apiCoordinator';
import { resolveCoordinatorHostPort } from '../../../utils/cookieUtils';
import { setFolderTreeCache } from '../../../hooks/useFolderTree';
import { setFolderContentsCache } from '../../../hooks/useFolderContents';
import Loading from '../../common/Loading/Loading';
import SidebarBrand from './SidebarBrand';
import SidebarTree from './SidebarTree';
import SidebarDrives from './SidebarDrives';

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

  const [pendingDriveId, setPendingDriveId] = useState(null);
  const [previousRouteDriveId, setPreviousRouteDriveId] = useState(currentRouteDriveId);
  const [prevRouteDriveId, setPrevRouteDriveId] = useState(routeDriveId);
  if (routeDriveId !== prevRouteDriveId) {
    setPrevRouteDriveId(routeDriveId);
    if (pendingDriveId) {
      setPendingDriveId(null);
    }
  }
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
    isResetting,
    startResizing,
    resetSidebarWidth,
    showContentLoading,
    hideContentLoading,
    hasServerConnection,
    serverConfig,
    triggerNotification,
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
        navigate(`/${preferredId}`, { replace: true });
      }
      return;
    }

    // Nếu đang ở trang chủ / hoặc /contents: tự động điều hướng sang URL /:preferredId
    if (location.pathname === '/' || location.pathname === '/contents') {
      navigate(`/${preferredId}`, { replace: true });
    }
  }, [hasServerConnection, drives, routeDriveId, isSettings, location.pathname, navigate]);

  // Xử lý chuyển đổi ổ đĩa: tải đồng thời Cây thư mục và Danh sách nội dung, chỉ tắt loading trong finally
  const handleSelectDrive = useCallback(async (newDriveId) => {
    // Trường hợp 1: Click vào chính ổ đĩa đang chọn
    if (newDriveId === activeDriveId) {
      // 1A. Nếu đã ở thư mục gốc (không có query path): bỏ qua, không gọi request
      if (location.pathname === `/${newDriveId}` && !location.search) {
        return;
      }
      // 1B. Nếu đang ở thư mục con: điều hướng ngay về thư mục gốc của ổ mà không cần loading cây thư mục
      navigate(`/${newDriveId}`);
      return;
    }

    // Trường hợp 2: Chuyển sang ổ đĩa khác
    // 1. Nhảy viền xanh active ngay lập tức trên nút ổ đĩa mới
    setPendingDriveId(newDriveId);
    setPreviousRouteDriveId(currentRouteDriveId);

    // 2. Bật loading overlay đồng thời phủ lên SidebarTree và main-content
    setIsTreeLoading(true);
    showContentLoading();

    const { host, port } = resolveCoordinatorHostPort(serverConfig);

    try {
      if (hasServerConnection && host && port) {
        // 3. Tải SONG SONG đồng thời Cây thư mục và Danh sách thư mục gốc
        const [treeRes, contentsRes] = await Promise.all([
          getFolderTreeApi(host, port, newDriveId),
          getFolderContentsApi(host, port, { drive: newDriveId, path: '' }),
        ]);

        if (treeRes.ok && Array.isArray(treeRes.data)) {
          setFolderTreeCache(newDriveId, treeRes.data);
        }
        if (contentsRes.ok && contentsRes.data) {
          setFolderContentsCache(`${newDriveId}:`, contentsRes.data);
        }
      }

      // 4. Chuyển URL route sang ổ mới
      navigate(`/${newDriveId}`);
    } catch (err) {
      console.error('Error switching drive:', err);
      triggerNotification?.({
        type: 'error',
        title: 'Drive Error',
        message: err.message || `Không thể tải dữ liệu cho ổ ${newDriveId}`,
      });
      navigate(`/${newDriveId}`);
    } finally {
      // 5. FINAL: Sau khi CẢ 2 tác vụ đều đã xử lý xong, mới tắt loading đồng thời!
      setIsTreeLoading(false);
      hideContentLoading();
      setPendingDriveId(null);
    }
  }, [activeDriveId, location.pathname, location.search, currentRouteDriveId, navigate, showContentLoading, hideContentLoading, hasServerConnection, serverConfig, triggerNotification]);

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
