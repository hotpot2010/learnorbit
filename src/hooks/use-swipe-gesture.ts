import { useCallback, useRef } from 'react';

interface SwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
  preventScroll?: boolean;
}

/**
 * 滑动手势检测Hook
 * 支持左右上下四个方向的滑动检测
 */
export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 50,
  preventScroll = false
}: SwipeGestureOptions = {}) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const touchEnd = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchEnd.current = null;
    touchStart.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    };
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (preventScroll) {
      e.preventDefault();
    }
    touchEnd.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    };
  }, [preventScroll]);

  const onTouchEnd = useCallback(() => {
    if (!touchStart.current || !touchEnd.current) return;

    const deltaX = touchStart.current.x - touchEnd.current.x;
    const deltaY = touchStart.current.y - touchEnd.current.y;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // 判断是水平滑动还是垂直滑动
    if (absDeltaX > absDeltaY) {
      // 水平滑动
      if (absDeltaX > threshold) {
        if (deltaX > 0) {
          // 向左滑动
          onSwipeLeft?.();
        } else {
          // 向右滑动
          onSwipeRight?.();
        }
      }
    } else {
      // 垂直滑动
      if (absDeltaY > threshold) {
        if (deltaY > 0) {
          // 向上滑动
          onSwipeUp?.();
        } else {
          // 向下滑动
          onSwipeDown?.();
        }
      }
    }

    // 重置触摸点
    touchStart.current = null;
    touchEnd.current = null;
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}
