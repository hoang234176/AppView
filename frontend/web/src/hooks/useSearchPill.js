import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import useLayout from './useLayout';

/**
 * Custom Hook quản lý toàn bộ logic tương tác, debounce và trạng thái của SearchPill
 * Tuân thủ Quy tắc 10 của frontend/web/AGENTS.md
 *
 * @returns {{
 *   isSearchOpen: boolean,
 *   inputValue: string,
 *   searchInputRef: React.RefObject,
 *   handleOpenSearch: () => void,
 *   handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
 *   handleBlurSearch: (e: React.FocusEvent<HTMLInputElement>) => void,
 *   handleKeyDownSearch: (e: React.KeyboardEvent<HTMLInputElement>) => void,
 * }}
 */
export default function useSearchPill() {
  const location = useLocation();
  const { searchQuery, setSearchQuery, clearSearchQuery } = useLayout();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [inputValue, setInputValue] = useState(searchQuery || '');
  const [prevSearchQuery, setPrevSearchQuery] = useState(searchQuery);
  const [prevLocationKey, setPrevLocationKey] = useState(location.pathname + location.search);
  const searchInputRef = useRef(null);

  const currentLocationKey = location.pathname + location.search;

  // Tự động thu gọn thanh search và xóa input khi đổi thư mục, đổi ổ đĩa hoặc chuyển trang
  if (currentLocationKey !== prevLocationKey) {
    setPrevLocationKey(currentLocationKey);
    setIsSearchOpen(false);
    setInputValue('');
  }

  // Đồng bộ lại khi searchQuery bị xóa từ bên ngoài (chỉ khi ô tìm kiếm không mở)
  if (searchQuery !== prevSearchQuery) {
    setPrevSearchQuery(searchQuery);
    if (!searchQuery && !isSearchOpen) {
      setInputValue('');
    }
  }

  // Debounce 250ms: chỉ cập nhật searchQuery sau khi người dùng ngừng gõ 250ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(inputValue.trim());
    }, 250);

    return () => clearTimeout(timer);
  }, [inputValue, setSearchQuery]);

  const handleOpenSearch = useCallback(() => {
    if (!isSearchOpen) {
      setIsSearchOpen(true);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isSearchOpen]);

  const handleInputChange = useCallback((e) => {
    setInputValue(e.target.value);
  }, []);

  const handleBlurSearch = useCallback((e) => {
    if (!e.target.value.trim()) {
      setIsSearchOpen(false);
      clearSearchQuery();
    }
  }, [clearSearchQuery]);

  const handleKeyDownSearch = useCallback((e) => {
    if (e.key === 'Escape') {
      setInputValue('');
      clearSearchQuery();
      setIsSearchOpen(false);
      searchInputRef.current?.blur();
    }
  }, [clearSearchQuery]);

  return {
    isSearchOpen,
    inputValue,
    searchInputRef,
    handleOpenSearch,
    handleInputChange,
    handleBlurSearch,
    handleKeyDownSearch,
  };
}
