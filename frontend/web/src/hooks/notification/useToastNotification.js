import { useNotificationContext } from '../../contexts/NotificationContext';

/**
 * useToastNotification — Hook for ToastNotification
 * Extracts floating toast message
 */
export function useToastNotification() {
  const { toastMessage } = useNotificationContext();

  return {
    message: toastMessage,
  };
}
