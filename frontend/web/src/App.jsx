import './App.css';
import SidebarLayout from './components/layouts/SidebarLayout/SidebarLayout';
import MainLayout from './components/layouts/MainLayout/MainLayout';

function App() {
  return (
    <div className="w-full h-full flex overflow-hidden bg-gray-50 text-gray-900 dark:bg-[#0b0c0e] dark:text-white">
      <SidebarLayout />
      <MainLayout />
    </div>
  );
}

export default App;
