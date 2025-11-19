'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StarRating } from '@/components/ui/star-rating';
import { useCurrentUser } from '@/hooks/use-current-user';
import { LocaleLink } from '@/i18n/navigation';
import { Routes } from '@/routes';
import { Search, BookOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, useMemo } from 'react';



// 生成课程 slug
const generateSlug = (title: string, ownerId: string) => {
  const cleanTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s-]/g, '') // 保留中文、英文、数字、空格、连字符
    .replace(/\s+/g, '-') // 空格替换为连字符
    .replace(/-+/g, '-') // 多个连字符合并为一个
    .trim();
  return `${cleanTitle}-${ownerId}`;
};

interface PublicCourse {
  id: string;
  title: string;
  description: string;
  coverImage: string;
  rating: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  ownerId: string;
  createdAt: string;
}

export default function CourseMarketplacePage() {
  const t = useTranslations('LearningPlatform.courseMarketplace');
  const tCommon = useTranslations('Common');
  const currentUser = useCurrentUser();
  const [courses, setCourses] = useState<PublicCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 获取公共课程列表
  useEffect(() => {
    const fetchPublicCourses = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/public-courses');
        if (!response.ok) {
          throw new Error('Failed to fetch public courses');
        }
        const data = await response.json();
        setCourses(data.courses || []);
              } catch (err) {
          console.error('Error fetching public courses:', err);
          setError(tCommon('loading'));
        } finally {
        setLoading(false);
      }
    };

    fetchPublicCourses();
  }, []);

  // 搜索过滤
  const filteredCourses = useMemo(() => {
    if (!searchQuery.trim()) return courses;
    
    const query = searchQuery.toLowerCase();
    return courses.filter(course => 
      course.title.toLowerCase().includes(query) ||
      course.description.toLowerCase().includes(query)
    );
  }, [courses, searchQuery]);

  if (!mounted) {
    return <div>{tCommon('loading')}</div>;
  }

  return (
    <div className="min-h-screen"
         style={{
           backgroundImage: `
             linear-gradient(to right, #f0f0f0 1px, transparent 1px),
             linear-gradient(to bottom, #f0f0f0 1px, transparent 1px)
           `,
           backgroundSize: '20px 20px'
         }}>
      <div className="container mx-auto px-4 py-8">
        {/* 页面标题 */}
        <div className="text-center mb-12">
          <h1 
            className="text-4xl font-bold text-gray-800 mb-4"
            style={{
              fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
            }}
          >
            📚 {t('title')}
          </h1>
          <p 
            className="text-lg text-gray-600"
            style={{
              fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
            }}
          >
            {t('subtitle')}
          </p>
        </div>

        {/* 搜索栏 */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="relative transform hover:scale-105 transition-transform duration-300">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 py-3 text-lg border-2 rounded-xl shadow-lg transition-all duration-300"
              style={{
                fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
              }}
            />
          </div>
        </div>

        {/* 课程统计 */}
        {!loading && filteredCourses.length > 0 && (
          <div className="text-center mb-8">
            <p 
              className="text-gray-600"
              style={{
                fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
              }}
            >
              {t('foundCourses', { count: filteredCourses.length })}
            </p>
          </div>
        )}

        {/* 错误状态 */}
        {error && (
          <div className="text-center mb-8">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <p className="text-red-600 font-medium">{error}</p>
              <Button
                onClick={() => window.location.reload()}
                className="mt-4"
                variant="outline"
              >
                {t('tryAgain')}
              </Button>
            </div>
          </div>
        )}

        {/* 加载状态 */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, index) => (
              <div key={index} className="w-full">
                <Skeleton className="w-full h-64 rounded-lg" />
              </div>
            ))}
          </div>
        )}

        {/* 课程列表 */}
        {!loading && filteredCourses.length > 0 && (
          <div className="px-4">
            {/* 自动换行网格布局 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
              {filteredCourses.map((course, index) => (
                <CourseCard key={course.id} course={course} index={index} />
              ))}
            </div>
          </div>
        )}

        {/* 空状态 */}
        {!loading && filteredCourses.length === 0 && !error && (
          <div className="text-center py-16">
            <div>
              <BookOpen className="w-24 h-24 text-gray-300 mx-auto mb-4" />
              <h3 
                className="text-xl font-bold text-gray-600 mb-2"
                style={{
                  fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                }}
              >
                {searchQuery ? t('noSearchResults') : t('noCourses')}
              </h3>
              <p 
                className="text-gray-500"
                style={{
                  fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                }}
              >
                {searchQuery 
                  ? t('noSearchResultsSubtitle')
                  : t('noCoursesSubtitle')
                }
              </p>
              {searchQuery && (
                <Button
                  onClick={() => setSearchQuery('')}
                  className="mt-4"
                  variant="outline"
                >
                  {t('clearSearch')}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* 底部提示 */}
        {!loading && !currentUser && filteredCourses.length > 0 && (
          <div className="mt-16 text-center">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <p 
                className="text-blue-800 font-medium mb-4"
                style={{
                  fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                }}
              >
                {t('signInPrompt')}
              </p>
              <LocaleLink
                href={Routes.Login}
                className="text-blue-600 hover:text-blue-800 font-semibold"
              >
                {t('signInButton')}
              </LocaleLink>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 课程卡片组件 - 与首页样式保持一致
const CourseCard = ({ course, index }: { course: PublicCourse; index: number }) => {
  const t = useTranslations('LearningPlatform.courseMarketplace');
  const slug = generateSlug(course.title, course.ownerId);

  return (
    <LocaleLink href={`/study/${slug}`}>
      <div className="w-full group cursor-pointer transform hover:scale-105 transition-all duration-300 relative">
        {/* 照片外框 - 白色边框模拟相片但不显示图片 */}
        <div className="bg-white p-4 rounded-lg shadow-lg transition-all duration-300">
          {/* 手写标注区域 */}
          <div className="space-y-3">
            {/* 手写标题 */}
            <h3
              className="font-bold text-base text-gray-800"
              style={{
                fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
              }}
            >
              {course.title}
            </h3>

            {/* 手写描述 */}
            <p
              className="text-sm text-gray-600 line-clamp-3"
              style={{
                fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
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
                  fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                }}
              >
                {t(`difficulty.${course.difficulty}`)}
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

            {/* 创建者信息 */}
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>
                {t('labels.public')}
              </span>
              <span>
                {new Date(course.createdAt).toLocaleDateString()}
              </span>
            </div>

            {/* 开始学习按钮 */}
            <button
              className="w-full bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg font-medium transition-colors text-sm shadow-md"
              style={{
                fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
              }}
            >
              Start Learning 🚀
            </button>
          </div>
        </div>

        {/* 图钉装饰 */}
        <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-400 rounded-full shadow-md transform rotate-45 opacity-80"></div>
      </div>
    </LocaleLink>
  );
};
