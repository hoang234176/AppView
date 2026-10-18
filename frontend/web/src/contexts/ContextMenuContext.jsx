import { createContext, useContext } from 'react';
import { useNavigationContext } from './NavigationContext';

/**
 * ContextMenuContext — Data pipeline for Area 7: Right-Click Context Menu Flyouts
 */
export const ContextMenuContext = createContext(null);

export function useContextMenuContext() {
  const contextMenuContext = useContext(ContextMenuContext);
  const navigationContext = useNavigationContext();
  return contextMenuContext || navigationContext || {};
}

export const ContextMenuProvider = ContextMenuContext.Provider;
