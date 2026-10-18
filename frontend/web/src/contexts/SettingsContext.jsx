import { createContext, useContext } from 'react';
import { useNavigationContext } from './NavigationContext';

/**
 * SettingsContext — Pipeline for Area 5: Settings & Connection Management
 */
export const SettingsContext = createContext(null);

export function useSettingsContext() {
  const settingsContext = useContext(SettingsContext);
  const navigationContext = useNavigationContext();
  return settingsContext || navigationContext || {};
}

export const SettingsProvider = SettingsContext.Provider;
