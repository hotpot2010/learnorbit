'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Play, BookOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';

interface CourseCardProps {
  id: string;
  title: string;
  description: string;
  coverImage: string;
  estimatedTime?: string;
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

  const difficultyColors = {
    beginner: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    advanced: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  const courseContent = (
    <div className="group cursor-pointer transform hover:rotate-1 hover:scale-105 transition-all duration-300 relative">
      {/* 照片外框 - 白色边框模拟相片 */}
      <div className="bg-white p-3 rounded-lg shadow-lg transform rotate-2 group-hover:rotate-0 transition-all duration-300">
        {/* 图片区域 */}
        <div className="relative overflow-hidden rounded-md">
          <Image
            src={coverImage}
            alt={title}
            width={400}
            height={200}
            className="w-full h-48 object-cover"
          />
          {showProgress && progress !== undefined && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-white text-sm mt-1 block">{progress}% {t('completed')}</span>
            </div>
          )}
        </div>
        
        {/* 照片下方的手写标注区域 */}
        <div className="mt-3 space-y-2">
          {/* 手写标题 */}
          <h3 className="font-bold text-lg text-gray-800 transform -rotate-1"
              style={{
                fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
              }}>
            {title}
          </h3>
          
          {/* 手写描述 */}
          <p className="text-sm text-gray-600 line-clamp-2 transform rotate-0.5"
             style={{
               fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
             }}>
            {description}
          </p>
          
          {/* 标签和时间 - 像便签纸一样 */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center space-x-2">
              <Badge className={`${difficultyColors[difficulty]} transform -rotate-3 text-xs`}
                     style={{
                       fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                     }}>
                {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
              </Badge>
            </div>
            {estimatedTime && (
              <div className="flex items-center text-xs text-gray-500 bg-yellow-100 px-2 py-1 rounded transform rotate-2"
                   style={{
                     fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                   }}>
                <Clock className="w-3 h-3 mr-1" />
                {estimatedTime}
              </div>
            )}
          </div>
          
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
      </div>
      
      {/* 图钉装饰 */}
      <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-400 rounded-full shadow-md transform rotate-45 opacity-80"></div>
    </div>
  );

  if (onClick) {
    return courseContent;
  }

  return (
    <Link href={`/study/${id}`}>
      {courseContent}
    </Link>
  );
} 