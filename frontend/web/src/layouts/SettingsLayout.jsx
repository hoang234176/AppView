import { memo } from 'react';
import { SettingsModal } from '../components/SettingsModal';
import './SettingsLayout.css';

/**
 * SettingsLayout — Area 5: Settings & Server Connection Management
 * Encapsulates the SettingsModal and the disconnected server alert overlay.
 */
export const SettingsLayout = memo(({
  isConnected,
  showConfigModal,
  onOpenConfig,
  onCloseConfigModal,
  onRefresh,
  onServerConfigSaved,
  onServerConfigFailed,
}) => {
  return (
    <>
      {/* A failed health check invalidates every server-backed surface */}
      {!isConnected && !showConfigModal && (
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
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showConfigModal}
        onClose={onCloseConfigModal}
        onRefreshFolder={onRefresh}
        onServerConfigSaved={onServerConfigSaved}
        onServerConfigFailed={onServerConfigFailed}
      />
    </>
  );
});

SettingsLayout.displayName = 'SettingsLayout';
