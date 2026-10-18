import { createContext, useContext } from 'react';

/**
 * SettingsContext — Pipeline for Area 5: Settings & Connection Management
 */
export const SettingsContext = createContext(null);

export function useSettingsContext() {
  const context = useContext(SettingsContext);
  return context || {};
}

export const SettingsProvider = SettingsContext.Provider;
