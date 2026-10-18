import { createContext, useContext } from 'react';
import { useNavigationContext } from './NavigationContext';

/**
 * DownloadContext — Data pipeline for Area 6: Download Management & Notification Layout
 */
export const DownloadContext = createContext(null);

export function useDownloadContext() {
  const downloadContext = useContext(DownloadContext);
  const navigationContext = useNavigationContext();
  return downloadContext || navigationContext || {};
}

export const DownloadProvider = DownloadContext.Provider;
