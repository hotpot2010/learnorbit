'use client';

import { CourseRecommendationGrid } from './course-recommendation-grid';
import { useRouter } from 'next/navigation';

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
  className
}: CourseRecommendationWithNavigationProps) {
  const router = useRouter();

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
      courses={courses}
      showProgress={showProgress}
      className={className}
      onCourseClick={handleCourseClick}
    />
  );
} 