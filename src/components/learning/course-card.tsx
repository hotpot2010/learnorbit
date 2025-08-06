'use client';

import { Button } from '@/components/ui/button';
import { Clock, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useAuthCheck } from '@/components/shared/login-check';

interface CourseCardProps {
  id: string;
  title: string;
  description: string;
  coverImage?: string;
  estimatedTime: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  progress?: number;
  onClick?: () => void;
  showProgress?: boolean;
}

export function CourseCard({
  id,
  title,
  description,
  coverImage,
  estimatedTime,
  difficulty = 'beginner',
  progress,
  onClick,
  showProgress = false,
}: CourseCardProps) {
  const t = useTranslations('LearningPlatform');
  const { requireAuth } = useAuthCheck();

  const getDifficultyColor = () => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleClick = () => {
    requireAuth(() => {
      if (onClick) {
        onClick();
      } else {
        // 如果没有onClick，导航到学习页面
        window.location.href = `/study/${id}`;
      }
    });
  };

  const courseContent = (
    <div className={`relative bg-white rounded-lg p-4 shadow-lg transform transition-all duration-300 hover:scale-105 hover:shadow-xl border border-gray-100 hover:border-blue-200 ${
      progress ? 'border-blue-200' : ''
    }`}
         style={{
           backgroundColor: '#fefefe',
           backgroundImage: 'linear-gradient(45deg, transparent 24%, rgba(255,255,255,.5) 25%, rgba(255,255,255,.5) 26%, transparent 27%, transparent 74%, rgba(255,255,255,.5) 75%, rgba(255,255,255,.5) 76%, transparent 77%)',
           backgroundSize: '15px 15px'
         }}>

      {/* Cover Image */}
      {coverImage && (
        <div className="aspect-video mb-3 rounded-lg overflow-hidden">
          <img
            src={coverImage}
            alt={title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="space-y-3">
        <h3 className="font-bold text-base text-gray-800 line-clamp-2 transform -rotate-1"
            style={{
              fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
            }}>
          {title}
        </h3>

        <p className="text-sm text-gray-600 line-clamp-3 transform rotate-0.5"
           style={{
             fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
           }}>
          {description}
        </p>

        <div className="flex items-center justify-between">
          <span className={`px-2 py-1 rounded text-xs transform -rotate-3 ${getDifficultyColor()}`}
                style={{
                  fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                }}>
            {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
          </span>

          <div className="flex items-center text-xs text-gray-500 bg-yellow-100 px-2 py-1 rounded transform rotate-2"
               style={{
                 fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
               }}>
            <Clock className="w-3 h-3 mr-1" />
            {estimatedTime}
          </div>
        </div>

        {/* Progress Bar */}
        {showProgress && progress !== undefined && (
          <div className="space-y-1">
            <div className="w-full bg-gray-200 rounded-full h-2 transform -rotate-1">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 transform rotate-1 inline-block"
                  style={{
                    fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                  }}>
              {progress}% {t('completed')}
            </span>
          </div>
        )}

        {/* 开始学习按钮 */}
        <div className="mt-4">
          <Button
            className="w-full bg-blue-500 hover:bg-blue-600 transform rotate-1 hover:rotate-0 transition-all duration-300 shadow-md"
            onClick={handleClick}
            style={{
              fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
            }}
          >
            <Play className="w-4 h-4 mr-2" />
            {showProgress ? t('continueStudying') : t('startLearning')} 🚀
          </Button>
        </div>
      </div>

      {/* 图钉装饰 */}
      <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-400 rounded-full shadow-md transform rotate-45 opacity-80"></div>
    </div>
  );

  return courseContent;
}
