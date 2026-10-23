import { useState } from 'react';
import './SidebarLayout.css';
import useLayout from '../../../hooks/useLayout';
import SidebarBrand from './SidebarBrand';
import SidebarTree from './SidebarTree';
import SidebarDrives from './SidebarDrives';

function SidebarLayout() {
  const [activeDriveId, setActiveDriveId] = useState('drive-1');
  const {
    isSidebarOpen,
    isMobile,
    closeSidebar,
    sidebarWidth,
    isResizing,
    startResizing,
    resetSidebarWidth,
  } = useLayout();

  const sidebarStyle = isMobile
    ? undefined
    : {
        width: `${sidebarWidth}%`,
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
        <SidebarTree activeDriveId={activeDriveId} />

        {/* Khối ổ cứng ở đáy Sidebar */}
        <SidebarDrives activeDriveId={activeDriveId} onSelectDrive={setActiveDriveId} />

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
