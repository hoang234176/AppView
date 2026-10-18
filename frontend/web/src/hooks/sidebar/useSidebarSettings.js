import { useCallback } from 'react';
import { useSidebarContext } from '../../contexts/SidebarContext';

export function useSidebarSettings() {
  const context = useSidebarContext();
  const openConfigFn = context.handleOpenConfig || context.onOpenConfig;

  const onOpenConfig = useCallback(() => {
    if (openConfigFn) {
      openConfigFn();
    }
  }, [openConfigFn]);

  return {
    onOpenConfig,
  };
}
