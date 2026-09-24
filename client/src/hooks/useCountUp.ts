import { useEffect, useState } from 'react';

export const useCountUp = (target: number | string, duration = 1000): string => {
  const [displayValue, setDisplayValue] = useState<string>('0');

  useEffect(() => {
    const rawStr = target !== undefined && target !== null ? target.toString() : '0';
    const isPercentage = rawStr.includes('%');
    const numericPart = parseFloat(rawStr.replace(/[^0-9.-]+/g, ''));

    if (isNaN(numericPart)) {
      setDisplayValue(rawStr);
      return;
    }

    let startTimestamp: number | null = null;
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = numericPart * easeProgress;

      const hasDecimals = rawStr.includes('.') || numericPart % 1 !== 0;
      const formatted = hasDecimals ? current.toFixed(1) : Math.round(current).toString();
      setDisplayValue(isPercentage ? `${formatted}%` : formatted);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        setDisplayValue(rawStr);
      }
    };

    animationFrameId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [target, duration]);

  return displayValue;
};