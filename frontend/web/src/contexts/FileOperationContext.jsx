import { createContext, useContext } from 'react';
import { useNavigationContext } from './NavigationContext';

/**
 * FileOperationContext — Pipeline for Area 10: File Operations & Batch Dialogs
 */
export const FileOperationContext = createContext(null);

export function useFileOperationContext() {
  const fileOperationContext = useContext(FileOperationContext);
  const navigationContext = useNavigationContext();
  return fileOperationContext || navigationContext || {};
}

export const FileOperationProvider = FileOperationContext.Provider;
