import { memo } from 'react';
import { useDisconnectedOverlay } from '../../../../hooks/notification';
import './DisconnectedOverlay.css';

/**
 * DisconnectedOverlay — Modal backdrop displayed when connection to backend server is lost
 */
export const DisconnectedOverlay = memo(({
  isConnected: propIsConnected,
  showConfigModal: propShowConfigModal,
  onOpenConfig: propOnOpenConfig,
}) => {
  const hookData = useDisconnectedOverlay();
  const isConnected = propIsConnected !== undefined ? propIsConnected : hookData.isConnected;
  const showConfigModal = propShowConfigModal !== undefined ? propShowConfigModal : hookData.showConfigModal;
  const onOpenConfig = propOnOpenConfig || hookData.onOpenConfig;

  if (isConnected || showConfigModal) return null;

  return (
    <div
      className="settings-disconnected-overlay"
      role="alert"
      aria-live="assertive"
    >
      <div className="settings-disconnected-card">
        <h2 className="settings-disconnected-title">Chưa kết nối máy chủ</h2>
        <p className="settings-disconnected-desc">
          Cần kết nối Coordinator hợp lệ trước khi duyệt thư mục, mở media hoặc tải xuống.
        </p>
        <button
          type="button"
          onClick={onOpenConfig}
          className="settings-disconnected-btn"
        >
          Mở cài đặt kết nối
        </button>
      </div>
    </div>
  );
});

DisconnectedOverlay.displayName = 'DisconnectedOverlay';
