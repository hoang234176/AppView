import { useContextMenuContext } from '../../contexts/ContextMenuContext';

/**
 * useEmptyContextMenu — Hook for EmptyContextMenu
 * Extracts empty canvas actions (create folder, refresh)
 */
export function useEmptyContextMenu() {
  const {
    onClose,
    onCreateFolder,
    onRefresh,
  } = useContextMenuContext();

  return {
    onClose,
    onCreateFolder,
    onRefresh,
  };
}
