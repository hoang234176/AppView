import { createContext, useContext } from 'react';

/**
 * NotificationContext — Pipeline for Area 8: Notifications, System Alerts & Feedback
 */
export const NotificationContext = createContext(null);

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  return context || {};
}

export const NotificationProvider = NotificationContext.Provider;
