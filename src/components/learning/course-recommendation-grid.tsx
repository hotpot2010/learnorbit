'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { CourseCard } from './course-card';
import { StarRating } from '@/components/ui/star-rating';

interface Course {
  id: string;
  title: string;
  description: string;
  coverImage: string;
  rating: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

interface CourseRecommendationGridProps {
  courses?: Course[];
  showProgress?: boolean;
  className?: string;
  onCourseClick?: (course: Course) => void; // 新增：点击课程时的回调
}

export function CourseRecommendationGrid({
  courses = [],
  showProgress = false,
  className = '',
  onCourseClick,
}: CourseRecommendationGridProps) {
  const t = useTranslations('LearningPlatform');
  const router = useRouter();

  const handleCourseClick = (course: Course) => {
    if (onCourseClick) {
      onCourseClick(course);
    } else {
      router.push(`/learning/course/${course.id}`);
    }
  };

  // 没有已发布课程时不展示卡片
  if (!courses || courses.length === 0) {
    return null;
  }

  return (
    <div className={`${className} -mt-4`}>
      {/* 添加滚动动画样式 */}
      <style jsx>{`
        @keyframes scroll-right {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-scroll-right {
          animation: scroll-right 60s linear infinite;
        }
        .animate-scroll-right:hover {
          animation-play-state: paused;
        }
      `}</style>
      
      {/* 横向滚动卡片容器 */}
      <div className="relative overflow-hidden">
        <div className="flex animate-scroll-right space-x-4 py-2">
          {/* 第一组课程卡片 */}
          {courses.map((course) => (
            <div
              key={`first-${course.id}`}
              className="w-64 flex-shrink-0 group cursor-pointer transform hover:scale-105 transition-all duration-300 relative"
              onClick={() => handleCourseClick(course)}
            >
              {/* 照片外框 - 白色边框模拟相片但不显示图片 */}
              <div className="bg-white p-4 rounded-lg shadow-lg transition-all duration-300">
                {/* 手写标注区域 */}
                <div className="space-y-3">
                  {/* 手写标题 */}
                  <h3
                    className="font-bold text-base text-gray-800"
                    style={{
                      fontFamily:
                        '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                    }}
                  >
                    {course.title}
                  </h3>

                  {/* 手写描述 */}
                  <p
                    className="text-sm text-gray-600 line-clamp-3"
                    style={{
                      fontFamily:
                        '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                    }}
                  >
                    {course.description}
                  </p>

                  {/* 标签和时间 - 像便签纸一样 */}
                  <div className="flex items-center justify-between mt-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        course.difficulty === 'beginner'
                          ? 'bg-green-100 text-green-800'
                          : course.difficulty === 'intermediate'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                      }`}
                      style={{
                        fontFamily:
                          '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                      }}
                    >
                      {course.difficulty.charAt(0).toUpperCase() +
                        course.difficulty.slice(1)}
                    </span>
                    <div className="flex items-center bg-yellow-100 px-2 py-1 rounded">
                      <StarRating rating={course.rating} size="sm" />
                      <span className="ml-1 text-xs text-gray-600"
                            style={{
                              fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                            }}>
                        {course.rating}/5
                      </span>
                    </div>
                  </div>

                  {/* 开始学习按钮 */}
                  <button
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg font-medium transition-colors text-sm shadow-md"
                    style={{
                      fontFamily:
                        '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                    }}
                  >
                    Start Learning 🚀
                  </button>
                </div>
              </div>

              {/* 图钉装饰 */}
              <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-400 rounded-full shadow-md opacity-80"></div>
            </div>
          ))}

          {/* 第二组课程卡片（用于无缝循环） */}
          {courses.map((course) => (
            <div
              key={`second-${course.id}`}
              className="w-64 flex-shrink-0 group cursor-pointer transform hover:scale-105 transition-all duration-300 relative"
              onClick={() => handleCourseClick(course)}
            >
              {/* 照片外框 - 白色边框模拟相片但不显示图片 */}
              <div className="bg-white p-4 rounded-lg shadow-lg transition-all duration-300">
                {/* 手写标注区域 */}
                <div className="space-y-3">
                  {/* 手写标题 */}
                  <h3
                    className="font-bold text-base text-gray-800"
                    style={{
                      fontFamily:
                        '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                    }}
                  >
                    {course.title}
                  </h3>

                  {/* 手写描述 */}
                  <p
                    className="text-sm text-gray-600 line-clamp-3"
                    style={{
                      fontFamily:
                        '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                    }}
                  >
                    {course.description}
                  </p>

                  {/* 标签和时间 - 像便签纸一样 */}
                  <div className="flex items-center justify-between mt-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        course.difficulty === 'beginner'
                          ? 'bg-green-100 text-green-800'
                          : course.difficulty === 'intermediate'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                      }`}
                      style={{
                        fontFamily:
                          '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                      }}
                    >
                      {course.difficulty.charAt(0).toUpperCase() +
                        course.difficulty.slice(1)}
                    </span>
                    <div className="flex items-center bg-yellow-100 px-2 py-1 rounded">
                      <StarRating rating={course.rating} size="sm" />
                      <span className="ml-1 text-xs text-gray-600"
                            style={{
                              fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                            }}>
                        {course.rating}/5
                      </span>
                    </div>
                  </div>

                  {/* 开始学习按钮 */}
                  <button
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg font-medium transition-colors text-sm shadow-md"
                    style={{
                      fontFamily:
                        '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                    }}
                  >
                    Start Learning 🚀
                  </button>
                </div>
              </div>

              {/* 图钉装饰 */}
              <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-400 rounded-full shadow-md opacity-80"></div>
            </div>
          ))}
        </div>

        {/* 左右渐变遮罩 */}
        <div className="absolute top-0 left-0 w-8 h-full bg-gradient-to-r from-white/50 to-transparent pointer-events-none z-10" />
        <div className="absolute top-0 right-0 w-8 h-full bg-gradient-to-l from-white/50 to-transparent pointer-events-none z-10" />
      </div>
    </div>
  );
}
