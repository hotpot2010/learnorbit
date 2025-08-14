'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HelpCircle, Lightbulb, StickyNote, Play, Move } from 'lucide-react';

interface TextSelectionPopupProps {
  onWhatClick?: (selectedText: string) => void;
  onWhyClick?: (selectedText: string) => void;
  onHowClick?: (selectedText: string) => void;
  onMarkClick?: (selectedText: string) => void;
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
  onHowClick,
  onMarkClick,
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
  const handleButtonClick = (action: 'what' | 'why' | 'how' | 'mark' | 'note' | 'video') => {
    const callbacks = {
      what: onWhatClick,
      why: onWhyClick,
      how: onHowClick,
      mark: onMarkClick,
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

  // 计算轨迹箭头的角度和长度
  const calculateArrowGeometry = () => {
    const { startPosition, currentPosition } = dragState;
    const deltaX = currentPosition.x - startPosition.x;
    const deltaY = currentPosition.y - startPosition.y;
    const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
    
    return { length, angle, deltaX, deltaY };
  };

  // 生成手写风格的曲线路径
  const generateHandDrawnPath = () => {
    const { startPosition, currentPosition } = dragState;
    const deltaX = currentPosition.x - startPosition.x;
    const deltaY = currentPosition.y - startPosition.y;
    
    // 计算控制点来创建自然的曲线
    const midX = startPosition.x + deltaX * 0.5;
    const midY = startPosition.y + deltaY * 0.5;
    
    // 添加一些随机性和弯曲度来模拟手写效果
    const curvature = Math.min(Math.sqrt(deltaX * deltaX + deltaY * deltaY) * 0.2, 50);
    const controlX1 = startPosition.x + deltaX * 0.25 + (Math.random() - 0.5) * 20;
    const controlY1 = startPosition.y + deltaY * 0.25 - curvature + (Math.random() - 0.5) * 20;
    const controlX2 = startPosition.x + deltaX * 0.75 + (Math.random() - 0.5) * 20;
    const controlY2 = startPosition.y + deltaY * 0.75 + curvature + (Math.random() - 0.5) * 20;
    
    // 创建贝塞尔曲线路径
    const path = `M ${startPosition.x} ${startPosition.y} 
                  C ${controlX1} ${controlY1}, 
                    ${controlX2} ${controlY2}, 
                    ${currentPosition.x} ${currentPosition.y}`;
    
    return path;
  };

  // 生成稳定的手写风格曲线路径（避免重影）
  const generateStableHandDrawnPath = () => {
    const { startPosition, currentPosition } = dragState;
    const deltaX = currentPosition.x - startPosition.x;
    const deltaY = currentPosition.y - startPosition.y;
    
    // 使用固定的种子值来避免随机性导致的重影
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const curvature = Math.min(distance * 0.15, 40);
    
    // 使用固定的偏移而不是随机值
    const controlX1 = startPosition.x + deltaX * 0.3;
    const controlY1 = startPosition.y + deltaY * 0.3 - curvature;
    const controlX2 = startPosition.x + deltaX * 0.7;
    const controlY2 = startPosition.y + deltaY * 0.7 + curvature;
    
    // 创建贝塞尔曲线路径
    const path = `M ${startPosition.x} ${startPosition.y} 
                  C ${controlX1} ${controlY1}, 
                    ${controlX2} ${controlY2}, 
                    ${currentPosition.x} ${currentPosition.y}`;
    
    return path;
  };

  // 计算箭头头部的角度
  const getArrowHeadAngle = () => {
    const { startPosition, currentPosition } = dragState;
    const deltaX = currentPosition.x - startPosition.x;
    const deltaY = currentPosition.y - startPosition.y;
    return Math.atan2(deltaY, deltaX) * (180 / Math.PI);
  };

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
              {/* 拖拽按钮 - 放在最左侧，只有图标 */}
              {isInChatArea() && (
                <Button
                  variant="ghost"
                  size="sm"
                  onMouseDown={handleDragStart}
                  className="flex items-center justify-center p-2 h-8 w-8 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-full transform hover:scale-110 transition-all duration-200 cursor-grab active:cursor-grabbing"
                  title={`拖拽笔记: ${selectedText.slice(0, 30)}${selectedText.length > 30 ? '...' : ''}`}
                >
                  <Move className="w-4 h-4" />
                </Button>
              )}

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

              {/* How 按钮 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleButtonClick('how')}
                className="flex items-center space-x-1 px-2 py-1 h-8 text-xs font-medium bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded transform rotate-1 hover:rotate-0 transition-all duration-200"
                title={`How: ${selectedText.slice(0, 30)}${selectedText.length > 30 ? '...' : ''}`}
              >
                <HelpCircle className="w-3 h-3" />
                <span style={{ fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive' }}>
                  How
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

              {/* 标记 按钮（圆点） - 放到最右侧 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleButtonClick('mark')}
                className="flex items-center justify-center p-2 h-8 w-8 border border-pink-200 rounded-full transform hover:scale-110 transition-all duration-200"
                title={`标记: ${selectedText.slice(0, 30)}${selectedText.length > 30 ? '...' : ''}`}
              >
                <span className="block w-2.5 h-2.5 rounded-full bg-pink-500" />
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* 拖拽中的手写风格曲线箭头 */}
      {dragState.isDragging && (() => {
        const { startPosition, currentPosition } = dragState;
        const midX = (startPosition.x + currentPosition.x) / 2;
        const midY = (startPosition.y + currentPosition.y) / 2;
        const arrowAngle = getArrowHeadAngle();
        
        return (
          <div className="fixed inset-0 z-[60] pointer-events-none">
            {/* SVG手写风格曲线 */}
            <svg
              className="absolute inset-0 w-full h-full"
              style={{
                left: 0,
                top: 0,
                width: '100vw',
                height: '100vh',
                overflow: 'visible'
              }}
            >
              <defs>
                {/* 渐变笔触 - 起点粗终点细 */}
                <linearGradient id="strokeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" style={{ stopColor: '#dc2626', stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: '#dc2626', stopOpacity: 0.8 }} />
                </linearGradient>
                
                {/* 变宽度笔触效果 */}
                <linearGradient id="widthGradient" gradientUnits="userSpaceOnUse"
                  x1={startPosition.x} y1={startPosition.y} 
                  x2={currentPosition.x} y2={currentPosition.y}>
                  <stop offset="0%" style={{ stopColor: '#dc2626', stopOpacity: 1 }} />
                  <stop offset="70%" style={{ stopColor: '#dc2626', stopOpacity: 0.9 }} />
                  <stop offset="100%" style={{ stopColor: '#dc2626', stopOpacity: 0.7 }} />
                </linearGradient>
                
                {/* 手写画笔效果的滤镜 */}
                <filter id="roughPaper" x="0%" y="0%" width="100%" height="100%">
                  <feTurbulence baseFrequency="0.02" numOctaves="3" result="noise"/>
                  <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.5"/>
                </filter>
                
                {/* 柔和发光效果 */}
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              
              {/* 主要的手写风格曲线 - 使用渐变宽度 */}
              <path
                d={generateStableHandDrawnPath()}
                stroke="url(#widthGradient)"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#roughPaper)"
                style={{
                  strokeDasharray: '8,3',
                  strokeDashoffset: '0',
                  animation: 'dashFlow 2s linear infinite'
                }}
              />
              
              {/* 细线条增强效果 - 起点粗终点细 */}
              <path
                d={generateStableHandDrawnPath()}
                stroke="url(#widthGradient)"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.7"
                filter="url(#glow)"
              />
              
              {/* 额外的细节线条 - 模拟笔尖压力变化 */}
              <path
                d={generateStableHandDrawnPath()}
                stroke="#dc2626"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.5"
                transform="translate(0.5, 0.5)"
              />
            </svg>
            
            {/* 终点呼吸红点 */}
            <div
              className="absolute"
              style={{
                left: `${currentPosition.x}px`,
                top: `${currentPosition.y}px`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" className="overflow-visible">
                <defs>
                  <filter id="dotGlow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                  
                  {/* 红点渐变 */}
                  <radialGradient id="dotGradient" cx="50%" cy="30%" r="70%">
                    <stop offset="0%" style={{ stopColor: '#fecaca', stopOpacity: 1 }} />
                    <stop offset="30%" style={{ stopColor: '#ef4444', stopOpacity: 1 }} />
                    <stop offset="70%" style={{ stopColor: '#dc2626', stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: '#991b1b', stopOpacity: 0.8 }} />
                  </radialGradient>
                </defs>
                
                {/* 外层呼吸光环 */}
                <circle
                  cx="10"
                  cy="10"
                  r="8"
                  fill="#dc2626"
                  opacity="0.3"
                  filter="url(#dotGlow)"
                  style={{
                    animation: 'breatheOuter 2s ease-in-out infinite'
                  }}
                />
                
                {/* 中层光环 */}
                <circle
                  cx="10"
                  cy="10"
                  r="6"
                  fill="#ef4444"
                  opacity="0.5"
                  filter="url(#dotGlow)"
                  style={{
                    animation: 'breatheMiddle 2s ease-in-out infinite 0.3s'
                  }}
                />
                
                {/* 主红点 */}
                <circle
                  cx="10"
                  cy="10"
                  r="4"
                  fill="url(#dotGradient)"
                  stroke="#dc2626"
                  strokeWidth="1"
                  filter="url(#dotGlow)"
                  style={{
                    animation: 'breatheCore 2s ease-in-out infinite 0.6s'
                  }}
                />
                
                {/* 中心高光点 */}
                <circle
                  cx="8"
                  cy="8"
                  r="1.5"
                  fill="#fecaca"
                  opacity="0.9"
                  style={{
                    animation: 'breatheCore 2s ease-in-out infinite 0.6s'
                  }}
                />
              </svg>
            </div>
            
            {/* 起点标记 - 手写风格 */}
            <div
              className="absolute"
              style={{
                left: `${startPosition.x}px`,
                top: `${startPosition.y}px`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10">
                <circle
                  cx="5"
                  cy="5"
                  r="3"
                  fill="#dc2626"
                  stroke="#dc2626"
                  strokeWidth="1"
                  opacity="0.9"
                  style={{
                    animation: 'startPointPulse 2s ease-in-out infinite'
                  }}
                />
                <circle
                  cx="5"
                  cy="5"
                  r="1.5"
                  fill="#ffffff"
                  opacity="0.8"
                />
              </svg>
            </div>
            
            {/* 拖拽提示文字 - 手写风格 */}
            <div
              className="absolute text-sm text-red-600 font-bold bg-white/95 px-3 py-2 rounded-lg shadow-xl border-2 border-red-200 pointer-events-none"
              style={{
                left: `${midX}px`,
                top: `${midY - 40}px`,
                transform: 'translate(-50%, 0) rotate(-1deg)',
                fontFamily: '"Kalam", "Comic Sans MS", "Marker Felt", cursive',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1)',
                animation: 'textFloat 3s ease-in-out infinite'
              }}
            >
              ✏️ 拖拽到正文位置
            </div>

            <style jsx>{`
              @keyframes dashFlow {
                from {
                  stroke-dashoffset: 0;
                }
                to {
                  stroke-dashoffset: 22;
                }
              }
              
              @keyframes breatheOuter {
                0%, 100% {
                  transform: scale(1);
                  opacity: 0.2;
                }
                50% {
                  transform: scale(1.4);
                  opacity: 0.1;
                }
              }
              
              @keyframes breatheMiddle {
                0%, 100% {
                  transform: scale(1);
                  opacity: 0.4;
                }
                50% {
                  transform: scale(1.3);
                  opacity: 0.2;
                }
              }
              
              @keyframes breatheCore {
                0%, 100% {
                  transform: scale(1);
                  opacity: 1;
                }
                50% {
                  transform: scale(1.2);
                  opacity: 0.8;
                }
              }
              
              @keyframes startPointPulse {
                0%, 100% {
                  transform: scale(1);
                  opacity: 0.9;
                }
                50% {
                  transform: scale(1.2);
                  opacity: 0.7;
                }
              }
              
              @keyframes textFloat {
                0%, 100% {
                  transform: translate(-50%, 0) rotate(-1deg);
                }
                50% {
                  transform: translate(-50%, -3px) rotate(-0.5deg);
                }
              }
            `}</style>
          </div>
        );
      })()}
    </>
  );
}
 
 
 