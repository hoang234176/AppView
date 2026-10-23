import { memo } from 'react';
import './SidebarDrives.css';

function SidebarDrives({ activeDriveId = 'drive-1', onSelectDrive }) {
  return (
    <div className="sidebar-drives">
      <div className="sidebar-drives-track">
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
  );
}

export default memo(SidebarDrives);
