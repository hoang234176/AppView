const labels = { jpeg: 'JPG', jpg: 'JPG', tif: 'TIF', tiff: 'TIF', mpeg: 'MPG' };

export const fileTypeLabel = (filename, fallback = 'FILE') => {
  const clean = String(filename || '').split(/[?#]/, 1)[0].toLowerCase();
  const multi = clean.match(/\.(tar\.gz|tar\.bz2|tar\.xz)$/);
  const extension = multi?.[1] || clean.split('.').pop();
  if (!extension || extension === clean) return fallback;
  return (labels[extension] || extension.toUpperCase()).slice(0, 5);
};

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
