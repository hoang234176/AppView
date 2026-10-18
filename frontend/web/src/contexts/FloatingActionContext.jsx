import { createContext, useContext } from 'react';
import { useNavigationContext } from './NavigationContext';

export const FloatingActionContext = createContext(null);

export function useFloatingActionContext() {
  const floatingActionContext = useContext(FloatingActionContext);
  const navigationContext = useNavigationContext();
  return floatingActionContext || navigationContext || {};
}

export const FloatingActionProvider = FloatingActionContext.Provider;
