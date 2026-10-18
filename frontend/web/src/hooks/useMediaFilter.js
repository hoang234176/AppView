import { useState, useCallback, useMemo } from 'react';

/**
 * useMediaFilter — Custom hook managing multi-select file types and social network filters
 *
 * @param {Object} params
 * @param {Array} params.folders
 * @param {Array} params.pictures
 * @param {Array} params.videos
 * @param {string} params.searchQuery
 */
export function useMediaFilter({ folders = [], pictures = [], videos = [], searchQuery = '' }) {
  // Filter States: multi-select Sets
  // fileTypes: Set of ('folder' | 'picture' | 'video') - empty or all 3 selected means show all
  // mxhs: Set of ('youtube' | 'tiktok' | 'facebook' | 'instagram' | 'telegram' | 'x') - empty means show all
  const [fileTypeFilters, setFileTypeFilters] = useState(new Set());
  const [mxhFilters, setMxhFilters] = useState(new Set());

  const matchesMxh = useCallback((name) => {
    if (!name || mxhFilters.size === 0) return true;
    const lower = name.toLowerCase();
    for (const mxh of mxhFilters) {
      if (mxh === 'youtube' && (lower.startsWith('[youtube]') || lower.includes('[youtube]'))) return true;
      if (mxh === 'tiktok' && (lower.startsWith('[tiktok]') || lower.includes('[tiktok]'))) return true;
      if (mxh === 'facebook' && (lower.startsWith('[facebook]') || lower.includes('[facebook]'))) return true;
      if (mxh === 'instagram' && (lower.startsWith('[instagram]') || lower.includes('[instagram]'))) return true;
      if (mxh === 'telegram' && (lower.startsWith('[telegram]') || lower.includes('[telegram]'))) return true;
      if (mxh === 'x' && (lower.startsWith('[x]') || lower.includes('[x]'))) return true;
    }
    return false;
  }, [mxhFilters]);

  const filteredFolders = useMemo(() => {
    if (fileTypeFilters.size > 0 && !fileTypeFilters.has('folder')) return [];
    let list = folders;
    if (mxhFilters.size > 0) {
      list = list.filter((f) => matchesMxh(f.name));
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((f) =>
      f.name?.toLowerCase().includes(q) ||
      f.path?.toLowerCase().includes(q)
    );
  }, [folders, searchQuery, fileTypeFilters, mxhFilters, matchesMxh]);

  const filteredPictures = useMemo(() => {
    if (fileTypeFilters.size > 0 && !fileTypeFilters.has('picture')) return [];
    let list = pictures;
    if (mxhFilters.size > 0) {
      list = list.filter((p) => matchesMxh(p.name));
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((p) =>
      p.name?.toLowerCase().includes(q) ||
      p.path?.toLowerCase().includes(q)
    );
  }, [pictures, searchQuery, fileTypeFilters, mxhFilters, matchesMxh]);

  const filteredVideos = useMemo(() => {
    if (fileTypeFilters.size > 0 && !fileTypeFilters.has('video')) return [];
    let list = videos;
    if (mxhFilters.size > 0) {
      list = list.filter((v) => matchesMxh(v.name));
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((v) =>
      v.name?.toLowerCase().includes(q) ||
      v.path?.toLowerCase().includes(q)
    );
  }, [videos, searchQuery, fileTypeFilters, mxhFilters, matchesMxh]);

  const visibleFolders = filteredFolders;
  const visiblePictures = filteredPictures;
  const visibleVideos = filteredVideos;

  const hasContent = filteredFolders.length > 0 || filteredPictures.length > 0 || filteredVideos.length > 0;

  return {
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
  };
}
