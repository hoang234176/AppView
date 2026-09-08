import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

/**
 * Custom AppView-styled dropdown selector.
 *
 * @param {Object} props
 * @param {Array<{value: any, label: string}>|Array<string|number>} props.options
 * @param {any} props.value
 * @param {Function} props.onChange
 * @param {boolean} [props.disabled=false]
 * @param {string} [props.placeholder='Chọn...']
 * @param {string} [props.size='md'] - 'sm' | 'md'
 * @param {'blue'|'purple'|'amber'|'red'} [props.accent='blue']
 * @param {string} [props.ariaLabel]
 */
export const CustomSelect = ({
  options = [],
  value,
  onChange,
  disabled = false,
  placeholder = 'Chọn...',
  size = 'md',
  accent = 'blue',
  ariaLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState('bottom'); // 'bottom' | 'top'
  const [maxHeight, setMaxHeight] = useState(200);
  const dropdownRef = useRef(null);

  // Normalize options to { value, label }
  const normalizedOptions = options.map((opt) => {
    if (opt !== null && typeof opt === 'object' && 'value' in opt) {
      return opt;
    }
    return { value: opt, label: typeof opt === 'number' ? `${opt}p` : String(opt) };
  });

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  // Calculate placement (upward vs downward) and max-height dynamically
  const updatePosition = () => {
    if (!dropdownRef.current) return;
    const rect = dropdownRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;

    const minComfortableHeight = 140;
    const maxDesiredHeight = 220;

    if (spaceBelow >= minComfortableHeight || spaceBelow >= spaceAbove) {
      setPlacement('bottom');
      setMaxHeight(Math.max(100, Math.min(maxDesiredHeight, spaceBelow)));
    } else {
      setPlacement('top');
      setMaxHeight(Math.max(100, Math.min(maxDesiredHeight, spaceAbove)));
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleResizeOrScroll = () => updatePosition();
      window.addEventListener('resize', handleResizeOrScroll);
      window.addEventListener('scroll', handleResizeOrScroll, true);
      return () => {
        window.removeEventListener('resize', handleResizeOrScroll);
        window.removeEventListener('scroll', handleResizeOrScroll, true);
      };
    }
  }, [isOpen]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close dropdown on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (optionValue) => {
    if (disabled) return;
    onChange(optionValue);
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        const currentIndex = normalizedOptions.findIndex((opt) => opt.value === value);
        const nextIndex = Math.min(currentIndex + 1, normalizedOptions.length - 1);
        if (nextIndex >= 0) onChange(normalizedOptions[nextIndex].value);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        const currentIndex = normalizedOptions.findIndex((opt) => opt.value === value);
        const prevIndex = Math.max(currentIndex - 1, 0);
        if (prevIndex >= 0) onChange(normalizedOptions[prevIndex].value);
      }
    }
  };

  // Accent styling mappings
  const accentStyles = {
    blue: {
      buttonBorder: 'border-[#383c42] hover:border-blue-400/80 focus:border-blue-400',
      activeBorder: 'border-blue-400 ring-1 ring-blue-400/30',
      activeText: 'text-blue-400',
      selectedItem: 'bg-blue-500/20 text-blue-300 font-bold',
      chevron: 'text-blue-400',
    },
    purple: {
      buttonBorder: 'border-purple-400/40 hover:border-purple-300 focus:border-purple-400',
      activeBorder: 'border-purple-400 ring-1 ring-purple-400/30',
      activeText: 'text-purple-300',
      selectedItem: 'bg-purple-500/20 text-purple-200 font-bold',
      chevron: 'text-purple-300',
    },
    amber: {
      buttonBorder: 'border-amber-400/40 hover:border-amber-300 focus:border-amber-400',
      activeBorder: 'border-amber-400 ring-1 ring-amber-400/30',
      activeText: 'text-amber-400',
      selectedItem: 'bg-amber-500/20 text-amber-300 font-bold',
      chevron: 'text-amber-400',
    },
  }[accent] || {
    buttonBorder: 'border-[#383c42] hover:border-blue-400 focus:border-blue-400',
    activeBorder: 'border-blue-400 ring-1 ring-blue-400/30',
    activeText: 'text-blue-400',
    selectedItem: 'bg-blue-500/20 text-blue-300 font-bold',
    chevron: 'text-blue-400',
  };

  const isSmall = size === 'sm';

  return (
    <div ref={dropdownRef} className="relative inline-block text-left w-full">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className={`w-full flex items-center justify-between gap-2 bg-[#1c1d21] rounded-xl border text-left outline-none transition-all cursor-pointer ${
          isSmall ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-xs font-semibold'
        } ${isOpen ? accentStyles.activeBorder : accentStyles.buttonBorder} ${
          disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
        }`}
      >
        <span className={`truncate ${selectedOption ? 'text-white' : 'text-gray-400'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`flex-shrink-0 transition-transform duration-200 ${
            isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4'
          } ${isOpen ? 'rotate-180 ' + accentStyles.chevron : 'text-gray-400'}`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          style={{ maxHeight: `${maxHeight}px` }}
          className={`absolute z-50 w-full min-w-[120px] overflow-y-auto custom-scrollbar bg-[#1c1d21] border border-[#383c42] rounded-xl shadow-2xl p-1 animate-fade-in space-y-0.5 ${
            placement === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
        >
          {normalizedOptions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-500 text-center">Không có tùy chọn</div>
          ) : (
            normalizedOptions.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <div
                  key={String(opt.value)}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(opt.value)}
                  className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg cursor-pointer text-xs transition-colors select-none ${
                    isSelected
                      ? accentStyles.selectedItem
                      : 'text-gray-200 hover:bg-[#28292d] hover:text-white'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check className={`w-3.5 h-3.5 flex-shrink-0 ${accentStyles.chevron}`} />}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
