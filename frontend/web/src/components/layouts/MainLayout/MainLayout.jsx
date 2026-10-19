import './MainLayout.css';
import useLayout from '../../../hooks/useLayout';

function MainLayout() {
  const { toggleSidebar, isMobile } = useLayout();

  return (
    <div className="main-layout">
      <header className="main-layout-header gap-3">
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
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Header</span>
      </header>
      <main className="main-layout-content">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Main Content</span>
      </main>
    </div>
  );
}

export default MainLayout;
