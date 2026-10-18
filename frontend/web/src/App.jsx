import { useState, useEffect, useCallback, useMemo } from 'react';
import { SidebarLayout } from './layouts/SidebarLayout';
import { NavigationProvider } from './contexts/NavigationContext';
import { HeaderLayout } from './layouts/HeaderLayout';
import { ContentLayout } from './layouts/ContentLayout';
import { ContentProvider } from './contexts/ContentContext';
import { FloatingActionLayout } from './layouts/FloatingActionLayout';
import { FloatingActionProvider } from './contexts/FloatingActionContext';
import { SettingsLayout } from './layouts/SettingsLayout';
import { SettingsProvider } from './contexts/SettingsContext';
import { DownloadLayout } from './layouts/DownloadLayout';
import { DownloadProvider } from './contexts/DownloadContext';
import { ContextMenuLayout } from './layouts/ContextMenuLayout';
import { ContextMenuProvider } from './contexts/ContextMenuContext';
import { NotificationLayout } from './layouts/NotificationLayout';
import { NotificationProvider } from './contexts/NotificationContext';
import { ViewerLayout } from './layouts/ViewerLayout';
import { ViewerProvider } from './contexts/ViewerContext';
import { FileOperationLayout } from './layouts/FileOperationLayout';
import { FileOperationProvider } from './contexts/FileOperationContext';
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
  const [toastMessage] = useState(null);

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
  const handleServerConfigSaved = useCallback(() => {
    const baseUrl = getApiBaseUrl();
    setApiBaseUrl(baseUrl);
    setConfigVersion((prev) => prev + 1);
    updateUrlPath('');
    setCurrentPath('');
    setSearchQuery('');
    setIsConnected(true);
  }, [updateUrlPath, setCurrentPath, setSearchQuery]);

  const handleServerConfigFailed = useCallback((message) => {
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
  }, [activeControllerRef, setErrorInfo, setFolders, setPictures, setTotalFolders, setTotalPictures, setTotalVideos, setVideos]);

  useEffect(() => {
    let active = true;
    if (!isServerConfigured()) return () => { active = false; };
    validateCoordinatorHost(getServerHost()).then((result) => {
      if (!active) return;
      if (result.success) setIsConnected(true);
      else handleServerConfigFailed(result.message);
    });
    return () => { active = false; };
  }, [configVersion, handleServerConfigFailed]);

  // Viewers & Modals Handlers
  const handleShowMediaInfo = useCallback((item, type) => {
    setInfoModalData({ isOpen: true, item, type });
  }, []);

  const handleOpenDeleteItem = useCallback((item, isFolder = false) => {
    setDeleteModalData({ isOpen: true, item, isFolder });
  }, []);

  const handleOpenVideo = useCallback((idx) => setVideoModalIndex(idx), []);
  const handleOpenLightbox = useCallback((idx) => setLightbox({ pictures: [...visiblePictures], index: idx }), [visiblePictures]);
  const handleDeleteMediaItem = useCallback((item) => handleOpenDeleteItem(item, false), [handleOpenDeleteItem]);

  const handleDeleteSuccess = useCallback((item, isFolder) => {
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
  }, [loadTreeData, setFolders, setPictures, setTotalFolders, setTotalPictures, setTotalVideos, setVideos]);

  // Context Menu Handlers
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu({ isOpen: false, x: 0, y: 0, mode: 'empty', folder: null });
  }, []);

  const handleEmptyContextMenu = useCallback((e) => {
    if (!isConnected) return;
    e.preventDefault();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      mode: 'empty',
      folder: null,
    });
  }, [isConnected]);

  const handleFolderContextMenu = useCallback((e, folder) => {
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
  }, [isConnected]);

  // Folder Mutation Handlers
  const handleCreateFolderSubmit = useCallback(async (arg1, arg2) => {
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
  }, [isConnected, currentPath, loadData, loadTreeData]);

  const handleRenameFolderSubmit = useCallback(async (folder, newName) => {
    if (!isConnected) return { success: false, message: 'Chưa kết nối máy chủ.' };
    const res = await renameFolder(folder.path, newName);
    if (res.success) {
      await loadData(currentPath);
      loadTreeData().catch(() => {});
    }
    return res;
  }, [isConnected, currentPath, loadData, loadTreeData]);

  const navigationValue = useMemo(() => ({
    // Navigation & Sidebar
    currentPath,
    treeData,
    folders,
    drives,
    activeDrive,
    handleNavigate,
    handleSelectDrive,
    handleFolderContextMenu,
    handleEmptyContextMenu,
    handleOpenConfig: () => setShowConfigModal(true),
    onOpenConfig: () => setShowConfigModal(true),

    // Header Search, Filter, Download & Select Mode
    searchQuery,
    setSearchQuery,
    onOpenDownloadPanel: () => setShowDownloadPanel(true),
    activeDownloadCount,
    downloadProgressPercent,
    isDownloadingMode,
    hasPasswordError,
    isScanning,
    isConverting,
    isSelectMode,
    onEnterSelectMode: handleEnterSelectMode,
    onExitSelectMode: handleExitSelectMode,
    selectedCount: selectedItems.size,
    onBatchCopy: handleBatchCopy,
    onBatchMove: handleBatchMove,
    onBatchDelete: handleBatchDelete,
    fileTypeFilters,
    setFileTypeFilters,
    mxhFilters,
    setMxhFilters,
  }), [
    currentPath,
    treeData,
    folders,
    drives,
    activeDrive,
    handleNavigate,
    handleSelectDrive,
    handleFolderContextMenu,
    handleEmptyContextMenu,
    setShowConfigModal,
    searchQuery,
    setSearchQuery,
    setShowDownloadPanel,
    activeDownloadCount,
    downloadProgressPercent,
    isDownloadingMode,
    hasPasswordError,
    isScanning,
    isConverting,
    isSelectMode,
    handleEnterSelectMode,
    handleExitSelectMode,
    selectedItems.size,
    handleBatchCopy,
    handleBatchMove,
    handleBatchDelete,
    fileTypeFilters,
    setFileTypeFilters,
    mxhFilters,
    setMxhFilters,
  ]);


  const handleClearSearch = useCallback(() => setSearchQuery(''), [setSearchQuery]);

  const contentValue = useMemo(() => ({
    currentPath,
    onNavigate: handleNavigate,
    totalFolders: searchQuery.trim() ? filteredFolders.length : totalFolders,
    totalPictures: searchQuery.trim() ? filteredPictures.length : totalPictures,
    totalVideos: searchQuery.trim() ? filteredVideos.length : totalVideos,
    activeDrive,
    onEmptyContextMenu: handleEmptyContextMenu,
    loading,
    errorInfo,
    onRetry: handleRefreshAll,
    hasContent,
    searchQuery,
    onClearSearch: handleClearSearch,
    visibleFolders,
    visibleVideos,
    visiblePictures,
    isSelectMode,
    selectedItems,
    onToggleSelectItem: handleToggleSelectItem,
    onToggleSelectAllFolders: handleToggleSelectAllFolders,
    onToggleSelectAllVideos: handleToggleSelectAllVideos,
    onToggleSelectAllPictures: handleToggleSelectAllPictures,
    onFolderContextMenu: handleFolderContextMenu,
    onOpenVideo: handleOpenVideo,
    onOpenLightbox: handleOpenLightbox,
    onShowMediaInfo: handleShowMediaInfo,
    onCopySingleItem: handleCopySingleItem,
    onOpenMoveItem: handleOpenMoveItem,
    onDeleteMediaItem: handleDeleteMediaItem,
    hasMore,
    isLoadingMore,
    remainingCount,
    onLoadMore: handleLoadMore,
  }), [
    currentPath,
    handleNavigate,
    searchQuery,
    filteredFolders.length,
    totalFolders,
    filteredPictures.length,
    totalPictures,
    filteredVideos.length,
    totalVideos,
    activeDrive,
    handleEmptyContextMenu,
    loading,
    errorInfo,
    handleRefreshAll,
    hasContent,
    handleClearSearch,
    visibleFolders,
    visibleVideos,
    visiblePictures,
    isSelectMode,
    selectedItems,
    handleToggleSelectItem,
    handleToggleSelectAllFolders,
    handleToggleSelectAllVideos,
    handleToggleSelectAllPictures,
    handleFolderContextMenu,
    handleOpenVideo,
    handleOpenLightbox,
    handleShowMediaInfo,
    handleCopySingleItem,
    handleOpenMoveItem,
    handleDeleteMediaItem,
    hasMore,
    isLoadingMore,
    remainingCount,
    handleLoadMore,
  ]);

  const floatingActionValue = useMemo(() => ({
    onCreateFolder: () => setShowCreateFolderModal(true),
    onDownloadArchive: () => setShowDownloadMediafireModal(true),
    onDownloadMedia: () => setShowDownloadMediaModal(true),
    showCreateFolderModal,
    onCloseCreateFolderModal: () => setShowCreateFolderModal(false),
    onCreateFolderSubmit: handleCreateFolderSubmit,
    showDownloadMediafireModal,
    onCloseDownloadMediafireModal: () => setShowDownloadMediafireModal(false),
    onDownloadMediafireSuccess: (job) => {
      handleCoordinatorJobCreated(job);
      setDownloadPanelTab('active');
      setShowDownloadPanel(true);
    },
    showDownloadMediaModal,
    onCloseDownloadMediaModal: () => setShowDownloadMediaModal(false),
    downloadTasks,
    onCoordinatorJobCreated: handleCoordinatorJobCreated,
    onOpenSettings: () => setShowConfigModal(true),
    currentPath,
    treeData,
    activeDrive,
  }), [
    showCreateFolderModal,
    handleCreateFolderSubmit,
    showDownloadMediafireModal,
    setShowDownloadMediafireModal,
    handleCoordinatorJobCreated,
    setDownloadPanelTab,
    setShowDownloadPanel,
    showDownloadMediaModal,
    setShowDownloadMediaModal,
    downloadTasks,
    setShowConfigModal,
    currentPath,
    treeData,
    activeDrive,
  ]);

  const settingsValue = useMemo(() => ({
    showConfigModal,
    onCloseConfigModal: () => setShowConfigModal(false),
    onRefresh: handleRefreshAll,
    onServerConfigSaved: handleServerConfigSaved,
    onServerConfigFailed: handleServerConfigFailed,
  }), [
    showConfigModal,
    handleRefreshAll,
    handleServerConfigSaved,
    handleServerConfigFailed,
  ]);

  const downloadValue = useMemo(() => ({
    showDownloadPanel,
    onCloseDownloadPanel: () => setShowDownloadPanel(false),
    downloadTasks,
    downloadPanelTab,
    onSelectedTabChange: setDownloadPanelTab,
    onOpenAddModal: () => {
      setShowDownloadPanel(false);
      setShowDownloadMediafireModal(true);
    },
    onDeleteTask: (taskId) => {
      setDownloadTasks((prev) => prev.filter((t) => t.task_id !== taskId));
    },
    transferTasks,
    downloadSummary,
    onOpenDownloadPanel: () => setShowDownloadPanel(true),
  }), [
    showDownloadPanel,
    setShowDownloadPanel,
    downloadTasks,
    downloadPanelTab,
    setDownloadPanelTab,
    setShowDownloadMediafireModal,
    setDownloadTasks,
    transferTasks,
    downloadSummary,
  ]);

  const contextMenuValue = useMemo(() => ({
    contextMenu,
    onClose: handleCloseContextMenu,
    onCreateFolder: () => setShowCreateFolderModal(true),
    onRenameFolder: (folder) => {
      setTargetFolder(folder);
      setShowRenameFolderModal(true);
    },
    onCopyFolder: (folder) => {
      handleCopySingleItem(folder, 'folder');
    },
    onMoveFolder: (folder) => {
      handleOpenMoveItem(folder, 'folder');
    },
    onDeleteFolder: (folder) => {
      handleOpenDeleteItem(folder, true);
    },
    onRefresh: handleRefreshAll,
  }), [
    contextMenu,
    handleCloseContextMenu,
    setShowCreateFolderModal,
    setTargetFolder,
    setShowRenameFolderModal,
    handleCopySingleItem,
    handleOpenMoveItem,
    handleOpenDeleteItem,
    handleRefreshAll,
  ]);

  const notificationValue = useMemo(() => ({
    isConnected,
    showConfigModal,
    onOpenConfig: () => setShowConfigModal(true),
    conflictModalData,
    onResolveConflicts: handleResolveConflicts,
    onCloseConflictModal: () =>
      setConflictModalData({ isOpen: false, conflicts: [], action: 'copy', pendingBatch: null }),
    deleteModalData,
    onCloseDeleteModal: () => setDeleteModalData({ isOpen: false, item: null, isFolder: false }),
    onDeleteSuccess: handleDeleteSuccess,
    toastMessage,
  }), [
    isConnected,
    showConfigModal,
    setShowConfigModal,
    conflictModalData,
    handleResolveConflicts,
    setConflictModalData,
    deleteModalData,
    setDeleteModalData,
    handleDeleteSuccess,
    toastMessage,
  ]);

  const viewerValue = useMemo(() => ({
    lightbox,
    onCloseLightbox: () => setLightbox(null),
    onSelectLightboxIndex: (newIdx) =>
      setLightbox((current) => (current ? { ...current, index: newIdx } : current)),
    hasMore,
    isLoadingMore,
    onLoadMore: handleLoadMore,
    videoModalIndex,
    videos: filteredVideos,
    onCloseVideoModal: () => setVideoModalIndex(null),
    onSelectVideoIndex: (newIdx) => setVideoModalIndex(newIdx),
    infoModalData,
    onCloseInfoModal: () => setInfoModalData((prev) => ({ ...prev, isOpen: false })),
  }), [
    lightbox,
    hasMore,
    isLoadingMore,
    handleLoadMore,
    videoModalIndex,
    filteredVideos,
    infoModalData,
  ]);

  const fileOperationValue = useMemo(() => ({
    showRenameFolderModal,
    onCloseRenameFolderModal: () => setShowRenameFolderModal(false),
    targetFolder,
    onRenameFolderSubmit: handleRenameFolderSubmit,
    batchModalState,
    onCloseBatchModal: () => setBatchModalState({ isOpen: false, action: null, items: [] }),
    selectedItems,
    treeData,
    currentPath,
    drives,
    activeDrive,
    onConfirmBatch: handleExecuteBatch,
  }), [
    showRenameFolderModal,
    setShowRenameFolderModal,
    targetFolder,
    handleRenameFolderSubmit,
    batchModalState,
    setBatchModalState,
    selectedItems,
    treeData,
    currentPath,
    drives,
    activeDrive,
    handleExecuteBatch,
  ]);

  return (
    <NavigationProvider value={navigationValue}>
      <div className="tahoe-app-wrapper app-layout-wrapper overflow-hidden">
        {/* Area 1: Left Column Sidebar */}
        <SidebarLayout />

        {/* Right Container: Header + Content Canvas */}
        <div className="app-main-column">
          {/* Area 2: Top Header Bar */}
          <HeaderLayout />


          {/* Area 3: Main Content Canvas */}
          <ContentProvider value={contentValue}>
            <ContentLayout />
          </ContentProvider>
        </div>

        {/* Area 4: Floating Action Button */}
        <FloatingActionProvider value={floatingActionValue}>
          <FloatingActionLayout />
        </FloatingActionProvider>

        {/* Area 5: Settings & Connection Management */}
        <SettingsProvider value={settingsValue}>
          <SettingsLayout />
        </SettingsProvider>

        {/* Area 6: Downloads & Notification */}
        <DownloadProvider value={downloadValue}>
          <DownloadLayout />
        </DownloadProvider>

        {/* Area 7: Context Menus */}
        <ContextMenuProvider value={contextMenuValue}>
          <ContextMenuLayout />
        </ContextMenuProvider>

        {/* Area 8: Notifications, System Alerts & Feedback */}
        <NotificationProvider value={notificationValue}>
          <NotificationLayout />
        </NotificationProvider>

        {/* Area 9: Media Viewers & Player Modals */}
        <ViewerProvider value={viewerValue}>
          <ViewerLayout />
        </ViewerProvider>

        {/* Area 10: File Operations & Batch Dialogs */}
        <FileOperationProvider value={fileOperationValue}>
          <FileOperationLayout />
        </FileOperationProvider>
      </div>
    </NavigationProvider>
  );


}

export default App;
