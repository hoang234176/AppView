import { createContext, useContext } from 'react';

export const FloatingActionContext = createContext(null);

export function useFloatingActionContext() {
  const context = useContext(FloatingActionContext);
  if (!context) {
    throw new Error('useFloatingActionContext must be used within a FloatingActionProvider');
  }
  return context;
}

export const FloatingActionProvider = FloatingActionContext.Provider;
