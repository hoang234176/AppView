import { useState, useMemo } from 'react';
import './SidebarTree.css';

// Hàm sinh 20 thư mục cấp 1, mỗi thư mục ngẫu nhiên 1 -> 20 thư mục con
function generateMockFolders() {
  return Array.from({ length: 20 }, (_, i) => {
    const parentNum = i + 1;
    const childCount = Math.floor(Math.random() * 20) + 1; // 1 đến 20
    const children = Array.from({ length: childCount }, (_, j) => {
      const childNum = j + 1;
      const childId = `${parentNum}.${childNum}`;
      // Thêm các thư mục con cho Thư mục 3.1 theo yêu cầu test
      let grandChildren = [];
      if (childId === '3.1') {
        grandChildren = [
          { id: '3.1.1', name: 'Thư mục 3.1.1' },
          { id: '3.1.2', name: 'Thư mục 3.1.2' },
          { id: '3.1.3', name: 'Thư mục 3.1.3' },
          { id: '3.1.4', name: 'Thư mục 3.1.4' },
        ];
      }
      return {
        id: childId,
        name: `Thư mục ${childId}`,
        children: grandChildren,
      };
    });
    return {
      id: `${parentNum}`,
      name: `Thư mục ${parentNum}`,
      children,
    };
  });
}

// Component đệ quy hiển thị từng mục thư mục ở mọi cấp
function TreeItem({ item, level = 1, expandedIds, selectedId, onToggle, onSelect }) {
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expandedIds.has(item.id);
  const isSelected = selectedId === item.id;
  const itemStyle = level > 1 ? { paddingLeft: `${6 + (level - 1) * 16}px` } : undefined;

  return (
    <div className="sidebar-tree__branch">
      <div
        className={`sidebar-tree__item ${level > 1 ? 'sidebar-tree__item--sub' : ''} ${
          isSelected ? 'sidebar-tree__item--selected' : ''
        }`}
        style={itemStyle}
        onClick={() => onSelect(item.id)}
        title={item.name}
      >
        {/* Nếu có con: nút chevron xoay; nếu không có con: spacer 18px giữ chỗ để thẳng hàng icon */}
        {hasChildren ? (
          <button
            type="button"
            className={`sidebar-tree__chevron ${isExpanded ? 'sidebar-tree__chevron--expanded' : ''}`}
            onClick={(e) => onToggle(item.id, e)}
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
        <div className={`sidebar-tree__icon ${level > 1 ? 'sidebar-tree__icon--sub' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
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
              key={child.id}
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

function SidebarTree({ activeDriveId = 'drive-1' }) {
  const folders = useMemo(() => generateMockFolders(), []);

  // Chia thành 2 khối tương ứng với 2 ổ cứng
  const driveGroups = useMemo(() => {
    return [
      {
        id: 'drive-1',
        driveName: 'Drive 1',
        folders: folders.slice(0, 10),
      },
      {
        id: 'drive-2',
        driveName: 'Drive 2',
        folders: folders.slice(10, 20),
      },
    ];
  }, [folders]);

  // Lấy dữ liệu của ổ cứng đang được chọn
  const activeDrive = useMemo(() => {
    return driveGroups.find(d => d.id === activeDriveId) || driveGroups[0];
  }, [driveGroups, activeDriveId]);

  // Mở sẵn Thư mục 3 và 3.1 để người dùng quan sát
  const [expandedIds, setExpandedIds] = useState(() => new Set(['3', '3.1']));
  const [selectedId, setSelectedId] = useState('3.1');

  const toggleExpand = (id, e) => {
    e.stopPropagation();
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelect = (id) => {
    setSelectedId(id);
  };

  return (
    <div className="sidebar-tree-container">
      {/* Tiêu đề cố định ở đỉnh, không bị trôi khi cuộn danh sách */}
      <div className="sidebar-tree-header">
        Folder Tree of {activeDrive.driveName}
      </div>

      {/* Vùng cuộn danh sách cây thư mục của ổ cứng tương ứng */}
      <div className="sidebar-tree">
        <div className="sidebar-tree__list">
          {activeDrive.folders.map(folder => (
            <TreeItem
              key={folder.id}
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
    </div>
  );
}

export default SidebarTree;
