import { useRef, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import useLayout from '../../../../hooks/useLayout';
import Loading from '../../../common/Loading/Loading';
import './Content.css';

function Content() {
  const { hasServerConnection } = useLayout();
  const location = useLocation();
  const mainRef = useRef(null);
  const scrollPosRef = useRef(0);

  const isSettings = location.pathname === '/settings';
  const isContentsPage = location.pathname === '/' || location.pathname === '/contents' || location.pathname.startsWith('/drives');

  // Lắng nghe và khôi phục vị trí cuộn khi quay lại trang nội dung
  useEffect(() => {
    const mainEl = mainRef.current;
    if (!mainEl) return;

    if (isContentsPage) {
      if (scrollPosRef.current > 0) {
        requestAnimationFrame(() => {
          mainEl.scrollTop = scrollPosRef.current;
        });
      }
    }
  }, [location.pathname, isContentsPage]);

  const handleScroll = () => {
    window.dispatchEvent(new CustomEvent('close-more-menu'));
    if (isContentsPage) {
      if (mainRef.current) {
        scrollPosRef.current = mainRef.current.scrollTop;
      }
    }
  };

  const handleContextMenu = (e) => {
    // Không kích hoạt khi đang ở trang cài đặt
    if (isSettings) return;
    // Không kích hoạt lại nếu click chuột phải vào bên trong menu
    if (e.target.closest('.header-more-menu') || e.target.closest('.folder-context-menu')) return;

    // Chặn menu chuột phải mặc định của trình duyệt
    e.preventDefault();

    // Phát sự kiện mở menu tại vị trí chuột click phải
    window.dispatchEvent(
      new CustomEvent('open-more-menu', {
        detail: { clientX: e.clientX, clientY: e.clientY },
      })
    );
  };

  return (
    <main
      ref={mainRef}
      className={`main-content ${isSettings ? 'main-content--settings' : ''}`}
      onScroll={handleScroll}
      onContextMenu={handleContextMenu}
    >
      {!hasServerConnection ? (
        <div className="content-loading-container">
          <Loading text="" size="md" />
        </div>
      ) : (
        <Outlet />
      )}
    </main>
  );
}

export default Content;
