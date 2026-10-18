import { memo } from 'react';
import { BatchActionModal, RenameFolderModal } from '../components/layout/FileOperationLayout';
import { useFileOperationContext } from '../contexts/FileOperationContext';

/**
 * FileOperationLayout — Area 10: File Operations & Batch Dialogs
 * Encapsulates batch action modal (move/copy) and rename folder dialog modal.
 */
export const FileOperationLayout = memo(({
  // Rename Folder Modal
  showRenameFolderModal: propShowRenameFolderModal,
  onCloseRenameFolderModal: propOnCloseRenameFolderModal,
  targetFolder: propTargetFolder,
  onRenameFolderSubmit: propOnRenameFolderSubmit,

  // Batch Action Modal
  batchModalState: propBatchModalState,
  onCloseBatchModal: propOnCloseBatchModal,
  selectedItems: propSelectedItems,
  treeData: propTreeData,
  currentPath: propCurrentPath,
  drives: propDrives,
  activeDrive: propActiveDrive,
  onConfirmBatch: propOnConfirmBatch,
} = {}) => {
  const context = useFileOperationContext();

  const showRenameFolderModal = propShowRenameFolderModal !== undefined ? propShowRenameFolderModal : context.showRenameFolderModal;
  const onCloseRenameFolderModal = propOnCloseRenameFolderModal || context.onCloseRenameFolderModal;
  const targetFolder = propTargetFolder !== undefined ? propTargetFolder : context.targetFolder;
  const onRenameFolderSubmit = propOnRenameFolderSubmit || context.onRenameFolderSubmit;

  const batchModalState = propBatchModalState !== undefined ? propBatchModalState : context.batchModalState;
  const onCloseBatchModal = propOnCloseBatchModal || context.onCloseBatchModal;
  const selectedItems = propSelectedItems !== undefined ? propSelectedItems : context.selectedItems;
  const treeData = propTreeData !== undefined ? propTreeData : context.treeData;
  const currentPath = propCurrentPath !== undefined ? propCurrentPath : context.currentPath;
  const drives = propDrives !== undefined ? propDrives : context.drives;
  const activeDrive = propActiveDrive !== undefined ? propActiveDrive : context.activeDrive;
  const onConfirmBatch = propOnConfirmBatch || context.onConfirmBatch;
  return (
    <>
      {/* Rename Folder Dialog Modal */}
      <RenameFolderModal
        isOpen={showRenameFolderModal}
        onClose={onCloseRenameFolderModal}
        folder={targetFolder}
        onRename={onRenameFolderSubmit}
      />

      {/* Batch Action Modal for Select Mode & Single Item Actions */}
      <BatchActionModal
        isOpen={batchModalState?.isOpen}
        action={batchModalState?.action}
        onClose={onCloseBatchModal}
        items={
          batchModalState?.items && batchModalState.items.length > 0
            ? batchModalState.items
            : selectedItems
            ? Array.from(selectedItems.values())
            : undefined
        }
        treeData={treeData}
        currentPath={currentPath}
        drives={drives}
        activeDrive={activeDrive}
        onConfirm={onConfirmBatch}
      />
    </>
  );
});

FileOperationLayout.displayName = 'FileOperationLayout';
