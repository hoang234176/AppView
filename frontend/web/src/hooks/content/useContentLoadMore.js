import { useContentContext } from '../../contexts/ContentContext';

export function useContentLoadMore() {
  const {
    hasMore = false,
    isLoadingMore = false,
    remainingCount = 0,
    onLoadMore,
  } = useContentContext();

  return {
    hasMore,
    isLoadingMore,
    remainingCount,
    onLoadMore,
  };
}
