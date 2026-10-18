import { createContext, useContext } from 'react';

/**
 * ViewerContext — Pipeline for Area 9: Media Viewers & Player Modals
 */
export const ViewerContext = createContext(null);

export function useViewerContext() {
  const context = useContext(ViewerContext);
  return context || {};
}

export const ViewerProvider = ViewerContext.Provider;
