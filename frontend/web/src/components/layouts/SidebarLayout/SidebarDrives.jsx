import { memo } from 'react';
import DriveIcon from '../../../assets/icons/DriveIcon';
import useStorageDrives, { formatStorageBytes } from '../../../hooks/useStorageDrives';
import './SidebarDrives.css';

function SidebarDrives({ activeDriveId = 'SSD', onSelectDrive }) {
  const { drives } = useStorageDrives();

  // Dữ liệu hiển thị: nếu chưa tải xong từ API thì dùng mảng giữ chỗ an toàn
  const displayDrives = drives && drives.length > 0
    ? drives
    : [
        { id: 'SSD', displayName: 'SSD', usedBytes: 0, availableBytes: 0, totalBytes: 0, usedPercent: 0, available: true },
        { id: 'HDD', displayName: 'HDD', usedBytes: 0, availableBytes: 0, totalBytes: 0, usedPercent: 0, available: false },
      ];

  const resolvedActiveId =
    activeDriveId === 'drive-1'
      ? displayDrives[0]?.id
      : activeDriveId === 'drive-2'
      ? displayDrives[1]?.id
      : (activeDriveId || displayDrives[0]?.id);

  return (
    <div className="sidebar-drives">
      <div className="sidebar-drives-track">
        {/* Layer 1: 2 khối đứng song song (> 20vw) */}
        <div className="sidebar-drives-layer sidebar-drives-layer--grid">
          {displayDrives.map((drive) => {
            const isActive = resolvedActiveId === drive.id;
            const isAvailable = drive.available !== false && (drive.totalBytes > 0 || drive.usedPercent > 0);
            const percent = isAvailable ? Math.min(Math.max(drive.usedPercent || 0, 0), 100) : 0;
            const isHighUsage = percent >= 90;
            const usedText = formatStorageBytes(drive.usedBytes);
            const freeText = formatStorageBytes(drive.availableBytes);
            const totalText = formatStorageBytes(drive.totalBytes);

            return (
              <button
                key={drive.id}
                type="button"
                className={`sidebar-drive-card ${isActive ? 'sidebar-drive-card--active' : ''} ${!isAvailable ? 'sidebar-drive-card--offline' : ''}`}
                onClick={() => isAvailable && onSelectDrive?.(drive.id)}
                aria-label={`Drive ${drive.displayName}, ${isAvailable ? `${Math.round(percent)}% used` : 'Offline'}`}
              >
                <div className="sidebar-drive-content sidebar-drive-content--grid">
                  {/* Cột trái: Khối Icon độc lập */}
                  <div className="sidebar-drive-icon-col">
                    <DriveIcon type={drive.displayName || drive.id} className="sidebar-drive-card__icon" />
                  </div>

                  {/* Cột phải: Toàn bộ thông tin (Tên + %, Thanh %, Free trước & Đã dùng / Gốc sau) */}
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

                    {/* Hàng 3: Free trước | Đã dùng / Dung lượng gốc sau */}
                    <div className="sidebar-drive-stats-row">
                      {isAvailable ? (
                        <>
                          <span className="sidebar-drive-card__stats sidebar-drive-card__stats--free">{freeText} free</span>
                          <span className="sidebar-drive-card__stats">{usedText} / {totalText}</span>
                        </>
                      ) : (
                        <span className="sidebar-drive-card__stats sidebar-drive-card__stats--offline">Offline • Chưa mount</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Layer 2: 2 thanh ngang xếp chồng (trượt vào khi <= 20vw) */}
        <div className="sidebar-drives-layer sidebar-drives-layer--stacked">
          {displayDrives.map((drive) => {
            const isActive = resolvedActiveId === drive.id;
            const isAvailable = drive.available !== false && (drive.totalBytes > 0 || drive.usedPercent > 0);
            const percent = isAvailable ? Math.min(Math.max(drive.usedPercent || 0, 0), 100) : 0;
            const isHighUsage = percent >= 90;
            const usedText = formatStorageBytes(drive.usedBytes);
            const freeText = formatStorageBytes(drive.availableBytes);
            const totalText = formatStorageBytes(drive.totalBytes);

            return (
              <button
                key={drive.id}
                type="button"
                className={`sidebar-drive-card sidebar-drive-card--stacked ${isActive ? 'sidebar-drive-card--active' : ''} ${!isAvailable ? 'sidebar-drive-card--offline' : ''}`}
                onClick={() => isAvailable && onSelectDrive?.(drive.id)}
                aria-label={`Drive ${drive.displayName}, ${isAvailable ? `${Math.round(percent)}% used` : 'Offline'}`}
              >
                <div className="sidebar-drive-content sidebar-drive-content--stacked">
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

                    {/* Hàng 3: Free trước | Đã dùng / Dung lượng gốc sau */}
                    <div className="sidebar-drive-stats-row">
                      {isAvailable ? (
                        <>
                          <span className="sidebar-drive-card__stats sidebar-drive-card__stats--free">{freeText} free</span>
                          <span className="sidebar-drive-card__stats">{usedText} / {totalText}</span>
                        </>
                      ) : (
                        <span className="sidebar-drive-card__stats sidebar-drive-card__stats--offline">Offline • Chưa mount</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default memo(SidebarDrives);
