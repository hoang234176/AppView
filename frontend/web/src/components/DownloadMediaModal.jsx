import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  X,
  AlertCircle,
  Loader2,
  Images,
  ArrowLeft,
  Clipboard,
  ClipboardCheck,
  Check
} from 'lucide-react';
import { previewMediaDownload, startMediaDownload } from '../api/downloadApi';
import { canonicalDownloadDestination } from '../utils/downloadDestination';
import { FolderPicker } from './FolderPicker';
import { CustomSelect } from './CustomSelect';

// Mounted only while open: unmount aborts preview and discards its metadata.
export const DownloadMediaModal = ({
  currentPath = '',
  treeData = [],
  onClose,
  onSuccess
}) => {
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState(null);
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

    const photos = (preview?.images || []).filter(img => img.type === 'slideshow_photo');
    const targetImages = photos.length > 0 ? photos : (preview?.images || []);
    const isTikTok = preview?.source === 'tiktok';
    const isSlideshow = isTikTok && (preview?.type === 'slideshow' || (targetImages.length > 0 && !preview?.has_video));

    if (preview) {
      let indices = null;
      let mediaType = null;
      if (isTikTok) {
        if (isSlideshow) {
          mediaType = 'images';
          indices = selectedIndices.length > 0 ? selectedIndices : null;
        } else if (preview.has_video) {
          mediaType = 'video';
        }
      }
      const result = await startMediaDownload(
        url.trim(),
        canonicalDownloadDestination(destination),
        quality,
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
      const pList = (result.images || []).filter(img => img.type === 'slideshow_photo');
      const imgs = pList.length > 0 ? pList : (result.images || []);
      setSelectedIndices(imgs.map((_, i) => i));
    } catch (failure) {
      if (!mounted.current || controller.signal.aborted) return;
      const detail = failure.response?.data?.error;
      setError(typeof detail === 'string' ? detail : detail?.message || 'Không thể xem trước nội dung. Vui lòng thử lại.');
    } finally {
      if (mounted.current && !controller.signal.aborted) setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/80 animate-fade-in select-none"
      onClick={() => { if (!(busy && preview)) close(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-download-title"
        className="bg-[#1c1d21] border border-[#383c42] rounded-[28px] p-6 max-w-md w-full shadow-2xl space-y-4 animate-pop-fast"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#383c42]">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-rose-500/15 rounded-full border border-rose-500/30 text-rose-400">
              <Images className="w-5 h-5" />
            </div>
            <h3 id="media-download-title" className="text-sm font-bold text-white">Tải ảnh/video</h3>
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
          <div role="alert" className="p-3 bg-red-500/15 border border-red-500/30 rounded-[14px] text-xs text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
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
                    className="w-full bg-[#202124] border border-[#383c42] focus:border-rose-400 rounded-xl pl-3 pr-20 py-2 text-white font-mono placeholder-gray-500 outline-none"
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
              {/* Video/Post Preview Card */}
              <div className="overflow-hidden rounded-2xl border border-[#383c42] bg-[#202124] sm:flex sm:flex-row items-stretch">
                {preview.thumbnail && (
                  <div className="relative aspect-video sm:w-[42%] sm:min-w-[140px] sm:max-w-[180px] flex-shrink-0 overflow-hidden bg-black/40">
                    <img
                      src={preview.thumbnail}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className={`absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm border border-white/10 text-[9px] font-bold ${preview.source === 'tiktok' ? 'text-cyan-400' : 'text-rose-400'}`}>
                      {preview.source === 'tiktok' ? 'TikTok' : 'YouTube'}
                    </div>
                  </div>
                )}
                <div className="p-3 flex flex-col justify-center min-w-0 flex-1 space-y-1">
                  <h4 className="font-semibold text-white text-xs line-clamp-2 leading-snug" title={preview.title}>
                    {preview.title}
                  </h4>
                  {preview.uploader && (
                    <p className="text-[11px] text-gray-400 truncate">
                      {preview.uploader}
                    </p>
                  )}
                </div>
              </div>

              {/* Multi-image horizontal scrollable selector for slideshows */}
              {((preview.images || []).filter(img => img.type === 'slideshow_photo').length > 0 || (preview.source === 'tiktok' && (preview.images || []).length > 0)) && (() => {
                const photos = (preview.images || []).filter(img => img.type === 'slideshow_photo');
                const targetImages = photos.length > 0 ? photos : (preview.images || []);
                return (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-gray-300 font-semibold">
                        Danh sách ảnh ({selectedIndices.length}/{targetImages.length}):
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedIndices.length === targetImages.length) {
                            setSelectedIndices([]);
                          } else {
                            setSelectedIndices(targetImages.map((_, i) => i));
                          }
                        }}
                        className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors font-medium"
                      >
                        {selectedIndices.length === targetImages.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                      </button>
                    </div>
                    <div className="flex gap-2 overflow-x-auto py-1 px-0.5 scrollbar-thin">
                      {targetImages.map((img, idx) => {
                        const isSelected = selectedIndices.includes(idx);
                        return (
                          <div
                            key={img.id || idx}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedIndices(selectedIndices.filter((i) => i !== idx));
                              } else {
                                setSelectedIndices([...selectedIndices, idx].sort((a, b) => a - b));
                              }
                            }}
                            className={`relative flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                              isSelected
                                ? 'border-cyan-400 shadow-md ring-2 ring-cyan-400/30'
                                : 'border-[#383c42] opacity-50 hover:opacity-80'
                            }`}
                          >
                            <img
                              src={img.url}
                              alt={img.label || `Ảnh ${idx + 1}`}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                            <div className={`absolute top-1 right-1 rounded-full p-0.5 ${isSelected ? 'bg-cyan-500 text-white' : 'bg-black/60 text-gray-400'}`}>
                              <Check className="w-3 h-3" />
                            </div>
                            <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-center text-gray-300 py-0.5 truncate">
                              #{idx + 1}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Custom Quality Selector or Format Info */}
              {preview.qualities && preview.qualities.length > 0 ? (
                <div>
                  <label className="block text-gray-300 font-semibold mb-1.5">
                    Chất lượng tải xuống:
                  </label>
                  <CustomSelect
                    options={(preview.qualities || []).map((q) => ({
                      value: q,
                      label: `${q}p`,
                    }))}
                    value={quality}
                    onChange={setQuality}
                    disabled={busy}
                    accent="blue"
                    ariaLabel="Chọn chất lượng tải xuống"
                  />
                </div>
              ) : (preview.type === 'slideshow' || (preview.images && preview.images.length > 0)) ? (
                <div className="bg-[#24252a] border border-[#383c42] rounded-xl px-3 py-2 flex items-center justify-between">
                  <span className="text-[11px] text-gray-400">Định dạng:</span>
                  <span className="text-xs font-semibold text-white">Ảnh gốc (JPEG)</span>
                </div>
              ) : null}

              {/* Destination summary */}
              <div className="bg-[#24252a] border border-[#383c42] rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                <span className="text-[11px] text-gray-400 flex-shrink-0">Vị trí lưu:</span>
                <span className="text-xs font-mono font-bold text-amber-400 truncate max-w-[240px]">
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
                onClick={() => { setPreview(null); setError(''); }}
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
