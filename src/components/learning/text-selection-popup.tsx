'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HelpCircle, Lightbulb, StickyNote, Play } from 'lucide-react';

interface TextSelectionPopupProps {
  onWhatClick?: (selectedText: string) => void;
  onWhyClick?: (selectedText: string) => void;
  onNoteClick?: (selectedText: string) => void;
  onVideoClick?: (selectedText: string) => void;
}

interface PopupPosition {
  x: number;
  y: number;
  visible: boolean;
}

export function TextSelectionPopup({
  onWhatClick,
  onWhyClick,
  onNoteClick,
  onVideoClick
}: TextSelectionPopupProps) {
  const [selectedText, setSelectedText] = useState<string>('');
  const [popupPosition, setPopupPosition] = useState<PopupPosition>({
    x: 0,
    y: 0,
    visible: false
  });
  const popupRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 处理文字选择
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection) return;

    const text = selection.toString().trim();
    
    if (text.length > 0) {
      // 获取选择范围的位置
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      // 计算浮框位置 - 显示在选择文字的上方
      const x = rect.left + (rect.width / 2);
      const y = rect.top - 10; // 稍微向上偏移
      
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

  if (!popupPosition.visible || !selectedText) {
    return null;
  }

  return (
    <div
      ref={popupRef}
      className="fixed z-50 pointer-events-auto"
      style={{
        left: `${popupPosition.x}px`,
        top: `${popupPosition.y}px`,
        transform: 'translate(-50%, -100%)'
      }}
    >
      <Card className="bg-white/95 backdrop-blur-sm shadow-lg border-2 border-blue-200 rounded-lg p-2 transform -rotate-1 hover:rotate-0 transition-all duration-300">
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
        </div>

        {/* 选择的文字预览 */}
        <div className="mt-2 px-2 py-1 bg-gray-50 rounded text-xs text-gray-600 max-w-xs truncate border border-gray-200">
          <span style={{ fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive' }}>
            "{selectedText.slice(0, 50)}{selectedText.length > 50 ? '...' : ''}"
          </span>
        </div>

        {/* 小箭头指向选择的文字 */}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2">
          <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-blue-200"></div>
          <div className="w-0 h-0 border-l-3 border-r-3 border-t-3 border-transparent border-t-white/95 absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-px"></div>
        </div>
      </Card>
    </div>
  );
} 