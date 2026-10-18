import { useContentContext } from '../../contexts/ContentContext';

export function useContentBreadcrumbs() {
  const {
    currentPath = '',
    onNavigate,
    totalFolders = 0,
    totalPictures = 0,
    totalVideos = 0,
    activeDrive = 'HDD',
  } = useContentContext();

  return {
    currentPath,
    onNavigate,
    totalFolders,
    totalPictures,
    totalVideos,
    activeDrive,
  };
}
