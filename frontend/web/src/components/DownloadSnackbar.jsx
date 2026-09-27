import { useEffect, useState, useRef } from 'react';
import { 
  X, 
  ChevronDown, 
  Download,
  AlertTriangle,
  Loader2,
  Copy,
  FolderInput,
  CheckCircle2
} from 'lucide-react';
import { formatFileSize, formatSpeed, getFileCategory } from '../utils/formatters';
import { cancelDownloadTask, submitTaskPassword } from '../api/downloadApi';
import { FileTypeIcon } from './icons/FileTypeIcon';
import { RollingNumber } from './common/RollingNumber';

// Go báo `current` là số video đã hoàn tất. Khi đang convert, video hiển thị
// phải là video kế tiếp đang chạy: 0 -> [1/N], 1 -> [2/N].
const displayConvertIndex = (task) => {
  const total = Number(task?.convert_total) || 0;
  if (total <= 0) return 0;
  return Math.min((Number(task?.convert_current) || 0) + 1, total);
};

export const DownloadSnackbar = ({ tasks = [], transferTasks = [], summary = null }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [detailsMounted, setDetailsMounted] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [passwordInputs, setPasswordInputs] = useState({});
  const [submittingPasswordId, setSubmittingPasswordId] = useState(null);

  const activeDownloadTasks = tasks.filter((t) => [
    'queued',
    'resolving',
    'downloading',
    'waiting_extract',
    'extracting',
    'scanning',
    'converting',
    'password_required'
  ].includes(t.stage));

  const activeTransferTasks = transferTasks.filter((t) =>
    t.status === 'running' || t.status === 'completed' || t.status === 'failed'
  );

  const totalActiveCount = activeDownloadTasks.length + activeTransferTasks.length;

  const prevCountRef = useRef(totalActiveCount);
  useEffect(() => {
    if (totalActiveCount > prevCountRef.current) {
      setIsDismissed(false);
    }
    prevCountRef.current = totalActiveCount;
  }, [totalActiveCount]);

  useEffect(() => {
    if (isExpanded || !detailsMounted) return undefined;
    const timer = window.setTimeout(() => setDetailsMounted(false), 200);
    return () => window.clearTimeout(timer);
  }, [isExpanded, detailsMounted]);

  if (totalActiveCount === 0 || isDismissed) {
    return null;
  }

  const passwordCount = activeDownloadTasks.filter((t) => t.stage === 'password_required').length;
  const convertingTask = activeDownloadTasks.find((t) => t.stage === 'converting');
  const isScanning = activeDownloadTasks.some((t) => t.stage === 'scanning');
  const downloadingTask = activeDownloadTasks.find((t) => t.stage === 'downloading');
  const resolvingTask = activeDownloadTasks.find((t) => t.stage === 'resolving' || t.stage === 'queued');
  const extractingTask = activeDownloadTasks.find((t) => ['waiting_extract', 'extracting'].includes(t.stage));

  const hasDownloads = activeDownloadTasks.length > 0;
  const hasTransfers = activeTransferTasks.length > 0;
  const isDownloadingMode = Boolean(downloadingTask) || (!hasDownloads && hasTransfers);

  let aggregatePercent = 0;
  if (hasDownloads) {
    aggregatePercent = Boolean(downloadingTask)
      ? (summary?.download?.percent ?? downloadingTask?.download_percent ?? 0)
      : (summary?.extract?.percent ?? 0);
  } else if (hasTransfers) {
    aggregatePercent = Math.round(
      activeTransferTasks.reduce((sum, t) => sum + (Number(t.percent) || 0), 0) / activeTransferTasks.length
    );
  }

  const processingLabel = resolvingTask
    ? 'Đang tìm liên kết tải...'
    : convertingTask
      ? `[${displayConvertIndex(convertingTask)}/${convertingTask.convert_total || 0}] Đang tối ưu video`
      : isScanning
        ? 'Kiểm tra thư mục...'
        : extractingTask?.stage === 'waiting_extract'
          ? 'Chờ giải nén...'
          : 'Đang giải nén...';

  // SVG Circular Progress
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (aggregatePercent / 100) * circumference;

  // Màu ring tổng hợp
  const mainRingColor = passwordCount > 0
    ? 'text-red-500'
    : convertingTask
      ? 'text-purple-500'
      : isScanning
        ? 'text-emerald-500'
        : hasDownloads
          ? (isDownloadingMode ? 'text-blue-500' : 'text-orange-500')
          : activeTransferTasks.some((t) => t.status === 'failed')
            ? 'text-red-500'
            : activeTransferTasks.every((t) => t.status === 'completed')
              ? 'text-emerald-500'
              : 'text-indigo-500';

  const mainTextColor = passwordCount > 0
    ? 'text-red-400'
    : convertingTask
      ? 'text-purple-400'
      : isScanning
        ? 'text-emerald-400'
        : resolvingTask
          ? 'text-blue-400 animate-pulse'
          : isDownloadingMode
            ? 'text-blue-400'
            : 'text-orange-400 animate-pulse';

  const handlePasswordChange = (taskId, val) => {
    setPasswordInputs((prev) => ({ ...prev, [taskId]: val }));
  };

  const toggleExpanded = () => {
    if (isExpanded) {
      setIsExpanded(false);
      return;
    }
    setDetailsMounted(true);
    window.requestAnimationFrame(() => setIsExpanded(true));
  };

  const handleRetryPassword = async (taskId) => {
    const pwd = passwordInputs[taskId] || '';
    if (!pwd.trim()) return;
    setSubmittingPasswordId(taskId);
    await submitTaskPassword(taskId, pwd.trim());
    setSubmittingPasswordId(null);
  };

  const getTaskColors = (t) => {
    if (t.stage === 'password_required') return { ring: 'text-red-500', bg: 'bg-red-500/10 border-red-500/30', label: 'text-red-400', bar: 'bg-red-500' };
    if (t.stage === 'converting') return { ring: 'text-purple-500', bg: 'bg-purple-500/10 border-purple-500/30', label: 'text-purple-400', bar: 'bg-purple-500' };
    if (t.stage === 'scanning') return { ring: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/30', label: 'text-emerald-400', bar: 'bg-emerald-500' };
    if (['waiting_extract', 'extracting'].includes(t.stage)) return { ring: 'text-orange-500', bg: 'bg-orange-500/10 border-orange-500/30', label: 'text-orange-400', bar: 'bg-orange-500' };
    return { ring: 'text-blue-500', bg: 'bg-[#202124] border-[#383c42]', label: 'text-blue-400', bar: 'bg-blue-500' };
  };

  return (
    <div className={`fixed bottom-6 left-1/2 z-40 w-full -translate-x-1/2 transform select-none px-4 transition-[max-width] duration-200 ease-out ${isExpanded ? 'max-w-2xl' : 'max-w-md'} animate-fade-in`}>
      <div className="overflow-hidden rounded-2xl border border-[#383c42] bg-[#1c1d21] shadow-2xl">

        {/* Expanded detail list */}
        {detailsMounted && (
          <div className={`snackbar-details ${isExpanded ? 'snackbar-details-expanded' : ''}`}>
            <div className="min-h-0 overflow-hidden flex flex-col">
              {/* List header (Sticky / Fixed at top, does not scroll with task list) */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#383c42]/60 bg-[#1c1d21] flex-shrink-0 z-10">
                <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                  Đang chạy (<RollingNumber value={totalActiveCount} />)
                </span>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Scrollable task cards */}
              <div className={`max-h-[460px] space-y-2.5 overflow-y-auto p-4 custom-scrollbar ${isExpanded ? 'border-b border-[#383c42]' : ''}`}>
                {/* Transfer tasks cards (Copy / Move) */}
                {activeTransferTasks.map((t) => {
                  const isCompleted = t.status === 'completed';
                  const isFailed = t.status === 'failed';
                  const isCopy = t.action === 'copy';
                  const pct = Math.max(0, Math.min(100, t.percent || 0));

                  return (
                    <div
                      key={t.id}
                      className={`rounded-xl border flex min-h-[70px] flex-col justify-center px-3 py-2.5 ${
                        isFailed
                          ? 'bg-red-500/10 border-red-500/30'
                          : isCompleted
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : 'bg-[#202124] border-[#383c42]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 rounded-xl bg-[#28292d] border border-white/10 flex items-center justify-center flex-shrink-0">
                          {isFailed ? (
                            <AlertTriangle className="w-5 h-5 text-red-400" />
                          ) : isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          ) : isCopy ? (
                            <Copy className="w-5 h-5 text-indigo-400" />
                          ) : (
                            <FolderInput className="w-5 h-5 text-amber-400" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <div className="text-xs font-semibold text-white truncate" title={t.dest}>
                              {isCopy ? 'Sao chép đến' : 'Di chuyển đến'}{' '}
                              <span className="text-blue-300 font-mono">{t.dest}</span>
                            </div>
                            <span
                              className={`text-[11px] font-mono font-bold flex-shrink-0 ${
                                isCompleted
                                  ? 'text-emerald-400'
                                  : isFailed
                                  ? 'text-red-400'
                                  : 'text-indigo-400'
                              }`}
                            >
                              <RollingNumber value={Math.round(pct)} suffix="%" />
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] font-mono text-gray-400">
                            <span className="truncate">
                              {isCompleted
                                ? t.message || 'Thao tác hoàn tất'
                                : isFailed
                                ? t.message || 'Thao tác thất bại'
                                : t.current_file
                                ? t.current_file
                                : `${t.itemsCount || 1} mục`}
                            </span>
                            {t.total_bytes > 0 && !isCompleted && !isFailed && (
                              <span className="text-gray-400 flex-shrink-0 ml-2">
                                {formatFileSize(t.copied_bytes)} / {formatFileSize(t.total_bytes)}
                              </span>
                            )}
                          </div>

                          {/* Progress Bar */}
                          <div className="mt-1.5 h-[3px] rounded-full bg-[#383c42] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isFailed
                                  ? 'bg-red-500'
                                  : isCompleted
                                  ? 'bg-emerald-500'
                                  : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                              }`}
                              style={{ width: `${isCompleted ? 100 : Math.max(4, pct)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Download task cards */}
                {activeDownloadTasks.map((t) => {
                  const colors = getTaskColors(t);
                  const isPasswordRequired = t.stage === 'password_required';
                  const isExtractingTask = ['waiting_extract', 'extracting'].includes(t.stage);
                  const isScanningTask = t.stage === 'scanning';
                  const isConvertingTask = t.stage === 'converting';
                  const isDownloadingTask = ['queued', 'resolving', 'downloading'].includes(t.stage);
                  const fileLabel = t.filename || t.original_url || '...';

                  // Mọi task dùng thanh ngang. Download có phần trăm xác định;
                  // resolve/giải nén/quét/convert dùng thanh chạy vô hạn.
                  const hasBarProgress = t.stage === 'downloading';
                  const barPct = hasBarProgress ? (t.download_percent ?? 0) : 0;
                  const isIndeterminate = !isPasswordRequired && !hasBarProgress;

                  return (
                    <div key={t.task_id} className={`rounded-xl border flex min-h-[70px] flex-col justify-center px-3 py-2.5 ${colors.bg}`}>
                      <div className="flex items-center gap-3">
                        {/* Không dùng vòng quanh icon trong danh sách mở rộng. */}
                        <div className="relative h-10 w-10 flex-shrink-0">
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <FileTypeIcon
                              filename={fileLabel}
                              fallback={getFileCategory(fileLabel) === 'video' ? 'MP4' : getFileCategory(fileLabel) === 'picture' ? 'IMG' : 'ZIP'}
                              className={`h-8 w-8 ${colors.label}`}
                            />
                          </div>
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-white truncate mb-0.5" title={fileLabel}>
                            {fileLabel}
                          </div>
                          {isPasswordRequired ? (
                            <div className={`text-[11px] font-semibold flex items-center gap-1 ${colors.label}`}>
                              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                              {t.error || 'Sai mật khẩu giải nén'}
                            </div>
                          ) : isConvertingTask ? (
                            <div className={`text-[11px] font-mono font-bold ${colors.label}`}>
                              [<RollingNumber value={displayConvertIndex(t)} />/{t.convert_total || 0}] Đang tối ưu video...
                            </div>
                          ) : isScanningTask ? (
                            <div className={`text-[11px] font-mono font-semibold animate-pulse ${colors.label}`}>
                              🔍 Kiểm tra thư mục...
                            </div>
                          ) : isExtractingTask ? (
                            <div className={`text-[11px] font-mono font-semibold animate-pulse ${colors.label}`}>
                              Giải nén 7-Zip...
                            </div>
                          ) : (
                            <div className="flex items-center justify-between text-[11px] font-mono">
                              <span className="text-gray-400">
                                {t.stage === 'resolving' ? 'Đang phân tích link...' : `${formatFileSize(t.downloaded_bytes)} / ${t.download_total_bytes ? formatFileSize(t.download_total_bytes) : '?'}`}
                              </span>
                              {t.download_speed_bytes > 0 && (
                                <span className="text-emerald-400 font-semibold">{formatSpeed(t.download_speed_bytes)}</span>
                              )}
                            </div>
                          )}

                          {/* Thin progress bar */}
                          {hasBarProgress && (
                            <div className="mt-1.5 h-[3px] rounded-full bg-[#383c42] overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${colors.bar}`}
                                style={{ width: `${barPct}%` }}
                              />
                            </div>
                          )}
                          {isIndeterminate && (
                            <div className={`mt-1.5 google-linear-progress ${isConvertingTask ? 'google-linear-progress-purple' : isScanningTask ? 'google-linear-progress-green' : ''}`}>
                              <div className="google-linear-progress-bar" />
                            </div>
                          )}
                        </div>

                        {/* Cancel */}
                        {!t.coordinator_job && <button
                          onClick={() => cancelDownloadTask(t.task_id)}
                          className="p-1 rounded-full text-gray-500 hover:text-red-400 hover:bg-red-500/20 transition-colors flex-shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>}
                      </div>

                      {/* Password input */}
                      {isPasswordRequired && !t.coordinator_job && (
                        <div className="flex items-center gap-2 mt-2.5">
                          <input
                            type="text"
                            value={passwordInputs[t.task_id] || ''}
                            onChange={(e) => handlePasswordChange(t.task_id, e.target.value)}
                            placeholder="Nhập mật khẩu đúng..."
                            className="flex-1 bg-[#1c1d21] border border-red-500/50 focus:border-red-400 rounded-lg px-2.5 py-1 text-white font-mono placeholder-gray-500 outline-none text-[11px]"
                          />
                          <button
                            onClick={() => handleRetryPassword(t.task_id)}
                            disabled={submittingPasswordId === t.task_id}
                            className="px-3 py-1 text-[11px] font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-all disabled:opacity-50"
                          >
                            {submittingPasswordId === t.task_id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : 'Thử lại'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Collapsed bar — always at bottom */}
        <div
          onClick={toggleExpanded}
          className="flex min-h-[56px] items-center justify-between gap-3 px-4 py-2.5 transition-all hover:bg-[#202124] cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Main ring */}
            <div className="relative w-10 h-10 flex-shrink-0">
              <svg viewBox="0 0 44 44" className={`w-10 h-10 ${isDownloadingMode ? '-rotate-90' : 'google-spinner-svg'}`}>
                <circle cx="22" cy="22" r={radius} stroke="currentColor" strokeWidth="3" fill="transparent" className="text-[#383c42]" />
                <circle
                  cx="22" cy="22" r={radius}
                  stroke="currentColor" strokeWidth="3" fill="transparent"
                  strokeLinecap="round"
                  strokeDasharray={isDownloadingMode ? circumference : undefined}
                  strokeDashoffset={isDownloadingMode ? strokeDashoffset : undefined}
                  className={`transition-all duration-300 ${mainRingColor} ${isDownloadingMode ? '' : 'google-spinner-circle'}`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="font-bold text-xs text-white leading-none"><RollingNumber value={totalActiveCount} /></span>
              </div>
            </div>

            {/* Status text */}
            <div className="text-xs min-w-0 flex-1">
              <div className="font-bold text-white truncate">
                {hasDownloads && hasTransfers
                  ? <span><RollingNumber value={totalActiveCount} /> tiến trình đang chạy</span>
                  : hasTransfers
                  ? activeTransferTasks.length === 1
                    ? activeTransferTasks[0].status === 'completed'
                      ? 'Thao tác hoàn tất'
                      : activeTransferTasks[0].action === 'copy'
                      ? 'Đang sao chép'
                      : 'Đang di chuyển'
                    : <span>Đang xử lý <RollingNumber value={activeTransferTasks.length} /> tác vụ sao chép/di chuyển</span>
                  : 'Tiến trình đang chạy'}
              </div>

              {hasDownloads ? (
                isDownloadingMode ? (
                  <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px]">
                    <span className="font-bold text-blue-400 flex-shrink-0 whitespace-nowrap">
                      <RollingNumber value={Number(aggregatePercent).toFixed(1)} suffix="%" />
                    </span>
                    {activeDownloadTasks.find((t) => t.download_speed_bytes > 0) && (
                      <span className="text-emerald-400 font-semibold ml-auto flex-shrink-0">
                        {formatSpeed(activeDownloadTasks.find((t) => t.download_speed_bytes > 0)?.download_speed_bytes)}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className={`mt-0.5 text-[11px] font-mono font-semibold truncate ${mainTextColor}`}>
                    {passwordCount > 0 ? (
                      <span><RollingNumber value={passwordCount} /> tệp sai mật khẩu</span>
                    ) : convertingTask ? (
                      <span>[<RollingNumber value={displayConvertIndex(convertingTask)} />/{convertingTask.convert_total || 0}] Đang tối ưu video</span>
                    ) : (
                      processingLabel
                    )}
                  </div>
                )
              ) : hasTransfers ? (
                <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px]">
                  <span className="font-bold text-indigo-400 flex-shrink-0 whitespace-nowrap">
                    <RollingNumber value={Number(aggregatePercent).toFixed(0)} suffix="%" />
                  </span>
                  <span className="text-gray-400 truncate ml-1">
                    {activeTransferTasks.length === 1
                      ? activeTransferTasks[0].status === 'completed'
                        ? (activeTransferTasks[0].message || 'Hoàn tất')
                        : (activeTransferTasks[0].current_file || activeTransferTasks[0].dest)
                      : <span><RollingNumber value={activeTransferTasks.length} /> tác vụ</span>}
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Dismiss button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsDismissed(true);
            }}
            title="Đóng thanh thông báo"
            className="p-1 rounded-full text-gray-400 hover:text-red-400 hover:bg-red-500/20 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
