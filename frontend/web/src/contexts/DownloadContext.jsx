import { createContext, useContext } from 'react';

/**
 * DownloadContext — Data pipeline for Area 6: Download Management & Notification Layout
 */
export const DownloadContext = createContext(null);

export function useDownloadContext() {
  const context = useContext(DownloadContext);
  return context || {};
}

export const DownloadProvider = DownloadContext.Provider;
