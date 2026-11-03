import { useState, useMemo, useEffect, useRef, useCallback } from 'react';

/**
 * Custom Hook quản lý logic phân nhóm (Sort by Kind) và hiệu ứng chuyển trạng thái
 * Tuân thủ Quy tắc 8, 10, 14 và 15 của frontend/web/AGENTS.md
 *
 * @param {{
 *   displayItems: Array,
 *   sortBy: string,
 *   currentViewKey: string,
 * }} params
 * @returns {{
 *   kindGroups: Array|null,
 *   collapsedGroups: Set,
 *   toggleGroupCollapse: (groupId: string) => void,
 *   isSwitchingSort: boolean,
 * }}
 */
export default function useFolderGrouping({ displayItems = [], sortBy = 'name', currentViewKey = '' }) {
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  const [prevViewKey, setPrevViewKey] = useState(currentViewKey);
  const [prevSortBy, setPrevSortBy] = useState(sortBy);
  const [isSwitchingSort, setIsSwitchingSort] = useState(false);
  const isFirstMount = useRef(true);

  // Tự động mở tất cả các nhóm khi chuyển thư mục hoặc đổi ổ đĩa
  if (currentViewKey !== prevViewKey) {
    setPrevViewKey(currentViewKey);
    setCollapsedGroups(new Set());
  }

  // Tự động mở tất cả các nhóm khi chuyển chế độ sắp xếp
  if (prevSortBy !== sortBy) {
    setPrevSortBy(sortBy);
    setCollapsedGroups(new Set());
  }

  // Hiệu ứng loading nhẹ 200ms khi chuyển đổi trạng thái sắp xếp
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    setIsSwitchingSort(true);
    const timer = setTimeout(() => {
      setIsSwitchingSort(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [sortBy]);

  // Đóng/mở từng nhóm độc lập
  const toggleGroupCollapse = useCallback((groupId) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  // Phân nhóm theo Kind phong cách Windows Explorer khi chọn Sort by Kind
  const kindGroups = useMemo(() => {
    if (sortBy !== 'kind') return null;

    const folderItems = displayItems.filter((item) => item.type === 'folder');
    const imageItems = displayItems.filter((item) => item.type === 'picture');
    const videoItems = displayItems.filter((item) => item.type === 'video');
    const otherItems = displayItems.filter(
      (item) => item.type !== 'folder' && item.type !== 'picture' && item.type !== 'video'
    );

    const groups = [];
    if (folderItems.length > 0) {
      groups.push({ id: 'folders', title: 'Folder', count: folderItems.length, items: folderItems });
    }
    if (imageItems.length > 0) {
      groups.push({ id: 'photos', title: 'Photo', count: imageItems.length, items: imageItems });
    }
    if (videoItems.length > 0) {
      groups.push({ id: 'videos', title: 'Video', count: videoItems.length, items: videoItems });
    }
    if (otherItems.length > 0) {
      groups.push({ id: 'others', title: 'Other Files', count: otherItems.length, items: otherItems });
    }

    return groups;
  }, [sortBy, displayItems]);

  return {
    kindGroups,
    collapsedGroups,
    toggleGroupCollapse,
    isSwitchingSort,
  };
}
