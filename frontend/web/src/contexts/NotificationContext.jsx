import { createContext, useContext } from 'react';
import { useNavigationContext } from './NavigationContext';

/**
 * NotificationContext — Pipeline for Area 8: Notifications, System Alerts & Feedback
 */
export const NotificationContext = createContext(null);

export function useNotificationContext() {
  const notificationContext = useContext(NotificationContext);
  const navigationContext = useNavigationContext();
  return notificationContext || navigationContext || {};
}

export const NotificationProvider = NotificationContext.Provider;
