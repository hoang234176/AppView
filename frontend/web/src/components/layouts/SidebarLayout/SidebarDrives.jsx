import { memo, useRef, useState, useEffect } from 'react';
import DriveIcon from '../../../assets/icons/DriveIcon';
import useStorageDrives, { formatStorageBytes } from '../../../hooks/useStorageDrives';
import './SidebarDrives.css';

function SidebarDrives({ activeDriveId = 'SSD', onSelectDrive }) {
  const { drives } = useStorageDrives();
  const prevAvailabilityRef = useRef({});
  const [animatingMountIds, setAnimatingMountIds] = useState(() => new Set());
  const [animatingUnmountIds, setAnimatingUnmountIds] = useState(() => new Set());

  // Kích hoạt animation khi trạng thái mount/unmount của ổ cứng biến động
  useEffect(() => {
    if (!Array.isArray(drives) || drives.length === 0) return;

    const prev = prevAvailabilityRef.current;
    const newMounted = [];
    const newUnmounted = [];

    drives.forEach((d) => {
      const isNowAvailable = d.available !== false && (d.totalBytes > 0 || d.usedPercent > 0);
      const wasAvailable = prev[d.id];

      // Chỉ kích hoạt hiệu ứng khi trạng thái có sự biến động (sau lần nạp ban đầu)
      if (wasAvailable !== undefined && wasAvailable !== isNowAvailable) {
        if (isNowAvailable) {
          newMounted.push(d.id);
        } else {
          newUnmounted.push(d.id);
        }
      }
      prev[d.id] = isNowAvailable;
    });

    if (newMounted.length > 0) {
      setAnimatingMountIds(new Set(newMounted));
      const timer = setTimeout(() => {
        setAnimatingMountIds(new Set());
      }, 750);
      return () => clearTimeout(timer);
    }

    if (newUnmounted.length > 0) {
      setAnimatingUnmountIds(new Set(newUnmounted));
      const timer = setTimeout(() => {
        setAnimatingUnmountIds(new Set());
      }, 650);
      return () => clearTimeout(timer);
    }
  }, [drives]);

  // Dữ liệu hiển thị: nếu chưa tải xong từ API thì dùng mảng giữ chỗ an toàn
  const displayDrives = drives && drives.length > 0
    ? drives
    : [
        { id: 'SSD', displayName: 'SSD', usedBytes: 0, availableBytes: 0, totalBytes: 0, usedPercent: 0, available: true },
        { id: 'HDD', displayName: 'HDD', usedBytes: 0, availableBytes: 0, totalBytes: 0, usedPercent: 0, available: false },
      ];

  const resolvedActiveId =
    activeDriveId === 'drive-1'
      ? (displayDrives.find((d) => d.id?.toUpperCase() === 'HDD')?.id || displayDrives[0]?.id)
      : activeDriveId === 'drive-2'
      ? (displayDrives.find((d) => d.id?.toUpperCase() === 'SSD')?.id || displayDrives[1]?.id)
      : activeDriveId;

  return (
    <div className="sidebar-drives">
      {displayDrives.map((drive) => {
        const isAvailable = drive.available !== false && (drive.totalBytes > 0 || drive.usedPercent > 0);
        const isActive = isAvailable && (resolvedActiveId === drive.id || resolvedActiveId === drive.displayName);
        const percent = isAvailable ? Math.min(Math.max(drive.usedPercent || 0, 0), 100) : 0;
        const isHighUsage = percent >= 90;
        const usedText = formatStorageBytes(drive.usedBytes);
        const freeText = formatStorageBytes(drive.availableBytes);
        const totalText = formatStorageBytes(drive.totalBytes);

        const isJustMounted = animatingMountIds.has(drive.id);
        const isJustUnmounted = animatingUnmountIds.has(drive.id);

        return (
          <button
            key={drive.id}
            type="button"
            className={`sidebar-drive-card ${isActive ? 'sidebar-drive-card--active' : ''} ${!isAvailable ? 'sidebar-drive-card--offline' : ''} ${isJustMounted ? 'sidebar-drive-card--just-mounted' : ''} ${isJustUnmounted ? 'sidebar-drive-card--just-unmounted' : ''}`}
            onClick={() => isAvailable && onSelectDrive?.(drive.id)}
            title={isAvailable ? `${drive.displayName}: ${freeText} free (${usedText} / ${totalText})` : `${drive.displayName}: Offline`}
            aria-label={`Drive ${drive.displayName}, ${isAvailable ? `${Math.round(percent)}% used` : 'Offline'}`}
          >
            <div className="sidebar-drive-content">
              {/* Cột trái: Khối Icon độc lập */}
              <div className="sidebar-drive-icon-col">
                <DriveIcon type={drive.displayName || drive.id} className="sidebar-drive-card__icon" />
              </div>

              {/* Cột phải: Toàn bộ thông tin */}
              <div className="sidebar-drive-info-col">
                {/* Hàng 1: Tên ổ (trái) | % (phải) */}
                <div className="sidebar-drive-name-row">
                  <span className="sidebar-drive-card__name">{drive.displayName}</span>
                  <span className={`sidebar-drive-card__percent ${isActive ? 'sidebar-drive-card__percent--active' : ''}`}>
                    {isAvailable ? `${Math.round(percent)}%` : '—'}
                  </span>
                </div>

                {/* Hàng 2: Thanh tiến trình ngang nằm ngay dưới tên */}
                <div className="sidebar-drive-progress-track">
                  <div
                    className={`sidebar-drive-progress-fill ${isActive ? 'sidebar-drive-progress-fill--active' : ''} ${isHighUsage ? 'sidebar-drive-progress-fill--warning' : ''}`}
                    style={{ width: isAvailable ? `${percent}%` : '0%' }}
                  />
                </div>

                {/* Hàng 3: Đã dùng (trái) | Dung lượng tổng (phải) */}
                <div className="sidebar-drive-stats-row">
                  {isAvailable ? (
                    <>
                      <span className="sidebar-drive-card__stats sidebar-drive-stat-used">
                        {usedText}
                      </span>
                      <span className="sidebar-drive-card__stats sidebar-drive-stat-total">
                        {totalText}
                      </span>
                    </>
                  ) : (
                    <span className="sidebar-drive-card__stats sidebar-drive-card__stats--offline">Offline</span>
                  )}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default memo(SidebarDrives);
