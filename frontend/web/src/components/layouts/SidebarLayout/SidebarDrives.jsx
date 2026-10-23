import { memo } from 'react';
import './SidebarDrives.css';

function SidebarDrives({ activeDriveId = 'drive-1', onSelectDrive }) {
  return (
    <div className="sidebar-drives">
      <div className="sidebar-drives-track">
        {/* Layer 2 khối đứng song song (hiển thị khi > 17vw) */}
        <div className="sidebar-drives-layer sidebar-drives-layer--grid">
          <button
            type="button"
            className={`sidebar-drive-card ${activeDriveId === 'drive-1' ? 'sidebar-drive-card--active' : ''}`}
            onClick={() => onSelectDrive?.('drive-1')}
            aria-label="Drive 1"
          />
          <button
            type="button"
            className={`sidebar-drive-card ${activeDriveId === 'drive-2' ? 'sidebar-drive-card--active' : ''}`}
            onClick={() => onSelectDrive?.('drive-2')}
            aria-label="Drive 2"
          />
        </div>

        {/* Layer 2 thanh ngang xếp chồng (trượt từ trái sang phải khi <= 17vw) */}
        <div className="sidebar-drives-layer sidebar-drives-layer--stacked">
          <button
            type="button"
            className={`sidebar-drive-card ${activeDriveId === 'drive-1' ? 'sidebar-drive-card--active' : ''}`}
            onClick={() => onSelectDrive?.('drive-1')}
            aria-label="Drive 1"
          />
          <button
            type="button"
            className={`sidebar-drive-card ${activeDriveId === 'drive-2' ? 'sidebar-drive-card--active' : ''}`}
            onClick={() => onSelectDrive?.('drive-2')}
            aria-label="Drive 2"
          />
        </div>
      </div>
    </div>
  );
}

export default memo(SidebarDrives);
