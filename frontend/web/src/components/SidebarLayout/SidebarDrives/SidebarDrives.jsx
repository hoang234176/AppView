import { memo } from 'react';
import { HardDrive } from 'lucide-react';
import { LiquidDriveButton } from './LiquidDriveButton';
import './SidebarDrives.css';

/**
 * SidebarDrives — Displays available drives list with liquid wave indicators
 */
export const SidebarDrives = memo(({
  drives = [],
  activeDrive = 'SSD',
  onSelectDrive,
  onNavigate,
}) => {
  if (!drives || drives.length === 0) return null;

  return (
    <div className="sidebar-drives-section">
      {/* Drives Header */}
      <div className="sidebar-drives-header">
        <span className="sidebar-drives-title">
          <HardDrive className="w-3.5 h-3.5 text-blue-400" />
          Ổ cứng
        </span>
      </div>

      {/* Horizontal Liquid Drive Buttons */}
      <div className="sidebar-drives-list">
        {drives.map((drive) => (
          <LiquidDriveButton
            key={drive.id}
            drive={drive}
            isActive={drive.id === activeDrive}
            onClick={() => {
              if (onSelectDrive) onSelectDrive(drive.id);
              if (onNavigate) onNavigate('');
            }}
          />
        ))}
      </div>
    </div>
  );
});

SidebarDrives.displayName = 'SidebarDrives';
