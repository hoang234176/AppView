import { createContext, useContext } from 'react';

/**
 * ContextMenuContext — Data pipeline for Area 7: Right-Click Context Menu Flyouts
 */
export const ContextMenuContext = createContext(null);

export function useContextMenuContext() {
  const context = useContext(ContextMenuContext);
  return context || {};
}

export const ContextMenuProvider = ContextMenuContext.Provider;
