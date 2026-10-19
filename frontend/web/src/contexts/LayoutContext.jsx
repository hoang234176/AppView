/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect } from 'react';

export const LayoutContext = createContext(null);

export function LayoutProvider({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(max-width: 767px)');

    const handleResize = (e) => {
      const mobile = e.matches;
      setIsMobile(mobile);
      if (!mobile) {
        setIsSidebarOpen(false);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleResize);
    } else {
      mediaQuery.addListener(handleResize);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleResize);
      } else {
        mediaQuery.removeListener(handleResize);
      }
    };
  }, []);

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);
  const openSidebar = () => setIsSidebarOpen(true);
  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <LayoutContext.Provider
      value={{
        isSidebarOpen,
        isMobile,
        toggleSidebar,
        openSidebar,
        closeSidebar,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
}

export default LayoutProvider;
