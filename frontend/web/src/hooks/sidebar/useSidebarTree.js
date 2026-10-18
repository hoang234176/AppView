import { useState, useCallback } from 'react';
import { useSidebarContext } from '../../contexts/SidebarContext';

export function useSidebarTree() {
  const {
    currentPath = '',
    treeData = [],
    folders = [],
    activeDrive = 'SSD',
    handleNavigate,
    handleFolderContextMenu,
    handleEmptyContextMenu,
  } = useSidebarContext();

  const [prevPath, setPrevPath] = useState(currentPath);
  const [expandedNodes, setExpandedNodes] = useState({});

  if (currentPath !== prevPath) {
    setPrevPath(currentPath);
    if (currentPath) {
      const parts = currentPath.split('/');
      let accPath = '';
      const toExpand = {};
      parts.forEach((part) => {
        accPath = accPath ? `${accPath}/${part}` : part;
        toExpand[accPath] = true;
      });
      setExpandedNodes((prev) => ({ ...prev, ...toExpand }));
    }
  }

  const toggleExpand = useCallback((path, forceExpand = null) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [path]: forceExpand !== null ? forceExpand : !prev[path],
    }));
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedNodes({});
  }, []);

  return {
    currentPath,
    treeData,
    folders,
    activeDrive,
    expandedNodes,
    toggleExpand,
    collapseAll,
    handleNavigate,
    handleFolderContextMenu,
    handleEmptyContextMenu,
  };
}
