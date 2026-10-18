import { useFileOperationContext } from '../../contexts/FileOperationContext';

export function useRenameFolderModal() {
  const context = useFileOperationContext();

  return {
    isOpen: context.showRenameFolderModal ?? false,
    onClose: context.onCloseRenameFolderModal,
    folder: context.targetFolder ?? null,
    onRename: context.onRenameFolderSubmit,
  };
}
