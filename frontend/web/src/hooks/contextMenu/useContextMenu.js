import { useContextMenuContext } from '../../contexts/ContextMenuContext';

/**
 * useContextMenu — Hook for ContextMenuLayout shell
 */
export function useContextMenu() {
  const {
    contextMenu = { isOpen: false, x: 0, y: 0, mode: 'empty', folder: null },
    onClose,
  } = useContextMenuContext();

  return {
    isOpen: contextMenu?.isOpen || false,
    x: contextMenu?.x || 0,
    y: contextMenu?.y || 0,
    mode: contextMenu?.mode || 'empty',
    folder: contextMenu?.folder || null,
    onClose,
  };
}
