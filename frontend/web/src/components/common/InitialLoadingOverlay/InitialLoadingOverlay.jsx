import { useState, useEffect, useRef } from 'react';
import useLayout from '../../../hooks/useLayout';
import useStorageDrives from '../../../hooks/useStorageDrives';
import './InitialLoadingOverlay.css';

/**
 * InitialLoadingOverlay - Lớp phủ màn hình khởi động (Splash Screen)
 * Hiển thị thanh tiến trình tải mượt mà khi lần đầu truy cập hoặc reload trang
 * Giúp che các chuyển động layout ban đầu và chuyển cảnh êm ái vào ứng dụng
 */
function InitialLoadingOverlay() {
  const { isInitialCheckDone, hasServerConnection } = useLayout();
  const { drives } = useStorageDrives();
  const [progress, setProgress] = useState(10);
  const [isExiting, setIsExiting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const mountTimeRef = useRef(null);

  // Ghi nhận thời điểm mount và nhịp độ tăng dần thanh tiến trình một cách mượt mà và tự nhiên
  useEffect(() => {
    mountTimeRef.current = Date.now();

    const t1 = setTimeout(() => {
      setProgress(35);
    }, 120);

    const t2 = setTimeout(() => {
      setProgress(68);
    }, 400);

    const t3 = setTimeout(() => {
      setProgress(85);
    }, 750);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  useEffect(() => {
    // Chỉ kích hoạt bước kết thúc khi server check hoàn tất
    if (!isInitialCheckDone) return;

    // Nếu có kết nối server, đợi danh sách ổ đĩa nạp xong để không bị giật layout
    const isDataReady = !hasServerConnection || (Array.isArray(drives) && drives.length > 0);
    if (!isDataReady) return;

    // Đảm bảo thời gian hiển thị đệm tối thiểu 900ms để chuyển cảnh đầm chắc, mượt mà
    const startTime = mountTimeRef.current || Date.now();
    const elapsed = Date.now() - startTime;
    const remainingDelay = Math.max(0, 900 - elapsed);

    const tFinish = setTimeout(() => {
      // 1. Chạm mốc 100%
      setProgress(100);

      // 2. Giữ một thoáng (160ms) cho người dùng cảm nhận tải xong
      const tExit = setTimeout(() => {
        setIsExiting(true);

        // 3. Sau khi hiệu ứng Fade-out êm ái hoàn tất (350ms), unmount giải phóng RAM
        const tUnmount = setTimeout(() => {
          setIsDone(true);
        }, 360);

        return () => clearTimeout(tUnmount);
      }, 160);

      return () => clearTimeout(tExit);
    }, remainingDelay);

    return () => {
      clearTimeout(tFinish);
    };
  }, [isInitialCheckDone, hasServerConnection, drives]);

  // Sau khi hoàn tất và mờ dần, unmount hoàn toàn để giải phóng RAM
  if (isDone) return null;

  return (
    <div
      className={`initial-loading-overlay ${isExiting ? 'initial-loading-overlay--exiting' : ''}`}
      aria-hidden={isExiting}
      role="status"
      aria-label="Đang khởi động ứng dụng AppView"
    >
      <div className="initial-loading-card">
        <div className="initial-loading-logo-box">
          <img
            src="/app_icon.png"
            alt="AppView Logo"
            className="initial-loading-logo"
            draggable="false"
          />
        </div>
        <span className="initial-loading-title">AppView</span>
        <div className="initial-loading-bar-track">
          <div
            className="initial-loading-bar-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default InitialLoadingOverlay;
