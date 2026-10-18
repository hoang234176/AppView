import { memo } from 'react';
import { SettingsModal } from '../components/layout/SettingsLayout';
import { useSettingsContext } from '../contexts/SettingsContext';

/**
 * SettingsLayout — Area 5: Settings & Server Configuration Management
 * Encapsulates the SettingsModal for coordinator host, cookies, and cache settings.
 */
export const SettingsLayout = memo(({
  showConfigModal: propShowConfigModal,
  onCloseConfigModal: propOnCloseConfigModal,
  onRefresh: propOnRefresh,
  onServerConfigSaved: propOnServerConfigSaved,
  onServerConfigFailed: propOnServerConfigFailed,
} = {}) => {
  const context = useSettingsContext();
  const showConfigModal = propShowConfigModal !== undefined ? propShowConfigModal : context.showConfigModal;
  const onCloseConfigModal = propOnCloseConfigModal || context.onCloseConfigModal;
  const onRefresh = propOnRefresh || context.onRefresh;
  const onServerConfigSaved = propOnServerConfigSaved || context.onServerConfigSaved;
  const onServerConfigFailed = propOnServerConfigFailed || context.onServerConfigFailed;

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
