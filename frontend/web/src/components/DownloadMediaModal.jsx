import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { previewMediaDownload, startMediaDownload } from '../api/downloadApi';
import { canonicalDownloadDestination } from '../utils/downloadDestination';

// Mounted only while open: unmount aborts preview and discards its metadata.
export const DownloadMediaModal = ({ currentPath, onClose, onSuccess }) => {
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState(null);
  const [quality, setQuality] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const operation = useRef(null);
  const mounted = useRef(true);
  const [destination] = useState(() => canonicalDownloadDestination(currentPath));

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; operation.current?.abort(); };
  }, []);

  const close = () => { operation.current?.abort(); onClose(); };
  useEffect(() => {
    const escape = (event) => {
      if (event.key === 'Escape' && !(busy && preview)) { operation.current?.abort(); onClose(); }
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
      const result = await startMediaDownload(url.trim(), destination, quality);
      if (!mounted.current) return;
      setBusy(false);
      if (result.success) { onSuccess(result.data); onClose(); }
      else setError(result.message);
      return;
    }
    const controller = new AbortController();
    operation.current = controller;
    try {
      const result = await previewMediaDownload(url.trim(), controller.signal);
      if (!mounted.current || controller.signal.aborted) return;
      setPreview(result);
      setQuality(result.qualities[0]);
    } catch (failure) {
      if (!mounted.current || controller.signal.aborted) return;
      const detail = failure.response?.data?.error;
      setError(typeof detail === 'string' ? detail : detail?.message || 'Không thể xem trước video. Vui lòng thử lại.');
    } finally {
      if (mounted.current && !controller.signal.aborted) setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 p-4" onClick={() => { if (!(busy && preview)) close(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="media-download-title" className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-[#383c42] bg-[#1c1d21] p-6 text-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 id="media-download-title" className="font-bold">Tải ảnh/video</h3>
          <button aria-label="Đóng" disabled={busy && !!preview} onClick={close}><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {!preview ? <>
            <label className="block text-sm" htmlFor="media-url">Liên kết</label>
            <input id="media-url" type="url" required autoFocus value={url} disabled={busy} onChange={(event) => setUrl(event.target.value)} placeholder="https://youtube.com/..." className="w-full rounded-xl border border-[#383c42] bg-black/20 p-3 text-sm outline-none" />
          </> : <>
            <p className="text-xs font-bold text-red-400">YouTube</p>
            {preview.thumbnail && <img src={preview.thumbnail} alt="" referrerPolicy="no-referrer" className="aspect-video w-full rounded-xl object-cover" />}
            <h4 className="font-semibold">{preview.title}</h4>
            {preview.uploader && <p className="text-sm text-gray-400">{preview.uploader}</p>}
            <label className="flex items-center justify-between gap-3 text-sm">
              Chất lượng tải xuống
              <select value={quality} disabled={busy} onChange={(event) => setQuality(Number(event.target.value))} className="rounded-lg border border-[#383c42] bg-[#1c1d21] p-2">
                {preview.qualities.map((value) => <option key={value} value={value}>{value}p</option>)}
              </select>
            </label>
          </>}
          <p className="break-all text-xs text-gray-400">Lưu vào: {destination}</p>
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-3">
            {preview && <button type="button" disabled={busy} onClick={() => { setPreview(null); setError(''); }}>Quay lại</button>}
            <button type="submit" disabled={busy} className="rounded-xl bg-blue-600 px-4 py-2 font-semibold disabled:opacity-50">
              {busy ? (preview ? 'Đang bắt đầu...' : 'Đang xem trước...') : (preview ? 'Tải xuống' : 'Tiếp tục')}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};
