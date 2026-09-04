export const downloadGroup = (task) => task.stage === 'completed' ? 'completed' : task.stage === 'cancelled' ? 'cancelled' : 'active';
export const isActiveDownload = (task) => downloadGroup(task) === 'active';
export const isRetryableDownload = (task) => ['error', 'failed', 'interrupted'].includes(task.stage) && task.error_code !== 'VIDEO_CONVERT_UNAVAILABLE';
export const needsPassword = (task) => Boolean(task.password_required || task.stage === 'password_required');
export const canCancelDownload = (task) => downloadGroup(task) === 'active';

export const needsDownloadAttention = (task) => Boolean(
  needsPassword(task) || ['video_decision_required', 'error', 'failed', 'interrupted'].includes(task.stage),
);
