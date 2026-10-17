const labels = { jpeg: 'JPG', jpg: 'JPG', tif: 'TIF', tiff: 'TIF', mpeg: 'MPG' };

/**
 * Extract clean, uppercase file extension label from filename (e.g., 'JPG', 'MP4', 'ZIP').
 * Handles multi-dot extensions like .tar.gz, .tar.bz2, .tar.xz.
 *
 * @param {string} filename - Filename or URL path
 * @param {string} fallback - Fallback label if no extension is found (default: 'FILE')
 * @returns {string} Clean uppercase extension label (up to 5 chars)
 */
export const fileTypeLabel = (filename, fallback = 'FILE') => {
  const clean = String(filename || '').split(/[?#]/, 1)[0].toLowerCase();
  const multi = clean.match(/\.(tar\.gz|tar\.bz2|tar\.xz)$/);
  const extension = multi?.[1] || clean.split('.').pop();
  if (!extension || extension === clean) return fallback;
  return (labels[extension] || extension.toUpperCase()).slice(0, 5);
};

/**
 * Detect whether a file or task is part of a split/multipart archive
 * (e.g., .part1.rar, .7z.001, .z01, .r01, or explicit task metadata).
 *
 * @param {string|object} taskOrFilename - File name string or download task object
 * @param {string} url - Optional URL to inspect for part patterns
 * @param {boolean} isMultipart - Explicit multipart flag
 * @param {number} totalParts - Total parts count
 * @returns {boolean} True if identified as a multipart archive
 */
export const isMultipartArchive = (taskOrFilename, url = '', isMultipart = false, totalParts = 0) => {
  if (isMultipart || totalParts > 1) return true;
  if (taskOrFilename && typeof taskOrFilename === 'object') {
    const obj = taskOrFilename;
    if (obj.is_multipart || obj.isMultipart || obj.archive_type === 'multipart' || obj.archiveType === 'multipart') return true;
    if (Number(obj.total_parts || obj.totalParts) > 1) return true;
    return isMultipartArchive(
      obj.filename || obj.displayName || '',
      obj.original_url || obj.url || obj.part_name || obj.partName || ''
    );
  }
  const str = `${taskOrFilename || ''} ${url || ''}`.toLowerCase();
  return (
    /\.part\d+(\.rar)?($|\s|[?#])/i.test(str) ||
    /\.7z\.\d+($|\s|[?#])/i.test(str) ||
    /\.z\d+($|\s|[?#])/i.test(str) ||
    /\.r\d+($|\s|[?#])/i.test(str) ||
    /\.\d{3}($|\s|[?#])/i.test(str)
  );
};
