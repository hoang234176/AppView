import { createContext, useContext } from 'react';

export const ContentContext = createContext(null);

export function useContentContext() {
  const context = useContext(ContentContext);
  if (!context) {
    throw new Error('useContentContext must be used within a ContentProvider');
  }
  return context;
}

export const ContentProvider = ContentContext.Provider;
