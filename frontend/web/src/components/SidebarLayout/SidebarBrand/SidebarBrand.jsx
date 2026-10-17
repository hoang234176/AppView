import { memo } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import './SidebarBrand.css';

/**
 * SidebarBrand — Logo and Brand Header of AppView
 */
export const SidebarBrand = memo(({ onNavigate }) => {
  return (
    <div
      className="sidebar-brand-container group"
      onClick={() => onNavigate && onNavigate('')}
    >
      <div className="sidebar-brand-icon-wrap">
        <div className="sidebar-brand-icon-inner">
          <ImageIcon className="sidebar-brand-icon" />
        </div>
      </div>
      <div>
        <h1 className="sidebar-brand-title">AppView</h1>
      </div>
    </div>
  );
});

SidebarBrand.displayName = 'SidebarBrand';
