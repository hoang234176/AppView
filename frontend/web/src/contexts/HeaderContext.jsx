import { createContext, useContext } from 'react';

export const HeaderContext = createContext(null);

export function useHeaderContext() {
  const context = useContext(HeaderContext);
  if (!context) {
    throw new Error('useHeaderContext must be used within a HeaderProvider');
  }
  return context;
}

export const HeaderProvider = HeaderContext.Provider;
