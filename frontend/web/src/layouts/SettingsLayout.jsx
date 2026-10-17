import { memo } from 'react';
import { SettingsModal } from '../components/layout/SettingsLayout';
import './SettingsLayout.css';

/**
 * SettingsLayout — Area 5: Settings & Server Configuration Management
 * Encapsulates the SettingsModal for coordinator host, cookies, and cache settings.
 */
export const SettingsLayout = memo(({
  showConfigModal,
  onCloseConfigModal,
  onRefresh,
  onServerConfigSaved,
  onServerConfigFailed,
}) => {
  return (
    <SettingsModal
      isOpen={showConfigModal}
      onClose={onCloseConfigModal}
      onRefreshFolder={onRefresh}
      onServerConfigSaved={onServerConfigSaved}
      onServerConfigFailed={onServerConfigFailed}
    />
  );
});

SettingsLayout.displayName = 'SettingsLayout';
