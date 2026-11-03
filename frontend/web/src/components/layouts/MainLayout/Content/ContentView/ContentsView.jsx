import { useState, useMemo, useEffect } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import useFolderContents from '../../../../../hooks/useFolderContents';
import useFolderGrouping from '../../../../../hooks/useFolderGrouping';
import useLayout from '../../../../../hooks/useLayout';
import Loading from '../../../../common/Loading/Loading';
import MediaCard from '../../../../common/MediaCard/MediaCard';
import TreeChevronIcon from '../../../../../assets/icons/TreeChevronIcon';
import './ContentsView.css';

function ContentsView() {
  const { driveId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { searchQuery, clearSearchQuery, sortBy = 'name' } = useLayout();

  const queryParams = new URLSearchParams(location.search);
  const currentPath = queryParams.get('path') || '';

  const activeDrive = driveId || 'SSD';
  const {
    folders: rawFolders,
    pictures,
    videos,
    isLoading,
    error,
  } = useFolderContents(activeDrive, currentPath);

  const currentViewKey = `${activeDrive}:${currentPath}`;
  const [prevViewKey, setPrevViewKey] = useState(currentViewKey);
  const [selectedKey, setSelectedKey] = useState(null);
  const [sessionCreatedFolders, setSessionCreatedFolders] = useState([]);

  // Tự động bỏ chọn và xóa danh sách thư mục tạm thời của phiên khi chuyển thư mục hoặc đổi ổ đĩa
  if (currentViewKey !== prevViewKey) {
    setPrevViewKey(currentViewKey);
    setSelectedKey(null);
    setSessionCreatedFolders([]);
  }

  // Tự động xóa từ khóa tìm kiếm khi người dùng chuyển sang thư mục khác
  useEffect(() => {
    clearSearchQuery();
  }, [currentViewKey, clearSearchQuery]);

  // Lắng nghe sự kiện tạo thư mục mới từ NewFolderModal để chèn vào cuối mảng
  useEffect(() => {
    const handleFolderCreated = (e) => {
      const { folder, drive, path } = e.detail || {};
      const cleanEventPath = String(path || '').trim().replace(/^\/+|\/+$/g, '');
      const cleanCurrentPath = String(currentPath || '').trim().replace(/^\/+|\/+$/g, '');

      if (drive === activeDrive && cleanEventPath === cleanCurrentPath && folder) {
        setSessionCreatedFolders((prev) => {
          const itemKey = `folder-${folder.id || folder.path || folder.name}`;
          if (prev.some((f) => f.itemKey === itemKey)) return prev;
          return [
            ...prev,
            {
              ...folder,
              type: 'folder',
              itemKey,
              isJustCreated: true,
            },
          ];
        });
      }
    };

    window.addEventListener('folder-created-optimistic', handleFolderCreated);
    return () => {
      window.removeEventListener('folder-created-optimistic', handleFolderCreated);
    };
  }, [activeDrive, currentPath]);

  // Lắng nghe sự kiện đổi tên thư mục để cập nhật ngay lập tức
  useEffect(() => {
    const handleFolderRenamed = (e) => {
      const { oldPath, newPath, newName, drive } = e.detail || {};
      if (drive && drive !== activeDrive) return;

      setSessionCreatedFolders((prev) =>
        prev.map((f) => {
          if (f.path === oldPath) {
            return {
              ...f,
              name: newName,
              path: newPath,
              itemKey: `folder-${f.id || newPath || newName}`,
            };
          }
          return f;
        })
      );
    };

    window.addEventListener('folder-renamed', handleFolderRenamed);
    return () => {
      window.removeEventListener('folder-renamed', handleFolderRenamed);
    };
  }, [activeDrive]);

  // Gộp chung Thư mục, Ảnh, Video vào một khối duy nhất chuẩn Finder
  const allItems = useMemo(() => {
    // Tập hợp key của các thư mục vừa tạo trong phiên để tránh lặp khi API/WebSocket cập nhật ngầm
    const sessionKeys = new Set(sessionCreatedFolders.map((sf) => sf.itemKey));

    const folderItems = (Array.isArray(rawFolders) ? rawFolders : [])
      .filter((f) => !sessionKeys.has(`folder-${f.id || f.path || f.name}`))
      .map((f) => ({
        ...f,
        type: 'folder',
        itemKey: `folder-${f.id || f.path || f.name}`,
      }));
    const picItems = (pictures || []).map((p) => ({
      ...p,
      type: 'picture',
      itemKey: `picture-${p.id || p.path || p.name}`,
    }));
    const vidItems = (videos || []).map((v) => ({
      ...v,
      type: 'video',
      itemKey: `video-${v.id || v.path || v.name}`,
    }));

    // Sắp xếp kiểu Finder: Thư mục lên trước, sau đó đến tệp (sắp xếp theo alphabet)
    const sortedFolders = folderItems.sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' })
    );
    const sortedFiles = [...picItems, ...vidItems].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' })
    );

    // QUAN TRỌNG: Thư mục vừa tạo trong phiên hiện tại được thêm vào SAU CÙNG của mảng (sau cả file cuối cùng)
    return [...sortedFolders, ...sortedFiles, ...sessionCreatedFolders];
  }, [rawFolders, pictures, videos, sessionCreatedFolders]);

  // Lọc nội dung chỉ trong phạm vi thư mục hiện tại theo searchQuery (đã debounce 250ms)
  const displayItems = useMemo(() => {
    if (!searchQuery) return allItems;
    const q = searchQuery.toLowerCase();
    return allItems.filter((item) =>
      (item.name || '').toLowerCase().includes(q)
    );
  }, [allItems, searchQuery]);

  // Quản lý logic phân nhóm (Kind) và hiệu ứng chuyển trạng thái qua Custom Hook (Quy tắc 10)
  const { kindGroups, collapsedGroups, toggleGroupCollapse, isSwitchingSort } = useFolderGrouping({
    displayItems,
    sortBy,
    currentViewKey,
  });

  const handleItemClick = (item, e) => {
    e.stopPropagation();
    if (selectedKey === item.itemKey && item.type === 'folder') {
      // Đã chọn thư mục rồi click tiếp -> mở thư mục
      navigate(`/${activeDrive}?path=${encodeURIComponent(item.path)}`);
    } else {
      setSelectedKey(item.itemKey);
    }
  };

  const handleItemDoubleClick = (item, e) => {
    e.stopPropagation();
    if (item.type === 'folder') {
      navigate(`/${activeDrive}?path=${encodeURIComponent(item.path)}`);
    }
  };

  const handleSelect = (item) => {
    setSelectedKey(item.itemKey);
  };

  const handleBackgroundClick = () => {
    setSelectedKey(null);
  };

  return (
    <div className="contents-view" onClick={handleBackgroundClick}>
      {(isLoading && allItems.length === 0) || isSwitchingSort ? (
        <div className="contents-loading">
          <Loading text="" size="md" />
        </div>
      ) : error ? (
        <div className="contents-error">
          <p>{error}</p>
        </div>
      ) : allItems.length === 0 ? (
        <div className="contents-empty">
          <p>Folder is empty</p>
        </div>
      ) : displayItems.length === 0 ? (
        <div className="contents-empty">
          <p>No matching items found for &quot;{searchQuery}&quot;</p>
        </div>
      ) : (
        <div className="contents-container">
          {sortBy === 'kind' && kindGroups ? (
            kindGroups.map((group) => {
              const isCollapsed = collapsedGroups.has(group.id);
              return (
                <div key={group.id} className="contents-group">
                  <button
                    type="button"
                    className="contents-group__header"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleGroupCollapse(group.id);
                    }}
                    aria-expanded={!isCollapsed}
                  >
                    <span
                      className={`contents-group__chevron ${
                        isCollapsed ? '' : 'contents-group__chevron--expanded'
                      }`}
                      aria-hidden="true"
                    >
                      <TreeChevronIcon />
                    </span>
                    <span className="contents-group__title">
                      {group.title}{' '}
                      <span className="contents-group__count">({group.count})</span>
                    </span>
                    <div className="contents-group__divider" aria-hidden="true" />
                  </button>

                  {!isCollapsed && (
                    <div className="contents-grid contents-grid--finder">
                      {group.items.map((item) => (
                        <MediaCard
                          key={item.itemKey}
                          item={item}
                          isSelected={selectedKey === item.itemKey}
                          onClick={handleItemClick}
                          onDoubleClick={handleItemDoubleClick}
                          onSelect={handleSelect}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="contents-grid contents-grid--finder">
              {displayItems.map((item) => (
                <MediaCard
                  key={item.itemKey}
                  item={item}
                  isSelected={selectedKey === item.itemKey}
                  onClick={handleItemClick}
                  onDoubleClick={handleItemDoubleClick}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ContentsView;
