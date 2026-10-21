import './SidebarBrand.css';
import SettingsIcon from '../../../assets/icons/SettingsIcon';

function SidebarBrand() {
  return (
    <div className="sidebar-brand">
      <div className="sidebar-brand__left">
        <img
          src="/app_icon.png"
          alt="AppView Logo"
          className="sidebar-brand__logo"
          draggable="false"
        />
        <span className="sidebar-brand__title">AppView</span>
      </div>

      <button
        type="button"
        className="sidebar-brand__settings-btn"
        aria-label="Cài đặt"
      >
        <SettingsIcon className="sidebar-brand__settings-icon" />
      </button>
    </div>
  );
}

export default SidebarBrand;
