'use client';

import { useRouter } from 'next/navigation';
import { CourseRecommendationGrid } from './course-recommendation-grid';
import { useLocaleRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

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
  const [publicCourses, setPublicCourses] = useState<Course[] | null>(null);

  useEffect(() => {
    if (!courses) {
      fetch('/api/public-courses')
        .then(r => r.ok ? r.json() : Promise.reject(r))
        .then(data => setPublicCourses(data.courses || []))
        .catch(() => setPublicCourses([]));
    }
  }, [courses]);

  const handleCourseClick = (course: Course) => {
    // 将课程信息保存到sessionStorage，与首页输入框行为保持一致
    if (typeof window !== 'undefined') {
      const message = `我要学习${course.title}`;
      sessionStorage.setItem('learningInput', message); // 使用 'learningInput' 作为 key
      sessionStorage.removeItem('aiResponse'); // 清除旧的AI响应
    }

    // 导航到课程定制页面，并指定/en/前缀
    router.push('/en/custom');
  };

  return (
    <CourseRecommendationGrid
      courses={courses || publicCourses || undefined}
      showProgress={showProgress}
      className={className}
      onCourseClick={handleCourseClick}
    />
  );
}