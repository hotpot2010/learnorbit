'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useSwipeGesture } from '@/hooks/use-swipe-gesture';

interface SwipeableContentProps {
  currentIndex: number;
  onSwipe: (direction: 'left' | 'right') => void;
  children: React.ReactNode[];
  showIndicators?: boolean;
  className?: string;
  indicatorClassName?: string;
  disabled?: boolean;
}

/**
 * 可滑动内容组件
 * 支持左右滑动切换内容，带指示器
 */
export function SwipeableContent({
  currentIndex,
  onSwipe,
  children,
  showIndicators = true,
  className,
  indicatorClassName,
  disabled = false
}: SwipeableContentProps) {
  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: disabled ? undefined : () => onSwipe('left'),
    onSwipeRight: disabled ? undefined : () => onSwipe('right'),
    threshold: 50,
    preventScroll: false
  });

  if (children.length === 0) {
    return null;
  }

  return (
    <div className={cn("relative overflow-hidden h-full", className)}>
      {/* 可滑动内容区域 */}
      <div
        className="flex h-full transition-transform duration-300 ease-out"
        style={{
          transform: `translateX(-${currentIndex * 100}%)`,
          width: `${children.length * 100}%`
        }}
        {...swipeHandlers}
      >
        {children.map((child, index) => (
          <div
            key={index}
            className="w-full h-full flex-shrink-0"
            style={{ width: `${100 / children.length}%` }}
          >
            {child}
          </div>
        ))}
      </div>

      {/* 指示器 */}
      {showIndicators && children.length > 1 && (
        <div className={cn(
          "absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2 bg-black/20 rounded-full px-3 py-2",
          indicatorClassName
        )}>
          {children.map((_, index) => (
            <div
              key={index}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-200",
                index === currentIndex
                  ? "bg-white scale-110"
                  : "bg-white/60 hover:bg-white/80"
              )}
            />
          ))}
        </div>
      )}

      {/* 左右滑动提示 */}
      {!disabled && children.length > 1 && (
        <>
          {currentIndex > 0 && (
            <div className="absolute left-2 top-1/2 transform -translate-y-1/2 text-white/60 text-xs bg-black/20 rounded-full px-2 py-1">
              ← 滑动
            </div>
          )}
          {currentIndex < children.length - 1 && (
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white/60 text-xs bg-black/20 rounded-full px-2 py-1">
              滑动 →
            </div>
          )}
        </>
      )}
    </div>
  );
}
