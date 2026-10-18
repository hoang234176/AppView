import { useState, useRef, useEffect, useCallback } from 'react';
import { fetchCoordinatorDownloads } from '../api/downloadApi';
import { isMultipartArchive } from '../utils/fileType';
import { isActiveDownload, needsDownloadAttention } from '../utils/downloadPresentation';

/**
 * useCoordinatorDownloads — Custom hook managing Coordinator background downloads & jobs
 *
 * @param {Object} params
 * @param {boolean} params.isConnected
 */
export function useCoordinatorDownloads({ isConnected }) {
  const [downloadTasks, setDownloadTasks] = useState([]);
  const [downloadSummary, setDownloadSummary] = useState(null);
  const [showDownloadPanel, setShowDownloadPanel] = useState(false);
  const [downloadPanelTab, setDownloadPanelTab] = useState('active');
  const [showDownloadMediafireModal, setShowDownloadMediafireModal] = useState(false);
  const [showDownloadMediaModal, setShowDownloadMediaModal] = useState(false);

  const coordinatorPollersRef = useRef(new Map());
  const isMountedRef = useRef(true);
  const downloadRefreshSequenceRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      coordinatorPollersRef.current.forEach((timer) => window.clearTimeout(timer));
      coordinatorPollersRef.current.clear();
    };
  }, []);

  const mapCoordinatorJob = useCallback((job) => {
    const progress = job.progress && typeof job.progress === 'object' ? job.progress : {};
    const downloadedBytes = Number(progress.downloadedBytes) || 0;
    const totalBytes = Number(progress.totalBytes) || 0;
    const stage = job.stage || (job.state === 'downloading' ? (progress.state || 'downloading') : job.state === 'failed' ? 'error' : job.state);
    const source = job.source || (
      job.url?.includes('youtube.com') || job.url?.includes('youtu.be') ? 'youtube' :
      job.url?.includes('tiktok.com') ? 'tiktok' :
      (job.url?.includes('facebook.com') || job.url?.includes('fb.watch') || job.url?.includes('fb.com') || job.url?.includes('fb.me')) ? 'facebook' :
      (job.url?.includes('instagram.com') || job.url?.includes('instagr.am')) ? 'instagram' :
      (job.url?.includes('x.com') || job.url?.includes('twitter.com') || job.url?.includes('t.co')) ? 'x' : ''
    );
    return {
      task_id: job.id,
      original_url: job.url,
      source,
      filename: job.displayName || job.filename || progress.filename || '',
      destination: job.destination || '',
      stage,
      downloaded_bytes: downloadedBytes,
      download_total_bytes: totalBytes || null,
      download_percent: totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : null,
      download_speed_bytes: Number(progress.speedBytes) || 0,
      extracted_percent: progress.extractedPercent ?? null,
      convert_total: Number(job.conversionTotal ?? progress.conversion?.total) || 0,
      convert_current: Number(job.conversionCurrent ?? progress.conversion?.current) || 0,
      error: job.error?.message || null,
      error_code: job.error?.code || null,
      failure_stage: job.failureStage || null,
      coordinator_job: true,
      password_required: Boolean(job.passwordRequired),
      archive_downloaded: Boolean(job.archiveDownloaded),
      archive_extracted: Boolean(job.archiveExtracted),
      total_video_count: Number(job.totalVideoCount) || 0,
      invalid_video_count: Number(job.invalidVideoCount) || 0,
      videos: Array.isArray(job.videos) ? job.videos : [],
      optimization_cancelled: Boolean(job.optimizationCancelled || progress.optimizationCancelled),
      cancelled_from_stage: job.cancelledFromStage || progress.cancelledFromStage || null,
      created_at: job.createdAt || null,
      updated_at: job.updatedAt || null,
      is_multipart: Boolean(
        job.isMultipart ||
        job.is_multipart ||
        progress.isMultipart ||
        progress.is_multipart ||
        (Number(job.totalParts || job.total_parts || progress.totalParts || progress.total_parts) > 1) ||
        isMultipartArchive(job.displayName || job.filename || progress.filename || '', job.url || job.sourceUrl || job.partName || progress.partName || '')
      ),
      total_parts: Number(job.totalParts || job.total_parts || progress.totalParts || progress.total_parts) || 0,
      current_part: Number(job.currentPart || job.current_part || progress.currentPart || progress.current_part) || 0,
      part_name: job.partName || job.part_name || progress.partName || progress.part_name || '',
    };
  }, []);

  const refreshCoordinatorDownloads = useCallback(async () => {
    const requestSequence = ++downloadRefreshSequenceRef.current;
    if (!isConnected) {
      setDownloadTasks([]);
      return;
    }
    const response = await fetchCoordinatorDownloads();
    if (requestSequence !== downloadRefreshSequenceRef.current) return;
    if (isMountedRef.current && response.success) {
      setDownloadTasks(response.data.map(mapCoordinatorJob));
    }
  }, [isConnected, mapCoordinatorJob]);

  useEffect(() => {
    refreshCoordinatorDownloads();
  }, [refreshCoordinatorDownloads]);

  const handleCoordinatorJobCreated = useCallback((job) => {
    if (job?.id) refreshCoordinatorDownloads();
  }, [refreshCoordinatorDownloads]);

  const activeDownloadCount = downloadTasks.filter(isActiveDownload).length;
  const downloadingTask = downloadTasks.find((t) => t.stage === 'downloading');
  const isDownloadingMode = Boolean(downloadingTask);
  const downloadProgressPercent = isDownloadingMode
    ? downloadingTask.download_percent ?? 0
    : 0;
  const hasPasswordError = downloadTasks.some(needsDownloadAttention);
  const isScanning = downloadTasks.some((t) => t.stage === 'scanning');
  const isConverting = downloadTasks.some((t) => t.stage === 'converting');

  return {
    downloadTasks,
    setDownloadTasks,
    downloadSummary,
    setDownloadSummary,
    showDownloadPanel,
    setShowDownloadPanel,
    downloadPanelTab,
    setDownloadPanelTab,
    showDownloadMediafireModal,
    setShowDownloadMediafireModal,
    showDownloadMediaModal,
    setShowDownloadMediaModal,
    refreshCoordinatorDownloads,
    handleCoordinatorJobCreated,
    activeDownloadCount,
    downloadProgressPercent,
    isDownloadingMode,
    hasPasswordError,
    isScanning,
    isConverting,
  };
}
