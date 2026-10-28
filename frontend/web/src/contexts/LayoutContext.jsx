/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { checkCoordinatorHealth } from '../api/coordinatorApi';

export const LayoutContext = createContext(null);

export function LayoutProvider({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('appview_sidebar_width');
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 15 && val <= 60) {
          return val;
        }
      }
    }
    return 25;
  });

  const sidebarWidthRef = useRef(sidebarWidth);

  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth;
    document.documentElement.style.setProperty('--sidebar-width', `${sidebarWidth}%`);
  }, [sidebarWidth]);

  const [isResizing, setIsResizing] = useState(false);
  const [activeView, setActiveView] = useState('contents');
  const [isContentLoading, setIsContentLoading] = useState(false);
  const [isHeaderRightVisible, setIsHeaderRightVisible] = useState(true);
  const [isHeaderRightExiting, setIsHeaderRightExiting] = useState(false);
  const [isHeaderTitleVisible, setIsHeaderTitleVisible] = useState(false);
  const [isSettingsClosing, setIsSettingsClosing] = useState(false);
  const [hasServerConnection, setHasServerConnection] = useState(false);
  const [isInitialCheckDone, setIsInitialCheckDone] = useState(false);
  const [initialConnectionError, setInitialConnectionError] = useState('');
  const [initialServerValues, setInitialServerValues] = useState({ host: '', port: '' });
  const [serverConfig, setServerConfig] = useState({
    coordinator: { host: '', port: '' },
    download: { host: '', port: '' },
    storage: { host: '', port: '' },
  });
  const [notifications, setNotifications] = useState([]);

  const dismissNotification = useCallback((id) => {
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isExiting: true } : item))
    );
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const triggerNotification = useCallback((options = {}) => {
    const newId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    let type = 'success';
    if (options?.type === 'error') {
      type = 'error';
    } else if (options?.type === 'warning') {
      type = 'warning';
    }
    const defaultTitle = type === 'error' ? 'Error' : type === 'warning' ? 'Warning' : 'Success';
    const title = options?.title || defaultTitle;
    const message = typeof options?.message === 'string' ? options.message : '';

    setNotifications((prev) => {
      const active = prev.filter((item) => !item.isExiting);
      const updated = [{ id: newId, type, title, message, isExiting: false }, ...prev];
      // Nếu số lượng thẻ đang hiển thị >= 4, tự động trượt tắt thẻ ở dưới cùng
      if (active.length >= 4) {
        const bottomActive = active[active.length - 1];
        return updated.map((item) =>
          item.id === bottomActive.id ? { ...item, isExiting: true } : item
        );
      }
      return updated;
    });
  }, []);

  // Kiểm tra kết nối server ngầm khi khởi động App
  useEffect(() => {
    let isMounted = true;

    async function checkSavedServer() {
      let savedHost = '';
      let savedPort = '';

      try {
        const raw = localStorage.getItem('setting');
        if (raw) {
          const parsed = JSON.parse(raw);
          const coordSetting = parsed?.['connect-server']?.coordinator || parsed?.['connect-server'];
          savedHost = coordSetting?.host ? String(coordSetting.host).trim() : '';
          savedPort = coordSetting?.port ? String(coordSetting.port).trim() : '';
        }
      } catch (e) {
        console.error('Failed to parse setting from localStorage', e);
      }

      if (!savedHost || !savedPort) {
        if (isMounted) {
          setHasServerConnection(false);
          setIsInitialCheckDone(true);
        }
        return;
      }

      try {
        const result = await checkCoordinatorHealth(savedHost, savedPort);
        if (isMounted) {
          if (result.ok) {
            setHasServerConnection(true);
            setServerConfig((prev) => ({
              ...prev,
              coordinator: { host: savedHost, port: savedPort },
            }));
          } else {
            const errMsg = result.error || `Failed to connect to server at http://${savedHost}:${savedPort}`;
            setHasServerConnection(false);
            setInitialConnectionError(errMsg);
            setInitialServerValues({ host: savedHost, port: savedPort });
            triggerNotification({
              type: 'error',
              title: 'Connection Failed',
              message: errMsg,
            });
          }
        }
      } catch (err) {
        if (isMounted) {
          const errMsg = err.message || 'Error connecting to saved server.';
          setHasServerConnection(false);
          setInitialConnectionError(errMsg);
          setInitialServerValues({ host: savedHost, port: savedPort });
          triggerNotification({
            type: 'error',
            title: 'Connection Error',
            message: errMsg,
          });
        }
      } finally {
        if (isMounted) {
          setIsInitialCheckDone(true);
        }
      }
    }

    checkSavedServer();

    return () => {
      isMounted = false;
    };
  }, [triggerNotification]);

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

  const toggleSidebar = useCallback(() => setIsSidebarOpen((prev) => !prev), []);
  const openSidebar = useCallback(() => setIsSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);

  const startResizing = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const resetSidebarWidth = useCallback(() => {
    document.documentElement.style.setProperty('--sidebar-width', '25%');
    setSidebarWidth(25);
    if (typeof window !== 'undefined') {
      localStorage.setItem('appview_sidebar_width', '25');
    }
  }, []);

  const showContentLoading = useCallback(() => setIsContentLoading(true), []);
  const hideContentLoading = useCallback(() => setIsContentLoading(false), []);

  const showHeaderRight = useCallback(() => {
    setIsHeaderRightExiting(false);
    setIsHeaderRightVisible(true);
  }, []);

  const hideHeaderRight = useCallback(() => {
    setIsHeaderRightExiting(true);
    setTimeout(() => {
      setIsHeaderRightVisible(false);
      setIsHeaderRightExiting(false);
    }, 240);
  }, []);

  const closeSettings = useCallback((onComplete) => {
    setIsSettingsClosing(true);
    setTimeout(() => {
      setIsSettingsClosing(false);
      showHeaderRight();
      if (onComplete) {
        onComplete();
      }
    }, 180);
  }, [showHeaderRight]);

  // 60-120 FPS Hardware-Accelerated Zero-Render Drag Handler
  useEffect(() => {
    if (!isResizing) return;

    let rafId = null;
    let latestPercentage = sidebarWidthRef.current;

    const calculatePercentage = (clientX) => {
      const appLeft = window.innerWidth * 0.01;
      const appWidth = window.innerWidth * 0.98;
      const currentX = clientX - appLeft;
      let percentage = (currentX / appWidth) * 100;

      if (percentage < 15) percentage = 15;
      if (percentage > 60) percentage = 60;

      return percentage;
    };

    const handleMouseMove = (e) => {
      const percentage = calculatePercentage(e.clientX);
      latestPercentage = percentage;

      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--sidebar-width', `${latestPercentage}%`);
        rafId = null;
      });
    };

    const handleMouseUp = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      document.documentElement.style.setProperty('--sidebar-width', `${latestPercentage}%`);
      setSidebarWidth(latestPercentage);
      setIsResizing(false);
      if (typeof window !== 'undefined') {
        localStorage.setItem('appview_sidebar_width', latestPercentage.toFixed(2));
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const contextValue = useMemo(() => ({
    isSidebarOpen,
    isMobile,
    toggleSidebar,
    openSidebar,
    closeSidebar,
    sidebarWidth,
    isResizing,
    startResizing,
    resetSidebarWidth,
    activeView,
    setActiveView,
    isContentLoading,
    showContentLoading,
    hideContentLoading,
    isHeaderRightVisible,
    isHeaderRightExiting,
    showHeaderRight,
    hideHeaderRight,
    isHeaderTitleVisible,
    setHeaderTitleVisible: setIsHeaderTitleVisible,
    isSettingsClosing,
    closeSettings,
    hasServerConnection,
    setHasServerConnection,
    isInitialCheckDone,
    initialConnectionError,
    initialServerValues,
    serverConfig,
    setServerConfig,
    notifications,
    triggerNotification,
    dismissNotification,
    removeNotification,
  }), [
    isSidebarOpen,
    isMobile,
    toggleSidebar,
    openSidebar,
    closeSidebar,
    sidebarWidth,
    isResizing,
    startResizing,
    resetSidebarWidth,
    activeView,
    isContentLoading,
    showContentLoading,
    hideContentLoading,
    isHeaderRightVisible,
    isHeaderRightExiting,
    showHeaderRight,
    hideHeaderRight,
    isHeaderTitleVisible,
    isSettingsClosing,
    closeSettings,
    hasServerConnection,
    isInitialCheckDone,
    initialConnectionError,
    initialServerValues,
    serverConfig,
    notifications,
    triggerNotification,
    dismissNotification,
    removeNotification,
  ]);

  return (
    <LayoutContext.Provider value={contextValue}>
      {children}
    </LayoutContext.Provider>
  );
}

export default LayoutProvider;
