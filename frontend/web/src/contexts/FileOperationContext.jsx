import { createContext, useContext } from 'react';

/**
 * FileOperationContext — Pipeline for Area 10: File Operations & Batch Dialogs
 */
export const FileOperationContext = createContext(null);

export function useFileOperationContext() {
  const context = useContext(FileOperationContext);
  return context || {};
}

export const FileOperationProvider = FileOperationContext.Provider;
