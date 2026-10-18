import { createContext, useContext } from 'react';
import { useNavigationContext } from './NavigationContext';

/**
 * ViewerContext — Pipeline for Area 9: Media Viewers & Player Modals
 */
export const ViewerContext = createContext(null);

export function useViewerContext() {
  const viewerContext = useContext(ViewerContext);
  const navigationContext = useNavigationContext();
  return viewerContext || navigationContext || {};
}

export const ViewerProvider = ViewerContext.Provider;
