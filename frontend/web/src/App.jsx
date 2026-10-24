import './App.css';
import SidebarLayout from './components/layouts/SidebarLayout/SidebarLayout';
import MainLayout from './components/layouts/MainLayout/MainLayout';
import NotificationLayout from './components/layouts/NotificationLayout/NotificationLayout';
import ServerConnectionModal from './components/layouts/ServerConnectionModal/ServerConnectionModal';

function App() {
  return (
    <div className="w-full h-full flex overflow-hidden bg-white text-gray-900 dark:bg-[#1f1f1f] dark:text-white">
      <SidebarLayout />
      <MainLayout />
      <NotificationLayout />
      <ServerConnectionModal />
    </div>
  );
}

export default App;
