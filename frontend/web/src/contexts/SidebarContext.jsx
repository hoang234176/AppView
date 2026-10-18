import { createContext, useContext } from 'react';
import { useNavigationContext } from './NavigationContext';

export const SidebarContext = createContext(null);

export function useSidebarContext() {
  const sidebarContext = useContext(SidebarContext);
  const navigationContext = useNavigationContext();
  return sidebarContext || navigationContext || {};
}

export const SidebarProvider = SidebarContext.Provider;
