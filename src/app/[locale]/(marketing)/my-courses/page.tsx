'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/hooks/use-current-user';
import { LocaleLink, useLocaleRouter } from '@/i18n/navigation';
import { Routes } from '@/routes';
import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

// 生成随机评分
const generateRating = (courseId: string) => {
  const ratings = [4.2, 4.5, 4.7, 4.8, 4.9, 4.3, 4.6, 4.4, 4.1];
  return ratings[
    Math.abs(courseId.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) %
      ratings.length
  ];
};

// 星星组件
const StarRating = ({ rating }: { rating: number }) => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 !== 0;

  return (
    <div className="flex items-center space-x-1">
      {[...Array(5)].map((_, i) => (
        <span key={i} className="text-yellow-400 text-xs">
          {i < fullStars ? '★' : i === fullStars && hasHalfStar ? '☆' : '☆'}
        </span>
      ))}
      <span className="text-xs text-slate-500 ml-1">{rating}</span>
    </div>
  );
};

// 从LearningPlan提取课程信息的辅助函数
const extractCourseInfo = (coursePlan: any) => {
  // 处理新格式（包含plan和tasks）和旧格式
  const planData = coursePlan?.plan || coursePlan;
  
  if (!planData || !Array.isArray(planData)) {
    return {
      title: 'Unknown Course',
      description: 'Course description not available',
      difficulty: 'beginner' as const,
      estimatedTime: 'Unknown',
    };
  }

  const plan = planData;
  const title = plan.length > 0 ? plan[0].title : 'Unknown Course';
  const totalTime = plan.reduce((acc: number, step: any) => {
    const time = Number.parseInt(step.estimatedTime || '0');
    return acc + time;
  }, 0);

  // 基于步骤复杂度判断难度
  const difficulties = plan.map((step: any) => step.difficulty).filter(Boolean);
  const hasAdvanced = difficulties.includes('advanced');
  const hasIntermediate = difficulties.includes('intermediate');

  let difficulty: 'beginner' | 'intermediate' | 'advanced';
  if (hasAdvanced) {
    difficulty = 'advanced';
  } else if (hasIntermediate) {
    difficulty = 'intermediate';
  } else {
    difficulty = 'beginner';
  }

  return {
    title: title || 'Unknown Course',
    // 优先展示第一个步骤的描述，若无则回退到原有的步数摘要
    description:
      (plan[0]?.description && String(plan[0].description).trim())
        ? String(plan[0].description)
        : (plan.length > 1 ? `${plan.length} step learning path` : 'Single step course'),
    difficulty,
    estimatedTime: totalTime > 0 ? `${totalTime} hours` : 'Unknown',
  };
};

