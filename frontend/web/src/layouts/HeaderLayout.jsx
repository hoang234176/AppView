import { memo } from 'react';
import { Header } from '../components/HeaderLayout';
import './HeaderLayout.css';

/**
 * HeaderLayout — Area 2: Top Header Bar
 * Houses search input, filter options, active download counters, and select mode controls.
 */
export const HeaderLayout = memo(({
  searchQuery,
  setSearchQuery,
  onRefresh,
  loading,
  isConnected,
  onSaveServerConfig,
  showConfigModal,
  setShowConfigModal,
  onOpenMobileTree,
  onOpenDownloadPanel,
  activeDownloadCount,
  downloadProgressPercent,
  isDownloadingMode,
  hasPasswordError,
  isScanning,
  isConverting,
  isSelectMode,
  onEnterSelectMode,
  onExitSelectMode,
  selectedCount,
  onBatchCopy,
  onBatchMove,
  onBatchDelete,
  fileTypeFilters,
  setFileTypeFilters,
  mxhFilters,
  setMxhFilters,
}) => {
  return (
    <Header
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      onRefresh={onRefresh}
      loading={loading}
      isConnected={isConnected}
      onSaveServerConfig={onSaveServerConfig}
      showConfigModal={showConfigModal}
      setShowConfigModal={setShowConfigModal}
      onOpenMobileTree={onOpenMobileTree}
      onOpenDownloadPanel={onOpenDownloadPanel}
      activeDownloadCount={activeDownloadCount}
      downloadProgressPercent={downloadProgressPercent}
      isDownloadingMode={isDownloadingMode}
      hasPasswordError={hasPasswordError}
      isScanning={isScanning}
      isConverting={isConverting}
      isSelectMode={isSelectMode}
      onEnterSelectMode={onEnterSelectMode}
      onExitSelectMode={onExitSelectMode}
      selectedCount={selectedCount}
      onBatchCopy={onBatchCopy}
      onBatchMove={onBatchMove}
      onBatchDelete={onBatchDelete}
      fileTypeFilters={fileTypeFilters}
      setFileTypeFilters={setFileTypeFilters}
      mxhFilters={mxhFilters}
      setMxhFilters={setMxhFilters}
    />
  );
});

HeaderLayout.displayName = 'HeaderLayout';
