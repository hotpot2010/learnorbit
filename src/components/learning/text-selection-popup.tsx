'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HelpCircle, Lightbulb, StickyNote, Play, Move } from 'lucide-react';

interface TextSelectionPopupProps {
  onWhatClick?: (selectedText: string) => void;
  onWhyClick?: (selectedText: string) => void;
  onNoteClick?: (selectedText: string) => void;
  onVideoClick?: (selectedText: string) => void;
  onDragStart?: (selectedText: string) => void; // 新增：拖拽开始回调
  onDragEnd?: (selectedText: string, targetPosition: { x: number; y: number }) => void; // 新增：拖拽结束回调
  containerSelector?: string; // 新增：限制工作的容器选择器
}

interface PopupPosition {
  x: number;
  y: number;
  visible: boolean;
}

interface DragState {
  isDragging: boolean;
  dragText: string;
  startPosition: { x: number; y: number };
  currentPosition: { x: number; y: number };
}

export function TextSelectionPopup({
  onWhatClick,
  onWhyClick,
  onNoteClick,
  onVideoClick,
  onDragStart,
  onDragEnd,
  containerSelector = '' // 默认为空，表示全局工作
}: TextSelectionPopupProps) {
  const [selectedText, setSelectedText] = useState<string>('');
  const [popupPosition, setPopupPosition] = useState<PopupPosition>({
    x: 0,
    y: 0,
    visible: false
  });
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    dragText: '',
    startPosition: { x: 0, y: 0 },
    currentPosition: { x: 0, y: 0 }
  });
  
  const popupRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dragElementRef = useRef<HTMLDivElement>(null);

  // 处理文字选择
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection) return;

    const text = selection.toString().trim();
    
    if (text.length > 0) {
      // 获取选择范围的位置
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      // 计算浮框位置 - 显示在选择文字的下方
      const x = rect.left + (rect.width / 2);
      const y = rect.bottom + 10; // 稍微向下偏移
      
      setSelectedText(text);
      setPopupPosition({
        x,
        y,
        visible: true
      });

      // 清除之前的超时
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    } else {
      // 没有选择文字，延迟隐藏浮框
      timeoutRef.current = setTimeout(() => {
        setPopupPosition(prev => ({ ...prev, visible: false }));
      }, 100);
    }
  };

  // 检查当前选择是否在聊天区域（用于决定是否显示拖拽按钮）
  const isInChatArea = () => {
    if (!containerSelector) return true; // 没有限制则总是显示
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    
    const container = document.querySelector(containerSelector);
    if (!container) return false;
    
    const range = selection.getRangeAt(0);
    const selectionContainer = range.commonAncestorContainer;
    
    // 检查选择的内容是否在指定容器内
    if (selectionContainer.nodeType === Node.TEXT_NODE) {
      return container.contains(selectionContainer.parentNode);
    } else {
      return container.contains(selectionContainer);
    }
  };

  // 处理点击外部隐藏浮框
  const handleClickOutside = (event: MouseEvent) => {
    if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
      // 检查是否点击在选择的文字上
      const selection = window.getSelection();
      if (!selection || selection.toString().trim() === '') {
        setPopupPosition(prev => ({ ...prev, visible: false }));
      }
    }
  };

  // 监听文字选择事件
  useEffect(() => {
    const handleMouseUp = () => {
      // 延迟一点执行，确保selection已经完成
      setTimeout(handleTextSelection, 10);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      // 监听键盘选择（Shift + 方向键等）
      if (event.shiftKey) {
        setTimeout(handleTextSelection, 10);
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('mousedown', handleClickOutside);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // 处理按钮点击
  const handleButtonClick = (action: 'what' | 'why' | 'note' | 'video') => {
    const callbacks = {
      what: onWhatClick,
      why: onWhyClick,
      note: onNoteClick,
      video: onVideoClick
    };

    const callback = callbacks[action];
    if (callback) {
      callback(selectedText);
    }

    // 点击后保持浮框显示一会儿，然后隐藏
    setTimeout(() => {
      setPopupPosition(prev => ({ ...prev, visible: false }));
      // 清除文字选择
      window.getSelection()?.removeAllRanges();
    }, 500);
  };

  // 处理拖拽开始
  const handleDragStart = (event: React.MouseEvent) => {
    event.preventDefault();
    
    const startX = event.clientX;
    const startY = event.clientY;
    
    setDragState({
      isDragging: true,
      dragText: selectedText,
      startPosition: { x: startX, y: startY },
      currentPosition: { x: startX, y: startY }
    });

    // 通知父组件拖拽开始
    onDragStart?.(selectedText);

    // 隐藏选择浮框
    setPopupPosition(prev => ({ ...prev, visible: false }));
    
    // 清除文字选择
    window.getSelection()?.removeAllRanges();
  };

  // 处理拖拽移动
  const handleDragMove = (event: MouseEvent) => {
    if (!dragState.isDragging) return;
    
    setDragState(prev => ({
      ...prev,
      currentPosition: { x: event.clientX, y: event.clientY }
    }));
  };

  // 处理拖拽结束
  const handleDragEnd = (event: MouseEvent) => {
    if (!dragState.isDragging) return;
    
    const targetPosition = { x: event.clientX, y: event.clientY };
    
    // 通知父组件拖拽结束和目标位置
    onDragEnd?.(dragState.dragText, targetPosition);
    
    // 重置拖拽状态
    setDragState({
      isDragging: false,
      dragText: '',
      startPosition: { x: 0, y: 0 },
      currentPosition: { x: 0, y: 0 }
    });
  };

  // 监听拖拽事件
  useEffect(() => {
    if (dragState.isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [dragState.isDragging, dragState.dragText]);

  return (
    <>
      {/* 文字选择浮框 */}
      {popupPosition.visible && selectedText && (
        <div
          ref={popupRef}
          className="fixed z-50 pointer-events-auto"
          style={{
            left: `${popupPosition.x}px`,
            top: `${popupPosition.y}px`,
            // 位于选中文本下方，仅水平居中
            transform: 'translate(-50%, 0)'
          }}
        >
          <Card className="bg-white/95 backdrop-blur-sm shadow-lg border-2 border-blue-200 rounded-lg p-2">
            <div className="flex items-center space-x-2">
              {/* What 按钮 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleButtonClick('what')}
                className="flex items-center space-x-1 px-2 py-1 h-8 text-xs font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded transform rotate-1 hover:rotate-0 transition-all duration-200"
                title={`What: ${selectedText.slice(0, 30)}${selectedText.length > 30 ? '...' : ''}`}
              >
                <HelpCircle className="w-3 h-3" />
                <span style={{ fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive' }}>
                  What
                </span>
              </Button>

              {/* Why 按钮 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleButtonClick('why')}
                className="flex items-center space-x-1 px-2 py-1 h-8 text-xs font-medium bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200 rounded transform -rotate-1 hover:rotate-0 transition-all duration-200"
                title={`Why: ${selectedText.slice(0, 30)}${selectedText.length > 30 ? '...' : ''}`}
              >
                <Lightbulb className="w-3 h-3" />
                <span style={{ fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive' }}>
                  Why
                </span>
              </Button>

              {/* Note 按钮 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleButtonClick('note')}
                className="flex items-center space-x-1 px-2 py-1 h-8 text-xs font-medium bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded transform rotate-0.5 hover:rotate-0 transition-all duration-200"
                title={`Note: ${selectedText.slice(0, 30)}${selectedText.length > 30 ? '...' : ''}`}
              >
                <StickyNote className="w-3 h-3" />
                <span style={{ fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive' }}>
                  Note
                </span>
              </Button>

              {/* Video 按钮 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleButtonClick('video')}
                className="flex items-center space-x-1 px-2 py-1 h-8 text-xs font-medium bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded transform -rotate-0.5 hover:rotate-0 transition-all duration-200"
                title={`Video: ${selectedText.slice(0, 30)}${selectedText.length > 30 ? '...' : ''}`}
              >
                <Play className="w-3 h-3" />
                <span style={{ fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive' }}>
                  Video
                </span>
              </Button>

              {/* 拖拽按钮 */}
              {isInChatArea() && (
                <Button
                  variant="ghost"
                  size="sm"
                  onMouseDown={handleDragStart}
                  className="flex items-center space-x-1 px-2 py-1 h-8 text-xs font-medium bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded transform rotate-1 hover:rotate-0 transition-all duration-200 cursor-grab active:cursor-grabbing"
                  title={`拖拽笔记: ${selectedText.slice(0, 30)}${selectedText.length > 30 ? '...' : ''}`}
                >
                  <Move className="w-3 h-3" />
                  <span style={{ fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive' }}>
                    拖拽
                  </span>
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* 拖拽中的视觉反馈 - 独立于浮框显示 */}
      {dragState.isDragging && (
        <div
          className="fixed z-[60] pointer-events-none"
          style={{
            left: `${dragState.currentPosition.x}px`,
            top: `${dragState.currentPosition.y}px`,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div className="flex flex-col items-center">
            {/* 主箭头 */}
            <div className="relative">
              {/* 箭头身体 */}
              <div className="w-1 h-8 bg-red-500 mx-auto animate-pulse"></div>
              {/* 箭头头部 */}
              <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[12px] border-l-transparent border-r-transparent border-t-red-500 animate-bounce"></div>
            </div>
            
            {/* 提示文字 */}
            <div className="text-xs text-red-600 font-bold mt-2 bg-white/90 px-2 py-1 rounded shadow-lg border border-red-200" style={{ fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive' }}>
              拖拽到正文位置
            </div>
          </div>
        </div>
      )}
    </>
  );
} 