export default function MyCoursesPage() {
  const currentUser = useCurrentUser();
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<any>(null);
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);
  const router = useLocaleRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  // 获取用户课程数据
  const fetchCourses = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
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
  };

  // 删除课程
  const handleDeleteCourse = async (courseId: string) => {
    try {
      setDeletingCourseId(courseId);
      const response = await fetch(`/api/user-courses/${courseId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // 从本地状态中移除课程
        setCourses((prev) => prev.filter((course) => course.id !== courseId));
        setDeleteDialogOpen(false);
        setCourseToDelete(null);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete course');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete course');
    } finally {
      setDeletingCourseId(null);
    }
  };

  // 打开删除确认对话框
  const openDeleteDialog = (course: any) => {
    setCourseToDelete(course);
    setDeleteDialogOpen(true);
  };

  // 点击课程卡片
  const handleCourseClick = (course: any) => {
    // 将课程数据存储到 sessionStorage
    const learningPlan = {
      plan: course.coursePlan.plan || course.coursePlan
    };
    
    // 如果有任务数据，也一并存储
    if (course.coursePlan.tasks) {
      sessionStorage.setItem('taskCache', JSON.stringify(course.coursePlan.tasks));
    }
    // 如果有便签数据，也一并存储
    if (course.coursePlan.notes) {
      sessionStorage.setItem('courseNotes', JSON.stringify(course.coursePlan.notes));
    }
    // 如果有彩笔标记数据，也一并存储
    if (course.coursePlan.marks) {
      sessionStorage.setItem('courseMarks', JSON.stringify(course.coursePlan.marks));
    }
    
    sessionStorage.setItem('learningPlan', JSON.stringify(learningPlan));
    sessionStorage.setItem('fromDatabase', 'true'); // 标记来源于数据库
    
    console.log('📖 加载数据库课程:', course);
    
    // 跳转到学习页面
    router.push('/study/custom');
  };

  useEffect(() => {
    if (currentUser && mounted) {
      fetchCourses();
    }
  }, [currentUser, mounted]);

  // 如果用户未登录，重定向到登录页面
  if (mounted && !currentUser && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg mb-4">Please log in to view your courses</p>
          <LocaleLink
            href={Routes.Login}
            className="text-blue-600 hover:text-blue-800 font-semibold"
          >
            Go to Login
          </LocaleLink>
        </div>
      </div>
    );
  }

  // 分类课程 - 使用any类型处理数据库返回的数据
  const inProgressCourses = courses.filter(
    (course: any) =>
      course.status === 'in-progress' &&
      (course.currentStep || 0) < (course.coursePlan?.plan?.length || course.coursePlan?.length || 1)
  );

  const completedCourses = courses.filter(
    (course: any) =>
      course.status === 'completed' ||
      (course.status === 'in-progress' &&
        (course.currentStep || 0) >= (course.coursePlan?.plan?.length || course.coursePlan?.length || 1))
  );

  // 注意：数据库中没有'published'状态，这里可能需要根据实际需求调整
  const publishedCourses: any[] = courses.filter((c: any) => c.coursePlan?.isPublic === true);

  const CourseCard = ({ course, index }: { course: any; index: number }) => {
    const courseInfo = extractCourseInfo(course.coursePlan);
    const planData = course.coursePlan?.plan || course.coursePlan;
    const progress = Array.isArray(planData)
      ? Math.round(
          ((course.currentStep || 0) / planData.length) * 100
        )
      : 0;
    const isPublic = course.coursePlan?.isPublic === true;
    const [editing, setEditing] = useState(false);
    const [titleDraft, setTitleDraft] = useState(courseInfo.title);
    const [descDraft, setDescDraft] = useState(courseInfo.description);

    return (
      <div className="w-64 flex-shrink-0 group cursor-pointer transform hover:rotate-1 hover:scale-105 transition-all duration-300 relative">
        <div
          className={`bg-white p-4 rounded-lg shadow-lg transform transition-all duration-300 ${
            index % 2 === 0 ? 'rotate-2' : '-rotate-1'
          } group-hover:rotate-0`}
        >
          {/* 删除按钮（若已发布：作为 Unpublish 使用）*/}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (isPublic) {
                // 已发布：点击删除按钮执行 Unpublish
                (async () => {
                  try {
                    const resp = await fetch(`/api/user-courses/${course.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ isPublic: false })
                    });
                    if (!resp.ok) throw new Error(await resp.text());
                    setCourses(prev => prev.map((c) => c.id === course.id ? { ...c, coursePlan: { ...c.coursePlan, isPublic: false } } : c));
                  } catch (err) {
                    console.error('Unpublish 失败', err);
                    alert('Unpublish 失败，请稍后再试');
                  }
                })();
              } else {
                openDeleteDialog(course);
              }
            }}
            className="absolute top-2 right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 transform hover:scale-110 z-10"
            disabled={deletingCourseId === course.id}
            title={isPublic ? 'Unpublish course' : 'Delete course'}
          >
            {deletingCourseId === course.id ? (
              <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-3 h-3" />
            )}
          </button>

          {/* 进度条 */}
          {progress > 0 && course.status === 'in-progress' && (
            <div className="mb-3">
              <div className="w-full bg-gray-200 rounded-full h-2 transform -rotate-1">
                <div
                  className={`h-2 rounded-full ${
                    progress === 100 ? 'bg-green-400' : 'bg-blue-400'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span
                className="text-xs text-gray-600 mt-1 inline-block transform rotate-1"
                style={{
                  fontFamily:
                    '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                }}
              >
                {progress}% Complete
              </span>
            </div>
          )}

          {/* 任务生成状态 */}
          {/* 移除任务生成状态显示
          {!course.tasksGenerated && (
            <div className="mb-3">
              <span
                className="text-xs text-orange-600 font-bold inline-block transform -rotate-1 bg-orange-100 px-2 py-1 rounded flex items-center gap-1"
                style={{
                  fontFamily:
                    '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                }}
              >
                <div className="w-3 h-3 border border-orange-600 border-t-transparent rounded-full animate-spin" />
                生成课程内容中...
              </span>
            </div>
          )}
          */}

          {/* 完成状态标识 */}
          {course.status === 'completed' && (
            <div className="mb-3">
              <span
                className="text-xs text-green-600 font-bold inline-block transform -rotate-1 bg-green-100 px-2 py-1 rounded"
                style={{
                  fontFamily:
                    '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                }}
              >
                ✅ Completed
              </span>
            </div>
          )}

          {/* 课程内容 */}
          <div className="space-y-3">
            {isPublic && editing ? (
              <input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm"
              />
            ) : (
              <h3
                className="font-bold text-base text-gray-800 transform -rotate-1"
                style={{
                  fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                }}
              >
                {titleDraft}
              </h3>
            )}

            {isPublic && editing ? (
              <textarea
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm"
                rows={3}
              />
            ) : (
              <p
                className="text-sm text-gray-600 line-clamp-3 transform rotate-0.5"
                style={{
                  fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                }}
              >
                {descDraft}
              </p>
            )}

            <StarRating rating={generateRating(course.id)} />

            <div className="flex items-center justify-between mt-3">
              <span
                className={`px-2 py-1 rounded text-xs transform -rotate-3 ${
                  courseInfo.difficulty === 'beginner'
                    ? 'bg-green-100 text-green-800'
                    : courseInfo.difficulty === 'intermediate'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                }`}
                style={{
                  fontFamily:
                    '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                }}
              >
                {courseInfo.difficulty.charAt(0).toUpperCase() +
                  courseInfo.difficulty.slice(1)}
              </span>
              <div
                className="flex items-center text-xs text-gray-500 bg-yellow-100 px-2 py-1 rounded transform rotate-2"
                style={{
                  fontFamily:
                    '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                }}
              >
                {courseInfo.estimatedTime}
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => { 
                e.stopPropagation(); 
                const isPublic = course.coursePlan?.isPublic === true;
                if (isPublic) {
                  // 构造公开课程 slug: [title]-[userId]
                  const title = extractCourseInfo(course.coursePlan).title || 'course';
                  const slug = `${title}`
                    .toString()
                    .trim()
                    .toLowerCase()
                    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, '')
                    .replace(/\s+/g, '-')
                    .replace(/-+/g, '-')
                    + `-${course.userId}`;
                  const base = (process.env.NEXT_PUBLIC_BASE_URL as string) || '';
                  // 继续沿用现有 sessionStorage 传递计划与缓存，学习页已支持载入
                  handleCourseClick(course); // 写入 sessionStorage
                  if (base) {
                    window.location.href = `${base}/study/${slug}`;
                  } else {
                    router.push(`/study/${slug}`);
                  }
                } else {
                  handleCourseClick(course);
                }
              }}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg font-medium transition-colors text-sm transform rotate-1 hover:rotate-0 shadow-md"
              style={{
                fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
              }}
            >
              {course.status === 'completed'
                ? 'Review Course 📚'
                : 'Continue Learning ⚡'}
            </button>

            {/* 发布按钮：进行中的课程可见；已发布不显示 Unpublish（由删除按钮承担）*/}
            {course.status === 'in-progress' && !isPublic && (
              <button
                type="button"
                onClick={async (e) => {
                  e.stopPropagation();
                  // Capture the button reference once to avoid SyntheticEvent pooling issues
                  const btn = e.currentTarget as HTMLButtonElement;
                  try {
                    btn.disabled = true;
                    const nextPublic = !(course.coursePlan?.isPublic === true);
                    const resp = await fetch(`/api/user-courses/${course.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ isPublic: nextPublic })
                    });
                    if (!resp.ok) throw new Error(await resp.text());
                    setCourses(prev => prev.map((c) => c.id === course.id ? { ...c, coursePlan: { ...c.coursePlan, isPublic: nextPublic } } : c));
                  } catch (err) {
                    console.error('发布失败', err);
                    alert('发布失败，请稍后再试');
                  } finally {
                    if (btn) btn.disabled = false;
                  }
                }}
                className="w-full mt-2 bg-purple-500 hover:bg-purple-600 text-white px-3 py-2 rounded-lg font-medium transition-colors text-sm transform -rotate-1 hover:rotate-0 shadow-md"
                style={{ fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive' }}
              >
                Publish 🔓
              </button>
            )}

            {/* 已发布的课程允许编辑标题/描述 */}
            {isPublic && (
              <div className="mt-2 flex gap-2">
                {!editing ? (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                    className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded-lg text-sm shadow"
                    style={{ fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive' }}
                  >
                    Edit ✏️
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          const resp = await fetch(`/api/user-courses/${course.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ title: titleDraft, description: descDraft })
                          });
                          if (!resp.ok) throw new Error(await resp.text());
                          setCourses(prev => prev.map(c => c.id === course.id ? { ...c, coursePlan: { ...c.coursePlan, plan: [{ ...(c.coursePlan?.plan?.[0] || {}), title: titleDraft, description: descDraft }, ...(c.coursePlan?.plan?.slice(1) || [])] } } : c));
                          setEditing(false);
                        } catch (err) {
                          console.error('保存失败', err);
                          alert('保存失败，请稍后再试');
                        }
                      }}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm shadow"
                      style={{ fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive' }}
                    >
                      Save ✅
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setEditing(false); setTitleDraft(courseInfo.title); setDescDraft(courseInfo.description); }}
                      className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-3 py-2 rounded-lg text-sm shadow"
                      style={{ fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive' }}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div
          className={`absolute -top-2 -right-2 w-4 h-4 rounded-full shadow-md transform rotate-45 opacity-80 ${
            index % 3 === 0
              ? 'bg-red-400'
              : index % 3 === 1
                ? 'bg-blue-400'
                : 'bg-green-400'
          }`}
        />
      </div>
    );
  };

  // 加载状态
  if (loading) {
    return (
      <div
        className="min-h-screen pb-0"
        style={{
          backgroundImage: `
               linear-gradient(to right, #f0f0f0 1px, transparent 1px),
               linear-gradient(to bottom, #f0f0f0 1px, transparent 1px)
             `,
          backgroundSize: '20px 20px',
        }}
      >
        <div className="container mx-auto px-4 py-8">
          <div className="space-y-12 pb-8">
            <section>
              <Skeleton className="h-8 w-48 mb-6" />
              <div className="flex space-x-6">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="w-64 h-80 flex-shrink-0" />
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-red-600 mb-4">
            Error loading courses: {error}
          </p>
          <button
            type="button"
            onClick={fetchCourses}
            className="text-blue-600 hover:text-blue-800 font-semibold"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-0"
      style={{
        backgroundImage: `
             linear-gradient(to right, #f0f0f0 1px, transparent 1px),
             linear-gradient(to bottom, #f0f0f0 1px, transparent 1px)
           `,
        backgroundSize: '20px 20px',
      }}
    >
      <div className="container mx-auto px-4 py-8">
        {courses.length === 0 ? (
          /* 空状态 */
          <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
            <div className="text-center">
              <div className="bg-white/80 p-8 rounded-lg shadow-lg transform -rotate-1 border-2 border-dashed border-blue-300">
                <p
                  className="text-lg text-gray-700 mb-4"
                  style={{
                    fontFamily:
                      '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                  }}
                >
                  No courses yet! ✨
                </p>
                <p
                  className="text-sm text-gray-500 mb-6"
                  style={{
                    fontFamily:
                      '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                  }}
                >
                  Start your first learning course and explore infinite
                  possibilities 💡
                </p>
                <LocaleLink href="/">
                  <div
                    className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer flex items-center text-lg"
                    style={{
                      fontFamily:
                        '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                    }}
                  >
                    ← Back to Home
                  </div>
                </LocaleLink>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-12 pb-8">
            {/* 进行中的课程 */}
            {inProgressCourses.length > 0 && (
              <section>
                <h2
                  className="text-2xl font-bold mb-6 text-blue-700 transform -rotate-1"
                  style={{
                    fontFamily:
                      '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                  }}
                >
                  <span className="bg-blue-200 px-3 py-1 rounded-lg inline-block shadow-sm">
                    📚 In Progress ({inProgressCourses.length})
                  </span>
                </h2>
                <div className="overflow-x-auto">
                  <div className="flex space-x-6 pb-4">
                    {inProgressCourses.map((course, index) => (
                      <CourseCard
                        key={course.id}
                        course={course}
                        index={index}
                      />
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* 已完成的课程 */}
            {completedCourses.length > 0 && (
              <section>
                <h2
                  className="text-2xl font-bold mb-6 text-green-700 transform rotate-1"
                  style={{
                    fontFamily:
                      '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                  }}
                >
                  <span className="bg-green-200 px-3 py-1 rounded-lg inline-block shadow-sm">
                    ✅ Completed ({completedCourses.length})
                  </span>
                </h2>
                <div className="overflow-x-auto">
                  <div className="flex space-x-6 pb-4">
                    {completedCourses.map((course, index) => (
                      <CourseCard
                        key={course.id}
                        course={course}
                        index={index}
                      />
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* 发布的课程（如果将来需要的话） */}
            {publishedCourses.length > 0 && (
              <section>
                <h2
                  className="text-2xl font-bold mb-6 text-purple-700 transform -rotate-0.5"
                  style={{
                    fontFamily:
                      '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                  }}
                >
                  <span className="bg-purple-200 px-3 py-1 rounded-lg inline-block shadow-sm">
                    🚀 Published ({publishedCourses.length})
                  </span>
                </h2>
                <div className="overflow-x-auto">
                  <div className="flex space-x-6 pb-4">
                    {publishedCourses.map((course, index) => (
                      <CourseCard
                        key={course.id}
                        course={course}
                        index={index}
                      />
                    ))}
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="transform -rotate-1">
          <AlertDialogHeader>
            <AlertDialogTitle
              className="text-lg font-bold text-gray-800"
              style={{
                fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
              }}
            >
              确认删除课程？ 🗑️
            </AlertDialogTitle>
            <AlertDialogDescription
              className="text-gray-600"
              style={{
                fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
              }}
            >
              您确定要删除课程 "
              {courseToDelete
                ? extractCourseInfo(courseToDelete.coursePlan).title
                : ''}
              " 吗？
              <br />
              此操作无法撤销，您的学习进度也将丢失。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              className="transform rotate-1"
              style={{
                fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
              }}
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                courseToDelete && handleDeleteCourse(courseToDelete.id)
              }
              className="bg-red-500 hover:bg-red-600 transform -rotate-1"
              style={{
                fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
              }}
              disabled={!!deletingCourseId}
            >
              {deletingCourseId ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
