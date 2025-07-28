'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LocaleLink } from '@/i18n/navigation';

// 生成随机评分
const generateRating = (courseId: string) => {
  const ratings = [4.2, 4.5, 4.7, 4.8, 4.9, 4.3, 4.6, 4.4, 4.1];
  return ratings[Math.abs(courseId.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % ratings.length];
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

export default function MyCoursesPage() {
  // 模拟用户的课程数据
  const userCourses = [
    {
      id: 'reinforcement-learning-001',
      title: 'Reinforcement Learning & Q-Learning',
      description: 'Learn Q-Learning algorithms and agent training to build AI systems that can learn autonomously in environments',
      estimatedTime: '6 hours',
      difficulty: 'intermediate' as const,
      progress: 65,
      status: 'learning',
      createdAt: new Date('2024-01-15')
    },
    {
      id: 'web-development-002',
      title: 'React Full-Stack Development',
      description: 'From React basics to full-stack development, including state management, routing, and backend API integration',
      estimatedTime: '12 hours',
      difficulty: 'intermediate' as const,
      progress: 30,
      status: 'learning',
      createdAt: new Date('2024-01-10')
    },
    {
      id: 'data-analysis-003',
      title: 'Advanced Python Data Analysis',
      description: 'Deep dive into pandas, numpy, matplotlib, master data visualization and statistical analysis',
      estimatedTime: '8 hours',
      difficulty: 'advanced' as const,
      progress: 90,
      status: 'learning',
      createdAt: new Date('2024-01-05')
    },
    {
      id: 'machine-learning-004',
      title: 'Machine Learning Fundamentals',
      description: 'From supervised learning to unsupervised learning, master core machine learning algorithms and practical applications',
      estimatedTime: '15 hours',
      difficulty: 'advanced' as const,
      progress: 45,
      status: 'learning',
      createdAt: new Date('2024-01-12')
    },
    {
      id: 'web-apis-005',
      title: 'RESTful API Development',
      description: 'Build robust REST APIs with Node.js, Express, and MongoDB, including authentication and testing',
      estimatedTime: '9 hours',
      difficulty: 'intermediate' as const,
      progress: 100,
      status: 'published',
      createdAt: new Date('2024-01-20')
    },
    {
      id: 'frontend-design-006',
      title: 'Modern UI/UX Design',
      description: 'Learn design principles, user experience best practices, and create beautiful, functional interfaces',
      estimatedTime: '7 hours',
      difficulty: 'beginner' as const,
      progress: 100,
      status: 'published',
      createdAt: new Date('2024-01-08')
    }
  ];

  const completedCourses = userCourses.filter(course => course.progress === 100 && course.status === 'learning');
  const inProgressCourses = userCourses.filter(course => course.progress > 0 && course.progress < 100);
  const publishedCourses = userCourses.filter(course => course.status === 'published');

  const CourseCard = ({ course, index }: { course: any, index: number }) => (
    <div
      className="w-64 flex-shrink-0 group cursor-pointer transform hover:rotate-1 hover:scale-105 transition-all duration-300 relative"
    >
      {/* 照片外框 - 白色边框模拟相片但不显示图片 */}
      <div className={`bg-white p-4 rounded-lg shadow-lg transform transition-all duration-300 ${
        index % 2 === 0 ? 'rotate-2' : '-rotate-1'
      } group-hover:rotate-0`}>
        {/* 进度条 */}
        {course.progress > 0 && course.status === 'learning' && (
          <div className="mb-3">
            <div className="w-full bg-gray-200 rounded-full h-2 transform -rotate-1">
              <div 
                className={`h-2 rounded-full ${
                  course.progress === 100 ? 'bg-green-400' : 'bg-blue-400'
                }`}
                style={{ width: `${course.progress}%` }}
              ></div>
            </div>
            <span className="text-xs text-gray-600 mt-1 inline-block transform rotate-1"
                  style={{ fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive' }}>
              {course.progress}% Complete
            </span>
          </div>
        )}
        
        {/* 发布状态标识 */}
        {course.status === 'published' && (
          <div className="mb-3">
            <span className="text-xs text-green-600 font-bold inline-block transform -rotate-1 bg-green-100 px-2 py-1 rounded"
                  style={{ fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive' }}>
              📚 Published Course
            </span>
          </div>
        )}
        
        {/* 手写标注区域 */}
        <div className="space-y-3">
          {/* 手写标题 */}
          <h3 className="font-bold text-base text-gray-800 transform -rotate-1"
              style={{
                fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
              }}>
            {course.title}
          </h3>
          
          {/* 手写描述 */}
          <p className="text-sm text-gray-600 line-clamp-3 transform rotate-0.5"
             style={{
               fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
             }}>
            {course.description}
          </p>
          
          {/* 评分 */}
          <StarRating rating={generateRating(course.id)} />
          
          {/* 标签和时间 - 像便签纸一样 */}
          <div className="flex items-center justify-between mt-3">
            <span className={`px-2 py-1 rounded text-xs transform -rotate-3 ${
              course.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
              course.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}
                  style={{
                    fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                  }}>
              {course.difficulty.charAt(0).toUpperCase() + course.difficulty.slice(1)}
            </span>
            <div className="flex items-center text-xs text-gray-500 bg-yellow-100 px-2 py-1 rounded transform rotate-2"
                 style={{
                   fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                 }}>
              {course.estimatedTime}
            </div>
          </div>
          
          {/* 按钮 */}
          <Link href={`/study/${course.id}`}>
            <button className="w-full bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg font-medium transition-colors text-sm transform rotate-1 hover:rotate-0 shadow-md"
                    style={{
                      fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                    }}>
              {course.status === 'published' ? 'Publish Course 🚀' :
               course.progress === 100 ? 'Publish Course 📚' : 
               'Continue Learning ⚡'}
            </button>
          </Link>
        </div>
      </div>
      
      {/* 图钉装饰 */}
      <div className={`absolute -top-2 -right-2 w-4 h-4 rounded-full shadow-md transform rotate-45 opacity-80 ${
        index % 3 === 0 ? 'bg-red-400' : index % 3 === 1 ? 'bg-blue-400' : 'bg-green-400'
      }`}></div>
    </div>
  );

  return (
    <div className="min-h-screen pb-0"
         style={{
           backgroundImage: `
             linear-gradient(to right, #f0f0f0 1px, transparent 1px),
             linear-gradient(to bottom, #f0f0f0 1px, transparent 1px)
           `,
           backgroundSize: '20px 20px'
         }}>
      <div className="container mx-auto px-4 py-8">
        {userCourses.length === 0 ? (
          /* 空状态 */
          <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
            <div className="text-center">
              <div className="bg-white/80 p-8 rounded-lg shadow-lg transform -rotate-1 border-2 border-dashed border-blue-300">
                <p className="text-lg text-gray-700 mb-4"
                   style={{
                     fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                   }}>
                  No courses yet! ✨
                </p>
                <p className="text-sm text-gray-500 mb-6"
                   style={{
                     fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                   }}>
                  Start your first learning course and explore infinite possibilities 💡
                </p>
                <LocaleLink href="/">
                  <div className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer flex items-center text-lg"
                       style={{
                         fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                       }}>
                    ← 返回首页
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
                <h2 className="text-2xl font-bold mb-6 text-blue-700 transform -rotate-1"
                    style={{
                      fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                    }}>
                  <span className="bg-blue-200 px-3 py-1 rounded-lg inline-block shadow-sm">
                    📚 In Progress ({inProgressCourses.length})
                  </span>
                </h2>
                <div className="overflow-x-auto">
                  <div className="flex space-x-6 pb-4">
                    {inProgressCourses.map((course, index) => (
                      <CourseCard key={course.id} course={course} index={index} />
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* 已完成的课程 */}
            {completedCourses.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold mb-6 text-green-700 transform rotate-1"
                    style={{
                      fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                    }}>
                  <span className="bg-green-200 px-3 py-1 rounded-lg inline-block shadow-sm">
                    ✅ Completed ({completedCourses.length})
                  </span>
                </h2>
                <div className="overflow-x-auto">
                  <div className="flex space-x-6 pb-4">
                    {completedCourses.map((course, index) => (
                      <CourseCard key={course.id} course={course} index={index} />
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* 发布的课程 */}
            {publishedCourses.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold mb-6 text-purple-700 transform -rotate-0.5"
                    style={{
                      fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                    }}>
                  <span className="bg-purple-200 px-3 py-1 rounded-lg inline-block shadow-sm">
                    🚀 Published ({publishedCourses.length})
                  </span>
                </h2>
                <div className="overflow-x-auto">
                  <div className="flex space-x-6 pb-4">
                    {publishedCourses.map((course, index) => (
                      <CourseCard key={course.id} course={course} index={index} />
                    ))}
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 