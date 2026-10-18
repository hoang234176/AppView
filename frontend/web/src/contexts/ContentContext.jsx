import { createContext, useContext } from 'react';
import { useNavigationContext } from './NavigationContext';

export const ContentContext = createContext(null);

export function useContentContext() {
  const contentContext = useContext(ContentContext);
  const navigationContext = useNavigationContext();
  return contentContext || navigationContext || {};
}

export const ContentProvider = ContentContext.Provider;
