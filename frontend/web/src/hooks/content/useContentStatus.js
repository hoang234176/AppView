import { useContentContext } from '../../contexts/ContentContext';

export function useContentStatus() {
  const {
    loading = false,
    errorInfo = null,
    hasContent = false,
    onRetry,
    searchQuery = '',
    onClearSearch,
    onEmptyContextMenu,
  } = useContentContext();

  return {
    loading,
    errorInfo,
    hasContent,
    onRetry,
    searchQuery,
    onClearSearch,
    onEmptyContextMenu,
  };
}
