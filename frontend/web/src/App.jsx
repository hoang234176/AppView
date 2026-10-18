import { useState, useEffect, useCallback, useRef } from 'react';
import { SidebarLayout } from './layouts/SidebarLayout';
import { HeaderLayout } from './layouts/HeaderLayout';
import { ContentLayout } from './layouts/ContentLayout';
import { FloatingActionLayout } from './layouts/FloatingActionLayout';
import { SettingsLayout } from './layouts/SettingsLayout';
import { DownloadLayout } from './layouts/DownloadLayout';
import { ContextMenuLayout } from './layouts/ContextMenuLayout';
import { NotificationLayout } from './layouts/NotificationLayout';
import { ViewerLayout } from './layouts/ViewerLayout';
import { FileOperationLayout } from './layouts/FileOperationLayout';
import {
  useFolderNavigation,
  useRealtimeSync,
  useCoordinatorDownloads,
  useBatchOperations,
  useMediaFilter,
} from './hooks';
import { createNewFolder, renameFolder } from './api/folderApi';
import {
  getApiBaseUrl,
  isServerConfigured,
  getServerHost,
  validateCoordinatorHost,
} from './api/axiosConfig';
import './App.css';

function App() {
  // Server Configuration & Connection State
  const [, setApiBaseUrl] = useState(getApiBaseUrl());
  const [configVersion, setConfigVersion] = useState(0);
  const [showConfigModal, setShowConfigModal] = useState(!isServerConfigured());
  const [isConnected, setIsConnected] = useState(false);

  // Search & Viewer Modals State
  const [searchQuery, setSearchQuery] = useState('');
  const [lightbox, setLightbox] = useState(null);
  const [videoModalIndex, setVideoModalIndex] = useState(null);
  const [infoModalData, setInfoModalData] = useState({ isOpen: false, item: null, type: 'picture' });
  const [deleteModalData, setDeleteModalData] = useState({ isOpen: false, item: null, isFolder: false });

  // Folder Dialogs & Context Menu State
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showRenameFolderModal, setShowRenameFolderModal] = useState(false);
  const [targetFolder, setTargetFolder] = useState(null);
  const [contextMenu, setContextMenu] = useState({ isOpen: false, x: 0, y: 0, mode: 'empty', folder: null });

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState(null);
  const toastTimerRef = useRef(null);

  // 1. Navigation & Content Hook
  const {
    currentPath,
    setCurrentPath,
    updateUrlPath,
    drives,
    setDrives,
    loadDrives,
    activeDrive,
    handleSelectDrive,
    folders,
    setFolders,
    totalFolders,
    setTotalFolders,
    pictures,
    setPictures,
    totalPictures,
    setTotalPictures,
    videos,
    setVideos,
    totalVideos,
    setTotalVideos,
    treeData,
    loadTreeData,
    loading,
    isLoadingMore,
    errorInfo,
    setErrorInfo,
    loadData,
    handleNavigate,
    handleRefreshAll,
    hasMore,
    remainingCount,
    handleLoadMore,
    activeControllerRef,
  } = useFolderNavigation({
    configVersion,
    isConnected,
    setIsConnected,
    setShowConfigModal,
    searchQuery,
    setSearchQuery,
  });

  // 2. Media Filter & Search Hook
  const {
    fileTypeFilters,
    setFileTypeFilters,
    mxhFilters,
    setMxhFilters,
    filteredFolders,
    filteredPictures,
    filteredVideos,
    visibleFolders,
    visiblePictures,
    visibleVideos,
    hasContent,
  } = useMediaFilter({
    folders,
    pictures,
    videos,
    searchQuery,
  });

  // 3. Batch Operations & Selection Hook
  const {
    isSelectMode,
    selectedItems,
    batchModalState,
    setBatchModalState,
    conflictModalData,
    setConflictModalData,
    transferTasks,
    setTransferTasks,
    handleEnterSelectMode,
    handleExitSelectMode,
    handleToggleSelectItem,
    handleToggleSelectAllFolders,
    handleToggleSelectAllPictures,
    handleToggleSelectAllVideos,
    handleBatchCopy,
    handleBatchMove,
    handleBatchDelete,
    handleCopySingleItem,
    handleOpenMoveItem,
    handleExecuteBatch,
    handleResolveConflicts,
  } = useBatchOperations({
    activeDrive,
    currentPath,
    handleRefreshAll,
    loadData,
    loadTreeData,
    setFolders,
    setPictures,
    setVideos,
    setTotalFolders,
    setTotalPictures,
    setTotalVideos,
    updateUrlPath,
    setCurrentPath,
    visibleFolders,
    visiblePictures,
    visibleVideos,
  });

  // 4. Coordinator Downloads Hook
  const {
    downloadTasks,
    setDownloadTasks,
    downloadSummary,
    showDownloadPanel,
    setShowDownloadPanel,
    downloadPanelTab,
    setDownloadPanelTab,
    showDownloadMediafireModal,
    setShowDownloadMediafireModal,
    showDownloadMediaModal,
    setShowDownloadMediaModal,
    refreshCoordinatorDownloads,
    handleCoordinatorJobCreated,
    activeDownloadCount,
    downloadProgressPercent,
    isDownloadingMode,
    hasPasswordError,
    isScanning,
    isConverting,
  } = useCoordinatorDownloads({
    isConnected,
  });

  // 5. WebSocket Realtime Sync Hook
  useRealtimeSync({
    isConnected,
    configVersion,
    activeDrive,
    currentPath,
    setCurrentPath,
    updateUrlPath,
    setSearchQuery,
    loadTreeData,
    loadData,
    loadDrives,
    setDrives,
    setFolders,
    setPictures,
    setVideos,
    setTotalFolders,
    setTotalPictures,
    setTotalVideos,
    setTransferTasks,
    handleRefreshAll,
    refreshCoordinatorDownloads,
  });

  // Server Config Handlers
  const handleServerConfigSaved = () => {
    const baseUrl = getApiBaseUrl();
    setApiBaseUrl(baseUrl);
    setConfigVersion((prev) => prev + 1);
    updateUrlPath('');
    setCurrentPath('');
    setSearchQuery('');
    setIsConnected(true);
  };

  const handleServerConfigFailed = (message) => {
    if (activeControllerRef.current) activeControllerRef.current.abort();
    setIsConnected(false);
    setFolders([]);
    setPictures([]);
    setVideos([]);
    setTotalFolders(0);
    setTotalPictures(0);
    setTotalVideos(0);
    setErrorInfo({
      status: 'Lỗi kết nối máy chủ',
      message: message || 'Không thể kết nối đến Coordinator trên máy chủ vừa nhập.',
    });
  };

  useEffect(() => {
    let active = true;
    if (!isServerConfigured()) return () => { active = false; };
    validateCoordinatorHost(getServerHost()).then((result) => {
      if (!active) return;
      if (result.success) setIsConnected(true);
      else handleServerConfigFailed(result.message);
    });
    return () => { active = false; };
  }, [configVersion]);

  // Viewers & Modals Handlers
  const handleShowMediaInfo = (item, type) => {
    setInfoModalData({ isOpen: true, item, type });
  };

  const handleOpenDeleteItem = (item, isFolder = false) => {
    setDeleteModalData({ isOpen: true, item, isFolder });
  };

  const handleOpenVideo = useCallback((idx) => setVideoModalIndex(idx), []);
  const handleOpenLightbox = useCallback((idx) => setLightbox({ pictures: [...visiblePictures], index: idx }), [visiblePictures]);
  const handleDeleteMediaItem = useCallback((item) => handleOpenDeleteItem(item, false), []);

  // Context Menu Handlers
  const handleCloseContextMenu = () => {
    setContextMenu({ isOpen: false, x: 0, y: 0, mode: 'empty', folder: null });
  };

  const handleEmptyContextMenu = (e) => {
    if (!isConnected) return;
    e.preventDefault();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      mode: 'empty',
      folder: null,
    });
  };

  const handleFolderContextMenu = (e, folder) => {
    if (!isConnected) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      mode: 'folder',
      folder,
    });
  };

  // Folder Mutation Handlers
  const handleCreateFolderSubmit = async (arg1, arg2) => {
    if (!isConnected) return { success: false, message: 'Chưa kết nối máy chủ.' };
    let parentPath = currentPath;
    let folderName = arg1;
    if (arg2 !== undefined) {
      parentPath = arg1;
      folderName = arg2;
    }
    const res = await createNewFolder(parentPath, folderName);
    if (res.success) {
      await loadData(currentPath);
      loadTreeData().catch(() => {});
    }
    return res;
  };

  const handleRenameFolderSubmit = async (folder, newName) => {
    if (!isConnected) return { success: false, message: 'Chưa kết nối máy chủ.' };
    const res = await renameFolder(folder.path, newName);
    if (res.success) {
      await loadData(currentPath);
      loadTreeData().catch(() => {});
    }
    return res;
  };

  return (
    <div className="tahoe-app-wrapper app-layout-wrapper overflow-hidden">
      {/* Area 1: Left Column Sidebar */}
      <SidebarLayout
        currentPath={currentPath}
        treeData={treeData}
        folders={filteredFolders}
        onNavigate={handleNavigate}
        onFolderContextMenu={handleFolderContextMenu}
        onEmptyContextMenu={handleEmptyContextMenu}
        onOpenConfig={() => setShowConfigModal(true)}
        drives={drives}
        activeDrive={activeDrive}
        onSelectDrive={handleSelectDrive}
      />

      {/* Right Container: Header + Content Canvas */}
      <div className="app-main-column">
        {/* Area 2: Top Header Bar */}
        <HeaderLayout
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onRefresh={handleRefreshAll}
          loading={loading}
          isConnected={isConnected}
          onOpenDownloadPanel={() => setShowDownloadPanel(true)}
          activeDownloadCount={activeDownloadCount}
          downloadProgressPercent={downloadProgressPercent}
          isDownloadingMode={isDownloadingMode}
          hasPasswordError={hasPasswordError}
          isScanning={isScanning}
          isConverting={isConverting}
          isSelectMode={isSelectMode}
          onEnterSelectMode={handleEnterSelectMode}
          onExitSelectMode={handleExitSelectMode}
          selectedCount={selectedItems.size}
          onBatchCopy={handleBatchCopy}
          onBatchMove={handleBatchMove}
          onBatchDelete={handleBatchDelete}
          fileTypeFilters={fileTypeFilters}
          setFileTypeFilters={setFileTypeFilters}
          mxhFilters={mxhFilters}
          setMxhFilters={setMxhFilters}
        />

        {/* Area 3: Main Content Canvas */}
        <ContentLayout
          currentPath={currentPath}
          onNavigate={handleNavigate}
          totalFolders={searchQuery.trim() ? filteredFolders.length : totalFolders}
          totalPictures={searchQuery.trim() ? filteredPictures.length : totalPictures}
          totalVideos={searchQuery.trim() ? filteredVideos.length : totalVideos}
          activeDrive={activeDrive}
          onEmptyContextMenu={handleEmptyContextMenu}
          loading={loading}
          errorInfo={errorInfo}
          onRetry={handleRefreshAll}
          hasContent={hasContent}
          searchQuery={searchQuery}
          onClearSearch={() => setSearchQuery('')}
          visibleFolders={visibleFolders}
          visibleVideos={visibleVideos}
          visiblePictures={visiblePictures}
          isSelectMode={isSelectMode}
          selectedItems={selectedItems}
          onToggleSelectItem={handleToggleSelectItem}
          onToggleSelectAllFolders={handleToggleSelectAllFolders}
          onToggleSelectAllVideos={handleToggleSelectAllVideos}
          onToggleSelectAllPictures={handleToggleSelectAllPictures}
          onFolderContextMenu={handleFolderContextMenu}
          onOpenVideo={handleOpenVideo}
          onOpenLightbox={handleOpenLightbox}
          onShowMediaInfo={handleShowMediaInfo}
          onCopySingleItem={handleCopySingleItem}
          onOpenMoveItem={handleOpenMoveItem}
          onDeleteMediaItem={handleDeleteMediaItem}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          remainingCount={remainingCount}
          onLoadMore={handleLoadMore}
        />
      </div>

      {/* Area 4: Floating Action Button */}
      <FloatingActionLayout
        onCreateFolder={() => setShowCreateFolderModal(true)}
        onDownloadArchive={() => setShowDownloadMediafireModal(true)}
        onDownloadMedia={() => setShowDownloadMediaModal(true)}
        showCreateFolderModal={showCreateFolderModal}
        onCloseCreateFolderModal={() => setShowCreateFolderModal(false)}
        onCreateFolderSubmit={handleCreateFolderSubmit}
        showDownloadMediafireModal={showDownloadMediafireModal}
        onCloseDownloadMediafireModal={() => setShowDownloadMediafireModal(false)}
        onDownloadMediafireSuccess={(job) => {
          handleCoordinatorJobCreated(job);
          setDownloadPanelTab('active');
          setShowDownloadPanel(true);
        }}
        showDownloadMediaModal={showDownloadMediaModal}
        onCloseDownloadMediaModal={() => setShowDownloadMediaModal(false)}
        downloadTasks={downloadTasks}
        onCoordinatorJobCreated={handleCoordinatorJobCreated}
        onOpenSettings={() => setShowConfigModal(true)}
        currentPath={currentPath}
        treeData={treeData}
        activeDrive={activeDrive}
      />

      {/* Area 5: Settings & Connection Management */}
      <SettingsLayout
        showConfigModal={showConfigModal}
        onCloseConfigModal={() => setShowConfigModal(false)}
        onRefresh={handleRefreshAll}
        onServerConfigSaved={handleServerConfigSaved}
        onServerConfigFailed={handleServerConfigFailed}
      />

      {/* Area 6: Downloads & Notification */}
      <DownloadLayout
        showDownloadPanel={showDownloadPanel}
        onCloseDownloadPanel={() => setShowDownloadPanel(false)}
        downloadTasks={downloadTasks}
        downloadPanelTab={downloadPanelTab}
        onSelectedTabChange={setDownloadPanelTab}
        onOpenAddModal={() => {
          setShowDownloadPanel(false);
          setShowDownloadMediafireModal(true);
        }}
        onDeleteTask={(taskId) => {
          setDownloadTasks((prev) => prev.filter((t) => t.task_id !== taskId));
        }}
        transferTasks={transferTasks}
        downloadSummary={downloadSummary}
        onOpenDownloadPanel={() => setShowDownloadPanel(true)}
      />

      {/* Area 7: Context Menus */}
      <ContextMenuLayout
        contextMenu={contextMenu}
        onClose={handleCloseContextMenu}
        onCreateFolder={() => setShowCreateFolderModal(true)}
        onRenameFolder={(folder) => {
          setTargetFolder(folder);
          setShowRenameFolderModal(true);
        }}
        onCopyFolder={(folder) => {
          handleCopySingleItem(folder, 'folder');
        }}
        onMoveFolder={(folder) => {
          handleOpenMoveItem(folder, 'folder');
        }}
        onDeleteFolder={(folder) => {
          handleOpenDeleteItem(folder, true);
        }}
        onRefresh={handleRefreshAll}
      />

      {/* Area 8: Notifications, System Alerts & Feedback */}
      <NotificationLayout
        isConnected={isConnected}
        showConfigModal={showConfigModal}
        onOpenConfig={() => setShowConfigModal(true)}
        conflictModalData={conflictModalData}
        onResolveConflicts={handleResolveConflicts}
        onCloseConflictModal={() =>
          setConflictModalData({ isOpen: false, conflicts: [], action: 'copy', pendingBatch: null })
        }
        deleteModalData={deleteModalData}
        onCloseDeleteModal={() => setDeleteModalData({ isOpen: false, item: null, isFolder: false })}
        onDeleteSuccess={(item, isFolder) => {
          const normalize = (p) => (p || '').replace(/^\/+|\/+$/g, '');
          if (isFolder) {
            loadTreeData();
            setFolders((prev) => prev.filter((f) => normalize(f.path) !== normalize(item?.path)));
            setTotalFolders((c) => Math.max(0, c - 1));
          } else {
            const norm = normalize(item?.path || item?.name);
            setPictures((prev) => {
              const next = prev.filter((p) => normalize(p.path || p.name) !== norm);
              if (next.length !== prev.length) setTotalPictures((c) => Math.max(0, c - 1));
              return next;
            });
            setVideos((prev) => {
              const next = prev.filter((v) => normalize(v.path || v.name) !== norm);
              if (next.length !== prev.length) setTotalVideos((c) => Math.max(0, c - 1));
              return next;
            });
          }
        }}
        toastMessage={toastMessage}
      />

      {/* Area 9: Media Viewers & Player Modals */}
      <ViewerLayout
        lightbox={lightbox}
        onCloseLightbox={() => setLightbox(null)}
        onSelectLightboxIndex={(newIdx) =>
          setLightbox((current) => (current ? { ...current, index: newIdx } : current))
        }
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={handleLoadMore}
        videoModalIndex={videoModalIndex}
        videos={filteredVideos}
        onCloseVideoModal={() => setVideoModalIndex(null)}
        onSelectVideoIndex={(newIdx) => setVideoModalIndex(newIdx)}
        infoModalData={infoModalData}
        onCloseInfoModal={() => setInfoModalData((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Area 10: File Operations & Batch Dialogs */}
      <FileOperationLayout
        showRenameFolderModal={showRenameFolderModal}
        onCloseRenameFolderModal={() => setShowRenameFolderModal(false)}
        targetFolder={targetFolder}
        onRenameFolderSubmit={handleRenameFolderSubmit}
        batchModalState={batchModalState}
        onCloseBatchModal={() => setBatchModalState({ isOpen: false, action: null, items: [] })}
        selectedItems={selectedItems}
        treeData={treeData}
        currentPath={currentPath}
        drives={drives}
        activeDrive={activeDrive}
        onConfirmBatch={handleExecuteBatch}
      />
    </div>
  );
}

export default App;
