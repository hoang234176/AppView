import { useEffect, useRef, useState } from 'react';
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
  ThumbsUp,
  MessageCircle,
  Share2,
  Settings,
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [destination, setDestination] = useState(currentPath || '');
  const [pasted, setPasted] = useState(false);
  const operation = useRef(null);
  const mounted = useRef(true);

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
      const photos = (preview?.images || []).filter(
        (img) => img.type === 'slideshow_photo' || img.type === 'post_photo' || !img.type
      );
      const targetImages = photos.length > 0 ? photos : preview?.images || [];
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
              {/* Facebook Dedicated Rich Card */}
              {isFacebook ? (
                <div className="overflow-hidden rounded-2xl border border-[#383c42] bg-[#202124]">
                  {/* Author Header Row */}
                  <div className="p-3 bg-[#18191c] border-b border-[#383c42]/60 flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {preview.author?.avatar ? (
                        <img
                          src={preview.author.avatar}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 rounded-full object-cover border border-[#383c42] flex-shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0 font-bold text-xs">
                          {preview.uploader?.charAt(0)?.toUpperCase() || 'FB'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h5 className="font-bold text-white text-xs truncate">
                          {preview.author?.name || preview.uploader || preview.title || 'Facebook Post'}
                        </h5>
                        <p className="text-[10px] text-gray-400 truncate">
                          {preview.created_time || 'Bài viết Facebook'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#1877F2]/15 text-[#1877F2] border border-[#1877F2]/30 flex-shrink-0">
                      <FacebookIcon className="w-3 h-3" />
                      <span>Facebook</span>
                    </div>
                  </div>

                  {/* Post Caption / Content */}
                  {preview.content ? (
                    <div className="px-3 py-2.5 text-xs text-gray-200 bg-[#16171a] border-b border-[#383c42]/40 max-h-24 overflow-y-auto custom-scrollbar whitespace-pre-wrap leading-relaxed">
                      {preview.content}
                    </div>
                  ) : preview.title && preview.title !== 'Facebook Post' ? (
                    <div className="px-3 py-2 text-xs font-medium text-gray-300 bg-[#16171a] border-b border-[#383c42]/40 truncate">
                      {preview.title}
                    </div>
                  ) : null}

                  {/* Reactions Engagement Bar */}
                  {preview.reactions &&
                  (preview.reactions.likes ||
                    preview.reactions.comments ||
                    preview.reactions.shares) ? (
                    <div className="px-3 py-1.5 bg-[#131417] border-b border-[#383c42]/40 flex items-center gap-4 text-[11px] text-gray-400 font-medium">
                      {preview.reactions.likes ? (
                        <span className="flex items-center gap-1 text-blue-400 font-semibold">
                          <ThumbsUp className="w-3.5 h-3.5" />
                          {preview.reactions.likes}
                        </span>
                      ) : null}
                      {preview.reactions.comments ? (
                        <span className="flex items-center gap-1 text-gray-300">
                          <MessageCircle className="w-3.5 h-3.5" />
                          {preview.reactions.comments}
                        </span>
                      ) : null}
                      {preview.reactions.shares ? (
                        <span className="flex items-center gap-1 text-gray-300">
                          <Share2 className="w-3.5 h-3.5" />
                          {preview.reactions.shares}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Video Thumbnail (for Facebook video posts) */}
                  {preview.has_video && preview.thumbnail && (
                    <div className="relative aspect-video max-h-48 overflow-hidden bg-black/50 flex items-center justify-center">
                      <img
                        src={preview.thumbnail}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-12 h-12 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white backdrop-blur-xs shadow-lg">
                          <Video className="w-6 h-6 text-blue-400" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Non-Facebook (YouTube / TikTok) Preview Card */
                <div className="overflow-hidden rounded-2xl border border-[#383c42] bg-[#202124] sm:flex sm:flex-row items-stretch">
                  {preview.thumbnail && (
                    <div className="relative aspect-video sm:w-[42%] sm:min-w-[140px] sm:max-w-[180px] flex-shrink-0 overflow-hidden bg-black/40">
                      <img
                        src={preview.thumbnail}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <div
                        className={`absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm border border-white/10 text-[9px] font-bold ${
                          isTikTok ? 'text-cyan-400' : 'text-rose-400'
                        }`}
                      >
                        {isTikTok ? <TikTokIcon className="w-3 h-3" /> : <YouTubeIcon className="w-3 h-3" />}
                        <span>{isTikTok ? 'TikTok' : 'YouTube'}</span>
                      </div>
                    </div>
                  )}
                  <div className="p-3 flex flex-col justify-center min-w-0 flex-1 space-y-1">
                    <h4
                      className="font-semibold text-white text-xs line-clamp-2 leading-snug"
                      title={preview.title}
                    >
                      {preview.title}
                    </h4>
                    {preview.uploader && (
                      <p className="text-[11px] text-gray-400 truncate">{preview.uploader}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Dynamic Media Controls (Video quality / Photo squares with select all button) */}
              {(() => {
                const photos = (preview.images || []).filter(
                  (img) => img.type === 'slideshow_photo' || img.type === 'post_photo' || !img.type
                );
                const targetImages = photos.length > 0 ? photos : preview.images || [];
                const hasImages = targetImages.length > 0;
                const hasVideo = Boolean(
                  preview.has_video ||
                    preview.source === 'youtube' ||
                    (preview.qualities && preview.qualities.length > 0)
                );

                return (
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
                          <div className="relative rounded-2xl overflow-hidden border border-[#383c42] bg-[#18191c] p-2 flex items-center gap-3">
                            <div className="w-20 h-20 rounded-xl overflow-hidden bg-black/40 flex-shrink-0 border border-[#383c42]">
                              <img
                                src={targetImages[0].url}
                                alt="Ảnh bài viết"
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                                <Check className="w-4 h-4 text-emerald-400" />
                                <span>Ảnh bài viết (1 ảnh)</span>
                              </div>
                              <p className="text-[11px] text-gray-400">
                                Sẽ được lưu trực tiếp dưới dạng hình ảnh <code className="text-emerald-400">.jpeg</code>
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
                            <div className="flex gap-2.5 overflow-x-auto py-2 px-1.5 scrollbar-thin bg-[#18191c] rounded-2xl border border-[#2e3136]">
                              {targetImages.map((img, idx) => {
                                const isSelected = selectedIndices.includes(idx);
                                return (
                                  <div
                                    key={img.id || idx}
                                    onClick={() => {
                                      if (isSelected) {
                                        setSelectedIndices(selectedIndices.filter((i) => i !== idx));
                                      } else {
                                        setSelectedIndices(
                                          [...selectedIndices, idx].sort((a, b) => a - b)
                                        );
                                      }
                                    }}
                                    className={`relative flex-shrink-0 w-[74px] h-[74px] rounded-xl overflow-hidden border-2 cursor-pointer transition-all duration-200 select-none ${
                                      isSelected
                                        ? isFacebook
                                          ? 'border-blue-400 shadow-md ring-2 ring-blue-400/40 opacity-100'
                                          : 'border-cyan-400 shadow-md ring-2 ring-cyan-400/40 opacity-100'
                                        : 'border-[#383c42] opacity-40 hover:opacity-75'
                                    }`}
                                  >
                                    <img
                                      src={img.url}
                                      alt={img.label || `Ảnh ${idx + 1}`}
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-cover"
                                    />
                                    <div
                                      className={`absolute top-1 right-1 rounded-full p-0.5 ${
                                        isSelected
                                          ? isFacebook
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-cyan-500 text-white'
                                          : 'bg-black/60 text-gray-400'
                                      }`}
                                    >
                                      <Check className="w-3 h-3" />
                                    </div>
                                    <div className="absolute bottom-0 inset-x-0 bg-black/70 backdrop-blur-xs text-[10px] font-mono text-center text-gray-200 py-0.5 truncate">
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
                );
              })()}

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
    </div>
  );
};
