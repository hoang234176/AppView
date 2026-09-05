import { useMemo, useState } from 'react';
import { X, Download, Video, Image, Trash2, AlertTriangle, RotateCw } from 'lucide-react';
import { formatFileSize, formatSpeed, getFileCategory } from '../utils/formatters';
import { submitTaskPassword, cancelDownloadTask, deleteDownloadTask, retryDownloadTask, retryCoordinatorArchive, submitCoordinatorArchivePassword, cancelCoordinatorArchive, submitVideoDecision, applyCoordinatorVideoDecisions } from '../api/downloadApi';
import { FileTypeIcon } from './icons/FileTypeIcon';
import { isActiveDownload, isRetryableDownload, needsDownloadAttention, needsPassword, canCancelDownload, isCancelledOptimization } from '../utils/downloadPresentation';

const isRetryableDownloadError = isRetryableDownload;
const getUnoptimizedCount = (t) => {
  if (t?.unoptimized_video_count != null && t?.unoptimized_video_count !== undefined) {
    return Number(t.unoptimized_video_count);
  }
  if (t?.unoptimizedVideoCount != null && t?.unoptimizedVideoCount !== undefined) {
    return Number(t.unoptimizedVideoCount);
  }
  if (Array.isArray(t?.videos) && t.videos.length > 0) {
    return t.videos.filter((v) => v.optimizationRequired && v.state !== 'completed').length;
  }
  const total = Number(t?.convert_total) || Number(t?.conversionTotal) || Number(t?.invalid_video_count) || Number(t?.invalidVideoCount) || 0;
  const current = Number(t?.convert_current) || Number(t?.conversionCurrent) || 0;
  return Math.max(0, total - current);
};

const COMPLETED_GROUPS = [
  ['File nén', 'archive', ({ className }) => <FileTypeIcon fallback="ZIP" className={className} />],
  ['Video', 'video', Video],
  ['Ảnh', 'picture', Image],
  ['Lỗi tối ưu', 'optimization_error', AlertTriangle],
];
const displayConvertIndex = (task) => {
  const total = Number(task.convert_total) || 0;
  return total ? Math.min((Number(task.convert_current) || 0) + 1, total) : 0;
};

