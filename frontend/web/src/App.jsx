import { useEffect } from 'react';
import useLayout from './hooks/useLayout';
import SidebarLayout from './components/layouts/SidebarLayout/SidebarLayout';
import MainLayout from './components/layouts/MainLayout/MainLayout';
import NotificationLayout from './components/layouts/NotificationLayout/NotificationLayout';
import ServerConnectionModal from './components/layouts/ServerConnectionModal/ServerConnectionModal';
import NewFolderModal from './components/layouts/NewFolderModal/NewFolderModal';
import RenameModal from './components/layouts/RenameModal/RenameModal';
import GetInfoModal from './components/layouts/GetInfoModal/GetInfoModal';
import FolderContextMenu from './components/common/FolderContextMenu/FolderContextMenu';
import InitialLoadingOverlay from './components/common/InitialLoadingOverlay/InitialLoadingOverlay';

function App() {
  const { openGetInfo } = useLayout();

  // Khóa hoàn toàn menu chuột phải mặc định của trình duyệt trên toàn bộ ứng dụng
  useEffect(() => {
    const handleContextMenu = (e) => {
      e.preventDefault();
    };

    window.addEventListener('contextmenu', handleContextMenu);
    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  // Hỗ trợ phím tắt Cmd+I / Ctrl+I để mở Get Info thư mục hiện tại
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        openGetInfo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openGetInfo]);

  return (
    <div className="w-full h-full flex overflow-hidden bg-white text-gray-900 dark:bg-[#1f1f1f] dark:text-white">
      <SidebarLayout />
      <MainLayout />
      <ServerConnectionModal />
      <NotificationLayout />
      <NewFolderModal />
      <RenameModal />
      <GetInfoModal />
      <FolderContextMenu />
      <InitialLoadingOverlay />
    </div>
  );
}

export default App;
