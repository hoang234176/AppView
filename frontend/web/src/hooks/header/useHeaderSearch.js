import { useHeaderContext } from '../../contexts/HeaderContext';

export function useHeaderSearch() {
  const { searchQuery = '', setSearchQuery } = useHeaderContext();

  return {
    searchQuery,
    setSearchQuery,
  };
}
