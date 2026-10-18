import { memo, useEffect, useRef } from 'react';

/**
 * ContextMenuWrapper — Floating boundary container
 * Handles coordinate calculation, boundary collision prevention, outside click and Escape key dismissal.
 */
export const ContextMenuWrapper = memo(({
  x = 0,
  y = 0,
  mode = 'empty',
  onClose,
  children,
}) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const menuWidth = 220;
  const menuHeight = mode === 'folder' ? 180 : 120;
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 10);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 10);

  return (
    <div
      ref={menuRef}
      style={{ top: `${adjustedY}px`, left: `${adjustedX}px` }}
      className="fixed z-[99999] bg-[#1c1d21] border border-[#383c42] rounded-[18px] p-1.5 shadow-2xl w-56 animate-fade-in space-y-1 select-none"
    >
      {children}
    </div>
  );
});

ContextMenuWrapper.displayName = 'ContextMenuWrapper';
