import React, { useState, useEffect, memo } from 'react';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

const RollingDigit = memo(({ char, duration = 480, delay = 0 }) => {
  const isDigit = char >= '0' && char <= '9';

  if (char === ' ') {
    return (
      <span
        className="inline-block select-none"
        style={{ width: '0.35em', height: '1.2em', lineHeight: '1.2em', verticalAlign: 'middle' }}
      >
        &nbsp;
      </span>
    );
  }

  if (!isDigit) {
    return (
      <span
        className="inline-block select-none font-mono text-center"
        style={{ height: '1.2em', lineHeight: '1.2em', verticalAlign: 'middle' }}
      >
        {char}
      </span>
    );
  }

  const num = parseInt(char, 10);

  return (
    <span
      className="inline-block overflow-hidden relative select-none font-mono"
      style={{
        height: '1.2em',
        lineHeight: '1.2em',
        verticalAlign: 'middle',
      }}
    >
      <span
        className="block will-change-transform"
        style={{
          transform: `translateY(-${num * 10}%)`,
          transition: `transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
        }}
      >
        {DIGITS.map((d) => (
          <span
            key={d}
            className="flex items-center justify-center font-mono"
            style={{ height: '1.2em', lineHeight: '1.2em' }}
          >
            {d}
          </span>
        ))}
      </span>
    </span>
  );
});

RollingDigit.displayName = 'RollingDigit';

export const RollingNumber = memo(({
  value,
  className = '',
  duration = 500,
  stagger = 20,
  animateOnMount = false,
  prefix = '',
  suffix = '',
}) => {
  if (value === null || value === undefined) return null;

  const targetStr = String(value);
  const [displayStr, setDisplayStr] = useState(() => {
    if (animateOnMount) {
      return targetStr.replace(/[0-9]/g, '0');
    }
    return targetStr;
  });

  useEffect(() => {
    if (animateOnMount) {
      const timer = setTimeout(() => {
        setDisplayStr(targetStr);
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setDisplayStr(targetStr);
    }
  }, [targetStr, animateOnMount]);

  const chars = displayStr.split('');

  return (
    <span
      className={`inline-flex items-center tabular-nums leading-none whitespace-nowrap flex-shrink-0 ${className}`}
      style={{ verticalAlign: 'middle' }}
    >
      {prefix && (
        <span
          className="inline-block select-none font-mono"
          style={{ height: '1.2em', lineHeight: '1.2em', verticalAlign: 'middle' }}
        >
          {prefix}
        </span>
      )}
      {chars.map((char, idx) => {
        const reverseIdx = chars.length - 1 - idx;
        return (
          <RollingDigit
            key={`r-${reverseIdx}`}
            char={char}
            duration={duration}
            delay={stagger * reverseIdx}
          />
        );
      })}
      {suffix && (
        <span
          className="inline-block select-none font-mono"
          style={{ height: '1.2em', lineHeight: '1.2em', verticalAlign: 'middle' }}
        >
          {suffix}
        </span>
      )}
    </span>
  );
});

RollingNumber.displayName = 'RollingNumber';
