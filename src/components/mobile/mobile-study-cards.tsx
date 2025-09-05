'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import { mathMarkdownPlugins, mathStyles, preprocessMathContent } from '@/lib/math-renderer';
import { PlayCircle, FileText, CheckCircle } from 'lucide-react';

interface MobilePPTCardProps {
  content: string;
  stepTitle: string;
  stepNumber: number;
  totalSteps: number;
}

export function MobilePPTCard({ content, stepTitle, stepNumber, totalSteps }: MobilePPTCardProps) {
  const processedContent = preprocessMathContent(content);
  
  return (
    <div className="h-full flex flex-col bg-white">
      {/* 头部 */}
      <div className="p-4 border-b bg-blue-50">
        <div className="flex items-center justify-between mb-2">
          <Badge variant="secondary" className="text-xs">
            步骤 {stepNumber}/{totalSteps}
          </Badge>
          <Badge variant="outline" className="text-xs">
            📝 PPT内容
          </Badge>
        </div>
        <h2 className="text-lg font-bold text-gray-800 leading-tight">
          {stepTitle}
        </h2>
      </div>
      
      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown
            remarkPlugins={mathMarkdownPlugins.remarkPlugins}
            rehypePlugins={mathMarkdownPlugins.rehypePlugins}
            components={{
              h1: ({ children }) => (
                <h1 className="text-xl font-bold mb-4 text-blue-700">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-lg font-semibold mb-3 text-blue-600">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-base font-medium mb-2 text-blue-500">{children}</h3>
              ),
              p: ({ children }) => (
                <p className="mb-3 text-gray-700 leading-relaxed">{children}</p>
              ),
              ul: ({ children }) => (
                <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>
              ),
              li: ({ children }) => (
                <li className="text-gray-700">{children}</li>
              ),
              code: ({ children, className }) => {
                if (className === 'language-math') {
                  return <span className="math math-inline">{children}</span>;
                }
                return <code className="bg-gray-100 px-1 py-0.5 rounded text-sm">{children}</code>;
              },
              pre: ({ children }) => (
                <pre className="bg-gray-100 p-3 rounded-lg overflow-x-auto text-sm mb-4">{children}</pre>
              ),
              // 数学公式渲染
              div: ({ children, className, ...props }) => {
                if (className === 'math math-display') {
                  return (
                    <div className="my-4 text-center" {...props}>
                      <span className="math math-display">{children}</span>
                    </div>
                  );
                }
                return <div className={className} {...props}>{children}</div>;
              },
              span: ({ children, className, ...props }) => {
                if (className === 'math math-inline') {
                  return (
                    <span className="math math-inline" {...props}>{children}</span>
                  );
                }
                return <span className={className} {...props}>{children}</span>;
              }
            }}
          >
            {processedContent}
          </ReactMarkdown>
        </div>
      </div>
      
      {/* 底部提示 */}
      <div className="p-4 bg-gray-50 border-t">
        <p className="text-xs text-gray-500 text-center">
          向右滑动查看视频内容 →
        </p>
      </div>
    </div>
  );
}

interface MobileVideoCardProps {
  videos: Array<{ url: string; title?: string; description?: string }>;
  currentVideoIndex: number;
  onVideoChange: (index: number) => void;
}

