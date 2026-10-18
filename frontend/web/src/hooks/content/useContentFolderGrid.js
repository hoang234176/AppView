import { useContentContext } from '../../contexts/ContentContext';

export function useContentFolderGrid() {
  const {
    visibleFolders = [],
    totalFolders = 0,
    onNavigate,
    onFolderContextMenu,
    isSelectMode = false,
    selectedItems = new Map(),
    onToggleSelectItem,
    onToggleSelectAllFolders,
  } = useContentContext();

  return {
    folders: visibleFolders,
    totalCount: totalFolders,
    onNavigate,
    onFolderContextMenu,
    isSelectMode,
    selectedItems,
    onToggleSelect: onToggleSelectItem,
    onToggleSelectAll: onToggleSelectAllFolders,
  };
}
