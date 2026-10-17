import React, { memo } from 'react';
import { FabSpeedDial } from '../components/FabSpeedDial';

/**
 * FloatingActionLayout — Area 4: Floating Action Button
 * Wraps FabSpeedDial for creating folders and downloading media/archives.
 */
export const FloatingActionLayout = memo(({
  onCreateFolder,
  onDownloadArchive,
  onDownloadMedia,
}) => {
  return (
    <FabSpeedDial
      onCreateFolder={onCreateFolder}
      onDownloadArchive={onDownloadArchive}
      onDownloadMedia={onDownloadMedia}
    />
  );
});

FloatingActionLayout.displayName = 'FloatingActionLayout';
