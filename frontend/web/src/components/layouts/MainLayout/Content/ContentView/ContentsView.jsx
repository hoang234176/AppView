import { useState, useMemo, useEffect } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import useFolderContents from '../../../../../hooks/useFolderContents';
import useLayout from '../../../../../hooks/useLayout';
import Loading from '../../../../common/Loading/Loading';
import MediaCard from '../../../../common/MediaCard/MediaCard';
import './ContentsView.css';

function ContentsView() {
  const { driveId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { searchQuery, clearSearchQuery } = useLayout();

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

  // Tự động bỏ chọn ngay khi chuyển thư mục hoặc chuyển ổ đĩa
  if (currentViewKey !== prevViewKey) {
    setPrevViewKey(currentViewKey);
    setSelectedKey(null);
  }

  // Tự động xóa từ khóa tìm kiếm khi người dùng chuyển sang thư mục khác
  useEffect(() => {
    clearSearchQuery();
  }, [currentViewKey, clearSearchQuery]);

  // Gộp chung Thư mục, Ảnh, Video vào một khối duy nhất chuẩn Finder
  const allItems = useMemo(() => {
    const folderItems = (Array.isArray(rawFolders) ? rawFolders : []).map((f) => ({
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

    return [...sortedFolders, ...sortedFiles];
  }, [rawFolders, pictures, videos]);

  // Lọc nội dung chỉ trong phạm vi thư mục hiện tại theo searchQuery (đã debounce 250ms)
  const displayItems = useMemo(() => {
    if (!searchQuery) return allItems;
    const q = searchQuery.toLowerCase();
    return allItems.filter((item) =>
      (item.name || '').toLowerCase().includes(q)
    );
  }, [allItems, searchQuery]);

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

  const handleBackgroundClick = () => {
    setSelectedKey(null);
  };

  return (
    <div className="contents-view" onClick={handleBackgroundClick}>
      {isLoading ? (
        <div className="contents-loading">
          <Loading text="" size="md" />
        </div>
      ) : error ? (
        <div className="contents-error">
          <p>{error}</p>
        </div>
      ) : allItems.length === 0 ? (
        <div className="contents-empty">
          <p>Thư mục trống</p>
        </div>
      ) : displayItems.length === 0 ? (
        <div className="contents-empty">
          <p>Không tìm thấy nội dung phù hợp cho &quot;{searchQuery}&quot;</p>
        </div>
      ) : (
        <div className="contents-container">
          <div className="contents-grid contents-grid--finder">
            {displayItems.map((item) => (
              <MediaCard
                key={item.itemKey}
                item={item}
                isSelected={selectedKey === item.itemKey}
                onClick={handleItemClick}
                onDoubleClick={handleItemDoubleClick}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ContentsView;
