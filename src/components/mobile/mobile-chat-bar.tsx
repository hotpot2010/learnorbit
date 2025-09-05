'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { MessageCircle, X, Send } from 'lucide-react';

interface MobileChatBarProps {
  isExpanded: boolean;
  onToggle: () => void;
  onSendMessage: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * 移动端底部聊天栏组件
 * 支持收起/展开状态，全屏聊天界面
 */
export function MobileChatBar({
  isExpanded,
  onToggle,
  onSendMessage,
  placeholder = "点击展开聊天...",
  disabled = false
}: MobileChatBarProps) {
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isExpanded) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b bg-white">
          <h3 className="text-lg font-semibold">AI助手</h3>
          <button
            onClick={onToggle}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 聊天消息区域 */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-center text-gray-500 py-8">
            聊天消息将在这里显示
          </div>
        </div>

        {/* 底部输入区 */}
        <div className="p-4 border-t bg-white">
          <div className="flex items-end space-x-3">
            <div className="flex-1">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="输入消息..."
                disabled={disabled}
                className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={1}
                style={{ minHeight: '44px', maxHeight: '120px' }}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={disabled || !inputValue.trim()}
              className={cn(
                "p-3 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center",
                disabled || !inputValue.trim()
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-blue-500 text-white hover:bg-blue-600"
              )}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t z-40">
      <div
        className={cn(
          "flex items-center p-4 cursor-pointer transition-colors",
          disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"
        )}
        onClick={disabled ? undefined : onToggle}
      >
        <MessageCircle className="w-5 h-5 text-gray-400 mr-3 flex-shrink-0" />
        <div className="flex-1 bg-gray-100 rounded-full px-4 py-3 text-gray-600">
          {placeholder}
        </div>
      </div>
    </div>
  );
}
