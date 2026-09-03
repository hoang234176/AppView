import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FolderTreeSidebar } from './components/FolderTreeSidebar';
import { Header } from './components/Header';
import { Breadcrumbs } from './components/Breadcrumbs';
import { FolderGrid } from './components/FolderGrid';
import { PictureGrid } from './components/PictureGrid';
import { VideoGrid } from './components/VideoGrid';
import { LightboxModal } from './components/LightboxModal';
import { VideoPlayerModal } from './components/VideoPlayerModal';
import { ErrorState } from './components/ErrorState';
import { LoadingSkeleton } from './components/LoadingSkeleton';
import { MobileNav } from './components/MobileNav';
import { CreateFolderModal } from './components/CreateFolderModal';
import { RenameFolderModal } from './components/RenameFolderModal';
import { MoveItemModal } from './components/MoveItemModal';
import { MediaInfoModal } from './components/MediaInfoModal';
import { DeleteModal } from './components/DeleteModal';
import { ContextMenu } from './components/ContextMenu';
import { FabSpeedDial } from './components/FabSpeedDial';
import { SettingsModal } from './components/SettingsModal';
import { DownloadMediafireModal } from './components/DownloadMediafireModal';
import { DownloadPanelModal } from './components/DownloadPanelModal';
import { DownloadSnackbar } from './components/DownloadSnackbar';
import { fetchFolderContents, fetchFolderTree, createNewFolder, renameFolder } from './api/folderApi';
import { fetchCoordinatorDownload } from './api/downloadApi';
import { getApiBaseUrl, saveServerConfig, isServerConfigured } from './api/axiosConfig';
import { FolderX, Loader2 } from 'lucide-react';
import './styles/index.css';

