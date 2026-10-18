import { useCallback } from 'react';
import { useSidebarContext } from '../../contexts/SidebarContext';

export function useSidebarDrives() {
  const {
    drives = [],
    activeDrive = 'SSD',
    handleSelectDrive,
    handleNavigate,
  } = useSidebarContext();

  const onSelectDrive = useCallback((driveId) => {
    if (handleSelectDrive) {
      handleSelectDrive(driveId);
    }
    if (handleNavigate) {
      handleNavigate('');
    }
  }, [handleSelectDrive, handleNavigate]);

  return {
    drives,
    activeDrive,
    onSelectDrive,
  };
}
