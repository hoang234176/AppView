import { useState, useCallback, useRef, useEffect } from 'react';
import './SidebarLayout.css';
import useLayout from '../../../hooks/useLayout';
import SidebarBrand from './SidebarBrand';
import SidebarTree from './SidebarTree';
import SidebarDrives from './SidebarDrives';

function SidebarLayout() {
  const [activeDriveId, setActiveDriveId] = useState('drive-1');
  const [treeDriveId, setTreeDriveId] = useState('drive-1');
  const [isTreeLoading, setIsTreeLoading] = useState(false);
  const driveTimeoutRef = useRef(null);

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
  } = useLayout();

  // Dọn dẹp timer khi component unmount
  useEffect(() => {
    return () => {
      if (driveTimeoutRef.current) {
        clearTimeout(driveTimeoutRef.current);
      }
    };
  }, []);

  // Xử lý chuyển đổi ổ đĩa thuần UI (tối thiểu 400ms)
  const handleSelectDrive = useCallback((newDriveId) => {
    // Nếu click vào ổ đang mở: không làm gì
    if (newDriveId === activeDriveId) return;

    // 1. Nhảy viền xanh active ngay lập tức trên nút ổ đĩa
    setActiveDriveId(newDriveId);

    // 2. Bật loading overlay phủ lên SidebarTree và main-content
    setIsTreeLoading(true);
    showContentLoading();

    if (driveTimeoutRef.current) {
      clearTimeout(driveTimeoutRef.current);
    }

    driveTimeoutRef.current = setTimeout(() => {
      // 3. Sau 400ms: cập nhật dữ liệu cây thư mục sang ổ mới và tắt overlay
      setTreeDriveId(newDriveId);
      setIsTreeLoading(false);
      hideContentLoading();
    }, 400);
  }, [activeDriveId, showContentLoading, hideContentLoading]);

  const sidebarStyle = isMobile
    ? undefined
    : {
        width: `var(--sidebar-width, ${sidebarWidth}%)`,
        minWidth: '10%',
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

        {/* Khối cây thư mục phân cấp */}
        <SidebarTree activeDriveId={treeDriveId} isLoading={isTreeLoading} />

        {/* Khối ổ cứng ở đáy Sidebar */}
        <SidebarDrives activeDriveId={activeDriveId} onSelectDrive={handleSelectDrive} />

        {/* Resizer Handle (Desktop only) */}
        {!isMobile && (
          <div
            className={`sidebar-resizer ${isResizing ? 'sidebar-resizer--active' : ''}`}
            onMouseDown={startResizing}
            onDoubleClick={resetSidebarWidth}
            title="Kéo để chỉnh độ rộng (nhấp đúp để đặt lại 22%)"
            role="separator"
            aria-orientation="vertical"
          />
        )}
      </aside>
    </>
  );
}

export default SidebarLayout;
