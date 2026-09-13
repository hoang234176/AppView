import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  X,
  AlertCircle,
  Loader2,
  Images,
  ArrowLeft,
  Clipboard,
  ClipboardCheck,
  Check,
  Video,
  Settings,
  ZoomIn,
} from 'lucide-react';
import { previewMediaDownload, startMediaDownload } from '../api/downloadApi';
import { canonicalDownloadDestination } from '../utils/downloadDestination';
import { FolderPicker } from './FolderPicker';
import { CustomSelect } from './CustomSelect';

const FacebookIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={`${className} fill-current`} viewBox="0 0 24 24">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const TikTokIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={`${className} fill-current`} viewBox="0 0 24 24">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
  </svg>
);

const YouTubeIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={`${className} fill-current`} viewBox="0 0 24 24">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

// Mounted only while open: unmount aborts preview and discards its metadata.
export const DownloadMediaModal = ({
  currentPath = '',
  treeData = [],
  onClose,
  onSuccess,
  onOpenSettings,
}) => {
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState(null);
  const [mediaTypeTab, setMediaTypeTab] = useState('video');
  const [quality, setQuality] = useState(null);
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [previewImageIndex, setPreviewImageIndex] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [destination, setDestination] = useState(currentPath || '');
  const [pasted, setPasted] = useState(false);
  const operation = useRef(null);
  const mounted = useRef(true);

  const targetImages = useMemo(() => {
    const postPhotos = (preview?.images || []).filter(
      (img) => img.type === 'slideshow_photo' || img.type === 'post_photo' || !img.type
    );
    return postPhotos.length > 0 ? postPhotos : preview?.images || [];
  }, [preview]);
  const hasImages = targetImages.length > 0;
  const hasVideo = Boolean(
    preview?.has_video ||
      preview?.source === 'youtube' ||
      (preview?.qualities && preview.qualities.length > 0)
  );

  // Keyboard navigation for image preview lightbox
  useEffect(() => {
    if (previewImageIndex === null) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setPreviewImageIndex(null);
      } else if (e.key === 'ArrowLeft') {
        if (targetImages.length > 1) {
          setPreviewImageIndex((prev) => (prev - 1 + targetImages.length) % targetImages.length);
        }
      } else if (e.key === 'ArrowRight') {
        if (targetImages.length > 1) {
          setPreviewImageIndex((prev) => (prev + 1) % targetImages.length);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewImageIndex, targetImages]);

  const handlePaste = async () => {
    try {
      if (navigator?.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setUrl(text.trim());
          setError('');
          setPasted(true);
          setTimeout(() => {
            if (mounted.current) setPasted(false);
          }, 1500);
        }
      }
    } catch {
      // Clipboard permissions denied or unavailable
    }
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      operation.current?.abort();
    };
  }, []);

  const close = () => {
    operation.current?.abort();
    onClose();
  };

  useEffect(() => {
    const escape = (event) => {
      if (event.key === 'Escape' && !(busy && preview)) {
        operation.current?.abort();
        onClose();
      }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [onClose, busy, preview]);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');

    if (preview) {
      const isImages = mediaTypeTab === 'images' || (!preview.has_video && targetImages.length > 0);

      if (isImages && selectedIndices.length === 0) {
        setError('Vui lòng chọn ít nhất một ảnh để tải xuống.');
        setBusy(false);
        return;
      }

      const mediaType = isImages ? 'images' : 'video';
      const indices = isImages ? selectedIndices : null;
      const chosenQuality = isImages ? null : quality;

      const result = await startMediaDownload(
        url.trim(),
        canonicalDownloadDestination(destination),
        chosenQuality,
        indices,
        mediaType
      );
      if (!mounted.current) return;
      setBusy(false);
      if (result.success) {
        onSuccess(result.data);
        onClose();
      } else {
        setError(result.message);
      }
      return;
    }

    const controller = new AbortController();
    operation.current = controller;
    try {
      const result = await previewMediaDownload(url.trim(), controller.signal);
      if (!mounted.current || controller.signal.aborted) return;
      setPreview(result);
      if (result.qualities && result.qualities.length > 0) {
        setQuality(result.qualities[0]);
      } else {
        setQuality(null);
      }
      const pList = (result.images || []).filter(
        (img) => img.type === 'slideshow_photo' || img.type === 'post_photo' || !img.type
      );
      const imgs = pList.length > 0 ? pList : result.images || [];
      setSelectedIndices(imgs.map((_, i) => i));

      const hasImages = imgs.length > 0;
      const hasVideo = Boolean(
        result.has_video ||
          result.source === 'youtube' ||
          (result.qualities && result.qualities.length > 0)
      );
      if (hasImages && !hasVideo) {
        setMediaTypeTab('images');
      } else {
        setMediaTypeTab('video');
      }
    } catch (failure) {
      if (!mounted.current || controller.signal.aborted) return;
      const detail = failure.response?.data?.error;
      setError(typeof detail === 'string' ? detail : detail?.message || 'Không thể xem trước nội dung. Vui lòng thử lại.');
    } finally {
      if (mounted.current && !controller.signal.aborted) setBusy(false);
    }
  };

  const isFbUrl = Boolean(
    url &&
      (url.includes('facebook.com') ||
        url.includes('fb.watch') ||
        url.includes('fb.com') ||
        url.includes('fb.me'))
  );
  const isYtUrl = Boolean(url && (url.includes('youtube.com') || url.includes('youtu.be')));
  const isTtUrl = Boolean(url && url.includes('tiktok.com'));

  const isFacebook = preview?.source === 'facebook';
  const isTikTok = preview?.source === 'tiktok';
  const isAuthRequired =
    Boolean(error) &&
    (error.toLowerCase().includes('cookie') ||
      error.toLowerCase().includes('đăng nhập') ||
      error.includes('AUTH_REQUIRED'));

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/80 animate-fade-in select-none"
      onClick={() => {
        if (!(busy && preview)) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-download-title"
        className="bg-[#1c1d21] border border-[#383c42] rounded-[28px] p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl space-y-4 animate-pop-fast"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#383c42]">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-rose-500/15 rounded-full border border-rose-500/30 text-rose-400">
              <Images className="w-5 h-5" />
            </div>
            <h3 id="media-download-title" className="text-sm font-bold text-white">
              Tải ảnh/video
            </h3>
          </div>

          <button
            type="button"
            aria-label="Đóng"
            disabled={busy && !!preview}
            onClick={close}
            className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3 bg-red-500/15 border border-red-500/30 rounded-[14px] text-xs text-red-400 space-y-2"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 leading-snug">{error}</span>
            </div>
            {isAuthRequired && onOpenSettings && (
              <div className="pt-1.5 border-t border-red-500/20 flex items-center justify-between">
                <span className="text-[11px] text-red-300">
                  Cần gắn cookie để truy cập nội dung này.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    close();
                    onOpenSettings();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-sm"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Cài đặt Cookie</span>
                </button>
              </div>
            )}
          </div>
        )}

        <form onSubmit={submit} className="space-y-3.5 text-xs">
          {!preview ? (
            <>
              {/* URL Input */}
              <div>
                <label className="block text-gray-300 font-semibold mb-1" htmlFor="media-url">
                  Dán liên kết MXH
                </label>
                <div className="relative flex items-center">
                  <input
                    id="media-url"
                    type="url"
                    required
                    autoFocus
                    value={url}
                    disabled={busy}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://..."
                    className="w-full bg-[#202124] border border-[#383c42] focus:border-rose-400 rounded-xl pl-3 pr-20 py-2 text-white font-mono placeholder-gray-500 outline-none transition-colors"
                  />
                  <div className="absolute right-1.5 flex items-center gap-1">
                    {url ? (
                      <button
                        type="button"
                        onClick={() => {
                          setUrl('');
                          setError('');
                        }}
                        disabled={busy}
                        className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                        title="Xóa"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={handlePaste}
                      disabled={busy}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/30 transition-colors"
                      title="Dán từ Clipboard"
                    >
                      {pasted ? (
                        <>
                          <ClipboardCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Đã dán</span>
                        </>
                      ) : (
                        <>
                          <Clipboard className="w-3.5 h-3.5" />
                          <span>Dán</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Brand pills below input */}
                <div className="flex items-center gap-1.5 pt-2 text-[11px]">
                  <span className="text-gray-500 font-medium">Hỗ trợ:</span>
                  <span
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold transition-all ${
                      isFbUrl
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40 shadow-sm'
                        : 'text-gray-400 bg-white/5 border border-transparent'
                    }`}
                  >
                    <FacebookIcon className="w-3 h-3" />
                    <span>Facebook</span>
                  </span>
                  <span
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold transition-all ${
                      isTtUrl
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm'
                        : 'text-gray-400 bg-white/5 border border-transparent'
                    }`}
                  >
                    <TikTokIcon className="w-3 h-3" />
                    <span>TikTok</span>
                  </span>
                  <span
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold transition-all ${
                      isYtUrl
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm'
                        : 'text-gray-400 bg-white/5 border border-transparent'
                    }`}
                  >
                    <YouTubeIcon className="w-3 h-3" />
                    <span>YouTube</span>
                  </span>
                </div>
              </div>

              {/* Interactive Folder Tree Selector */}
              <FolderPicker
                destination={destination}
                onChangeDestination={setDestination}
                treeData={treeData}
                onError={setError}
                disabled={busy}
              />
            </>
          ) : (
            <div className="space-y-3">
              {/* Unified Media Preview Card (Facebook / TikTok / YouTube) */}
              {(() => {
                const platformName = isFacebook ? 'Facebook' : isTikTok ? 'TikTok' : 'YouTube';
                const accentColorClass = isFacebook
                  ? 'text-[#1877F2]'
                  : isTikTok
                  ? 'text-cyan-400'
                  : 'text-rose-400';
                const badgeBgClass = isFacebook
                  ? 'bg-[#1877F2]/15 text-[#1877F2] border-[#1877F2]/30'
                  : isTikTok
                  ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                  : 'bg-rose-500/15 text-rose-400 border-rose-500/30';
                const avatarBgClass = isFacebook
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  : isTikTok
                  ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                  : 'bg-rose-500/20 text-rose-400 border-rose-500/30';

                const authorName =
                  preview.author?.name ||
                  (preview.uploader
                    ? isTikTok && !preview.uploader.startsWith('@')
                      ? `@${preview.uploader}`
                      : preview.uploader
                    : preview.title || `${platformName} Post`);

                const subtitle =
                  preview.created_time ||
                  (isFacebook
                    ? 'Bài viết Facebook'
                    : isTikTok
                    ? 'Video / Ảnh TikTok'
                    : 'Video YouTube');

                const avatarInitial = (
                  (preview.author?.name || preview.uploader || preview.title || platformName)
                    .replace(/^@/, '')
                    .charAt(0) || platformName.charAt(0)
                ).toUpperCase();

                const showVideoVisual =
                  (hasVideo && mediaTypeTab === 'video') || (hasVideo && !hasImages);
                const showImageVisual = !showVideoVisual && hasImages;

                return (
                  <div
                    className="overflow-hidden rounded-2xl border border-[#383c42] bg-[#202124] shadow-sm [isolation:isolate] [contain:paint]"
                    style={{ WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}
                  >
                    {/* Author Header Row */}
                    <div
                      className={`p-3.5 bg-[#18191c] rounded-t-2xl flex items-center justify-between gap-3 ${
                        (showVideoVisual && preview.thumbnail) || showImageVisual
                          ? 'border-b border-[#383c42]/60'
                          : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {preview.author?.avatar ? (
                          <img
                            src={preview.author.avatar}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-full object-cover border border-[#383c42] flex-shrink-0"
                          />
                        ) : (
                          <div
                            className={`w-10 h-10 rounded-full ${avatarBgClass} border flex items-center justify-center flex-shrink-0 font-bold text-sm`}
                          >
                            {avatarInitial}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h5 className="font-bold text-white text-xs truncate" title={authorName}>
                            {authorName}
                          </h5>
                          <p className="text-[11px] text-gray-400 truncate">{subtitle}</p>
                        </div>
                      </div>

                      <div
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${badgeBgClass} border flex-shrink-0`}
                      >
                        {isFacebook ? (
                          <FacebookIcon className="w-3 h-3" />
                        ) : isTikTok ? (
                          <TikTokIcon className="w-3 h-3" />
                        ) : (
                          <YouTubeIcon className="w-3 h-3" />
                        )}
                        <span>{platformName}</span>
                      </div>
                    </div>

                    {/* Media Preview Box (Video or Photo) */}
                    {showVideoVisual && preview.thumbnail ? (
                      <div className="relative h-56 w-full overflow-hidden rounded-b-2xl bg-black flex items-center justify-center">
                        <img
                          src={preview.thumbnail}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="absolute inset-0 w-full h-full object-cover opacity-35 blur-md"
                        />
                        <img
                          src={preview.thumbnail}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="relative max-h-full max-w-full object-contain"
                        />
                        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-xs border border-white/15 text-[10px] font-bold text-white">
                          <Video className={`w-3 h-3 ${accentColorClass}`} />
                          <span>Video</span>
                        </div>
                      </div>
                    ) : showImageVisual ? (
                      <div
                        onClick={() => setPreviewImageIndex(0)}
                        className="relative h-56 w-full overflow-hidden rounded-b-2xl bg-black flex items-center justify-center cursor-pointer group"
                        title="Bấm để xem ảnh kích thước đầy đủ"
                      >
                        <img
                          src={targetImages[0].url}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="absolute inset-0 w-full h-full object-cover opacity-35 blur-md"
                        />
                        <img
                          src={targetImages[0].url}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="relative max-h-full max-w-full object-contain group-hover:scale-[1.02] transition-transform duration-200"
                        />
                        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/75 backdrop-blur-xs border border-white/15 text-[10px] font-bold text-white shadow-sm">
                          <Images className="w-3 h-3 text-cyan-400" />
                          <span>
                            {targetImages.length > 1
                              ? `${targetImages.length} ảnh • Xem trước`
                              : 'Xem trước ảnh'}
                          </span>
                        </div>
                        <div className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-black/60 border border-white/20 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          <ZoomIn className="w-4 h-4" />
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })()}

              {/* Dynamic Media Controls (Video quality / Photo squares with select all button) */}
              <div className="space-y-3">
                    {/* Segmented control when BOTH video and images are available */}
                    {hasVideo && hasImages && (
                      <div className="flex bg-[#16171a] p-1 rounded-xl border border-[#383c42] gap-1">
                        <button
                          type="button"
                          onClick={() => setMediaTypeTab('video')}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-medium text-xs transition-all ${
                            mediaTypeTab === 'video'
                              ? isFacebook
                                ? 'bg-blue-600/25 text-blue-300 border border-blue-500/40 shadow-sm'
                                : isTikTok
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-sm'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span>Tải Video (.mp4)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setMediaTypeTab('images')}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-medium text-xs transition-all ${
                            mediaTypeTab === 'images'
                              ? isFacebook
                                ? 'bg-blue-600/25 text-blue-300 border border-blue-500/40 shadow-sm'
                                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          <Images className="w-3.5 h-3.5" />
                          <span>Tải Ảnh ({targetImages.length})</span>
                        </button>
                      </div>
                    )}

                    {/* Image selector if mediaTypeTab === 'images' or pure slideshow/photos */}
                    {(mediaTypeTab === 'images' || (!hasVideo && hasImages)) && hasImages ? (
                      <div className="space-y-2">
                        {targetImages.length === 1 ? (
                          /* Single Photo Preview Card */
                          <div
                            onClick={() => setPreviewImageIndex(0)}
                            className="relative rounded-2xl overflow-hidden border border-[#383c42] bg-[#18191c] p-2.5 flex items-center gap-3 cursor-pointer group hover:border-[#4f535a] transition-all"
                            title="Bấm để xem ảnh kích thước đầy đủ"
                          >
                            <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-black/40 flex-shrink-0 border border-[#383c42]">
                              <img
                                src={targetImages[0].url}
                                alt="Ảnh bài viết"
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition-opacity">
                                <ZoomIn className="w-5 h-5 text-white drop-shadow-md" />
                              </div>
                            </div>
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                                <Check className="w-4 h-4 text-emerald-400" />
                                <span>Ảnh bài viết (1 ảnh)</span>
                              </div>
                              <p className="text-[11px] text-gray-400">
                                Sẽ được lưu trực tiếp dưới dạng hình ảnh <code className="text-emerald-400">.jpeg</code>
                              </p>
                              <p className="text-[11px] text-blue-400 font-medium flex items-center gap-1 pt-0.5">
                                <ZoomIn className="w-3.5 h-3.5" />
                                <span>Bấm vào để xem trước ảnh</span>
                              </p>
                            </div>
                          </div>
                        ) : (
                          /* Multiple Photos Gallery */
                          <>
                            <div className="flex items-center justify-between">
                              <label className="text-gray-300 font-semibold text-xs">
                                Danh sách ảnh ({targetImages.length} ảnh):
                              </label>
                              <span className="text-[11px] text-gray-400">
                                Đã chọn:{' '}
                                <span className="font-bold text-blue-400">
                                  {selectedIndices.length}
                                </span>
                                /{targetImages.length}
                              </span>
                            </div>

                            {/* Horizontal scrollable row of square images */}
                            <div className="flex gap-2.5 overflow-x-auto py-2.5 px-2 scrollbar-thin bg-[#18191c] rounded-2xl border border-[#2e3136]">
                              {targetImages.map((img, idx) => {
                                const isSelected = selectedIndices.includes(idx);
                                return (
                                  <div
                                    key={img.id || idx}
                                    onClick={() => setPreviewImageIndex(idx)}
                                    className={`group relative flex-shrink-0 w-[76px] h-[76px] rounded-xl overflow-hidden border-2 cursor-pointer transition-all duration-200 select-none [isolation:isolate] [contain:paint] ${
                                      isSelected
                                        ? isFacebook
                                          ? 'border-blue-400 shadow-md ring-2 ring-blue-400/40 opacity-100'
                                          : 'border-cyan-400 shadow-md ring-2 ring-cyan-400/40 opacity-100'
                                        : 'border-[#383c42] opacity-50 hover:opacity-90'
                                    }`}
                                    style={{ WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}
                                    title="Bấm vào ảnh để xem trước phóng to"
                                  >
                                    <img
                                      src={img.url}
                                      alt={img.label || `Ảnh ${idx + 1}`}
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-cover rounded-[9px] group-hover:scale-105 transition-transform duration-200 pointer-events-none"
                                    />

                                    {/* Corner checkbox button: ONLY clicking here selects/deselects the image */}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (isSelected) {
                                          setSelectedIndices(selectedIndices.filter((i) => i !== idx));
                                        } else {
                                          setSelectedIndices(
                                            [...selectedIndices, idx].sort((a, b) => a - b)
                                          );
                                        }
                                      }}
                                      className={`absolute top-1 right-1 rounded-full p-1 z-10 transition-all ${
                                        isSelected
                                          ? isFacebook
                                            ? 'bg-blue-600 text-white shadow-sm ring-1 ring-white/60 scale-105'
                                            : 'bg-cyan-500 text-white shadow-sm ring-1 ring-white/60 scale-105'
                                          : 'bg-black/70 text-gray-300 hover:bg-black/90 hover:text-white border border-white/20'
                                      }`}
                                      title={isSelected ? 'Bỏ chọn ảnh' : 'Chọn ảnh'}
                                    >
                                      <Check className="w-3 h-3 stroke-[2.5]" />
                                    </button>

                                    {/* Hover zoom indicator */}
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/35 transition-opacity pointer-events-none">
                                      <ZoomIn className="w-4 h-4 text-white drop-shadow-md" />
                                    </div>

                                    <div className="absolute bottom-0 inset-x-0 rounded-b-[9px] bg-black/75 backdrop-blur-xs text-[10px] font-mono text-center text-gray-200 py-0.5 truncate pointer-events-none">
                                      #{idx + 1}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Button BELOW the squares: Chọn tất cả */}
                            <div className="flex items-center justify-between pt-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  if (selectedIndices.length === targetImages.length) {
                                    setSelectedIndices([]);
                                  } else {
                                    setSelectedIndices(targetImages.map((_, i) => i));
                                  }
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                                  isFacebook
                                    ? 'text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 active:bg-blue-500/30 border-blue-500/20'
                                    : 'text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 active:bg-cyan-500/30 border-cyan-500/20'
                                }`}
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>
                                  {selectedIndices.length === targetImages.length
                                    ? 'Bỏ chọn tất cả'
                                    : 'Chọn tất cả'}
                                </span>
                              </button>
                              <span className="text-[11px] text-gray-400 font-mono">
                                  {selectedIndices.length === 0
                                    ? 'Chưa chọn ảnh nào'
                                    : `Lưu ${selectedIndices.length} ảnh (.zip)`}
                                </span>
                              </div>
                            </>
                          )}
                      </div>
                    ) : null}

                    {/* Video quality selector if mediaTypeTab === 'video' */}
                    {(mediaTypeTab === 'video' || (!hasImages && hasVideo)) &&
                    preview.qualities &&
                    preview.qualities.length > 0 ? (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-gray-300 font-semibold">
                            Chất lượng video:
                          </label>
                          <span className="text-[10px] text-gray-400 font-mono">
                            Định dạng: .mp4
                          </span>
                        </div>
                        <CustomSelect
                          options={(preview.qualities || []).map((q) => ({
                            value: q,
                            label: `${q}p`,
                          }))}
                          value={quality}
                          onChange={setQuality}
                          disabled={busy}
                          accent={isFacebook ? 'blue' : 'rose'}
                          ariaLabel="Chọn chất lượng tải xuống"
                        />
                      </div>
                    ) : null}
                  </div>

              {/* Destination summary */}
              <div className="bg-[#24252a] border border-[#383c42] rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                <span className="text-[11px] text-gray-400 flex-shrink-0">Vị trí lưu:</span>
                <span className="text-xs font-mono font-bold text-amber-400 truncate max-w-[280px]">
                  {destination === '' ? 'Thư viện gốc (Root)' : `/${destination}`}
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#383c42]">
            {preview ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setPreview(null);
                  setError('');
                }}
                className="flex items-center gap-1.5 px-4 py-2 font-semibold text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors disabled:opacity-50"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Quay lại</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="px-4 py-2 font-semibold text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors disabled:opacity-50"
              >
                Hủy
              </button>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-2 px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-xl shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{preview ? 'Đang bắt đầu...' : 'Đang xem trước...'}</span>
                </>
              ) : preview ? (
                <>
                  <Download className="w-4 h-4" />
                  <span>Tải xuống</span>
                </>
              ) : (
                <span>Tiếp tục</span>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Image Preview Lightbox Modal */}
      {previewImageIndex !== null && targetImages[previewImageIndex] && (() => {
        const currentImg = targetImages[previewImageIndex];
        const isSelected = selectedIndices.includes(previewImageIndex);
        const hasMultiple = targetImages.length > 1;

        const goToPrev = (e) => {
          e?.stopPropagation();
          if (hasMultiple) {
            setPreviewImageIndex((prev) => (prev - 1 + targetImages.length) % targetImages.length);
          }
        };

        const goToNext = (e) => {
          e?.stopPropagation();
          if (hasMultiple) {
            setPreviewImageIndex((prev) => (prev + 1) % targetImages.length);
          }
        };

        return (
          <div
            className="fixed inset-0 z-[120000] flex flex-col items-center justify-center bg-black/95 select-none"
            onClick={() => setPreviewImageIndex(null)}
          >
            {/* Top Toolbar (Fixed at top, z-30, stops propagation) */}
            <div
              className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-auto text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full bg-white/10 font-mono text-xs text-gray-200 border border-white/15">
                  {previewImageIndex + 1} / {targetImages.length}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      setSelectedIndices(selectedIndices.filter((i) => i !== previewImageIndex));
                    } else {
                      setSelectedIndices([...selectedIndices, previewImageIndex].sort((a, b) => a - b));
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors border ${
                    isSelected
                      ? isFacebook
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                        : 'bg-cyan-500 text-white border-cyan-400 shadow-md'
                      : 'bg-white/10 text-gray-300 border-white/20 hover:bg-white/20'
                  }`}
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>{isSelected ? 'Đã chọn tải' : 'Chọn ảnh này'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setPreviewImageIndex(null)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors"
                title="Đóng xem trước (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Main Image Display (pointer-events-none so left/right click zones catch clicks across the entire screen including image) */}
            <div className="relative max-w-full max-h-[85vh] flex items-center justify-center p-4 pointer-events-none z-10">
              <img
                src={currentImg.url}
                alt={currentImg.label || `Ảnh ${previewImageIndex + 1}`}
                referrerPolicy="no-referrer"
                className="max-h-[82vh] max-w-[90vw] object-contain rounded-xl shadow-2xl pointer-events-none select-none"
              />
            </div>

            {/* Left & Right Clickable Zones (Covers entire left & right halves of the screen and image) */}
            {hasMultiple ? (
              <>
                <div
                  className="absolute inset-y-0 left-0 w-1/2 z-20 cursor-pointer"
                  onClick={goToPrev}
                  title="Ảnh trước (← hoặc click bên trái)"
                />
                <div
                  className="absolute inset-y-0 right-0 w-1/2 z-20 cursor-pointer"
                  onClick={goToNext}
                  title="Ảnh tiếp theo (→ hoặc click bên phải)"
                />
              </>
            ) : null}
          </div>
        );
      })()}
    </div>
  );
};
