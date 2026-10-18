import { useMemo } from 'react';
import { useFileOperationContext } from '../../contexts/FileOperationContext';

const EMPTY_ITEMS = [];

export function useBatchActionModal() {
  const context = useFileOperationContext();
  const batchModalState = context.batchModalState;
  const selectedItems = context.selectedItems;

  const items = useMemo(() => {
    if (batchModalState?.items && batchModalState.items.length > 0) {
      return batchModalState.items;
    }
    if (selectedItems && selectedItems.size > 0) {
      return Array.from(selectedItems.values());
    }
    return EMPTY_ITEMS;
  }, [batchModalState?.items, selectedItems]);

  return {
    isOpen: !!batchModalState?.isOpen,
    action: batchModalState?.action || null,
    onClose: context.onCloseBatchModal,
    items,
    treeData: context.treeData,
    currentPath: context.currentPath,
    drives: context.drives,
    activeDrive: context.activeDrive,
    onConfirm: context.onConfirmBatch,
  };
}
