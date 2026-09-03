import { getApiBaseUrl, getRootFolderPath } from '../api/axiosConfig';

/**
 * Format ISO Date string to readable Vietnamese date time
 */
export const formatDate = (isoString) => {
  if (!isoString) return 'Chưa có thông tin';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  } catch (e) {
    return isoString;
  }
};

/**
 * Split path string into breadcrumb array
 * e.g., "Cosplay/Coser@不可爱羚 - 阮梅" -> [{ name: 'Trang chủ', path: '' }, { name: 'Cosplay', path: 'Cosplay' }, ...]
 */
export const parseBreadcrumbs = (pathString) => {
  const breadcrumbs = [{ name: 'Trang chủ', path: '' }];
  if (!pathString || pathString.trim() === '') return breadcrumbs;

  const parts = pathString.split('/').filter(Boolean);
  let accumulatedPath = '';

  parts.forEach((part) => {
    accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;
    breadcrumbs.push({
      name: part,
      path: accumulatedPath,
    });
  });

  return breadcrumbs;
};

/**
 * Convert picture object to original image API endpoint (/pictures/*) for Lightbox/Viewer
 */
export const getPictureUrl = (picture) => {
  if (!picture) return '';
  if (picture.url && picture.url.trim() !== '') return picture.url;
  if (picture.path) {
    const baseUrl = getApiBaseUrl();
    const rootPath = getRootFolderPath();
    const rootQuery = rootPath ? `?root_path=${encodeURIComponent(rootPath)}` : '';
    const cleanPath = picture.path.startsWith('/') ? picture.path.slice(1) : picture.path;
    const encodedPath = cleanPath.split('/').map(encodeURIComponent).join('/');
    return `${baseUrl}/pictures/${encodedPath}${rootQuery}`;
  }
  return '';
};

/**
 * Convert picture object to thumbnail API endpoint (/thumbnails/*) for grid preview
 */
export const getThumbnailUrl = (picture) => {
  if (!picture) return '';
  if (picture.thumbnail_url && picture.thumbnail_url.trim() !== '') return picture.thumbnail_url;
  if (picture.url && picture.url.trim() !== '') {
    return picture.url.replace(/\/pictures\//i, '/thumbnails/');
  }
  if (picture.path) {
    const baseUrl = getApiBaseUrl();
    const rootPath = getRootFolderPath();
    const rootQuery = rootPath ? `?root_path=${encodeURIComponent(rootPath)}` : '';
    const cleanPath = picture.path.startsWith('/') ? picture.path.slice(1) : picture.path;
    const encodedPath = cleanPath.split('/').map(encodeURIComponent).join('/');
    return `${baseUrl}/thumbnails/${encodedPath}${rootQuery}`;
  }
  return '';
};

/**
 * Format bytes to readable size string (B, KB, MB, GB)
 */
export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/**
 * Format speed bytes per second to readable string (KB/s, MB/s)
 */
export const formatSpeed = (bytesPerSec) => {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 KB/s';
  if (bytesPerSec >= 1024 * 1024) {
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  }
  return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
};

/**
 * Get Video Streaming URL from /videos/* endpoint
 */
export const getVideoStreamUrl = (video) => {
  if (!video) return '';
  if (video.url) return video.url;
  if (video.path) {
    const baseUrl = getApiBaseUrl();
    const cleanPath = video.path.startsWith('/') ? video.path.slice(1) : video.path;
    const encodedPath = cleanPath.split('/').map(p => encodeURIComponent(p).replace(/#/g, '%2523')).join('/');
    return `${baseUrl}/videos/${encodedPath}`;
  }
  return '';
};

/**
 * Convert video object to thumbnail API endpoint (/thumbnails/*) for preview
 */
export const getVideoThumbnailUrl = (video) => {
  if (!video) return '';
  if (video.thumbnail_url) return video.thumbnail_url;
  if (video.path) {
    const baseUrl = getApiBaseUrl();
    const cleanPath = video.path.startsWith('/') ? video.path.slice(1) : video.path;
    const encodedPath = cleanPath.split('/').map(encodeURIComponent).join('/');
    return `${baseUrl}/thumbnails/${encodedPath}`;
  }
  return '';
};

/**
 * Detect file category (picture, video, or archive) from filename or URL
 */
export const getFileCategory = (filenameOrUrl) => {
  if (!filenameOrUrl) return 'archive';
  const clean = filenameOrUrl.split('?')[0].toLowerCase();
  
  const videoExts = ['.mp4', '.mkv', '.mov', '.avi', '.webm', '.m4v', '.flv', '.ts'];
  if (videoExts.some((ext) => clean.endsWith(ext))) return 'video';

  const pictureExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.bmp', '.svg'];
  if (pictureExts.some((ext) => clean.endsWith(ext))) return 'picture';

  return 'archive';
};
