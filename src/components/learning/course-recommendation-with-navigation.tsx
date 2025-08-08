'use client';

import { CourseRecommendationGrid } from './course-recommendation-grid';
import { useLocaleRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

interface Course {
  id: string;
  title: string;
  description: string;
  coverImage: string;
  estimatedTime: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

interface CourseRecommendationWithNavigationProps {
  courses?: Course[];
  showProgress?: boolean;
  className?: string;
}

export function CourseRecommendationWithNavigation({
  courses,
  showProgress,
  className,
}: CourseRecommendationWithNavigationProps) {
  const router = useLocaleRouter();
  const t = useTranslations();

  const handleCourseClick = (course: Course) => {
    // 将课程信息保存到sessionStorage，与首页输入框行为保持一致
    if (typeof window !== 'undefined') {
      const message = `I want to learn ${course.title}`;
      sessionStorage.setItem('learningInput', message); // 使用 'learningInput' 作为 key
      sessionStorage.removeItem('aiResponse'); // 清除旧的AI响应
    }

    // 导航到课程定制页面
    router.push('/custom');
  };

  return (
    <CourseRecommendationGrid
      courses={courses}
      showProgress={showProgress}
      className={className}
      onCourseClick={handleCourseClick}
    />
  );
}
