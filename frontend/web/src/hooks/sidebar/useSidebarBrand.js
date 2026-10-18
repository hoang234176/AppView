import { useCallback } from 'react';
import { useSidebarContext } from '../../contexts/SidebarContext';

export function useSidebarBrand() {
  const { handleNavigate } = useSidebarContext();

  const handleNavigateHome = useCallback(() => {
    if (handleNavigate) {
      handleNavigate('');
    }
  }, [handleNavigate]);

  return {
    handleNavigateHome,
  };
}
