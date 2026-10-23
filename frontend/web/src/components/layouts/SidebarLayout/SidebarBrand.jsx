import { useRef, useEffect, memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './SidebarBrand.css';
import SettingsIcon from '../../../assets/icons/SettingsIcon';
import useLayout from '../../../hooks/useLayout';

function SidebarBrand() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showContentLoading, hideContentLoading, hideHeaderRight, closeSettings } = useLayout();
  const isSettings = location.pathname === '/settings';
  const timeoutRef = useRef(null);

  const handleSettingClick = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Toggle đóng Settings với hiệu ứng mượt mà
    if (isSettings) {
      closeSettings(() => {
        if (window.history.length > 1) {
          navigate(-1);
        } else {
          navigate('/');
        }
      });
      return;
    }

    // Mở Settings khi đang ở trang khác
    hideHeaderRight();
    showContentLoading();

    timeoutRef.current = setTimeout(() => {
      navigate('/settings');
      hideContentLoading();
    }, 400);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

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
        className={`sidebar-brand__settings-btn ${isSettings ? 'sidebar-brand__settings-btn--active' : ''}`}
        aria-label="Cài đặt"
        onClick={handleSettingClick}
      >
        <SettingsIcon className="sidebar-brand__settings-icon" />
      </button>
    </div>
  );
}

export default memo(SidebarBrand);