export function MobileVideoCard({ videos, currentVideoIndex, onVideoChange }: MobileVideoCardProps) {
  if (!videos || videos.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-white p-4">
        <PlayCircle className="w-16 h-16 text-gray-300 mb-4" />
        <p className="text-gray-500 text-center">暂无视频内容</p>
        <p className="text-xs text-gray-400 text-center mt-2">
          向右滑动进入练习 →
        </p>
      </div>
    );
  }

  const currentVideo = videos[currentVideoIndex];
  
  return (
    <div className="h-full flex flex-col bg-white">
      {/* 头部 */}
      <div className="p-4 border-b bg-red-50">
        <div className="flex items-center justify-between mb-2">
          <Badge variant="secondary" className="text-xs">
            视频 {currentVideoIndex + 1}/{videos.length}
          </Badge>
          <Badge variant="outline" className="text-xs">
            🎥 视频内容
          </Badge>
        </div>
        {currentVideo.title && (
          <h2 className="text-lg font-bold text-gray-800 leading-tight">
            {currentVideo.title}
          </h2>
        )}
      </div>
      
      {/* 视频区域 */}
      <div className="flex-1 bg-black flex items-center justify-center">
        {currentVideo.url ? (
          <iframe
            src={currentVideo.url}
            className="w-full h-full"
            allowFullScreen
            title={currentVideo.title || `视频 ${currentVideoIndex + 1}`}
          />
        ) : (
          <div className="text-white text-center">
            <PlayCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>视频加载中...</p>
          </div>
        )}
      </div>
      
      {/* 视频列表 */}
      {videos.length > 1 && (
        <div className="p-4 bg-gray-50 border-t">
          <div className="flex space-x-2 overflow-x-auto">
            {videos.map((video, index) => (
              <button
                key={index}
                onClick={() => onVideoChange(index)}
                className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  index === currentVideoIndex
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                视频 {index + 1}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* 底部提示 */}
      <div className="p-2 bg-gray-50">
        <p className="text-xs text-gray-500 text-center">
          ← 左滑返回PPT　　右滑进入练习 →
        </p>
      </div>
    </div>
  );
}

interface MobileQuizCardProps {
  questions: Array<{
    question: string;
    options: string[];
    answer: string;
  }>;
  selectedAnswers: Record<number, string>;
  wrongAnswers: Set<number>;
  hasSubmitted: boolean;
  onAnswerSelect: (questionIndex: number, answer: string) => void;
  onSubmit: () => void;
}

export function MobileQuizCard({
  questions,
  selectedAnswers,
  wrongAnswers,
  hasSubmitted,
  onAnswerSelect,
  onSubmit
}: MobileQuizCardProps) {
  if (!questions || questions.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-white p-4">
        <CheckCircle className="w-16 h-16 text-gray-300 mb-4" />
        <p className="text-gray-500 text-center">暂无练习题</p>
        <p className="text-xs text-gray-400 text-center mt-2">
          向右滑动进入下一步 →
        </p>
      </div>
    );
  }

  const allAnswered = Object.keys(selectedAnswers).length === questions.length;
  const allCorrect = wrongAnswers.size === 0;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* 头部 */}
      <div className="p-4 border-b bg-green-50">
        <div className="flex items-center justify-between mb-2">
          <Badge variant="secondary" className="text-xs">
            练习题 {questions.length}题
          </Badge>
          <Badge variant="outline" className="text-xs">
            🧠 Quiz练习
          </Badge>
        </div>
        <h2 className="text-lg font-bold text-gray-800">
          课堂练习
        </h2>
      </div>
      
      {/* 题目区域 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {questions.map((question, qIndex) => (
          <div key={qIndex} className="bg-gray-50 p-4 rounded-lg">
            <h4 className={`text-sm font-semibold mb-3 ${
              wrongAnswers.has(qIndex) ? 'text-red-700' : 'text-gray-800'
            }`}>
              <span className="mr-2">Q{qIndex + 1}:</span>
              {question.question}
            </h4>
            
            <div className="space-y-2">
              {question.options.map((option, index) => {
                const isSelected = selectedAnswers[qIndex] === option;
                const isWrongAnswer = hasSubmitted && isSelected && option !== question.answer;
                const isCorrectAnswer = hasSubmitted && option === question.answer;
                
                return (
                  <label
                    key={index}
                    className={`flex items-center space-x-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                      isWrongAnswer 
                        ? 'bg-red-100 border-red-400 text-red-800'
                        : isCorrectAnswer && hasSubmitted
                        ? 'bg-green-100 border-green-400 text-green-800'
                        : isSelected
                        ? 'bg-blue-100 border-blue-400 text-blue-800'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`mobile-question-${qIndex}`}
                      value={option}
                      checked={isSelected}
                      onChange={(e) => onAnswerSelect(qIndex, e.target.value)}
                      className="text-blue-500"
                    />
                    <span className="text-sm font-medium flex-1">
                      {String.fromCharCode(65 + index)}. {option}
                    </span>
                    {isWrongAnswer && (
                      <span className="text-red-600 font-bold">✗</span>
                    )}
                    {isCorrectAnswer && hasSubmitted && (
                      <span className="text-green-600 font-bold">✓</span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      
      {/* 底部操作 */}
      <div className="p-4 bg-gray-50 border-t">
        {!hasSubmitted ? (
          <Button
            onClick={onSubmit}
            disabled={!allAnswered}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-medium"
          >
            提交答案 ({Object.keys(selectedAnswers).length}/{questions.length})
          </Button>
        ) : allCorrect ? (
          <div className="text-center">
            <p className="text-green-600 font-bold mb-2">🎉 全部正确！</p>
            <p className="text-xs text-gray-500">
              向右滑动进入下一步 →
            </p>
          </div>
        ) : (
          <div className="text-center">
            <Button
              onClick={onSubmit}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium mb-2"
            >
              重新提交
            </Button>
            <p className="text-xs text-gray-500">
              有 {wrongAnswers.size} 题答错，请重新作答
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
