import { createPortal } from 'react-dom';
import useFolderContextMenu from '../../../hooks/useFolderContextMenu';
import MoveIcon from '../../../assets/icons/MoveIcon';
import CopyIcon from '../../../assets/icons/CopyIcon';
import EditIcon from '../../../assets/icons/EditIcon';
import InfoCircleIcon from '../../../assets/icons/InfoCircleIcon';
import TrashIcon from '../../../assets/icons/TrashIcon';
import './FolderContextMenu.css';

/**
 * Component hiển thị Context Menu tùy chọn khi click chuột phải vào thư mục
 * Tuân thủ Quy tắc 10 (Pure presentational component), Quy tắc 11 (No-Blur) và Quy tắc 14 (100% English)
 */
function FolderContextMenu() {
  const {
    isOpen,
    menuPos,
    targetFolder,
    menuRef,
    handleAction,
  } = useFolderContextMenu();

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="folder-context-menu"
      style={{
        left: `${menuPos.x}px`,
        top: `${menuPos.y}px`,
      }}
      role="menu"
      aria-label="Folder Options"
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Move */}
      <button
        type="button"
        className="folder-context-menu__item"
        role="menuitem"
        onClick={() => handleAction('move', targetFolder)}
      >
        <span className="folder-context-menu__icon">
          <MoveIcon />
        </span>
        <span className="folder-context-menu__label">Move</span>
      </button>

      {/* 2. Copy */}
      <button
        type="button"
        className="folder-context-menu__item"
        role="menuitem"
        onClick={() => handleAction('copy', targetFolder)}
      >
        <span className="folder-context-menu__icon">
          <CopyIcon />
        </span>
        <span className="folder-context-menu__label">Copy</span>
      </button>

      {/* 3. Rename */}
      <button
        type="button"
        className="folder-context-menu__item"
        role="menuitem"
        onClick={() => handleAction('rename', targetFolder)}
      >
        <span className="folder-context-menu__icon">
          <EditIcon />
        </span>
        <span className="folder-context-menu__label">Rename</span>
      </button>

      {/* 4. Get Info */}
      <button
        type="button"
        className="folder-context-menu__item"
        role="menuitem"
        onClick={() => handleAction('info', targetFolder)}
      >
        <span className="folder-context-menu__icon">
          <InfoCircleIcon />
        </span>
        <span className="folder-context-menu__label">Get Info</span>
      </button>

      {/* Đường kẻ phân cách */}
      <div className="folder-context-menu__divider" role="separator" />

      {/* 5. Delete */}
      <button
        type="button"
        className="folder-context-menu__item folder-context-menu__item--danger"
        role="menuitem"
        onClick={() => handleAction('delete', targetFolder)}
      >
        <span className="folder-context-menu__icon">
          <TrashIcon />
        </span>
        <span className="folder-context-menu__label">Delete</span>
      </button>
    </div>,
    document.body
  );
}

export default FolderContextMenu;
