// Folder-tree paths can be relative to Storage's logical root. Download jobs
// cross Coordinator as absolute *logical* paths only. No library folder is
// implicitly inserted here: /Test and /Albums/Test are distinct selections.
export const canonicalDownloadDestination = (selectedPath = '', drive = '') => {
  let selected = String(selectedPath || '').trim().replace(/^\/+|\/+$/g, '');
  const cleanDrive = String(drive || '').trim().replace(/^\/+|\/+$/g, '');
  if (cleanDrive) {
    if (!selected.toLowerCase().startsWith(cleanDrive.toLowerCase() + '/') && selected.toLowerCase() !== cleanDrive.toLowerCase()) {
      selected = selected ? `${cleanDrive}/${selected}` : cleanDrive;
    }
  }
  return selected ? `/${selected}` : '/';
};
