import { useState, useMemo, memo, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './SidebarTree.css';
import useFolderTree from '../../../hooks/useFolderTree';
import Loading from '../../common/Loading/Loading';
import FolderIcon from '../../../assets/icons/FolderIcon';
import FolderOpenIcon from '../../../assets/icons/FolderOpenIcon';

// Helper tìm tên của thư mục đang chọn (chỉ trả về tên thư mục được chọn)
function findFolderName(items, targetId) {
  if (!Array.isArray(items)) return null;
  for (const item of items) {
    const itemId = item.id || item.path;
    if (itemId === targetId) {
      return item.name;
    }
    if (item.children && item.children.length > 0) {
      const found = findFolderName(item.children, targetId);
      if (found) return found;
    }
  }
  return null;
}

// Component đệ quy hiển thị từng mục thư mục ở mọi cấp
function TreeItem({ item, level = 1, expandedIds, selectedId, onToggle, onSelect }) {
  const hasChildren = item.children && item.children.length > 0;
  const itemId = item.id || item.path;
  const isExpanded = expandedIds.has(itemId);
  const isSelected = selectedId === itemId;
  const itemStyle = level > 1 ? { paddingLeft: `${6 + (level - 1) * 28}px` } : undefined;

  return (
    <div className="sidebar-tree__branch">
      <div
        className={`sidebar-tree__item ${level > 1 ? 'sidebar-tree__item--sub' : ''} ${
          isSelected ? 'sidebar-tree__item--selected' : ''
        }`}
        style={itemStyle}
        data-tree-id={itemId}
        onClick={() => onSelect(itemId, hasChildren)}
        title={item.name}
      >
        {/* Nếu có con: nút chevron xoay; nếu không có con: spacer 18px giữ chỗ để thẳng hàng icon */}
        {hasChildren ? (
          <button
            type="button"
            className={`sidebar-tree__chevron ${isExpanded ? 'sidebar-tree__chevron--expanded' : ''}`}
            onClick={(e) => onToggle(itemId, e)}
            aria-label={isExpanded ? 'Thu gọn' : 'Mở rộng'}
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        ) : (
          <span className="sidebar-tree__chevron-spacer" aria-hidden="true" />
        )}

        {/* Icon Thư mục */}
        <div
          className={`sidebar-tree__icon ${level > 1 ? 'sidebar-tree__icon--sub' : ''}`}
        >
          {isExpanded ? (
            <FolderOpenIcon />
          ) : (
            <FolderIcon />
          )}
        </div>

        {/* Tên Thư mục */}
        <span className="sidebar-tree__name">{item.name}</span>

        {/* Badge số lượng thư mục con */}
        {hasChildren && (
          <span className="sidebar-tree__badge">{item.children.length}</span>
        )}
      </div>

      {/* Các thư mục con thụt lề khi mở */}
      {hasChildren && isExpanded && (
        <div className="sidebar-tree__sub-list">
          {item.children.map(child => (
            <TreeItem
              key={child.id || child.path}
              item={child}
              level={level + 1}
              expandedIds={expandedIds}
              selectedId={selectedId}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarTree({ activeDriveId = 'drive-1', isLoading = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { folders, normalizedDriveId, isFetchingTree } = useFolderTree(activeDriveId);
  const scrollContainerRef = useRef(null);
  const [floatingDirection, setFloatingDirection] = useState(null); // 'above' | 'below' | null

  // Trạng thái mở rộng và chọn thư mục
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [selectedId, setSelectedId] = useState(null);

  // Đồng bộ trạng thái chọn và mở rộng thư mục từ URL ?path=...
  useEffect(() => {
    try {
      const query = new URLSearchParams(location.search);
      const pathParam = query.get('path');
      if (pathParam && pathParam.trim()) {
        const cleanPath = pathParam.trim();
        Promise.resolve().then(() => {
          setSelectedId(cleanPath);
        });
        const parts = cleanPath.split('/').filter(Boolean);
        if (parts.length > 1) {
          Promise.resolve().then(() => {
            setExpandedIds((prev) => {
              const next = new Set(prev);
              let acc = '';
              for (let i = 0; i < parts.length - 1; i++) {
                acc = acc ? `${acc}/${parts[i]}` : parts[i];
                next.add(acc);
              }
              return next;
            });
          });
        }
      } else {
        Promise.resolve().then(() => {
          setSelectedId(null);
        });
      }
    } catch {
      // Bỏ qua lỗi URL search parse
    }
  }, [location.search]);

  // Khi chuyển sang ổ đĩa khác: xóa trắng trạng thái trỏ/mở của ổ cũ và cuộn về đầu
  const isFirstMountRef = useRef(true);
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }
    setExpandedIds(new Set());
    setSelectedId(null);
    setFloatingDirection(null);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [normalizedDriveId]);

  // Lấy đúng tên thư mục đang chọn (chỉ tên thư mục con hoặc gốc, không nối >)
  const selectedFolderName = useMemo(() => {
    if (!selectedId) return null;
    return findFolderName(folders, selectedId);
  }, [folders, selectedId]);

  // Kiểm tra xem mục đang chọn có bị cuộn khuất khỏi tầm mắt hay không
  const checkVisibility = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || !selectedId) {
      setFloatingDirection(null);
      return;
    }

    const selectedEl = container.querySelector(`[data-tree-id="${selectedId}"]`);
    if (!selectedEl) {
      setFloatingDirection(null);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const itemRect = selectedEl.getBoundingClientRect();

    if (itemRect.bottom < containerRect.top) {
      setFloatingDirection('above');
    } else if (itemRect.top > containerRect.bottom) {
      setFloatingDirection('below');
    } else {
      setFloatingDirection(null);
    }
  }, [selectedId]);

  // Tự động kiểm tra tức thì khi mục đang chọn thay đổi hoặc thư mục mở rộng
  useEffect(() => {
    // Chỉ kiểm tra khi cây thư mục đã tải xong và ổn định (chống chập giật layout)
    if (isLoading || isFetchingTree || !folders || folders.length === 0) return;

    checkVisibility();

    // Kiểm tra lại sau khi animation mở/đóng hoàn tất (180ms)
    const timer = setTimeout(checkVisibility, 200);

    const container = scrollContainerRef.current;
    if (!container || !selectedId) return () => clearTimeout(timer);

    const selectedEl = container.querySelector(`[data-tree-id="${selectedId}"]`);
    if (!selectedEl) return () => clearTimeout(timer);

    const observer = new IntersectionObserver(
      () => {
        checkVisibility();
      },
      {
        root: container,
        threshold: [0, 1],
      }
    );

    observer.observe(selectedEl);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [selectedId, activeDriveId, expandedIds, checkVisibility, isLoading, isFetchingTree, folders]);

  // Cuộn mượt đưa thư mục đang chọn quay trở lại giữa màn hình khi bấm nút nổi
  const handleJumpToSelected = () => {
    const container = scrollContainerRef.current;
    const selectedEl = container?.querySelector(`[data-tree-id="${selectedId}"]`);
    if (selectedEl) {
      selectedEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Cuộn mượt đưa thư mục lên đỉnh (hoặc cách đỉnh một khoảng offset nếu bị nút nổi che)
  const scrollToFolder = useCallback((id, offset = 0) => {
    requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      const targetEl = container?.querySelector(`[data-tree-id="${id}"]`);

      if (container && targetEl) {
        const containerRect = container.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        const targetScrollTop = Math.max(0, targetRect.top - containerRect.top + container.scrollTop - offset);
        container.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
      }
    });
  }, []);

  const toggleExpand = (id, e) => {
    e.stopPropagation();
    const isExpanding = !expandedIds.has(id);

    if (isExpanding) {
      // 1. Bung mở thư mục vào DOM để scrollHeight mở rộng đủ chiều cao
      setExpandedIds(prev => new Set(prev).add(id));

      // 2. Ngay sau khi DOM render con, cuộn mượt thư mục lên
      // Nếu có thư mục đã được chọn trước đó (khác id hiện tại), đẩy xuống 36px để không bị nút nổi che mất
      const offset = (selectedId && selectedId !== id) ? 36 : 0;
      scrollToFolder(id, offset);
    } else {
      // Khi thu gọn lại thì đóng ngay lập tức
      setExpandedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleSelect = (id, hasChildren) => {
    setSelectedId(id);
    if (hasChildren) {
      // Đồng thời xổ thư mục con bên trong
      setExpandedIds(prev => new Set(prev).add(id));
      // Đưa lên trên cùng (không cần đẩy xuống vì chính nó là thư mục đang chọn trong khung nhìn)
      scrollToFolder(id, 0);
    }
    navigate(`/${normalizedDriveId}?path=${encodeURIComponent(id)}`);
  };

  return (
    <div className="sidebar-tree-container">
      {/* Tiêu đề cố định ở đỉnh, tự động rút gọn theo độ rộng khung chứa */}
      <div className="sidebar-tree-header" title={`Folder Tree of ${normalizedDriveId}`}>
        <span className="sidebar-tree-header__prefix-full">Folder Tree of </span>
        <span className="sidebar-tree-header__prefix-short">Folder of </span>
        <span className="sidebar-tree-header__name">{normalizedDriveId}</span>
      </div>

      {/* Nút nổi định vị khi thư mục đang chọn bị cuộn khuất khỏi màn hình */}
      {floatingDirection && selectedFolderName && (
        <button
          type="button"
          className={`sidebar-tree-floating-pill sidebar-tree-floating-pill--${floatingDirection}`}
          onClick={handleJumpToSelected}
          title="Nhấp để cuộn tới thư mục đang chọn"
        >
          <span className="sidebar-tree-floating-pill__arrow">
            {floatingDirection === 'above' ? (
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </span>
          <span className="sidebar-tree-floating-pill__text">
            {selectedFolderName}
          </span>
        </button>
      )}

      {/* Vùng cuộn danh sách cây thư mục của ổ cứng tương ứng */}
      <div
        className="sidebar-tree"
        ref={scrollContainerRef}
        onScroll={checkVisibility}
      >
        <div className="sidebar-tree__list">
          {folders.map(folder => (
            <TreeItem
              key={folder.id || folder.path}
              item={folder}
              level={1}
              expandedIds={expandedIds}
              selectedId={selectedId}
              onToggle={toggleExpand}
              onSelect={handleSelect}
            />
          ))}
        </div>
      </div>

      {/* Lớp phủ Loading che trọn toàn bộ SidebarTree (cả tiêu đề lẫn danh sách thư mục) */}
      {(isLoading || isFetchingTree) && (
        <div className="sidebar-tree-overlay" aria-live="polite">
          <Loading text="" size="md" />
        </div>
      )}
    </div>
  );
}

export default memo(SidebarTree);
