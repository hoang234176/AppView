import { createContext, useContext } from 'react';

/**
 * NavigationContext — Core shared navigation state for AppView
 * Provides currentPath, activeDrive, treeData, drives, folders, and navigation handlers.
 */
export const NavigationContext = createContext(null);

export function useNavigationContext() {
  const context = useContext(NavigationContext);
  return context || {};
}

export const NavigationProvider = NavigationContext.Provider;
