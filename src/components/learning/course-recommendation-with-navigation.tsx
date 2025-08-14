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
  ownerId: string;
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
  const [publicCourses, setPublicCourses] = useState<Course[] | null>(courses ?? null);

  useEffect(() => {
    if (courses && courses.length > 0) {
      // 当服务端已预加载，写入本地缓存
      try {
        localStorage.setItem('publicCoursesCache', JSON.stringify({ ts: Date.now(), data: courses }));
      } catch {}
      return;
    }

    // 客户端预取 + 本地缓存（5分钟 TTL）
    try {
      const cached = localStorage.getItem('publicCoursesCache');
      if (cached) {
        const parsed = JSON.parse(cached) as { ts: number; data: Course[] };
        const ttlMs = 5 * 60 * 1000;
        if (Array.isArray(parsed.data) && Date.now() - parsed.ts < ttlMs) {
          setPublicCourses(parsed.data);
          return;
        }
      }
    } catch {}

    fetch('/api/public-courses')
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => {
        const list = (data.courses || []) as Course[];
        setPublicCourses(list);
        try {
          localStorage.setItem('publicCoursesCache', JSON.stringify({ ts: Date.now(), data: list }));
        } catch {}
      })
      .catch(() => setPublicCourses([]));
  }, [courses]);

  const handleCourseClick = (course: Course) => {
    // 直接跳转到 slug 学习页：[title]-[ownerId]
    const raw = `${course.title}`
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    const slug = `${raw}-${course.ownerId}`;

    const base = (process.env.NEXT_PUBLIC_BASE_URL as string) || '';
    if (base) {
      window.location.href = `${base}/study/${slug}`;
    } else {
      router.push(`/study/${slug}`);
    }
  };

  return (
    <CourseRecommendationGrid
      courses={publicCourses || undefined}
      showProgress={showProgress}
      className={className}
      onCourseClick={handleCourseClick}
    />
  );
}
