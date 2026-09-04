// Folder-tree paths can be relative to Storage's logical root. Download jobs
// cross Coordinator as absolute *logical* paths only. No library folder is
// implicitly inserted here: /Test and /Albums/Test are distinct selections.
export const canonicalDownloadDestination = (selectedPath = '') => {
  const selected = String(selectedPath).trim().replace(/^\/+|\/+$/g, '');
  return selected ? `/${selected}` : '/';
};