export const DownloadPanelModal = ({ isOpen, onClose, tasks = [], onDeleteTask, selectedTab: controlledTab, onSelectedTabChange }) => {
  const [passwords, setPasswords] = useState({});
  const [localTab, setLocalTab] = useState('active');
  const [pendingPasswords, setPendingPasswords] = useState({});
  const [pendingRetries, setPendingRetries] = useState({});
  const [pendingCancels, setPendingCancels] = useState({});
  const [pendingDecisions, setPendingDecisions] = useState({});
  const [submittingApply, setSubmittingApply] = useState({});
  const selectedTab = controlledTab ?? localTab;
  const setSelectedTab = onSelectedTabChange ?? setLocalTab;
  const active = useMemo(() => tasks.filter((t) => isActiveDownload(t) || isRetryableDownloadError(t)), [tasks]);
  const cancelled = useMemo(() => tasks.filter((t) => t.stage === 'cancelled' && !isCancelledOptimization(t)), [tasks]);
  const completed = useMemo(() => tasks.filter((t) => !isActiveDownload(t) && !isRetryableDownloadError(t) && (t.stage === 'completed' || isCancelledOptimization(t))), [tasks]);
  const completedByGroup = useMemo(() => Object.fromEntries(
    COMPLETED_GROUPS.map(([, category]) => [
      category,
      completed.filter((t) => category === 'optimization_error'
        ? t.error_code === 'VIDEO_CONVERT_UNAVAILABLE'
        : t.error_code !== 'VIDEO_CONVERT_UNAVAILABLE' && getFileCategory(t.filename || t.original_url) === category),
    ]),
  ), [completed]);
  if (!isOpen) return null;

  const icon = (task, color = 'text-blue-400') => {
    const category = getFileCategory(task.filename || task.original_url);
    const fallback = category === 'video' ? 'MP4' : category === 'picture' ? 'IMG' : 'ZIP';
    return <FileTypeIcon filename={task.filename || task.original_url} fallback={fallback} className={`h-7 w-7 ${color}`} />;
  };
  const color = (stage) => ['error', 'failed', 'password_required', 'interrupted'].includes(stage) ? 'text-amber-400' : stage === 'scanning' ? 'text-emerald-400' : stage === 'converting' ? 'text-purple-400' : ['extracting', 'waiting_extract'].includes(stage) ? 'text-orange-400' : 'text-blue-400';
  const status = (t) => {
    if (t.stage === 'queued') return 'Đang chờ tải...';
    if (t.stage === 'resolving') return 'Đang lấy liên kết...';
    if (t.stage === 'downloading') return `${formatFileSize(t.downloaded_bytes)} / ${t.download_total_bytes ? formatFileSize(t.download_total_bytes) : 'Không rõ'} • ${formatSpeed(t.download_speed_bytes)}`;
    if (t.stage === 'waiting_extract') return 'Đang chờ giải nén...';
    if (t.stage === 'extracting') return 'Đang giải nén...';
    if (t.stage === 'scanning') return 'Đang kiểm tra thư mục...';
	if (t.stage === 'video_decision_required') return 'Chọn chất lượng cho từng video cần tối ưu';
    if (t.stage === 'converting') return `[${displayConvertIndex(t)}/${t.convert_total || 0}] Đang tối ưu video...`;
    if (t.invalid_video_count > 0) return `${t.total_video_count || t.invalid_video_count} video • ${t.invalid_video_count} cần tối ưu`;
    if (t.stage === 'password_required' || t.password_required) return 'Yêu cầu mật khẩu giải nén';
    if (['error', 'failed', 'interrupted'].includes(t.stage)) return `${t.failure_stage ? `[${t.failure_stage}] ` : ''}${t.error || 'Tải xuống bị lỗi.'}`;
    return t.stage;
  };
  const remove = async (id) => { onDeleteTask?.(id); await deleteDownloadTask(id); };
  const submitPassword = async (task) => { const value = (passwords[task.task_id] || '').trim(); if (!value || pendingPasswords[task.task_id]) return; setPendingPasswords((old) => ({ ...old, [task.task_id]: true })); try { const result = task.coordinator_job ? await submitCoordinatorArchivePassword(task.task_id, value) : await submitTaskPassword(task.task_id, value); if (result?.success) setPasswords((old) => ({ ...old, [task.task_id]: '' })); } finally { setPendingPasswords((old) => ({ ...old, [task.task_id]: false })); } };
  const retry = async (task) => { if (pendingRetries[task.task_id]) return; setPendingRetries((old) => ({ ...old, [task.task_id]: true })); try { if (task.coordinator_job) await retryCoordinatorArchive(task.task_id); else await retryDownloadTask(task.task_id); } finally { setPendingRetries((old) => ({ ...old, [task.task_id]: false })); } };
  const cancel = async (task) => { if (pendingCancels[task.task_id]) return; setPendingCancels((old) => ({ ...old, [task.task_id]: true })); try { if (task.coordinator_job) await cancelCoordinatorArchive(task.task_id); else await cancelDownloadTask(task.task_id); } finally { setPendingCancels((old) => ({ ...old, [task.task_id]: false })); } };
  const handleSelectQuality = (taskId, videoId, quality) => {
    setPendingDecisions((prev) => ({
      ...prev,
      [`${taskId}:${videoId}`]: quality,
    }));
  };
  const handleApply = async (task) => {
    if (submittingApply[task.task_id]) return;
    const decisionVideos = (task.videos || []).filter((v) => v.optimizationRequired && v.allowedQualities?.length > 0);
    const decisions = {};
    for (const v of decisionVideos) {
      const chosen = pendingDecisions[`${task.task_id}:${v.id}`] || v.selectedQuality;
      if (!chosen) return;
      decisions[v.id] = chosen;
    }
    setSubmittingApply((prev) => ({ ...prev, [task.task_id]: true }));
    try {
      const res = await applyCoordinatorVideoDecisions(task.task_id, decisions);
      if (!res?.success) {
        alert(res?.message || 'Không thể áp dụng lựa chọn video.');
      }
    } finally {
      setSubmittingApply((prev) => ({ ...prev, [task.task_id]: false }));
    }
  };
  const videoChoices = (t) => {
    const decisionVideos = (t.videos || []).filter((v) => v.optimizationRequired && v.allowedQualities?.length > 0);
    const allSelected = decisionVideos.length > 0 && decisionVideos.every((v) => pendingDecisions[`${t.task_id}:${v.id}`] || v.selectedQuality);
    const isSubmitting = submittingApply[t.task_id];
    return (
      <div className="space-y-2.5">
        <div className="space-y-2">
          {decisionVideos.map((v) => {
            const currentVal = pendingDecisions[`${t.task_id}:${v.id}`] || v.selectedQuality || '';
            return (
              <div key={v.id} className="flex items-center justify-between gap-3 rounded-xl border border-purple-400/25 bg-black/20 px-3 py-2 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-white" title={v.displayName}>{v.displayName}</div>
                  <div className="text-[10px] text-gray-400">{v.width}×{v.height} • {formatFileSize(v.sourceSizeBytes || 0)}</div>
                </div>
                <div className="flex-shrink-0">
                  <select
                    value={currentVal}
                    onChange={(e) => handleSelectQuality(t.task_id, v.id, e.target.value)}
                    disabled={isSubmitting}
                    className="rounded-lg border border-purple-400/40 bg-[#1c1d21] px-2.5 py-1.5 text-xs font-bold text-purple-200 outline-none hover:border-purple-300 focus:border-purple-400 disabled:opacity-50"
                  >
                    <option value="" disabled>Chọn chất lượng...</option>
                    {v.allowedQualities.map((q) => (
                      <option key={q} value={q}>
                        {q.toUpperCase()}{v.estimates?.[q] ? ` (~${formatFileSize(v.estimates[q])})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end pt-1">
          <button
            disabled={!allSelected || isSubmitting}
            onClick={() => handleApply(t)}
            className="rounded-xl bg-purple-600 px-4 py-1.5 text-xs font-bold text-white transition-opacity hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting ? 'Đang áp dụng...' : 'Áp dụng'}
          </button>
        </div>
      </div>
    );
  };

  const activeCard = (t) => {
    const loading = ['queued', 'resolving', 'waiting_extract', 'extracting', 'scanning', 'converting'].includes(t.stage);
    const cancelledOptimization = isCancelledOptimization(t);
    const taskColor = cancelledOptimization || needsDownloadAttention(t) ? 'text-amber-400' : color(t.stage);
    const unoptimizedCount = getUnoptimizedCount(t);
    return <div key={t.task_id} className="min-h-[108px] space-y-3 rounded-2xl border border-[#383c42] bg-[#202124] p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center">{icon(t, taskColor)}</div>
        <div className="min-w-0 flex-1"><h5 className="truncate text-xs font-bold text-white">{t.filename || 'Đang phân tích liên kết...'}</h5>{t.stage === 'downloading' ? <p className="mt-1 flex items-center justify-between gap-3 text-[11px] font-medium"><span className="truncate text-gray-400">{formatFileSize(t.downloaded_bytes)} / {t.download_total_bytes ? formatFileSize(t.download_total_bytes) : 'Không rõ'}</span><span className="flex-shrink-0 text-emerald-400">{formatSpeed(t.download_speed_bytes)}</span></p> : cancelledOptimization ? <div className="mt-1 text-[11px] font-medium leading-tight"><span className="text-emerald-400">Đã tải và giải nén</span><br /><span className="text-amber-400">{unoptimizedCount} video chưa được tối ưu hóa</span></div> : <p className={`mt-1 text-[11px] font-medium ${taskColor}`}>{status(t)}</p>}</div>
        <div className="flex items-center gap-1">{isRetryableDownloadError(t) && <button disabled={pendingRetries[t.task_id]} onClick={() => retry(t)} title="Tải tiếp" className="rounded-full p-1 text-blue-400 hover:bg-blue-500/20 disabled:opacity-50"><RotateCw className="h-4 w-4" /></button>}{canCancelDownload(t) && <button disabled={pendingCancels[t.task_id]} onClick={() => cancel(t)} title="Hủy tác vụ" className="rounded-full p-1 text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"><X className="h-4 w-4" /></button>}</div>
      </div>
      {t.stage === 'downloading' && <div className="h-2 overflow-hidden rounded-full bg-[#18191c]"><div className="h-full rounded-full bg-blue-500" style={{ width: `${t.download_percent || 0}%` }} /></div>}
      {loading && <div className={`google-linear-progress ${t.stage === 'converting' ? 'google-linear-progress-purple' : t.stage === 'scanning' ? 'google-linear-progress-green' : ''}`}><div className="google-linear-progress-bar" /></div>}
      {needsPassword(t) && <div className="flex gap-2"><input type="password" value={passwords[t.task_id] || ''} onChange={(e) => setPasswords((old) => ({ ...old, [t.task_id]: e.target.value }))} placeholder="Nhập lại mật khẩu..." className="min-w-0 flex-1 rounded-xl border border-amber-500/50 bg-[#1c1d21] px-3 py-1.5 text-xs text-white outline-none" /><button disabled={pendingPasswords[t.task_id]} onClick={() => submitPassword(t)} className="rounded-xl bg-amber-500 px-3 text-xs font-bold text-[#1c1d21] disabled:opacity-60">{pendingPasswords[t.task_id] ? 'Đang gửi...' : 'Thử giải nén'}</button></div>}
	  {t.stage === 'video_decision_required' && <div className="space-y-2">{videoChoices(t)}</div>}
    </div>;
  };

  const historyCard = (t) => {
    const isOptimizationError = t.error_code === 'VIDEO_CONVERT_UNAVAILABLE';
    const cancelledOptimization = isCancelledOptimization(t);
    const unoptimizedCount = getUnoptimizedCount(t);
    return <div key={t.task_id} className="flex items-center gap-3 rounded-2xl border border-[#383c42]/60 bg-[#202124]/60 p-3">
      {icon(t, cancelledOptimization || isOptimizationError ? 'text-amber-400' : 'text-gray-400')}
      <div className="min-w-0 flex-1">
        <h5 className="truncate text-xs font-semibold text-gray-200">{t.filename || t.original_url}</h5>
        {cancelledOptimization ? (
          <div className="text-[10px] font-medium leading-tight">
            <span className="text-emerald-400">Đã tải và giải nén</span>
            <br />
            <span className="text-amber-400">{unoptimizedCount} video chưa được tối ưu hóa</span>
          </div>
        ) : (
          <p className={`text-[10px] ${isOptimizationError ? 'text-amber-400' : t.stage === 'completed' ? 'text-emerald-400' : t.stage === 'cancelled' ? 'text-gray-400' : 'text-red-400'}`}>
            {isOptimizationError ? '⚠ Đã giải nén — chưa tối ưu được video' : t.stage === 'completed' ? (t.convert_total > 0 ? `✓ Đã giải nén - tối ưu ${t.convert_total} video` : '✓ Đã giải nén hoàn tất') : t.stage === 'cancelled' ? '⊘ Đã hủy' : `✕ ${t.error || 'Có lỗi xảy ra'}`}
          </p>
        )}
      </div>
      {t.stage === 'error' && <button onClick={() => retryDownloadTask(t.task_id)} className="rounded-lg bg-blue-600 px-2 py-1 text-[10px] font-bold text-white">Thử lại</button>}
      <button onClick={() => remove(t.task_id)} title="Xóa" className="text-gray-500 hover:text-gray-300"><Trash2 className="h-4 w-4" /></button>
    </div>;
  };
  return <div onClick={onClose} className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 animate-fade-in"><div onClick={(e) => e.stopPropagation()} className="flex h-[80vh] w-full max-w-3xl flex-col rounded-3xl border border-[#383c42] bg-[#1c1d21] p-6 shadow-2xl animate-modal-enter">
    <div className="mb-4 flex items-center justify-between border-b border-[#383c42] pb-3"><div className="flex items-center gap-2.5"><Download className="h-5 w-5 text-blue-400" /><div><h3 className="text-sm font-bold text-white">Quản lý tải xuống</h3><p className="text-[11px] text-gray-400">{tasks.length} nhiệm vụ</p></div></div><button onClick={onClose} className="p-1.5 text-gray-400"><X className="h-5 w-5" /></button></div>
    <div className="mb-4 grid grid-cols-3 rounded-2xl border border-[#383c42] bg-[#28292d] p-1">
      <button onClick={() => setSelectedTab('active')} className={`rounded-xl border border-transparent py-2.5 text-xs font-extrabold transition-colors duration-200 ${selectedTab === 'active' ? 'border-blue-300/70 bg-blue-400/25 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}>Đang tải ({active.length})</button>
      <button onClick={() => setSelectedTab('completed')} className={`rounded-xl border border-transparent py-2.5 text-xs font-extrabold transition-colors duration-200 ${selectedTab === 'completed' ? 'border-blue-300/70 bg-blue-400/25 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}>Đã tải ({completed.length})</button>
      <button onClick={() => setSelectedTab('cancelled')} className={`rounded-xl border border-transparent py-2.5 text-xs font-extrabold transition-colors duration-200 ${selectedTab === 'cancelled' ? 'border-amber-300/50 bg-amber-400/15 text-amber-200 shadow-sm' : 'text-gray-400 hover:text-white'}`}>Đã hủy ({cancelled.length})</button>
    </div>
    {/* Vùng danh sách cuộn độc lập; header và tab luôn đứng yên. */}
    <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-[#383c42] bg-[#202124] p-3 custom-scrollbar">
      {selectedTab === 'active' && <section className="space-y-3">{active.length ? <>{active.filter((t) => !isRetryableDownloadError(t)).map(activeCard)}{active.some(isRetryableDownloadError) && <div className="space-y-2"><h5 className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-red-400"><AlertTriangle className="h-3.5 w-3.5" />Lỗi tải xuống</h5>{active.filter(isRetryableDownloadError).map(activeCard)}</div>}</> : <p className="py-10 text-center text-xs text-gray-500">Không có tác vụ đang xử lý.</p>}</section>}
      {selectedTab === 'completed' && <section className="space-y-4">{COMPLETED_GROUPS.map(([label, category, GroupIcon]) => { const list = completedByGroup[category]; return list.length ? <div key={category} className="space-y-2"><h5 className={`flex items-center gap-1.5 text-[11px] font-bold uppercase ${category === 'optimization_error' ? 'text-amber-400' : 'text-gray-400'}`}><GroupIcon className="h-3.5 w-3.5" />{label} ({list.length})</h5>{list.map(historyCard)}</div> : null; })}{!completed.length && <p className="py-10 text-center text-xs text-gray-500">Chưa có tệp đã tải.</p>}</section>}
      {selectedTab === 'cancelled' && <section className="space-y-3">{cancelled.length ? cancelled.map(historyCard) : <p className="py-10 text-center text-xs text-gray-500">Chưa có tác vụ đã hủy.</p>}</section>}
    </div>
  </div></div>;
};
