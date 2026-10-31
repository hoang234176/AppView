import { useSyncExternalStore, useCallback, useEffect } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';

/**
 * External Store quản lý Navigation Stack độc lập
 * Tuân thủ tiêu chuẩn kiến trúc React 19 & quy tắc 10 của AGENTS.md
 */
const navStore = {
  stack: [],
  currentIndex: -1,
  isInternalNav: false,
  listeners: new Set(),

  snapshot: {
    stack: [],
    currentIndex: -1,
    canGoBack: false,
    canGoForward: false,
  },

  subscribe(callback) {
    navStore.listeners.add(callback);
    return () => {
      navStore.listeners.delete(callback);
    };
  },

  getSnapshot() {
    if (navStore.stack.length === 0 && typeof window !== 'undefined') {
      const initialUrl = window.location.pathname + (window.location.search || '');
      navStore.stack = [initialUrl];
      navStore.currentIndex = 0;
      navStore.snapshot = {
        stack: navStore.stack,
        currentIndex: 0,
        canGoBack: false,
        canGoForward: false,
      };
    }
    return navStore.snapshot;
  },

  update(newStack, newIndex) {
    navStore.stack = newStack;
    navStore.currentIndex = newIndex;
    navStore.snapshot = {
      stack: newStack,
      currentIndex: newIndex,
      canGoBack: newIndex > 0,
      canGoForward: newIndex < newStack.length - 1,
    };
    navStore.listeners.forEach((listener) => {
      try {
        listener();
      } catch {
        // Bỏ qua lỗi nếu component đã unmount
      }
    });
  },

  onLocationChange(currentUrl, navType) {
    // 1. Khởi tạo lần đầu
    if (navStore.currentIndex === -1 || navStore.stack.length === 0) {
      navStore.update([currentUrl], 0);
      return;
    }

    // 2. Nếu do chính nút < hoặc > điều hướng: tắt cờ và giữ nguyên vị trí đã trỏ
    if (navStore.isInternalNav) {
      navStore.isInternalNav = false;
      return;
    }

    const activeEntry = navStore.stack[navStore.currentIndex];

    // 3. XỬ LÝ TRÙNG LẶP LIÊN TIẾP (Consecutive Duplicate):
    // Người dùng click lại chính thư mục hiện tại -> Tuyệt đối không push thêm
    if (currentUrl === activeEntry) {
      return;
    }

    // 4. Xử lý 'REPLACE' (ví dụ redirect ngầm từ / sang /HDD)
    if (navType === 'REPLACE') {
      const nextStack = [...navStore.stack];
      nextStack[navStore.currentIndex] = currentUrl;
      navStore.update(nextStack, navStore.currentIndex);
      return;
    }

    // 5. Xử lý 'POP' (nút Back/Forward của trình duyệt ngoài)
    if (navType === 'POP') {
      if (navStore.currentIndex > 0 && navStore.stack[navStore.currentIndex - 1] === currentUrl) {
        navStore.update(navStore.stack, navStore.currentIndex - 1);
      } else if (
        navStore.currentIndex < navStore.stack.length - 1 &&
        navStore.stack[navStore.currentIndex + 1] === currentUrl
      ) {
        navStore.update(navStore.stack, navStore.currentIndex + 1);
      } else {
        const foundIndex = navStore.stack.lastIndexOf(currentUrl);
        if (foundIndex !== -1) {
          navStore.update(navStore.stack, foundIndex);
        } else {
          const nextStack = navStore.stack.slice(0, navStore.currentIndex + 1).concat(currentUrl);
          navStore.update(nextStack, nextStack.length - 1);
        }
      }
      return;
    }

    // 6. Xử lý 'PUSH': Điều hướng chủ động sang trang mới, cắt bỏ nhánh tương lai cũ (Branching)
    const nextStack = navStore.stack.slice(0, navStore.currentIndex + 1).concat(currentUrl);
    navStore.update(nextStack, nextStack.length - 1);
  },
};

/**
 * Custom Hook quản lý lịch sử điều hướng (Navigation History Stack)
 *
 * @returns {{
 *   canGoBack: boolean,
 *   canGoForward: boolean,
 *   goBack: () => void,
 *   goForward: () => void,
 *   currentIndex: number,
 *   stack: string[]
 * }}
 */
export default function useNavigationHistory() {
  const location = useLocation();
  const navigate = useNavigate();
  const navType = useNavigationType();

  const currentUrl = location.pathname + (location.search || '');

  // Lắng nghe thay đổi URL và cập nhật External Store
  useEffect(() => {
    navStore.onLocationChange(currentUrl, navType);
  }, [currentUrl, navType]);

  const snapshot = useSyncExternalStore(navStore.subscribe, navStore.getSnapshot);

  // Hàm lùi lại trang trước
  const goBack = useCallback(() => {
    if (navStore.currentIndex > 0) {
      const targetIndex = navStore.currentIndex - 1;
      const targetUrl = navStore.stack[targetIndex];
      if (targetUrl) {
        navStore.isInternalNav = true;
        navStore.update(navStore.stack, targetIndex);
        navigate(targetUrl);
      }
    }
  }, [navigate]);

  // Hàm tiến tới trang sau
  const goForward = useCallback(() => {
    if (navStore.currentIndex < navStore.stack.length - 1) {
      const targetIndex = navStore.currentIndex + 1;
      const targetUrl = navStore.stack[targetIndex];
      if (targetUrl) {
        navStore.isInternalNav = true;
        navStore.update(navStore.stack, targetIndex);
        navigate(targetUrl);
      }
    }
  }, [navigate]);

  return {
    canGoBack: snapshot.canGoBack,
    canGoForward: snapshot.canGoForward,
    goBack,
    goForward,
    currentIndex: snapshot.currentIndex,
    stack: snapshot.stack,
  };
}
