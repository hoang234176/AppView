import { useHeaderContext } from '../../contexts/HeaderContext';

export function useHeaderSelectMode() {
  const {
    isSelectMode = false,
    onEnterSelectMode,
    onExitSelectMode,
    selectedCount = 0,
    onBatchCopy,
    onBatchMove,
    onBatchDelete,
  } = useHeaderContext();

  return {
    isSelectMode,
    onEnterSelectMode,
    onExitSelectMode,
    selectedCount,
    onBatchCopy,
    onBatchMove,
    onBatchDelete,
  };
}
