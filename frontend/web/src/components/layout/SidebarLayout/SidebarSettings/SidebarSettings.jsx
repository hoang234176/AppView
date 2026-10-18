import { memo } from 'react';
import { Settings } from 'lucide-react';
import { useSidebarSettings } from '../../../../hooks/sidebar';
import './SidebarSettings.css';

/**
 * SidebarSettings — Server settings launcher card at the bottom of the sidebar
 */
export const SidebarSettings = memo(({ onOpenConfig: propOnOpenConfig }) => {
  const { onOpenConfig: hookOnOpenConfig } = useSidebarSettings();
  const handleClick = propOnOpenConfig || hookOnOpenConfig;

  return (
    <div
      onClick={handleClick}
      className="sidebar-settings-card group"
      title="Cài đặt máy chủ"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="sidebar-settings-icon-wrap">
          <Settings className="absolute inset-0 m-auto block w-4 h-4 text-blue-400 origin-center transform-gpu transition-transform duration-500 group-hover:rotate-[360deg]" />
        </div>
        <div className="min-w-0">
          <h4 className="text-xs font-bold text-white group-hover:text-blue-300 truncate">
            Cài đặt
          </h4>
          <p className="text-[10px] text-gray-400 truncate">
            Máy chủ
          </p>
        </div>
      </div>

      {/* Rotating gear icon button */}
      <div className="sidebar-settings-gear-end">
        <Settings className="absolute inset-0 m-auto block w-3.5 h-3.5 origin-center transform-gpu transition-transform duration-500 group-hover:rotate-[360deg]" />
      </div>
    </div>
  );
});

SidebarSettings.displayName = 'SidebarSettings';
