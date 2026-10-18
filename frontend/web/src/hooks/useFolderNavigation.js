import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchFolderContents, fetchFolderTree, fetchDrives } from '../api/folderApi';
import { isServerConfigured, getActiveDrive, setActiveDrive } from '../api/axiosConfig';

const PAGE_SIZE = 20;

export function useFolderNavigation({
  configVersion,
  isConnected,
  setIsConnected,
  setShowConfigModal,
  isSelectMode,
  handleExitSelectMode,
  searchQuery = '',
  setSearchQuery,
}) {
  const getInitialPathFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('path') || '';
  };

  const [currentPath, setCurrentPath] = useState(getInitialPathFromUrl);
  const [drives, setDrives] = useState([]);
  const [activeDrive, setActiveDriveState] = useState(getActiveDrive);
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

  const [folderLimit, setFolderLimit] = useState(PAGE_SIZE);
  const [pictureLimit, setPictureLimit] = useState(PAGE_SIZE);
  const [videoLimit, setVideoLimit] = useState(PAGE_SIZE);

  const activeControllerRef = useRef(null);
  const handleRefreshAllRef = useRef(null);

  useEffect(() => {
    setFolderLimit(PAGE_SIZE);
    setPictureLimit(PAGE_SIZE);
    setVideoLimit(PAGE_SIZE);
  }, [currentPath, searchQuery]);

  const updateUrlPath = useCallback((path) => {
    const url = new URL(window.location.href);
    if (path && path.trim() !== '') {
      url.searchParams.set('path', path);
    } else {
      url.searchParams.delete('path');
    }
    window.history.pushState({ path }, '', url.toString());
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const pathFromUrl = new URLSearchParams(window.location.search).get('path') || '';
      setCurrentPath(pathFromUrl);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [configVersion]);

  const loadDrives = useCallback(async () => {
    try {
      const loadedDrives = await fetchDrives();
      if (Array.isArray(loadedDrives) && loadedDrives.length > 0) {
        setDrives(loadedDrives);
      }
    } catch {
      // Ignore error
    }
  }, []);

  useEffect(() => {
    loadDrives();
  }, [configVersion, loadDrives]);

  const handleSelectDrive = useCallback((driveId) => {
    if (driveId === activeDrive) return;
    if (isSelectMode && handleExitSelectMode) {
      handleExitSelectMode();
    }
    setActiveDrive(driveId);
    setActiveDriveState(driveId);
    setCurrentPath('');
    updateUrlPath('');
    setPage(1);
  }, [activeDrive, isSelectMode, handleExitSelectMode, updateUrlPath]);

  const loadTreeData = useCallback(async (drive = activeDrive) => {
    if (!isServerConfigured()) {
      setTreeData([]);
      if (setIsConnected) setIsConnected(false);
      return;
    }
    const result = await fetchFolderTree(drive);
    if (result.success) {
      setTreeData(result.data || []);
    } else {
      setTreeData([]);
    }
  }, [activeDrive, setIsConnected]);

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
      if (setIsConnected) setIsConnected(false);
      setErrorInfo({
        status: 'Chưa cấu hình máy chủ',
        message: 'Vui lòng nhập Server Host trong phần cài đặt để bắt đầu.',
      });
      if (setShowConfigModal) setShowConfigModal(true);
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
      }
    } catch {
      if (!controller.signal.aborted) {
        setErrorInfo({ status: 500, message: 'Lỗi tải dữ liệu' });
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, [currentPath, setIsConnected, setShowConfigModal]);

  const handleRefreshAll = useCallback(() => {
    loadDrives();
    loadTreeData();
    loadData(currentPath, { limit: 0 }, false);
  }, [loadDrives, loadTreeData, loadData, currentPath]);

  useEffect(() => {
    handleRefreshAllRef.current = handleRefreshAll;
  }, [handleRefreshAll]);

  const handleNavigate = useCallback((newPath) => {
    if (newPath === currentPath) return;
    if (isSelectMode && handleExitSelectMode) {
      handleExitSelectMode();
    }
    updateUrlPath(newPath);
    setCurrentPath(newPath);
    if (setSearchQuery) setSearchQuery('');
    setPage(1);
  }, [currentPath, isSelectMode, handleExitSelectMode, updateUrlPath, setSearchQuery]);

  useEffect(() => {
    if (!isConnected) return;
    loadTreeData();
  }, [configVersion, isConnected, loadTreeData]);

  useEffect(() => {
    if (!isConnected) return;
    loadData(currentPath, { limit: 0 }, false);
  }, [currentPath, configVersion, isConnected, loadData]);

  const hasMore = (totalFolders > folders.length) || (totalPictures > pictures.length) || (totalVideos > videos.length);

  const remainingCount = Math.max(0, totalFolders - folders.length) +
    Math.max(0, totalPictures - pictures.length) +
    Math.max(0, totalVideos - videos.length);

  const handleLoadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    loadData(currentPath, { page: nextPage, limit: PAGE_SIZE }, true);
  }, [isLoadingMore, hasMore, page, loadData, currentPath]);

  return {
    currentPath,
    setCurrentPath,
    updateUrlPath,
    drives,
    setDrives,
    loadDrives,
    activeDrive,
    setActiveDriveState,
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
    setTreeData,
    loadTreeData,
    loading,
    setLoading,
    isLoadingMore,
    page,
    setPage,
    errorInfo,
    setErrorInfo,
    folderLimit,
    pictureLimit,
    videoLimit,
    loadData,
    handleNavigate,
    handleRefreshAll,
    hasMore,
    remainingCount,
    handleLoadMore,
    activeControllerRef,
  };
}
