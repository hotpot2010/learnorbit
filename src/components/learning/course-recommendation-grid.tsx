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
    title: '强化学习与Q-Learning',
    description:
      '学习Q-Learning算法和智能体训练，构建能够在环境中自主学习的AI系统',
    coverImage: '/images/blog/post-1.png',
    estimatedTime: '6小时',
    difficulty: 'intermediate',
  },
  {
    id: 'web-development',
    title: 'Web前端开发',
    description: '从HTML、CSS基础到React、Vue等现代前端框架的完整学习路径',
    coverImage: '/images/blog/post-2.png',
    estimatedTime: '12小时',
    difficulty: 'beginner',
  },
  {
    id: 'data-analysis',
    title: 'Python数据分析',
    description:
      '掌握pandas、numpy等数据科学核心库，学习数据清洗、分析和可视化',
    coverImage: '/images/blog/post-3.png',
    estimatedTime: '8小时',
    difficulty: 'intermediate',
  },
  {
    id: 'mobile-development',
    title: 'React Native移动开发',
    description:
      '使用React Native构建跨平台移动应用，一套代码同时支持iOS和Android',
    coverImage: '/images/blog/post-4.png',
    estimatedTime: '10小时',
    difficulty: 'intermediate',
  },
  {
    id: 'machine-learning',
    title: '机器学习基础',
    description: '从监督学习到无监督学习，掌握机器学习核心算法和实际应用',
    coverImage: '/images/blog/post-5.png',
    estimatedTime: '15小时',
    difficulty: 'advanced',
  },
  {
    id: 'blockchain-development',
    title: '区块链技术与智能合约',
    description: '学习以太坊区块链开发，掌握Solidity智能合约编程',
    coverImage: '/images/blog/post-6.png',
    estimatedTime: '12小时',
    difficulty: 'advanced',
  },
  {
    id: 'cloud-computing',
    title: 'AWS云计算',
    description: '掌握AWS云服务，学习云架构设计和部署最佳实践',
    coverImage: '/images/blog/post-7.png',
    estimatedTime: '14小时',
    difficulty: 'intermediate',
  },
  {
    id: 'cybersecurity',
    title: '网络安全与渗透测试',
    description: '学习网络安全防护策略，掌握常见漏洞检测和防护技术',
    coverImage: '/images/blog/post-8.png',
    estimatedTime: '16小时',
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
                    开始学习 🚀
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
                    开始学习 🚀
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
