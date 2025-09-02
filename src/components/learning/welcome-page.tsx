'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  HelpCircle,
  Lightbulb,
  StickyNote,
  Play,
  Move
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useTranslations } from 'next-intl';

interface WelcomePageProps {
  onStartLearning: () => void;
}

export function WelcomePage({ onStartLearning }: WelcomePageProps) {
  const t = useTranslations('LearningPlatform.welcome');

  const welcomeContent = `# ${t('title')} 🎉

${t('subtitle')}

## 📚 ${t('contentTitle')}

**${t('contentNote')}** - ${t('contentNoteDesc')}

**${t('contentVideo')}** - ${t('contentVideoDesc')}

## 🤖 ${t('aiAssistantTitle')}

${t('aiAssistantDesc')}

## ✨ ${t('interactionTitle')}

${t('interactionDesc')}`;
  return (
    <div className="learning-content-area space-y-12">
      {/* 主要内容 - 使用与其他步骤相同的 markdown 渲染 */}
      <div className="space-y-4">
        <div className="relative">
          <ReactMarkdown components={{
            h1: ({ children, ...props }) => (
              <h1 className="text-3xl font-bold text-center text-blue-700 relative mb-8" {...props}>
                <span className="bg-yellow-200 px-3 py-1 rounded-lg inline-block transform -rotate-1 shadow-sm">
                  {children}
                </span>
              </h1>
            ),
            h2: ({ children, ...props }) => {
              // 检查是否是 AI学习助手 标题
              const isAIAssistant = typeof children === 'string' && children.includes(t('aiAssistantTitle'));
              return (
                <div className="relative">
                  <h2 className="text-xl font-bold text-blue-700 mb-6 mt-8" style={{
                    fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                  }} {...props}>
                    {children}
                  </h2>
                  {isAIAssistant && (
                    <div className="absolute -right-8 top-6 pointer-events-none hidden lg:block">
                      <svg width="220" height="100" viewBox="0 0 220 100" className="transform scale-90">
                        <defs>
                          <filter id="rough-filter">
                            <feTurbulence baseFrequency="0.04" numOctaves="3" result="noise" seed="2"/>
                            <feDisplacementMap in="SourceGraphic" in2="noise" scale="1"/>
                          </filter>
                        </defs>
                        {/* 更长的弯曲箭头主体 */}
                        <path
                          d="M20,50 Q70,30 120,45 Q170,60 200,40"
                          stroke="#e74c3c"
                          strokeWidth="3"
                          fill="none"
                          strokeLinecap="round"
                          filter="url(#rough-filter)"
                          className="transform rotate-1"
                        />
                        {/* 箭头头部 */}
                        <path
                          d="M185,35 L200,40 L190,50"
                          stroke="#e74c3c"
                          strokeWidth="3"
                          fill="none"
                          strokeLinecap="round"
                          filter="url(#rough-filter)"
                        />
                        {/* 更大的手写文字 */}
                        <text
                          x="110"
                          y="85"
                          fill="#e74c3c"
                          fontFamily="Comic Sans MS, Marker Felt, Kalam, cursive"
                          fontSize="18"
                          fontWeight="bold"
                          textAnchor="middle"
                          className="transform -rotate-2"
                        >
                          {t('aiAssistantArrow')}
                        </text>
                      </svg>
                    </div>
                  )}
                </div>
              );
            },
            h3: ({ children, ...props }) => (
              <h3 className="text-lg font-bold text-purple-700 mb-5 mt-7" style={{
                fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
              }} {...props}>
                {children}
              </h3>
            ),
            p: ({ children, ...props }) => {
              // 检查是否是第一个段落（副标题）
              const isSubtitle = typeof children === 'string' && children.includes(t('subtitle').split(' ')[0]);
              if (isSubtitle) {
                return (
                  <p className="text-gray-800 leading-loose mb-4 text-center" style={{
                    fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                  }} {...props}>
                    {children}
                  </p>
                );
              }
              // 其他段落使用与学习步骤相同的缩进布局
              return (
                <div className="flex items-start space-x-3 mb-8 ml-6">
                  <div className="w-6 h-6 rounded-full bg-yellow-400 text-black text-sm font-bold flex items-center justify-center mt-1 transform rotate-12 shadow-sm">
                    📝
                  </div>
                  <div className="flex-1">
                    <p className="text-base leading-loose text-gray-800 font-bold" style={{
                      fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                    }} {...props}>
                      {children}
                    </p>
                  </div>
                </div>
              );
            },
            ul: ({ children, ...props }) => (
              <ul className="list-disc list-inside space-y-2 ml-4 text-gray-700" style={{
                fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
              }} {...props}>
                {children}
              </ul>
            ),
            li: ({ children, ...props }) => (
              <li className="leading-relaxed" {...props}>
                {children}
              </li>
            ),
          }}>
            {welcomeContent}
          </ReactMarkdown>
        </div>
      </div>

      {/* 浮框功能演示 */}
      <div className="space-y-6">
        {/* 模拟浮框展示 */}
        <div className="flex justify-center">
          <Card className="p-3 shadow-lg border-2 border-gray-300 bg-white relative">
            <div className="flex items-center space-x-2">
              {/* 拖拽按钮 */}
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center justify-center p-2 h-8 w-8 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-full transform hover:scale-110 transition-all duration-200"
                title="拖拽到AI聊天"
              >
                <Move className="w-4 h-4" />
              </Button>

              {/* What 按钮 */}
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center space-x-1 px-2 py-1 h-8 text-xs font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded transform rotate-1 hover:rotate-0 transition-all duration-200"
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
                className="flex items-center space-x-1 px-2 py-1 h-8 text-xs font-medium bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200 rounded transform -rotate-1 hover:rotate-0 transition-all duration-200"
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
                className="flex items-center space-x-1 px-2 py-1 h-8 text-xs font-medium bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded transform rotate-1 hover:rotate-0 transition-all duration-200"
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
                className="flex items-center space-x-1 px-2 py-1 h-8 text-xs font-medium bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded transform rotate-0.5 hover:rotate-0 transition-all duration-200"
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
                className="flex items-center space-x-1 px-2 py-1 h-8 text-xs font-medium bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded transform -rotate-0.5 hover:rotate-0 transition-all duration-200"
              >
                <Play className="w-3 h-3" />
                <span style={{ fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive' }}>
                  Video
                </span>
              </Button>

              {/* 标记按钮 */}
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center justify-center p-2 h-8 w-8 border border-pink-200 rounded-full transform hover:scale-110 transition-all duration-200"
              >
                <span className="block w-2.5 h-2.5 rounded-full bg-pink-500" />
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* 便签功能说明和示例 */}
      <div className="space-y-6">
        <div className="flex items-start space-x-3 mb-8 ml-6">
          <div className="w-6 h-6 rounded-full bg-yellow-400 text-black text-sm font-bold flex items-center justify-center mt-1 transform rotate-12 shadow-sm">
            📝
          </div>
          <div className="flex-1">
            <p className="text-base leading-loose text-gray-800 font-bold" style={{
              fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
            }}>
              {t('dragDesc')}
            </p>
          </div>
        </div>

        {/* 便签示例 */}
        <div className="my-6 relative">
          {/* 模拟聊天框消息 - 位于右侧 */}
          <div className="absolute -right-4 -top-8 z-10">
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 max-w-xs">
              {/* 聊天消息头部 */}
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">AI</span>
                </div>
                <span className="text-xs text-gray-500">刚刚</span>
              </div>
              {/* 消息内容 - 3行文本 */}
              <div className="bg-blue-50 rounded-lg p-2">
                <p className="text-sm text-gray-800 leading-relaxed" style={{ fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive' }}>
                  {t('chatBubble.line1').replace(t('chatBubble.highlight'), '')}<span className="bg-yellow-200 px-1 rounded text-blue-800 font-semibold">{t('chatBubble.highlight')}</span>{t('chatBubble.line1').includes('～') ? '～' : ''}
                  <br />
                  {t('chatBubble.line2')}
                  <br />
                  {t('chatBubble.line3')}
                </p>
              </div>
            </div>
          </div>

          {/* 手写红色箭头 - 从气泡左侧指向便签右侧 */}
          <div className="absolute left-1/2 top-4 transform translate-x-8 z-20 pointer-events-none hidden lg:block">
            <svg width="220" height="100" viewBox="0 0 220 100" className="transform scale-90">
              <defs>
                <filter id="rough-filter">
                  <feTurbulence baseFrequency="0.04" numOctaves="3" result="noise" seed="2"/>
                  <feDisplacementMap in="SourceGraphic" in2="noise" scale="1"/>
                </filter>
              </defs>
              {/* 弯曲的箭头主体 - 从右指向左 */}
              <path
                d="M200,40 Q170,60 120,45 Q70,30 20,50"
                stroke="#e74c3c"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                filter="url(#rough-filter)"
                className="transform rotate-1"
              />
              {/* 箭头头部 - 指向左侧便签 */}
              <path
                d="M35,45 L20,50 L30,60"
                stroke="#e74c3c"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                filter="url(#rough-filter)"
              />
              {/* 手写文字 */}
              <text
                x="110"
                y="85"
                fill="#e74c3c"
                fontFamily="Comic Sans MS, Marker Felt, Kalam, cursive"
                fontSize="18"
                fontWeight="bold"
                textAnchor="middle"
                className="transform -rotate-2"
              >
                {t('dragArrow')}
              </text>
            </svg>
          </div>

          <div className="flex items-start mb-4 ml-6 space-x-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-100 to-yellow-200 text-yellow-700 border-yellow-200 text-lg font-bold flex items-center justify-center mt-1 transform rotate-1 shadow-md">
              <StickyNote className="w-4 h-4" />
            </div>
            <div className="flex-1 max-w-fit">
              <div className="bg-yellow-100 border-yellow-200 border-2 rounded-lg p-4 relative shadow-md transform rotate-1">
                <div className="absolute top-1 right-1 w-3 h-3 bg-yellow-100 border-yellow-200 border-t border-r transform rotate-45 translate-x-1 -translate-y-1" />
                <div className="space-y-3">
                  <div className="text-lg leading-relaxed whitespace-pre-wrap break-words" style={{
                    fontFamily: '"Kalam", "Comic Sans MS", "Marker Felt", cursive',
                    fontSize: '16px',
                    lineHeight: '1.6',
                    textShadow: '0 0.5px 1px rgba(0, 0, 0, 0.06)',
                    wordBreak: 'break-word'
                  }}>
                    <span className="text-yellow-800">
                      {t('stickyNote.line1')}
                      {'\n'}{t('stickyNote.line2')}
                      {'\n'}{t('stickyNote.line3')}
                    </span>
                  </div>
                </div>
                <div className="text-xs opacity-70 text-yellow-600" style={{ fontFamily: '"Kalam", "Comic Sans MS", "Marker Felt", cursive' }}>
                  Added at 14:30:25
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 答题功能介绍 */}
      <div className="space-y-6">
        <div className="flex items-start space-x-3 mb-8 ml-6">
          <div className="w-6 h-6 rounded-full bg-purple-400 text-white text-sm font-bold flex items-center justify-center mt-1 transform rotate-12 shadow-sm">
            🧠
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-purple-700 mb-3" style={{
              fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
            }}>
              🎯 {t('quizTitle')}
            </h3>
            <p className="text-base leading-loose text-gray-800 font-bold mb-4" style={{
              fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
            }}>
              {t('quizDesc')}
            </p>
          </div>
        </div>
      </div>

      {/* 开始学习按钮 - 与其他步骤提交按钮位置和样式保持一致 */}
      <div className="flex justify-end pt-12">
        <Button
          onClick={onStartLearning}
          className="bg-primary hover:bg-primary/90 transform rotate-1 shadow-lg font-bold"
          style={{
            fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
          }}
        >
          {t('startButton')}
        </Button>
      </div>
    </div>
  );
}
