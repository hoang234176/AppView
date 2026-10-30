import { useMemo } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import useFolderContents from '../../../../../hooks/useFolderContents';
import Loading from '../../../../common/Loading/Loading';
import FolderPreviewIcon from '../../../../../assets/icons/FolderPreviewIcon';
import './ContentsView.css';

// Dữ liệu mẫu thực tế của SSD
const SAMPLE_PREVIEWS_MAP = {
  Cosplay: {
    previews: [
      'http://127.0.0.1:8080/api/v1/thumbnails/SSD/Cosplay/%5BFacebook%5D_%23cosplay%20%23asiangirl%20%23cute%20%23outfit%20%23dance%20%281%29.mp4',
      'http://127.0.0.1:8080/api/v1/thumbnails/SSD/Cosplay/%5BFacebook%5D_%23cosplay%20%23asiangirl%20%23cute%20%23outfit%20%23dance.mp4',
    ],
    picture_count: 76,
    video_count: 55,
  },
  Bigo: {
    previews: [
      'http://127.0.0.1:8080/api/v1/thumbnails/SSD/Bigo/%5BYouTube%5D_%F0%9F%91%85%20dolly%20%F0%9F%91%85%20bigo%20vo%CC%82%CC%83%20mo%CC%82ng%20%C4%91en%20%C4%91e%CC%81t.mp4',
    ],
    picture_count: 0,
    video_count: 1,
  },
  Lookbook: {
    previews: [
      'http://127.0.0.1:8080/api/v1/thumbnails/SSD/Lookbook/%5BYouTube%5D_%284K%E1%84%89%E1%85%A6%E1%84%85%E1%85%A9%E1%84%85%E1%85%AE%E1%86%A8%E1%84%87%E1%85%AE%E1%86%A8%29%20%E1%84%8E%E1%85%A9%E1%84%80%E1%85%B3%E1%86%AB%E1%84%8C%E1%85%A5%E1%86%B8%20%E1%84%80%E1%85%A1%E1%86%A8%E1%84%89%E1%85%A5%E1%86%AB%E1%84%86%E1%85%B5%20%E1%84%8C%E1%85%A1%E1%86%AF%20%E1%84%87%E1%85%A9%E1%84%8B%E1%85%B5%E1%84%82%E1%85%B3%E1%86%AB%20Ai%E1%84%89%E1%85%B5%E1%86%AF%E1%84%89%E1%85%A1%20%E1%84%85%E1%85%AE%E1%86%A8%E1%84%87%E1%85%AE%E1%86%A8%E2%9D%A4%EF%B8%8F%E1%84%8C%E1%85%B5%E1%86%A8%E1%84%8F%E1%85%A2%E1%86%B7%20%E1%84%8B%E1%85%A5%E1%86%AB%E1%84%83%E1%85%A5%E1%84%8B%E1%85%B0%E1%84%8B%E1%85%A5%20%E1%84%85%E1%85%A1%E1%86%AB%E1%84%8C%E1%85%A6%E1%84%85%E1%85%B5%20bikini%20Underwear.mp4',
    ],
    picture_count: 0,
    video_count: 1,
  },
  Other: {
    previews: [],
    picture_count: 0,
    video_count: 0,
  },
};

const DEFAULT_FOLDERS = [
  { name: 'Cosplay', path: 'Cosplay', ...SAMPLE_PREVIEWS_MAP.Cosplay },
  { name: 'Bigo', path: 'Bigo', ...SAMPLE_PREVIEWS_MAP.Bigo },
  { name: 'Lookbook', path: 'Lookbook', ...SAMPLE_PREVIEWS_MAP.Lookbook },
  { name: 'Other', path: 'Other', ...SAMPLE_PREVIEWS_MAP.Other },
];

