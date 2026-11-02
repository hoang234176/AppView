import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import useLayout from './useLayout';
import { getFolderContentsApi, getFolderStatsApi } from '../api/apiCoordinator';
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
  const [infoData, setInfoData] = useState({
    name: '',
    path: '',
    drive: '',
    kind: 'Folder',
    sizeFormatted: '0 B',
    sizeBytes: '0 bytes',
    containsText: '0 items',
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

        // Gọi đồng thời cả nội dung thư mục, số liệu tổng hợp đệ quy từ SQLite và timer tối thiểu
        const [contentsRes, statsRes] = await Promise.all([
          getFolderContentsApi(host, port, { drive: driveName, path: pathName }),
          getFolderStatsApi(host, port, { drive: driveName, path: pathName }),
          new Promise((resolve) => setTimeout(resolve, MIN_LOADING_TIME_MS)),
        ]);

        if (!isMounted) return;

        let totalFolders = 0;
        let totalPictures = 0;
        let totalVideos = 0;
        let totalBytes = 0;
        let latestModTime = null;

        // Ưu tiên đọc số liệu tổng hợp đệ quy từ SQLite (statsRes)
        if (statsRes && statsRes.ok && statsRes.data) {
          totalBytes = statsRes.data.total_size || 0;
          totalPictures = statsRes.data.total_pictures || 0;
          totalVideos = statsRes.data.total_videos || 0;
          totalFolders = statsRes.data.total_folders || 0;
          if (statsRes.data.latest_mod) {
            latestModTime = statsRes.data.latest_mod * 1000;
          }
        }

        // Bổ sung hoặc dự phòng từ contentsRes (dữ liệu trực tiếp cấp này)
        if (contentsRes && contentsRes.ok && contentsRes.data) {
          const folders = Array.isArray(contentsRes.data.folders) ? contentsRes.data.folders : [];
          const pictures = Array.isArray(contentsRes.data.pictures) ? contentsRes.data.pictures : [];
          const videos = Array.isArray(contentsRes.data.videos) ? contentsRes.data.videos : [];

          if (totalFolders === 0) totalFolders = contentsRes.data.total_folders ?? folders.length;
          if (totalPictures === 0) totalPictures = contentsRes.data.total_pictures ?? pictures.length;
          if (totalVideos === 0) totalVideos = contentsRes.data.total_videos ?? videos.length;

          if (totalBytes === 0) {
            pictures.forEach((p) => {
              if (p.size && typeof p.size === 'number') totalBytes += p.size;
            });
            videos.forEach((v) => {
              if (v.size && typeof v.size === 'number') totalBytes += v.size;
            });
          }

          if (!latestModTime) {
            pictures.forEach((p) => {
              if (p.mod_time) {
                const t = new Date(p.mod_time).getTime();
                if (!latestModTime || t > latestModTime) latestModTime = t;
              }
            });
            videos.forEach((v) => {
              if (v.mod_time) {
                const t = new Date(v.mod_time).getTime();
                if (!latestModTime || t > latestModTime) latestModTime = t;
              }
            });
          }
        }

        const totalItems = totalFolders + totalPictures + totalVideos;

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

        // Chuỗi hiển thị thành phần bên trong
        const parts = [];
        if (totalFolders > 0) parts.push(`${totalFolders} ${totalFolders === 1 ? 'folder' : 'folders'}`);
        if (totalPictures > 0) parts.push(`${totalPictures} ${totalPictures === 1 ? 'photo' : 'photos'}`);
        if (totalVideos > 0) parts.push(`${totalVideos} ${totalVideos === 1 ? 'video' : 'videos'}`);

        const containsStr = totalItems === 0
          ? 'Zero items'
          : `${totalItems} ${totalItems === 1 ? 'item' : 'items'}${parts.length > 0 ? ` (${parts.join(', ')})` : ''}`;

        setInfoData({
          name: folderName,
          path: pathName,
          drive: driveName,
          kind: 'Folder',
          sizeFormatted: formatStorageBytes(totalBytes),
          sizeBytes: `${totalBytes.toLocaleString()} bytes`,
          containsText: containsStr,
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

  // Xử lý đóng modal và đặt lại định dạng bytes
  const handleClose = useCallback(() => {
    setShowBytes(false);
    closeGetInfo();
  }, [closeGetInfo]);

  // Phím tắt bàn phím Escape để đóng modal
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' || e.key === 'Enter') {
      setShowBytes(false);
      closeGetInfo();
    }
  }, [closeGetInfo]);

  return {
    isOpen: isGetInfoOpen,
    isLoading,
    infoData,
    showBytes,
    toggleSizeFormat,
    handleClose,
    handleKeyDown,
  };
}
