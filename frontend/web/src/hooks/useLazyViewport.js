import { useState, useEffect, useRef } from 'react';

/**
 * Custom Hook tối ưu hiệu năng cuộn (Facebook-style Virtual Viewport với Overscan Buffer)
 * Giám sát phần tử DOM so với khung cuộn .main-content
 * 
 * - Trả về `isVisible = true` khi phần tử nằm trong khung nhìn hoặc vùng đệm overscan (mặc định 400px trên/dưới)
 * - Tự động chuyển `isVisible = false` khi phần tử cuộn ra xa ngoài vùng đệm 400px để unmount ảnh, giải phóng RAM/VRAM
 * - Hỗ trợ cả 3 cách dùng:
 *     1. const [ref, isVisible] = useLazyViewport();
 *     2. const { ref, isVisible } = useLazyViewport();
 *     3. const { isVisible } = useLazyViewport(customRef);
 *
 * @param {React.RefObject|object} [refOrOptions] - Ref trỏ phần tử hoặc options nếu không truyền ref
 * @param {object} [maybeOptions] - Options nếu đã truyền ref ở tham số 1
 * @param {string} [maybeOptions.rootMargin='400px 0px 400px 0px'] - Vùng đệm tải trước trên/dưới
 * @param {number} [maybeOptions.threshold=0] - Ngưỡng giao cắt
 * @returns {{ ref: React.RefObject, isVisible: boolean }}
 */
export default function useLazyViewport(refOrOptions = null, maybeOptions = {}) {
  const isRefPassed = Boolean(
    refOrOptions &&
      typeof refOrOptions === 'object' &&
      Object.prototype.hasOwnProperty.call(refOrOptions, 'current')
  );

  const internalRef = useRef(null);
  const targetRef = isRefPassed ? refOrOptions : internalRef;
  const options = isRefPassed ? maybeOptions : refOrOptions || {};
  const { rootMargin = '400px 0px 400px 0px', threshold = 0 } = options;

  const [isVisible, setIsVisible] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const element = targetRef?.current;
    if (!element) return;

    if (typeof IntersectionObserver === 'undefined') {
      return;
    }

    // Khung cuộn duy nhất của ứng dụng là .main-content
    const scrollContainer = element.closest('.main-content') || null;

    let isMounted = true;

    try {
      const observer = new IntersectionObserver(
        (entries) => {
          if (!isMounted) return;
          const entry = entries[0];
          if (entry) {
            setIsVisible(entry.isIntersecting);
          }
        },
        {
          root: scrollContainer,
          rootMargin,
          threshold,
        }
      );

      observer.observe(element);

      return () => {
        isMounted = false;
        observer.disconnect();
      };
    } catch {
      // Fallback an toàn nếu trình duyệt không tạo được observer
      Promise.resolve().then(() => {
        if (isMounted) {
          setIsVisible(true);
        }
      });
    }
  }, [targetRef, rootMargin, threshold]);

  return {
    ref: targetRef,
    isVisible,
    [Symbol.iterator]: function* () {
      yield targetRef;
      yield isVisible;
    },
  };
}
