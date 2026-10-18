import { useSettingsContext } from '../../contexts/SettingsContext';

/**
 * useSettingsModal — Co-located hook for SettingsModal
 * Extracts modal state and config handlers from SettingsContext
 */
export function useSettingsModal() {
  const {
    showConfigModal = false,
    onCloseConfigModal,
    onRefresh,
    onServerConfigSaved,
    onServerConfigFailed,
  } = useSettingsContext();

  return {
    isOpen: showConfigModal,
    onClose: onCloseConfigModal,
    onRefreshFolder: onRefresh,
    onServerConfigSaved,
    onServerConfigFailed,
  };
}
