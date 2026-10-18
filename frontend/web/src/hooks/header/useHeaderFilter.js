import { useHeaderContext } from '../../contexts/HeaderContext';

export function useHeaderFilter() {
  const {
    fileTypeFilters = new Set(),
    setFileTypeFilters,
    mxhFilters = new Set(),
    setMxhFilters,
  } = useHeaderContext();

  return {
    fileTypeFilters,
    setFileTypeFilters,
    mxhFilters,
    setMxhFilters,
  };
}
