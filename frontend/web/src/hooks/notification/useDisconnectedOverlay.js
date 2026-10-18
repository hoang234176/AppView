import { useNotificationContext } from '../../contexts/NotificationContext';

/**
 * useDisconnectedOverlay — Hook for DisconnectedOverlay
 * Extracts connection state and settings opener
 */
export function useDisconnectedOverlay() {
  const {
    isConnected = true,
    showConfigModal = false,
    onOpenConfig,
  } = useNotificationContext();

  return {
    isConnected,
    showConfigModal,
    onOpenConfig,
  };
}