function formatCount(folder) {
  const parts = [];
  const picCount = folder.picture_count ?? 0;
  const vidCount = folder.video_count ?? 0;
  if (picCount > 0) parts.push(`${picCount} ảnh`);
  if (vidCount > 0) parts.push(`${vidCount} video`);
  if (parts.length > 0) return parts.join(' • ');
  if (folder.item_count > 0) return `${folder.item_count} mục`;
  return '';
}

/** Thẻ Thư mục chính thức sử dụng FolderPreviewIcon (Phương án 1) */
function FolderCard({ folder, onNavigate }) {
  const metaText = formatCount(folder);

  return (
    <div
      className="folder-card"
      onClick={() => onNavigate(folder.path)}
      title={folder.name}
    >
      <FolderPreviewIcon previews={folder.previews} />
      <span className="folder-card__title" title={folder.name}>
        {folder.name}
      </span>
      {metaText ? <span className="folder-card__meta">{metaText}</span> : null}
    </div>
  );
}

function ContentsView() {
  const { driveId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

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

  // Gắn kèm preview dữ liệu nếu server chưa trả về
  const displayFolders = useMemo(() => {
    if (rawFolders && rawFolders.length > 0) {
      return rawFolders.map((f) => {
        const mock = SAMPLE_PREVIEWS_MAP[f.name];
        return {
          ...f,
          previews: f.previews && f.previews.length > 0 ? f.previews : mock?.previews || [],
          picture_count: f.picture_count !== undefined ? f.picture_count : mock?.picture_count || 0,
          video_count: f.video_count !== undefined ? f.video_count : mock?.video_count || 0,
        };
      });
    }
    return DEFAULT_FOLDERS;
  }, [rawFolders]);

  const handleFolderClick = (folderPath) => {
    navigate(`/${activeDrive}?path=${encodeURIComponent(folderPath)}`);
  };

  return (
    <div className="contents-view">
      {isLoading ? (
        <div className="contents-loading">
          <Loading text="" size="md" />
        </div>
      ) : error ? (
        <div className="contents-error">
          <p>{error}</p>
        </div>
      ) : (
        <div className="contents-container">
          {/* Danh sách Thư mục */}
          {displayFolders.length > 0 && (
            <section className="contents-section">
              <h3 className="contents-section__title">Folders</h3>
              <div className="contents-grid contents-grid--folders">
                {displayFolders.map((folder) => (
                  <FolderCard
                    key={`folder-${folder.id || folder.path || folder.name}`}
                    folder={folder}
                    onNavigate={handleFolderClick}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Danh sách Hình ảnh (nếu đang ở bên trong một thư mục có ảnh) */}
          {pictures && pictures.length > 0 && (
            <section className="contents-section">
              <h3 className="contents-section__title">Pictures</h3>
              <div className="contents-grid contents-grid--media">
                {pictures.map((pic) => (
                  <div key={pic.id || pic.path} className="contents-card contents-card--picture">
                    <div className="contents-card__thumb">
                      <img
                        src={pic.thumbnail_url || pic.url}
                        alt={pic.name}
                        loading="lazy"
                        className="contents-card__img"
                      />
                    </div>
                    <span className="contents-card__name" title={pic.name}>
                      {pic.name}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Danh sách Video (nếu đang ở bên trong một thư mục có video) */}
          {videos && videos.length > 0 && (
            <section className="contents-section">
              <h3 className="contents-section__title">Videos</h3>
              <div className="contents-grid contents-grid--media">
                {videos.map((vid) => (
                  <div key={vid.id || vid.path} className="contents-card contents-card--video">
                    <div className="contents-card__thumb">
                      {vid.thumbnail_url ? (
                        <img
                          src={vid.thumbnail_url}
                          alt={vid.name}
                          loading="lazy"
                          className="contents-card__img"
                        />
                      ) : (
                        <div className="contents-card__video-placeholder">▶</div>
                      )}
                    </div>
                    <span className="contents-card__name" title={vid.name}>
                      {vid.name}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

export default ContentsView;
