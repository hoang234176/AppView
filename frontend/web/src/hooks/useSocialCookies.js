import { useState, useCallback, useEffect } from 'react';
import useLayout from './useLayout';
import {
  verifyCookiesApi,
  updateCookiesApi,
  saveCookiesApi,
  DEFAULT_VERIFY_TIMEOUT_MS,
} from '../api/apiCoordinator';
import {
  SOCIAL_PLATFORMS,
  parseNetscapeCookies,
  resolveCoordinatorHostPort,
  evaluateCookieUpdateResult,
} from '../utils/cookieUtils';

// Tái xuất (re-export) để đảm bảo 100% tương thích ngược với các component đang import
export { SOCIAL_PLATFORMS, parseNetscapeCookies };

// Trạng thái lưu trữ Cookies theo phiên làm việc (Session) trong bộ nhớ RAM
let hasCheckedSessionCookies = false;
let sessionCookiesData = null;

/**
 * Custom Hook quản lý dữ liệu và tương tác Cookie của các mạng xã hội
 */
export default function useSocialCookies() {
  const { triggerNotification, serverConfig, hasServerConnection } = useLayout();

  // Khởi tạo trạng thái cookie hoàn toàn trong bộ nhớ RAM (không bao giờ lưu cookies trong localStorage)
  const [cookiesData, setCookiesDataState] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('appview_social_cookies');
      }
    } catch {
      // Bỏ qua lỗi trình duyệt nếu có
    }

    if (sessionCookiesData) {
      return sessionCookiesData;
    }

    const defaultState = {};
    SOCIAL_PLATFORMS.forEach((p) => {
      defaultState[p.id] = { raw: '', status: 'empty' };
    });
    sessionCookiesData = defaultState;
    return defaultState;
  });

  // Đồng bộ cập nhật trạng thái vào cả React State và bộ nhớ Session
  const setCookiesData = useCallback((updater) => {
    setCookiesDataState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      sessionCookiesData = next;
      return next;
    });
  }, []);

  // Lấy host và port Coordinator từ session
  const getCoordinatorHostPort = useCallback(() => {
    return resolveCoordinatorHostPort(serverConfig);
  }, [serverConfig]);

  // ID của platform đang mở drawer dán cookie (null nếu không mở)
  const [editingPlatformId, setEditingPlatformId] = useState(null);

  // Bản nháp nội dung textarea đang gõ
  const [draftCookies, setDraftCookies] = useState(() => {
    const drafts = {};
    SOCIAL_PLATFORMS.forEach((p) => {
      drafts[p.id] = '';
    });
    return drafts;
  });

  // Trạng thái đã kiểm tra hợp lệ và sẵn sàng Save của từng platform trong drawer
  const [readyToSaveState, setReadyToSaveState] = useState(() => {
    const state = {};
    SOCIAL_PLATFORMS.forEach((p) => {
      state[p.id] = false;
    });
    return state;
  });

  // ID của platform đang trong quá trình Check trực tiếp từ Drawer
  const [checkingDraftPlatformId, setCheckingDraftPlatformId] = useState(null);

  // ID của platform đang trong quá trình Save vào Coordinator
  const [savingPlatformId, setSavingPlatformId] = useState(null);

  // Trạng thái đang kiểm tra khởi tạo toàn bộ cookie khi vừa vào Settings (chỉ kích hoạt 1 lần trong phiên)
  const [isInitialChecking, setIsInitialChecking] = useState(
    () => Boolean(hasServerConnection) && !hasCheckedSessionCookies
  );

  // Trạng thái lỗi (cảnh báo viền đỏ) của từng platform trong drawer
  const [draftErrors, setDraftErrors] = useState(() => {
    const errors = {};
    SOCIAL_PLATFORMS.forEach((p) => {
      errors[p.id] = false;
    });
    return errors;
  });

  // Cập nhật và làm mới cookie của 1 nền tảng qua Coordinator (POST /api/v1/cookies/update, timeout 65s)
  const updatePlatformCookie = useCallback(
    async (platformId, showToast = false) => {
      const { host, port } = getCoordinatorHostPort();
      const platform = SOCIAL_PLATFORMS.find((p) => p.id === platformId);
      const platformName = platform?.name || platformId;

      if (!host || !port) {
        if (showToast) {
          triggerNotification({
            type: 'error',
            title: 'Not Connected',
            message: 'Server is not connected. Please check Server Connection settings.',
          });
        }
        return;
      }

      setCookiesData((prev) => ({
        ...prev,
        [platformId]: { ...prev[platformId], status: 'updating' },
      }));

      let nextStatus = 'empty';
      let notification = null;

      try {
        const res = await updateCookiesApi(host, port, platformId, DEFAULT_VERIFY_TIMEOUT_MS);
        const evalRes = evaluateCookieUpdateResult(res, platformName);
        nextStatus = evalRes.nextStatus;
        if (showToast) {
          notification = evalRes.notification;
        }
      } catch (err) {
        nextStatus = 'empty';
        if (showToast) {
          notification = {
            type: 'error',
            title: 'Update Failed',
            message: err.message || `Connection error while updating ${platformName}.`,
          };
        }
      } finally {
        setCookiesData((prev) => ({
          ...prev,
          [platformId]: { ...prev[platformId], status: nextStatus },
        }));
        if (notification) {
          triggerNotification(notification);
        }
      }
    },
    [getCoordinatorHostPort, setCookiesData, triggerNotification]
  );

  // Tự động kiểm tra/cập nhật trạng thái cookies cho các mạng xã hội khi Server đã kết nối (duy nhất 1 lần trong phiên)
  useEffect(() => {
    if (!hasServerConnection || hasCheckedSessionCookies) return;

    let isMounted = true;

    const checkAllPlatformCookies = async () => {
      try {
        await Promise.allSettled(
          SOCIAL_PLATFORMS.map((platform) => updatePlatformCookie(platform.id, false))
        );
        hasCheckedSessionCookies = true;
      } catch (err) {
        if (isMounted) {
          triggerNotification({
            type: 'error',
            title: 'Connection Error',
            message: err.message || 'Error checking social cookies.',
          });
        }
      } finally {
        if (isMounted) {
          setIsInitialChecking(false);
        }
      }
    };

    checkAllPlatformCookies();

    return () => {
      isMounted = false;
    };
  }, [hasServerConnection, updatePlatformCookie, triggerNotification]);

  // Mở/đóng drawer nhập cookie (nội dung ô nhập luôn luôn là rỗng để người dùng dán vào)
  const handleToggleDrawer = useCallback((platformId) => {
    setEditingPlatformId((prev) => {
      if (prev === platformId) {
        return null; // Đóng lại
      }
      setDraftCookies((d) => ({
        ...d,
        [platformId]: '',
      }));
      setReadyToSaveState((s) => ({
        ...s,
        [platformId]: false,
      }));
      setDraftErrors((e) => ({
        ...e,
        [platformId]: false,
      }));
      return platformId;
    });
  }, []);

  const handleDraftChange = useCallback((platformId, value) => {
    setDraftCookies((prev) => ({
      ...prev,
      [platformId]: value,
    }));
    setReadyToSaveState((prev) => ({
      ...prev,
      [platformId]: false,
    }));
    setDraftErrors((prev) => ({
      ...prev,
      [platformId]: false,
    }));
  }, []);

  const handleCancel = useCallback((platformId) => {
    setDraftCookies((prev) => ({
      ...prev,
      [platformId]: '',
    }));
    setReadyToSaveState((prev) => ({
      ...prev,
      [platformId]: false,
    }));
    setDraftErrors((prev) => ({
      ...prev,
      [platformId]: false,
    }));
    setEditingPlatformId(null);
  }, []);

  // Kiểm tra hợp lệ chuỗi cookie vừa dán trong Drawer trước khi cho phép Save
  const handleDrawerCheck = useCallback(
    async (platformId) => {
      const rawInput = (draftCookies[platformId] || '').trim();
      const platform = SOCIAL_PLATFORMS.find((p) => p.id === platformId);
      const platformName = platform?.name || platformId;

      if (!rawInput) {
        setDraftErrors((prev) => ({ ...prev, [platformId]: true }));
        setReadyToSaveState((prev) => ({ ...prev, [platformId]: false }));
        triggerNotification({
          type: 'error',
          title: 'Empty Input',
          message: 'Please paste cookies first before checking.',
        });
        return;
      }

      // 1. Kiểm tra nhanh định dạng Netscape cục bộ
      const localResult = parseNetscapeCookies(rawInput);
      if (localResult.status === 'invalid') {
        setDraftErrors((prev) => ({ ...prev, [platformId]: true }));
        setReadyToSaveState((prev) => ({
          ...prev,
          [platformId]: false,
        }));
        triggerNotification({
          type: 'error',
          title: 'Invalid Format',
          message: 'Invalid cookie format! Please paste Netscape HTTP Cookie format (# Netscape HTTP Cookie File).',
        });
        return;
      }

      if (localResult.status === 'expired') {
        setDraftErrors((prev) => ({ ...prev, [platformId]: true }));
        setReadyToSaveState((prev) => ({
          ...prev,
          [platformId]: false,
        }));
        triggerNotification({
          type: 'warning',
          title: 'Cookies Expired',
          message: `Cookies for ${platformName} are expired.`,
        });
        return;
      }

      const { host, port } = getCoordinatorHostPort();
      if (!host || !port) {
        setDraftErrors((prev) => ({ ...prev, [platformId]: false }));
        setReadyToSaveState((prev) => ({
          ...prev,
          [platformId]: true,
        }));
        triggerNotification({
          type: 'success',
          title: 'Cookies Valid',
          message: `Valid active cookies detected for ${platformName}. Click Save to apply.`,
        });
        return;
      }

      // 2. Gửi chuỗi cookies sang Coordinator để kiểm tra trực tiếp (timeout 65s)
      setCheckingDraftPlatformId(platformId);
      try {
        const res = await verifyCookiesApi(host, port, platformId, rawInput, DEFAULT_VERIFY_TIMEOUT_MS);
        if (res.ok && res.valid) {
          setDraftErrors((prev) => ({ ...prev, [platformId]: false }));
          setReadyToSaveState((prev) => ({
            ...prev,
            [platformId]: true,
          }));
          triggerNotification({
            type: 'success',
            title: 'Cookies Valid',
            message: res.message || `Cookies for ${platformName} verified active! Click Save to apply.`,
          });
        } else {
          setDraftErrors((prev) => ({ ...prev, [platformId]: true }));
          setReadyToSaveState((prev) => ({
            ...prev,
            [platformId]: false,
          }));
          triggerNotification({
            type: 'warning',
            title: 'Verification Failed',
            message: res.message || res.error || `Cookies for ${platformName} are invalid or expired.`,
          });
        }
      } catch (err) {
        setDraftErrors((prev) => ({ ...prev, [platformId]: true }));
        setReadyToSaveState((prev) => ({
          ...prev,
          [platformId]: false,
        }));
        triggerNotification({
          type: 'error',
          title: 'Check Failed',
          message: err.message || `Connection error while checking ${platformName}.`,
        });
      } finally {
        setCheckingDraftPlatformId(null);
      }
    },
    [draftCookies, getCoordinatorHostPort, triggerNotification]
  );

  const handleSave = useCallback(
    async (platformId) => {
      if (savingPlatformId) return;

      const rawInput = (draftCookies[platformId] || '').trim();
      const platform = SOCIAL_PLATFORMS.find((p) => p.id === platformId);
      const platformName = platform?.name || platformId;

      if (!rawInput) return;

      const result = parseNetscapeCookies(rawInput);
      if (result.status === 'invalid') {
        setDraftErrors((prev) => ({ ...prev, [platformId]: true }));
        triggerNotification({
          type: 'error',
          title: 'Invalid Format',
          message: 'Invalid cookie format! Please paste Netscape HTTP Cookie format (# Netscape HTTP Cookie File).',
        });
        setReadyToSaveState((prev) => ({
          ...prev,
          [platformId]: false,
        }));
        return;
      }

      const { host, port } = getCoordinatorHostPort();
      if (!host || !port) {
        triggerNotification({
          type: 'error',
          title: 'Not Connected',
          message: 'Server is not connected. Please check Server Connection settings.',
        });
        return;
      }

      setSavingPlatformId(platformId);

      try {
        const res = await saveCookiesApi(host, port, platformId, rawInput);
        if (!res.ok) {
          setDraftErrors((prev) => ({ ...prev, [platformId]: true }));
          triggerNotification({
            type: 'error',
            title: 'Save Failed',
            message: res.error || `Failed to save cookies for ${platformName}.`,
          });
          return;
        }

        setCookiesData((prev) => ({
          ...prev,
          [platformId]: { raw: rawInput, status: result.status },
        }));

        setDraftCookies((prev) => ({
          ...prev,
          [platformId]: '',
        }));

        setReadyToSaveState((prev) => ({
          ...prev,
          [platformId]: false,
        }));

        setDraftErrors((prev) => ({
          ...prev,
          [platformId]: false,
        }));

        triggerNotification({
          type: 'success',
          title: 'Cookies Saved',
          message: `Cookies for ${platformName} saved successfully.`,
        });

        setEditingPlatformId(null);
      } catch (err) {
        setDraftErrors((prev) => ({ ...prev, [platformId]: true }));
        triggerNotification({
          type: 'error',
          title: 'Save Failed',
          message: err.message || `Error saving cookies for ${platformName}.`,
        });
      } finally {
        setSavingPlatformId(null);
      }
    },
    [draftCookies, getCoordinatorHostPort, setCookiesData, triggerNotification, savingPlatformId]
  );

  const handleClear = useCallback((platformId) => {
    setDraftCookies((prev) => ({ ...prev, [platformId]: '' }));
    setReadyToSaveState((prev) => ({ ...prev, [platformId]: false }));
    setDraftErrors((prev) => ({ ...prev, [platformId]: false }));
    setCookiesData((prev) => ({
      ...prev,
      [platformId]: { raw: '', status: 'empty' },
    }));
  }, [setCookiesData]);

  const handleUpdate = useCallback(
    (platformId) => {
      updatePlatformCookie(platformId, true);
    },
    [updatePlatformCookie]
  );

  return {
    cookiesData,
    editingPlatformId,
    draftCookies,
    readyToSaveState,
    checkingDraftPlatformId,
    savingPlatformId,
    isSaving: Boolean(savingPlatformId),
    isInitialChecking,
    draftErrors,
    handleToggleDrawer,
    handleDraftChange,
    handleCancel,
    handleSave,
    handleClear,
    handleUpdate,
    handleCheck: handleUpdate,
    handleDrawerCheck,
  };
}
