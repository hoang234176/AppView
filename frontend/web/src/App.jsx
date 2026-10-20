import './App.css';
import SidebarLayout from './components/layouts/SidebarLayout/SidebarLayout';
import MainLayout from './components/layouts/MainLayout/MainLayout';

function App() {
  return (
    <div className="w-full h-full flex overflow-hidden bg-white text-gray-900 dark:bg-[#1f1f1f] dark:text-white">
      <SidebarLayout />
      <MainLayout />
    </div>
  );
}

export default App;