function App() {
  const getInitialPathFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('path') || '';
  };

  const [currentPath, setCurrentPath] = useState(getInitialPathFromUrl);
  const [folders, setFolders] = useState([]);
  const [pictures, setPictures] = useState([]);
  const [videos, setVideos] = useState([]);
  const [totalFolders, setTotalFolders] = useState(0);
  const [totalPictures, setTotalPictures] = useState(0);
  const [totalVideos, setTotalVideos] = useState(0);
  const [treeData, setTreeData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [errorInfo, setErrorInfo] = useState(null);
  const [isConnected, setIsConnected] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [videoModalIndex, setVideoModalIndex] = useState(null);
  
  const [apiBaseUrl, setApiBaseUrl] = useState(getApiBaseUrl());
  const [configVersion, setConfigVersion] = useState(0);
  const [showConfigModal, setShowConfigModal] = useState(!isServerConfigured());
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showRenameFolderModal, setShowRenameFolderModal] = useState(false);
  const [targetFolder, setTargetFolder] = useState(null);
  const [infoModalData, setInfoModalData] = useState({ isOpen: false, item: null, type: 'picture' });
  const [moveModalData, setMoveModalData] = useState({ isOpen: false, item: null });
  const [deleteModalData, setDeleteModalData] = useState({ isOpen: false, item: null, isFolder: false });

  // Download Service State
  const [downloadTasks, setDownloadTasks] = useState([]);
  const [downloadSummary, setDownloadSummary] = useState(null);
  const [showDownloadPanel, setShowDownloadPanel] = useState(false);
  const [downloadPanelTab, setDownloadPanelTab] = useState('active');
  const [showDownloadMediafireModal, setShowDownloadMediafireModal] = useState(false);
  const coordinatorPollersRef = useRef(new Map());
  const isMountedRef = useRef(true);

  const PAGE_SIZE = 20;
  const [folderLimit, setFolderLimit] = useState(PAGE_SIZE);
  const [pictureLimit, setPictureLimit] = useState(PAGE_SIZE);
  const [videoLimit, setVideoLimit] = useState(PAGE_SIZE);

  useEffect(() => {
    setFolderLimit(PAGE_SIZE);
    setPictureLimit(PAGE_SIZE);
    setVideoLimit(PAGE_SIZE);
  }, [currentPath, searchQuery]);

  const handleShowMediaInfo = (item, type) => {
    setInfoModalData({ isOpen: true, item, type });
  };

  const handleOpenMoveItem = (item) => {
    setMoveModalData({ isOpen: true, item });
  };

  const handleOpenDeleteItem = (item, isFolder = false) => {
    setDeleteModalData({ isOpen: true, item, isFolder });
  };

  const [contextMenu, setContextMenu] = useState({ isOpen: false, x: 0, y: 0, mode: 'empty', folder: null });

  const handleCloseContextMenu = () => {
    setContextMenu({ isOpen: false, x: 0, y: 0, mode: 'empty', folder: null });
  };

  const activeControllerRef = useRef(null);

  const updateUrlPath = (path) => {
    const url = new URL(window.location.href);
    if (path && path.trim() !== '') {
      url.searchParams.set('path', path);
    } else {
      url.searchParams.delete('path');
    }
    window.history.pushState({ path }, '', url.toString());
  };

  const handleSaveServerConfig = (ip, port, folderPath) => {
    const { baseUrl } = saveServerConfig(ip, port, folderPath);
    setApiBaseUrl(baseUrl);
    setConfigVersion((prev) => prev + 1);
    updateUrlPath('');
    setCurrentPath('');
    setSearchQuery('');
  };

  useEffect(() => {
    const handlePopState = () => {
      const pathFromUrl = new URLSearchParams(window.location.search).get('path') || '';
      setCurrentPath(pathFromUrl);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const loadTreeData = useCallback(async () => {
    if (!isServerConfigured()) {
      setTreeData([]);
      setIsConnected(false);
      return;
    }
    const result = await fetchFolderTree();
    if (result.success) {
      setTreeData(result.data || []);
      setIsConnected(true);
    } else {
      setTreeData([]);
      setIsConnected(false);
    }
  }, []);

  const loadData = useCallback(async (path = currentPath, opts = {}, isSilent = false) => {
    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
    }
    const controller = new AbortController();
    activeControllerRef.current = controller;

    if (!isSilent) {
      setLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    setErrorInfo(null);

    if (!isServerConfigured()) {
      setFolders([]);
      setPictures([]);
      setVideos([]);
      setTotalFolders(0);
      setTotalPictures(0);
      setTotalVideos(0);
      setLoading(false);
      setIsLoadingMore(false);
      setIsConnected(false);
      setErrorInfo({
        status: 'Chưa cấu hình máy chủ',
        message: 'Vui lòng nhập đầy đủ IP, Cổng (Port) và Đường dẫn thư mục gốc (Root Path) trong bảng cấu hình máy chủ để bắt đầu.',
      });
      setShowConfigModal(true);
      return;
    }

    try {
      const queryOpts = {
        limit: opts.limit !== undefined ? opts.limit : 0,
        page: opts.page || 1,
      };

      const result = await fetchFolderContents(path, queryOpts, controller.signal);

      if (controller.signal.aborted || result.canceled) {
        return;
      }

      if (result.success) {
        if (isSilent) {
          setFolders((prev) => {
            const existing = new Set(prev.map((f) => f.path || f.name));
            const newItems = (result.data.folders || []).filter((f) => !existing.has(f.path || f.name));
            return [...prev, ...newItems];
          });
          setPictures((prev) => {
            const existing = new Set(prev.map((p) => p.path || p.name));
            const newItems = (result.data.pictures || []).filter((p) => !existing.has(p.path || p.name));
            return [...prev, ...newItems];
          });
          setVideos((prev) => {
            const existing = new Set(prev.map((v) => v.path || v.name));
            const newItems = (result.data.videos || []).filter((v) => !existing.has(v.path || v.name));
            return [...prev, ...newItems];
          });
        } else {
          setFolders(result.data.folders || []);
          setPictures(result.data.pictures || []);
          setVideos(result.data.videos || []);
        }
        setTotalFolders(result.data.totalFolders ?? (result.data.folders || []).length);
        setTotalPictures(result.data.totalPictures ?? (result.data.pictures || []).length);
        setTotalVideos(result.data.totalVideos ?? (result.data.videos || []).length);
        setIsConnected(true);
        setErrorInfo(null);
      } else {
        if (!isSilent) {
          setFolders([]);
          setPictures([]);
          setVideos([]);
          setTotalFolders(0);
          setTotalPictures(0);
          setTotalVideos(0);
        }
        setErrorInfo(result);
        setIsConnected(false);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setErrorInfo({ status: 500, message: 'Lỗi tải dữ liệu' });
        setIsConnected(false);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, [currentPath]);

  useEffect(() => {
    loadTreeData();
  }, [configVersion, loadTreeData]);

  useEffect(() => {
    loadData(currentPath, { limit: 0 }, false);
  }, [currentPath, configVersion, loadData]);

  // Coordinator jobs are polled individually. The legacy Python WebSocket is
  // deliberately not used for normal submissions: the parent job is the
  // client-facing source of truth for resolve/download completion and errors.
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      coordinatorPollersRef.current.forEach((timer) => window.clearTimeout(timer));
      coordinatorPollersRef.current.clear();
    };
  }, []);

  const mapCoordinatorJob = useCallback((job) => {
    const progress = job.progress && typeof job.progress === 'object' ? job.progress : {};
    const downloadedBytes = Number(progress.downloadedBytes) || 0;
    const totalBytes = Number(progress.totalBytes) || 0;
    const stage = job.state === 'downloading' ? (progress.state || 'downloading') : job.state === 'failed' ? 'error' : job.state;
    return {
      task_id: job.id,
      original_url: job.url,
      filename: job.filename || progress.filename || '',
      destination: job.destination || '',
      stage,
      downloaded_bytes: downloadedBytes,
      download_total_bytes: totalBytes || null,
      download_percent: totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : null,
      download_speed_bytes: Number(progress.speedBytes) || 0,
      extracted_percent: progress.extractedPercent ?? null,
      convert_total: Number(progress.conversion?.total) || 0,
      convert_current: Number(progress.conversion?.current) || 0,
      error: job.error?.message || null,
      error_code: job.error?.code || null,
      failure_stage: job.failureStage || null,
      coordinator_job: true,
    };
  }, []);

  const pollCoordinatorJob = useCallback((jobId) => {
    const poll = async () => {
      const response = await fetchCoordinatorDownload(jobId);
      if (!isMountedRef.current) return;
      if (!response.success) {
        setDownloadTasks((previous) => previous.map((task) => task.task_id === jobId
          ? { ...task, stage: 'error', error: response.message, error_code: 'COORDINATOR_POLL_FAILED', coordinator_job: true }
          : task));
        coordinatorPollersRef.current.delete(jobId);
        return;
      }
      const task = mapCoordinatorJob(response.data);
      setDownloadTasks((previous) => [task, ...previous.filter((item) => item.task_id !== jobId)]);
      if (response.data.state === 'completed' || response.data.state === 'failed') {
        coordinatorPollersRef.current.delete(jobId);
        if (response.data.state === 'completed') {
          loadData(currentPath);
          loadTreeData();
        }
        return;
      }
      coordinatorPollersRef.current.set(jobId, window.setTimeout(poll, 1000));
    };
    poll();
  }, [currentPath, loadData, loadTreeData, mapCoordinatorJob]);

  const handleCoordinatorJobCreated = useCallback((job) => {
    if (!job?.id || coordinatorPollersRef.current.has(job.id)) return;
    const task = mapCoordinatorJob(job);
    setDownloadTasks((previous) => [task, ...previous.filter((item) => item.task_id !== job.id)]);
    pollCoordinatorJob(job.id);
  }, [mapCoordinatorJob, pollCoordinatorJob]);

  const handleNavigate = (newPath) => {
    if (newPath === currentPath) return;
    updateUrlPath(newPath);
    setCurrentPath(newPath);
    setSearchQuery('');
  };

  const handleRefreshAll = () => {
    loadTreeData();
    loadData(currentPath);
  };

  const handleEmptyContextMenu = (e) => {
    e.preventDefault();
    if (e.target.closest('input, button, a, img, video')) {
      return;
    }

    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      mode: 'empty',
      folder: null,
    });
  };

  const handleFolderContextMenu = (e, folder) => {
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

  const handleCreateFolderSubmit = async (arg1, arg2) => {
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
    const res = await renameFolder(folder.path, newName);
    if (res.success) {
      await loadData(currentPath);
      loadTreeData().catch(() => {});
    }
    return res;
  };

  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return folders;
    return folders.filter((f) => 
      f.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.path?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [folders, searchQuery]);

  const filteredPictures = useMemo(() => {
    if (!searchQuery.trim()) return pictures;
    return pictures.filter((p) => 
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.path?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [pictures, searchQuery]);

  const filteredVideos = useMemo(() => {
    if (!searchQuery.trim()) return videos;
    return videos.filter((v) => 
      v.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.path?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [videos, searchQuery]);

  const visibleFolders = filteredFolders;
  const visiblePictures = filteredPictures;
  const visibleVideos = filteredVideos;

  const hasMore = (totalFolders > folders.length) || (totalPictures > pictures.length) || (totalVideos > videos.length);

  const remainingCount = Math.max(0, totalFolders - folders.length) + 
                         Math.max(0, totalPictures - pictures.length) + 
                         Math.max(0, totalVideos - videos.length);

  const handleLoadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    loadData(currentPath, { page: nextPage, limit: PAGE_SIZE }, true);
  }, [page, currentPath, loadData, isLoadingMore, hasMore]);

  // Auto-prefetch next page when scrolling near bottom of page
  useEffect(() => {
    const handleScroll = () => {
      if (!hasMore || isLoadingMore || loading) return;
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 800) {
        handleLoadMore();
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasMore, isLoadingMore, loading, handleLoadMore]);

  const hasContent = filteredFolders.length > 0 || filteredPictures.length > 0 || filteredVideos.length > 0;

  // Active Download Status Metrics for Header Icon
  const activeDownloadCount = downloadTasks.filter((t) => ['queued', 'resolving', 'downloading', 'waiting_extract', 'extracting', 'scanning', 'converting', 'password_required'].includes(t.stage)).length;
  // Summary có thể đến chậm hơn WebSocket. Luôn lấy task thật làm fallback để
  // animation mũi tên Header xuất hiện ngay từ lúc Go bắt đầu tải.
  const downloadingTask = downloadTasks.find((t) => t.stage === 'downloading');
  const isDownloadingMode = Boolean(downloadingTask);
  const downloadProgressPercent = isDownloadingMode 
    ? (downloadingTask?.download_percent ?? 0)
    : 0;
  const hasPasswordError = downloadTasks.some((t) => t.stage === 'password_required');
  const isScanning = downloadTasks.some((t) => t.stage === 'scanning');
  const isConverting = downloadTasks.some((t) => t.stage === 'converting');

  return (
    <div className="tahoe-app-wrapper overflow-hidden">
      
      {/* Sidebar */}
      <FolderTreeSidebar
        currentPath={currentPath}
        treeData={treeData}
        folders={filteredFolders}
        onNavigate={handleNavigate}
        onOpenConfig={() => setShowConfigModal(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden gap-2">
        
        {/* Header */}
        <Header
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onRefresh={handleRefreshAll}
          loading={loading}
          isConnected={isConnected}
          onSaveServerConfig={handleSaveServerConfig}
          showConfigModal={showConfigModal}
          setShowConfigModal={setShowConfigModal}
          onOpenMobileTree={() => setIsMobileDrawerOpen(true)}
          onOpenDownloadPanel={() => setShowDownloadPanel(true)}
          activeDownloadCount={activeDownloadCount}
          downloadProgressPercent={downloadProgressPercent}
          isDownloadingMode={isDownloadingMode}
          hasPasswordError={hasPasswordError}
          isScanning={isScanning}
          isConverting={isConverting}
        />

        {/* Main Content Canvas */}
        <div className="tahoe-block flex-1 flex flex-col min-w-0 overflow-hidden">
          
          {/* Breadcrumbs Navigation */}
          <div className="flex-shrink-0 bg-[#1c1d21] border-b border-[#383c42]/40 z-10">
            <Breadcrumbs
              currentPath={currentPath}
              onNavigate={handleNavigate}
              totalFolders={searchQuery.trim() ? filteredFolders.length : totalFolders}
              totalPictures={searchQuery.trim() ? filteredPictures.length : totalPictures}
              totalVideos={searchQuery.trim() ? filteredVideos.length : totalVideos}
            />
          </div>

          {/* Scrollable Content Body */}
          <main 
            onContextMenu={handleEmptyContextMenu}
            className="flex-1 overflow-y-auto custom-scrollbar p-2 pb-4 min-h-0"
          >
            {loading ? (
              <LoadingSkeleton />
            ) : errorInfo ? (
              <ErrorState
                errorInfo={errorInfo}
                onRetry={handleRefreshAll}
              />
            ) : !hasContent ? (
              /* Empty state */
              <div className="max-w-md mx-auto my-16 p-8 text-center bg-[#28292d] rounded-[24px] border border-[#383c42] animate-fade-in space-y-4 shadow-md">
                <div className="w-14 h-14 rounded-[24px] bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto text-blue-400">
                  <FolderX className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Thư mục này trống</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    {searchQuery 
                      ? `Không tìm thấy mục khớp với "${searchQuery}"` 
                      : 'Chưa có thư mục con, hình ảnh hoặc video nào tại đường dẫn này.'}
                  </p>
                </div>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="btn-google btn-google-surface text-xs mt-2"
                  >
                    Xóa bộ lọc tìm kiếm
                  </button>
                )}
              </div>
            ) : (
              /* Folders, Pictures, and Videos Grid */
              <div className="animate-fade-in space-y-6 pt-2">
                <FolderGrid
                  folders={visibleFolders}
                  totalCount={totalFolders}
                  onNavigate={handleNavigate}
                  onFolderContextMenu={handleFolderContextMenu}
                />

                <VideoGrid
                  videos={visibleVideos}
                  totalCount={totalVideos}
                  onOpenVideo={(idx) => setVideoModalIndex(idx)}
                  onShowInfo={handleShowMediaInfo}
                  onMoveItem={handleOpenMoveItem}
                  onDeleteItem={(vid) => handleOpenDeleteItem(vid, false)}
                />

                <PictureGrid
                  pictures={visiblePictures}
                  totalCount={totalPictures}
                  onOpenLightbox={(idx) => setLightboxIndex(idx)}
                  onShowInfo={handleShowMediaInfo}
                  onMoveItem={handleOpenMoveItem}
                  onDeleteItem={(pic) => handleOpenDeleteItem(pic, false)}
                />

                {hasMore && (
                  <div className="flex justify-center pt-2 pb-4">
                    <button
                      type="button"
                      onClick={handleLoadMore}
                      disabled={isLoadingMore}
                      className="bg-[#202124] hover:bg-[#2d2f31] text-[#8ab4f8] border border-[#383c42] hover:border-[#8ab4f8] px-8 py-3 rounded-full text-xs font-semibold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2.5 hover:scale-105 active:scale-95 disabled:opacity-60"
                    >
                      {isLoadingMore ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                          <span>Đang tải thêm...</span>
                        </>
                      ) : (
                        <>
                          <span className="text-sm">Xem thêm</span>
                          <span className="text-[11px] font-mono bg-blue-500/20 text-blue-300 px-2.5 py-0.5 rounded-full border border-blue-500/30">
                            +{remainingCount} mục
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>

        {/* Lightbox Modal */}
        {lightboxIndex !== null && (
          <LightboxModal
            pictures={filteredPictures}
            currentIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onSelectIndex={(newIdx) => setLightboxIndex(newIdx)}
            totalPictures={searchQuery.trim() ? filteredPictures.length : totalPictures}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={handleLoadMore}
          />
        )}

        {/* Video Player Modal */}
        {videoModalIndex !== null && (
          <VideoPlayerModal
            videos={filteredVideos}
            currentIndex={videoModalIndex}
            onClose={() => setVideoModalIndex(null)}
            onSelectIndex={(newIdx) => setVideoModalIndex(newIdx)}
          />
        )}

        {/* Mobile Navigation Drawer */}
        <MobileNav
          isOpen={isMobileDrawerOpen}
          onClose={() => setIsMobileDrawerOpen(false)}
          currentPath={currentPath}
          treeData={treeData}
          folders={filteredFolders}
          onNavigate={handleNavigate}
          onOpenConfig={() => setShowConfigModal(true)}
        />

        {/* Floating Action Button */}
        <FabSpeedDial
          onCreateFolder={() => setShowCreateFolderModal(true)}
          onDownloadArchive={() => setShowDownloadMediafireModal(true)}
        />

        {/* Custom Context Menu */}
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isOpen={contextMenu.isOpen}
          onClose={handleCloseContextMenu}
          mode={contextMenu.mode}
          targetFolder={contextMenu.folder}
          onCreateFolder={() => setShowCreateFolderModal(true)}
          onRenameFolder={(folder) => {
            setTargetFolder(folder);
            setShowRenameFolderModal(true);
          }}
          onMoveFolder={(folder) => {
            handleOpenMoveItem(folder);
          }}
          onDeleteFolder={(folder) => {
            handleOpenDeleteItem(folder, true);
          }}
          onRefresh={handleRefreshAll}
        />

        {/* Delete Confirmation Modal */}
        <DeleteModal
          isOpen={deleteModalData.isOpen}
          onClose={() => setDeleteModalData({ isOpen: false, item: null, isFolder: false })}
          targetItem={deleteModalData.item}
          isFolder={deleteModalData.isFolder}
          onSuccess={handleRefreshAll}
        />

        {/* Move File or Folder Modal */}
        <MoveItemModal
          isOpen={moveModalData.isOpen}
          onClose={() => setMoveModalData({ isOpen: false, item: null })}
          item={moveModalData.item}
          treeData={treeData}
          currentPath={currentPath}
          onMoveSuccess={handleRefreshAll}
        />

        {/* Create Folder Dialog Modal */}
        <CreateFolderModal
          isOpen={showCreateFolderModal}
          onClose={() => setShowCreateFolderModal(false)}
          onCreate={handleCreateFolderSubmit}
        />

        {/* Rename Folder Dialog Modal */}
        <RenameFolderModal
          isOpen={showRenameFolderModal}
          onClose={() => setShowRenameFolderModal(false)}
          folder={targetFolder}
          onRename={handleRenameFolderSubmit}
        />

        {/* Download MediaFire Modal */}
        <DownloadMediafireModal
          isOpen={showDownloadMediafireModal}
          onClose={() => setShowDownloadMediafireModal(false)}
          currentPath={currentPath}
          treeData={treeData}
          onSuccess={(job) => {
            // The modal passes the accepted parent job; retain and poll that
            // exact Coordinator ID instead of creating another legacy task.
            handleCoordinatorJobCreated(job);
            setDownloadPanelTab('active');
            setShowDownloadPanel(true);
          }}
        />

        {/* Download Manager Panel Modal */}
        <DownloadPanelModal
          isOpen={showDownloadPanel}
          onClose={() => setShowDownloadPanel(false)}
          tasks={downloadTasks}
          selectedTab={downloadPanelTab}
          onSelectedTabChange={setDownloadPanelTab}
          onOpenAddModal={() => {
            setShowDownloadPanel(false);
            setShowDownloadMediafireModal(true);
          }}
          onDeleteTask={(taskId) => {
            setDownloadTasks((prev) => prev.filter((t) => t.task_id !== taskId));
          }}
        />

        {/* Compact Bottom Snackbar */}
        <DownloadSnackbar
          tasks={downloadTasks}
          summary={downloadSummary}
          onOpenPanel={() => setShowDownloadPanel(true)}
        />

        {/* Settings Modal */}
        <SettingsModal
          isOpen={showConfigModal}
          onClose={() => setShowConfigModal(false)}
          onRefreshFolder={handleRefreshAll}
        />

        {/* Media Info Dialog Modal */}
        <MediaInfoModal
          isOpen={infoModalData.isOpen}
          onClose={() => setInfoModalData((prev) => ({ ...prev, isOpen: false }))}
          item={infoModalData.item}
          type={infoModalData.type}
        />

      </div>
    </div>
  );
}

export default App;
