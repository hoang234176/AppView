import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import useLayout from './useLayout';
import { getFolderStatsApi } from '../api/apiCoordinator';
import { formatStorageBytes } from './useStorageDrives';

/**
 * Custom Hook quản lý dữ liệu và trạng thái của GetInfoModal
 * Tuân thủ Quy tắc 8 (try-catch-finally), 10 (Logic in hooks), 14 (100% English)
 */
export default function useGetInfoModal() {
  const {
    isGetInfoOpen,
    getInfoTarget,
    closeGetInfo,
    serverConfig,
  } = useLayout();

  const location = useLocation();
  const { driveId } = useParams();

  const [isLoading, setIsLoading] = useState(false);
  const [showBytes, setShowBytes] = useState(false);
  const [showDetailContains, setShowDetailContains] = useState(false);
  const [infoData, setInfoData] = useState({
    name: '',
    path: '',
    drive: '',
    kind: 'Folder',
    sizeFormatted: '0 B',
    sizeBytes: '0 bytes',
    containsSummary: 'Zero items',
    containsDetail: 'Zero items',
    containsText: 'Zero items',
    whereText: '',
    modifiedText: '—',
  });

  // Xác định Drive và Path mục tiêu
  const targetInfo = useMemo(() => {
    if (getInfoTarget) {
      const drive = getInfoTarget.drive || driveId || 'SSD';
      const path = String(getInfoTarget.path || '').trim();
      const name = getInfoTarget.name || (path ? path.split('/').filter(Boolean).pop() : drive);
      return { drive, path, name };
    }

    // Nếu không truyền target, lấy thư mục hiện tại đang mở trên màn hình
    const queryParams = new URLSearchParams(location.search);
    const path = queryParams.get('path') || '';
    const drive = driveId || 'SSD';
    const name = path ? path.split('/').filter(Boolean).pop() : drive;
    return { drive, path, name };
  }, [getInfoTarget, driveId, location.search]);

  // Nạp thông tin chi tiết của thư mục khi mở Modal
  useEffect(() => {
    if (!isGetInfoOpen) return;

    let isMounted = true;
    const host = serverConfig?.coordinator?.host;
    const port = serverConfig?.coordinator?.port;

    const folderName = targetInfo.name;
    const driveName = targetInfo.drive;
    const pathName = targetInfo.path;
    const cleanPath = String(pathName || '')
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean)
      .join('/');
    const displayWhere = cleanPath ? `${driveName}/${cleanPath}` : driveName;

    async function fetchInfo() {
      setIsLoading(true);
      try {
        if (!host || !port) {
          if (isMounted) {
            setInfoData({
              name: folderName,
              path: pathName,
              drive: driveName,
              kind: 'Folder',
              sizeFormatted: '0 B',
              sizeBytes: '0 bytes',
              containsText: '0 items',
              whereText: displayWhere,
              modifiedText: '—',
            });
          }
          return;
        }

        // Thời gian loading tối thiểu 200ms để chống chớp giật khung hình
        const MIN_LOADING_TIME_MS = 200;

        // Gọi API thống kê thư mục từ Coordinator (Storage worker xử lý)
        const [statsRes] = await Promise.all([
          getFolderStatsApi(host, port, { drive: driveName, path: pathName }),
          new Promise((resolve) => setTimeout(resolve, MIN_LOADING_TIME_MS)),
        ]);

        if (!isMounted) return;

        let totalBytes = 0;
        let directFolders = 0;
        let directPictures = 0;
        let directVideos = 0;
        let directTotal = 0;
        let latestModTime = null;

        if (statsRes && statsRes.ok && statsRes.data) {
          const data = statsRes.data;
          totalBytes = data.total_size || 0;
          directFolders = data.direct_folders || 0;
          directPictures = data.direct_pictures || 0;
          directVideos = data.direct_videos || 0;
          directTotal = data.direct_total ?? (directFolders + directPictures + directVideos);

          if (data.latest_mod) {
            latestModTime = data.latest_mod * 1000;
          }
        }

        // Định dạng ngày sửa đổi
        let modFormatted = '—';
        if (latestModTime && !isNaN(latestModTime)) {
          const dateObj = new Date(latestModTime);
          modFormatted = dateObj.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
        }

        // Chuỗi hiển thị thành phần trực tiếp bên trong (Contains - 100% English)
        const parts = [];
        if (directFolders > 0) parts.push(`${directFolders} ${directFolders === 1 ? 'folder' : 'folders'}`);
        if (directPictures > 0) parts.push(`${directPictures} ${directPictures === 1 ? 'photo' : 'photos'}`);
        if (directVideos > 0) parts.push(`${directVideos} ${directVideos === 1 ? 'video' : 'videos'}`);

        const summaryStr = directTotal === 0
          ? 'Zero items'
          : `${directTotal} ${directTotal === 1 ? 'item' : 'items'}`;
        const detailStr = parts.length > 0
          ? parts.join(', ')
          : summaryStr;

        setInfoData({
          name: folderName,
          path: pathName,
          drive: driveName,
          kind: 'Folder',
          sizeFormatted: formatStorageBytes(totalBytes),
          sizeBytes: `${totalBytes.toLocaleString()} bytes`,
          containsSummary: summaryStr,
          containsDetail: detailStr,
          containsText: summaryStr,
          whereText: displayWhere,
          modifiedText: modFormatted,
        });
      } catch {
        if (isMounted) {
          setInfoData({
            name: folderName,
            path: pathName,
            drive: driveName,
            kind: 'Folder',
            sizeFormatted: '0 B',
            sizeBytes: '0 bytes',
            containsSummary: 'Zero items',
            containsDetail: 'Zero items',
            containsText: 'Zero items',
            whereText: displayWhere,
            modifiedText: '—',
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchInfo();

    return () => {
      isMounted = false;
    };
  }, [isGetInfoOpen, targetInfo, serverConfig]);

  // Chuyển đổi định dạng kích thước giữa GB/MB và bytes khi click vào Size
  const toggleSizeFormat = useCallback(() => {
    setShowBytes((prev) => !prev);
  }, []);

  // Chuyển đổi định dạng tổng items và chi tiết khi click vào Contains
  const toggleContainsFormat = useCallback(() => {
    setShowDetailContains((prev) => !prev);
  }, []);

  // Xử lý đóng modal và đặt lại định dạng bytes, contains
  const handleClose = useCallback(() => {
    setShowBytes(false);
    setShowDetailContains(false);
    closeGetInfo();
  }, [closeGetInfo]);

  // Phím tắt bàn phím Escape để đóng modal
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' || e.key === 'Enter') {
      setShowBytes(false);
      setShowDetailContains(false);
      closeGetInfo();
    }
  }, [closeGetInfo]);

  return {
    isOpen: isGetInfoOpen,
    isLoading,
    infoData,
    showBytes,
    showDetailContains,
    toggleSizeFormat,
    toggleContainsFormat,
    handleClose,
    handleKeyDown,
  };
}
