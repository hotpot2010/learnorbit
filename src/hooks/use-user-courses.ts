import { authClient } from '@/lib/auth-client';
import type {
  CreateCourseRequest,
  SubmitAnswersRequest,
  UpdateProgressRequest,
  UserCourse,
} from '@/types/user-course';
import { useCallback, useEffect, useState } from 'react';

interface UseUserCoursesReturn {
  courses: UserCourse[];
  currentCourse: UserCourse | null;
  loading: boolean;
  error: string | null;
  refreshCourses: () => Promise<void>;
  createCourse: (courseData: CreateCourseRequest) => Promise<UserCourse>;
  updateProgress: (
    courseId: string,
    progressData: UpdateProgressRequest
  ) => Promise<void>;
  submitAnswers: (
    courseId: string,
    submissionData: SubmitAnswersRequest
  ) => Promise<any>;
  deleteCourse: (courseId: string) => Promise<void>;
  getCurrentCourse: (courseId: string) => Promise<UserCourse | null>;
}

export function useUserCourses(): UseUserCoursesReturn {
  const [courses, setCourses] = useState<UserCourse[]>([]);
  const [currentCourse, setCurrentCourse] = useState<UserCourse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 获取所有课程
  const refreshCourses = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/user-courses');
      if (!response.ok) {
        throw new Error('Failed to fetch courses');
      }

      const data = await response.json();
      setCourses(data.courses || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // 获取特定课程详情
  const getCurrentCourse = useCallback(
    async (courseId: string): Promise<UserCourse | null> => {
      try {
        const response = await fetch(`/api/user-courses/${courseId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch course');
        }

        const data = await response.json();
        const course = data.course;
        setCurrentCourse(course);
        return course;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        return null;
      }
    },
    []
  );

  // 创建新课程
  const createCourse = useCallback(
    async (courseData: CreateCourseRequest): Promise<UserCourse> => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/user-courses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(courseData),
        });

        if (!response.ok) {
          throw new Error('Failed to create course');
        }

        const data = await response.json();
        const newCourse = data.course;

        // 更新本地状态
        setCourses((prev) => [newCourse, ...prev]);

        return newCourse;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // 更新步骤进度
  const updateProgress = useCallback(
    async (
      courseId: string,
      progressData: UpdateProgressRequest
    ): Promise<void> => {
      try {
        const response = await fetch(`/api/user-courses/${courseId}/progress`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(progressData),
        });

        if (!response.ok) {
          throw new Error('Failed to update progress');
        }

        // 刷新课程数据
        await refreshCourses();
        if (currentCourse?.courseId === courseId) {
          await getCurrentCourse(courseId);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        throw err;
      }
    },
    [refreshCourses, getCurrentCourse, currentCourse?.courseId]
  );

  // 提交答题结果
  const submitAnswers = useCallback(
    async (
      courseId: string,
      submissionData: SubmitAnswersRequest
    ): Promise<any> => {
      try {
        const response = await fetch(
          `/api/user-courses/${courseId}/submit-answers`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(submissionData),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to submit answers');
        }

        const data = await response.json();

        // 刷新课程数据
        await refreshCourses();
        if (currentCourse?.courseId === courseId) {
          await getCurrentCourse(courseId);
        }

        return data;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        throw err;
      }
    },
    [refreshCourses, getCurrentCourse, currentCourse?.courseId]
  );

  // 删除课程
  const deleteCourse = useCallback(
    async (courseId: string): Promise<void> => {
      try {
        const response = await fetch(`/api/user-courses/${courseId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to delete course');
        }

        // 更新本地状态
        setCourses((prev) =>
          prev.filter((course) => course.courseId !== courseId)
        );
        if (currentCourse?.courseId === courseId) {
          setCurrentCourse(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        throw err;
      }
    },
    [currentCourse?.courseId]
  );

  // 初始化时获取课程
  useEffect(() => {
    const session = authClient.useSession();
    if (session?.data?.user) {
      refreshCourses();
    }
  }, [refreshCourses]);

  return {
    courses,
    currentCourse,
    loading,
    error,
    refreshCourses,
    createCourse,
    updateProgress,
    submitAnswers,
    deleteCourse,
    getCurrentCourse,
  };
}

// 用于学习统计的Hook
export function useUserLearningStats() {
  const [stats, setStats] = useState({
    totalCourses: 0,
    completedCourses: 0,
    inProgressCourses: 0,
    totalLearningTime: 0,
    averageProgress: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/user-courses/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }

      const data = await response.json();
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const session = authClient.useSession();
    if (session?.data?.user) {
      refreshStats();
    }
  }, [refreshStats]);

  return {
    stats,
    loading,
    error,
    refreshStats,
  };
}
