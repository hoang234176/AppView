import { useState, useMemo } from 'react';
import useLazyViewport from '../../../hooks/useLazyViewport';
import FolderPreviewIcon from '../../../assets/icons/FolderPreviewIcon';
import FoldedDocIcon from '../../../assets/icons/FoldedDocIcon';
import PlayIcon from '../../../assets/icons/PlayIcon';
import './MediaCard.css';

/**
 * Rút gọn tên 1 dòng dạng: tên....đuôi (giữ nguyên phần mở rộng)
 * Ví dụ: "[Facebook]_#cosplay #asiangirl.mp4" -> "[Facebook]_#co....mp4"
 */
function formatDisplayName(name, isFolder) {
  if (!name) return '';
  if (isFolder) return name;

  const lastDotIdx = name.lastIndexOf('.');
  if (lastDotIdx > 0 && lastDotIdx < name.length - 1) {
    const ext = name.slice(lastDotIdx);
    const base = name.slice(0, lastDotIdx);
    const maxBaseLen = 10;
    if (base.length > maxBaseLen) {
      return `${base.slice(0, maxBaseLen)}....${ext}`;
    }
  }
  return name;
}

/**
 * MediaCard - Component hiển thị Thư mục / Hình ảnh / Video
 * Hỗ trợ Khối Icon Dự phòng (Fallback) khi không tải được thumbnail
 */
function MediaCard({ item, isSelected = false, onClick, onDoubleClick, onSelect }) {
  const [cardRef, isVisible] = useLazyViewport();
  const [imgError, setImgError] = useState(false);

  const isFolder = item?.type === 'folder';
  const isVideo = item?.type === 'video';
  const isPicture = item?.type === 'picture';

  const hasThumb = Boolean(item?.thumbnail_url || item?.url) && !imgError;

  const displayName = useMemo(() => {
    return formatDisplayName(item?.name, isFolder);
  }, [item?.name, isFolder]);

  if (!item) return null;

  const handleFolderContextMenu = (e) => {
    if (isFolder) {
      e.preventDefault();
      e.stopPropagation();
      if (onSelect) {
        onSelect(item, e);
      }
      window.dispatchEvent(new CustomEvent('close-more-menu'));
      window.dispatchEvent(
        new CustomEvent('open-folder-context-menu', {
          detail: {
            clientX: e.clientX,
            clientY: e.clientY,
            target: {
              name: item.name,
              path: item.path,
              type: 'folder',
            },
          },
        })
      );
    }
  };

  const handleCardContextMenu = (e) => {
    if (isFolder && isSelected) {
      handleFolderContextMenu(e);
    }
  };

  return (
    <div
      ref={cardRef}
      className={`media-card media-card--${item.type} ${isSelected ? 'media-card--selected' : ''} ${item?.isJustCreated ? 'media-card--just-created' : ''}`}
      onClick={(e) => onClick && onClick(item, e)}
      onDoubleClick={(e) => onDoubleClick && onDoubleClick(item, e)}
      onContextMenu={handleCardContextMenu}
      title={item.name}
    >
      <div className="media-card__body">
        {isFolder && (
          <div className="media-card__folder-wrapper">
            <FolderPreviewIcon
              previews={item.previews}
              isVisible={isVisible}
              onContextMenu={handleFolderContextMenu}
            />
          </div>
        )}

        {isPicture && (
          hasThumb ? (
            isVisible ? (
              <img
                src={item.thumbnail_url || item.url}
                alt={item.name}
                loading="lazy"
                className="media-card__img"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="media-card__img-placeholder" aria-hidden="true" />
            )
          ) : (
            <FoldedDocIcon type="picture" />
          )
        )}

        {isVideo && (
          hasThumb ? (
            isVisible ? (
              <div className="media-card__video-wrapper">
                <img
                  src={item.thumbnail_url}
                  alt={item.name}
                  loading="lazy"
                  className="media-card__img"
                  onError={() => setImgError(true)}
                />
                <div className="media-card__play-badge">
                  <PlayIcon />
                </div>
              </div>
            ) : (
              <div className="media-card__img-placeholder" aria-hidden="true" />
            )
          ) : (
            <FoldedDocIcon type="video" />
          )
        )}
      </div>

      <div className="media-card__footer">
        <span
          className="media-card__name"
          title={item.name}
          onContextMenu={isFolder ? handleFolderContextMenu : undefined}
        >
          {displayName}
        </span>
      </div>
    </div>
  );
}

export default MediaCard;
