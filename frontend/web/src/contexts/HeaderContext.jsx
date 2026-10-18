import { createContext, useContext } from 'react';
import { useNavigationContext } from './NavigationContext';

export const HeaderContext = createContext(null);

export function useHeaderContext() {
  const headerContext = useContext(HeaderContext);
  const navigationContext = useNavigationContext();
  return headerContext || navigationContext || {};
}

export const HeaderProvider = HeaderContext.Provider;
