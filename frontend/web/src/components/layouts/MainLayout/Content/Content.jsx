import { useRef, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import useLayout from '../../../../hooks/useLayout';
import Loading from '../../../common/Loading/Loading';
import './Content.css';

function Content() {
  const { isContentLoading } = useLayout();
  const location = useLocation();
  const mainRef = useRef(null);
  const scrollPosRef = useRef(0);

  // Lắng nghe và khôi phục vị trí cuộn khi quay lại trang nội dung
  useEffect(() => {
    const mainEl = mainRef.current;
    if (!mainEl) return;

    if (location.pathname === '/' || location.pathname === '/contents') {
      if (scrollPosRef.current > 0) {
        requestAnimationFrame(() => {
          mainEl.scrollTop = scrollPosRef.current;
        });
      }
    }
  }, [location.pathname]);

  const handleScroll = () => {
    if (location.pathname === '/' || location.pathname === '/contents') {
      if (mainRef.current) {
        scrollPosRef.current = mainRef.current.scrollTop;
      }
    }
  };

  const isSettings = location.pathname === '/settings';

  return (
    <main
      ref={mainRef}
      className={`main-content ${isSettings ? 'main-content--settings' : ''}`}
      onScroll={handleScroll}
    >
      {isContentLoading ? (
        <div className="content-loading-container">
          <Loading />
        </div>
      ) : (
        <Outlet />
      )}
    </main>
  );
}

export default Content;
