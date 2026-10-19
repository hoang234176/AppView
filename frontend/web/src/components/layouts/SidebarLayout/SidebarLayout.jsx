import './SidebarLayout.css';
import useLayout from '../../../hooks/useLayout';

function SidebarLayout() {
  const { isSidebarOpen, isMobile, closeSidebar } = useLayout();

  return (
    <>
      {isMobile && isSidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar-layout ${isMobile && isSidebarOpen ? 'sidebar-layout--open' : ''}`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 md:border-b-0">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Sidebar</span>
          {isMobile && (
            <button
              type="button"
              onClick={closeSidebar}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Đóng thanh điều hướng"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

export default SidebarLayout;
