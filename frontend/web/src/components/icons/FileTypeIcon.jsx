import React from 'react';

const labels = { jpeg: 'JPG', jpg: 'JPG', tif: 'TIF', tiff: 'TIF', mpeg: 'MPG' };

export const fileTypeLabel = (filename, fallback = 'FILE') => {
  const clean = String(filename || '').split(/[?#]/, 1)[0].toLowerCase();
  const multi = clean.match(/\.(tar\.gz|tar\.bz2|tar\.xz)$/);
  const extension = multi?.[1] || clean.split('.').pop();
  if (!extension || extension === clean) return fallback;
  return (labels[extension] || extension.toUpperCase()).slice(0, 5);
};

// File icon with a readable extension badge (ZIP/RAR/MP4/JPG…). It deliberately
// does not use a generic folder/archive glyph: the label is the file's real type.
export const FileTypeIcon = ({ filename, fallback, className = '' }) => {
  const label = fileTypeLabel(filename, fallback);
  const fontSize = label.length >= 5 ? 3.6 : label.length === 4 ? 4.1 : 4.8;
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-label={label}>
      <path d="M7 2.75h6.8L19.5 8.5v11A1.75 1.75 0 0 1 17.75 21h-10A1.75 1.75 0 0 1 6 19.5v-15A1.75 1.75 0 0 1 7.75 2.75Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M13.5 2.9v4.15a1.5 1.5 0 0 0 1.5 1.5h4.1" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <rect x="1.4" y="10.5" width="15.4" height="7.1" rx="1.35" fill="currentColor" />
      <text x="9.1" y="15.42" textAnchor="middle" fill="#fff" fontSize={fontSize} fontWeight="800" fontFamily="ui-sans-serif, system-ui, sans-serif">{label}</text>
    </svg>
  );
};
