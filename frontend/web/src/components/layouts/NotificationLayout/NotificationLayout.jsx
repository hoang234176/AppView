import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import useLayout from '../../../hooks/useLayout';
import CheckCircleIcon from '../../../assets/icons/CheckCircleIcon';
import AlertCircleIcon from '../../../assets/icons/AlertCircleIcon';
import './NotificationLayout.css';

function NotificationItem({
  item,
  isPaused,
  onDismiss,
  onRemove,
  onMouseEnter,
  onMouseLeave,
}) {
  const { id, type = 'success', title = 'Success', message = '', isExiting } = item;
  const remainingTimeRef = useRef(3000);
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);
  const exitTimerRef = useRef(null);

  // Bắt đầu đếm ngược với khoảng thời gian được chỉ định
  const startTimer = useCallback(
    (duration) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      startTimeRef.current = Date.now();
      timerRef.current = setTimeout(() => {
        onDismiss(id);
      }, duration);
    },
    [id, onDismiss]
  );

  // Tạm dừng đếm ngược và lưu lại số mili-giây còn lại
  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (startTimeRef.current) {
      const elapsed = Date.now() - startTimeRef.current;
      remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
    }
  }, []);

  // Đồng bộ trạng thái dừng/tiếp tục đếm theo cờ isPaused toàn cục
  useEffect(() => {
    if (isExiting) return;

    if (isPaused) {
      pauseTimer();
    } else {
      if (remainingTimeRef.current > 0) {
        startTimer(remainingTimeRef.current);
      }
    }
  }, [isPaused, isExiting, pauseTimer, startTimer]);

  // Hủy timers khi unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, []);

  // Khi chuyển sang trạng thái isExiting (do hết giờ, bấm nút x, hoặc quá 4 thẻ)
  useEffect(() => {
    if (isExiting) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      exitTimerRef.current = setTimeout(() => {
        onRemove(id);
      }, 300);
    }
  }, [isExiting, id, onRemove]);

  return (
    <div
      className={`notification-card notification-card--${type} ${isExiting ? 'notification-card--exiting' : ''}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Nút tròn x ở góc trên bên trái, chỉ hiện khi hover thẻ */}
      <button
        type="button"
        className="notification-card__close-btn"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(id);
        }}
        aria-label="Close notification"
      >
        <svg
          viewBox="0 0 16 16"
          className="notification-card__close-icon"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M4 4l8 8M12 4L4 12" />
        </svg>
      </button>

      {/* Khối bên trái: Icon lỗi hoặc thành công */}
      <div className={`notification-card__icon-box notification-card__icon-box--${type}`}>
        {type === 'error' ? (
          <AlertCircleIcon className="notification-card__icon" />
        ) : (
          <CheckCircleIcon className="notification-card__icon" />
        )}
      </div>

      {/* Khối bên phải: Chia 2 tầng trên (in đậm) và dưới (tối đa 2 hàng xám) */}
      <div className="notification-card__content">
        <span className="notification-card__title">{title}</span>
        {message && <span className="notification-card__message">{message}</span>}
      </div>
    </div>
  );
}

function NotificationLayout() {
  const { notifications, dismissNotification, removeNotification } = useLayout();
  const [hoveredId, setHoveredId] = useState(null);
  const slotsRef = useRef(new Map());
  const prevPositionsRef = useRef(new Map());

  // Kỹ thuật FLIP: Đo và trượt mượt mà các thẻ cũ xuống dưới khi có thẻ mới xuất hiện
  useLayoutEffect(() => {
    const slots = slotsRef.current;
    const prevPositions = prevPositionsRef.current;

    slots.forEach((el, id) => {
      if (!el) return;
      const currentRect = el.getBoundingClientRect();
      const prevTop = prevPositions.get(id);

      if (prevTop !== undefined) {
        const deltaY = prevTop - currentRect.top;
        if (deltaY !== 0) {
          // Invert: tạm giữ thẻ ở vị trí thị giác cũ
          el.style.transform = `translateY(${deltaY}px)`;
          el.style.transition = 'none';

          // Play: trượt êm ái về vị trí mới trong animation frame kế tiếp
          requestAnimationFrame(() => {
            el.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
            el.style.transform = 'translateY(0)';
          });
        }
      }

      prevPositions.set(id, currentRect.top);
    });

    // Dọn dẹp những id đã bị xóa khỏi DOM
    const currentIds = new Set(notifications.map((n) => n.id));
    prevPositions.forEach((_, id) => {
      if (!currentIds.has(id)) {
        prevPositions.delete(id);
      }
    });
  }, [notifications]);

  if (!notifications || notifications.length === 0) {
    return null;
  }

  // Khi có bất kỳ thẻ nào đang được hover -> toàn bộ các thẻ đều tạm dừng đếm
  const isPaused = Boolean(
    hoveredId !== null && notifications.some((n) => n.id === hoveredId)
  );

  return (
    <aside className="notification-layout" aria-live="polite">
      {notifications.map((item) => (
        <div
          key={item.id}
          ref={(el) => {
            if (el) slotsRef.current.set(item.id, el);
            else slotsRef.current.delete(item.id);
          }}
          className="notification-slot"
        >
          <NotificationItem
            item={item}
            isPaused={isPaused}
            onDismiss={dismissNotification}
            onRemove={removeNotification}
            onMouseEnter={() => setHoveredId(item.id)}
            onMouseLeave={() =>
              setHoveredId((curr) => (curr === item.id ? null : curr))
            }
          />
        </div>
      ))}
    </aside>
  );
}

export default NotificationLayout;
