import { memo } from 'react';
import { SettingsModal, DisconnectedOverlay } from '../components/SettingsLayout';
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
      <DisconnectedOverlay
        isConnected={isConnected}
        showConfigModal={showConfigModal}
        onOpenConfig={onOpenConfig}
      />

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
