'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { CourseCard } from './course-card';

interface Course {
  id: string;
  title: string;
  description: string;
  coverImage: string;
  estimatedTime: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

interface CourseRecommendationGridProps {
  courses?: Course[];
  showProgress?: boolean;
  className?: string;
  onCourseClick?: (course: Course) => void; // 新增：点击课程时的回调
}

// 默认推荐课程数据
const defaultCourses: Course[] = [
  {
    id: 'reinforcement-learning',
    title: 'Reinforcement Learning & Q-Learning',
    description:
      'Learn Q-Learning algorithms and agent training to build AI systems that can learn autonomously in environments',
    coverImage: '/images/blog/post-1.png',
    estimatedTime: '6 hours',
    difficulty: 'intermediate',
  },
  {
    id: 'web-development',
    title: 'Frontend Web Development',
    description: 'Complete learning path from HTML, CSS basics to modern frontend frameworks like React and Vue',
    coverImage: '/images/blog/post-2.png',
    estimatedTime: '12 hours',
    difficulty: 'beginner',
  },
  {
    id: 'data-analysis',
    title: 'Python Data Analysis',
    description:
      'Master core data science libraries like pandas and numpy, learn data cleaning, analysis and visualization',
    coverImage: '/images/blog/post-3.png',
    estimatedTime: '8 hours',
    difficulty: 'intermediate',
  },
  {
    id: 'mobile-development',
    title: 'React Native Mobile Development',
    description:
      'Build cross-platform mobile apps with React Native, one codebase for both iOS and Android',
    coverImage: '/images/blog/post-4.png',
    estimatedTime: '10 hours',
    difficulty: 'intermediate',
  },
  {
    id: 'machine-learning',
    title: 'Machine Learning Fundamentals',
    description: 'From supervised to unsupervised learning, master core machine learning algorithms and practical applications',
    coverImage: '/images/blog/post-5.png',
    estimatedTime: '15 hours',
    difficulty: 'advanced',
  },
  {
    id: 'blockchain-development',
    title: 'Blockchain Technology & Smart Contracts',
    description: 'Learn Ethereum blockchain development and master Solidity smart contract programming',
    coverImage: '/images/blog/post-6.png',
    estimatedTime: '12 hours',
    difficulty: 'advanced',
  },
  {
    id: 'cloud-computing',
    title: 'AWS Cloud Computing',
    description: 'Master AWS cloud services, learn cloud architecture design and deployment best practices',
    coverImage: '/images/blog/post-7.png',
    estimatedTime: '14 hours',
    difficulty: 'intermediate',
  },
  {
    id: 'cybersecurity',
    title: 'Cybersecurity & Penetration Testing',
    description: 'Learn network security protection strategies and master common vulnerability detection and protection techniques',
    coverImage: '/images/blog/post-8.png',
    estimatedTime: '16 hours',
    difficulty: 'advanced',
  },
];

export function CourseRecommendationGrid({
  courses = defaultCourses,
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

  return (
    <div className={`${className} -mt-4`}>
      {/* 横向滚动卡片容器 */}
      <div className="relative overflow-hidden">
        <div className="flex animate-scroll-right space-x-4 py-2">
          {/* 第一组课程卡片 */}
          {courses.map((course) => (
            <div
              key={`first-${course.id}`}
              className="w-64 flex-shrink-0 group cursor-pointer transform hover:rotate-1 hover:scale-105 transition-all duration-300 relative"
              onClick={() => handleCourseClick(course)}
            >
              {/* 照片外框 - 白色边框模拟相片但不显示图片 */}
              <div className="bg-white p-4 rounded-lg shadow-lg transform rotate-2 group-hover:rotate-0 transition-all duration-300">
                {/* 手写标注区域 */}
                <div className="space-y-3">
                  {/* 手写标题 */}
                  <h3
                    className="font-bold text-base text-gray-800 transform -rotate-1"
                    style={{
                      fontFamily:
                        '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                    }}
                  >
                    {course.title}
                  </h3>

                  {/* 手写描述 */}
                  <p
                    className="text-sm text-gray-600 line-clamp-3 transform rotate-0.5"
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
                      className={`px-2 py-1 rounded text-xs transform -rotate-3 ${
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
                    <div
                      className="flex items-center text-xs text-gray-500 bg-yellow-100 px-2 py-1 rounded transform rotate-2"
                      style={{
                        fontFamily:
                          '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                      }}
                    >
                      {course.estimatedTime}
                    </div>
                  </div>

                  {/* 开始学习按钮 */}
                  <button
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg font-medium transition-colors text-sm transform rotate-1 hover:rotate-0 shadow-md"
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
              <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-400 rounded-full shadow-md transform rotate-45 opacity-80"></div>
            </div>
          ))}

          {/* 第二组课程卡片（用于无缝循环） */}
          {courses.map((course) => (
            <div
              key={`second-${course.id}`}
              className="w-64 flex-shrink-0 group cursor-pointer transform hover:rotate-1 hover:scale-105 transition-all duration-300 relative"
              onClick={() => handleCourseClick(course)}
            >
              {/* 照片外框 - 白色边框模拟相片但不显示图片 */}
              <div className="bg-white p-4 rounded-lg shadow-lg transform rotate-2 group-hover:rotate-0 transition-all duration-300">
                {/* 手写标注区域 */}
                <div className="space-y-3">
                  {/* 手写标题 */}
                  <h3
                    className="font-bold text-base text-gray-800 transform -rotate-1"
                    style={{
                      fontFamily:
                        '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                    }}
                  >
                    {course.title}
                  </h3>

                  {/* 手写描述 */}
                  <p
                    className="text-sm text-gray-600 line-clamp-3 transform rotate-0.5"
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
                      className={`px-2 py-1 rounded text-xs transform -rotate-3 ${
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
                    <div
                      className="flex items-center text-xs text-gray-500 bg-yellow-100 px-2 py-1 rounded transform rotate-2"
                      style={{
                        fontFamily:
                          '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                      }}
                    >
                      {course.estimatedTime}
                    </div>
                  </div>

                  {/* 开始学习按钮 */}
                  <button
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg font-medium transition-colors text-sm transform rotate-1 hover:rotate-0 shadow-md"
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
              <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-400 rounded-full shadow-md transform rotate-45 opacity-80"></div>
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
