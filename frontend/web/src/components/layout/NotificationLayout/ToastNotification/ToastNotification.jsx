import { memo } from 'react';
import { CheckCircle2 } from 'lucide-react';
import './ToastNotification.css';

/**
 * ToastNotification — Floating feedback toast badge in bottom-right corner
 */
export const ToastNotification = memo(({ message }) => {
  if (!message) return null;

  return (
    <div
      className="toast-notification flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-[#1c1d21] border border-blue-500/40 text-white text-xs font-semibold shadow-2xl animate-pop-fast select-none"
      role="status"
      aria-live="polite"
    >
      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
});

ToastNotification.displayName = 'ToastNotification';
