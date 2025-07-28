'use client';

import { useState, useEffect } from 'react';
import { AIChatInterface } from './ai-chat-interface';
import { CourseRecommendationGrid } from './course-recommendation-grid';
import { LearningPlan, LearningStep } from '@/types/learning-plan';
import Link from 'next/link';

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

interface CustomLearningPlanProps {
  recommendedCourses: Array<{
    id: string;
    title: string;
    description: string;
    coverImage: string;
    estimatedTime: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
  }>;
}

export function CustomLearningPlan({ recommendedCourses }: CustomLearningPlanProps) {
  const [showLearningPlan, setShowLearningPlan] = useState(false);
  const [learningInput, setLearningInput] = useState<string>('');
  const [learningPlan, setLearningPlan] = useState<LearningPlan | null>(null);
  const [planUpdateStatus, setPlanUpdateStatus] = useState<'idle' | 'updating' | 'completed'>('idle');
  const [sessionId] = useState(() => {
    const id = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log('🆔 生成SessionId:', id);
    return id;
  });
  const [callbackUrl, setCallbackUrl] = useState<string>('');

  useEffect(() => {
    // 从sessionStorage读取首页的输入
    if (typeof window !== 'undefined') {
      const savedInput = sessionStorage.getItem('learningInput');
      
      if (savedInput) {
        setLearningInput(savedInput);
        console.log('课程定制页面读取到用户输入:', savedInput);
        setShowLearningPlan(true);
        setPlanUpdateStatus('updating'); // 首页输入也设置为更新状态
      }

      // 设置回调URL - 使用本机IP
      const getLocalIP = () => {
        // 优先使用环境变量配置的IP
        const envIP = process.env.NEXT_PUBLIC_LOCAL_IP;
        if (envIP) {
          return envIP;
        }
        
        // 尝试从当前URL获取IP
        const currentHost = window.location.hostname;
        if (currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
          return currentHost;
        }
        
        // 默认回退IP，请根据实际情况修改
        console.warn('未配置NEXT_PUBLIC_LOCAL_IP环境变量，使用默认IP地址');
        return '192.168.1.100';
      };
      
      const localIP = getLocalIP();
      const port = window.location.port || '3000';
      const protocol = window.location.protocol;
      const callback = `${protocol}//${localIP}:${port}/api/plan/update`;
      
      setCallbackUrl(callback);
      console.log('设置计划更新回调URL:', callback);
      console.log('外部API可以通过此URL回调更新学习计划');
    }
  }, []);

  // 监听计划更新
  useEffect(() => {
    if (!callbackUrl || !showLearningPlan) return;

    console.log('\n=== 🔗 建立计划更新监听 ===');
    console.log('SessionId:', sessionId);
    console.log('回调URL:', callbackUrl);
    console.log('监听URL:', `/api/plan/update?sessionId=${sessionId}`);
    
    const eventSource = new EventSource(`/api/plan/update?sessionId=${sessionId}`);
    
    eventSource.onopen = () => {
      console.log('✅ SSE连接已建立');
    };
    
    eventSource.onmessage = (event) => {
      try {
        console.log('\n📨 收到SSE消息:');
        console.log('原始数据:', event.data);
        
        const data = JSON.parse(event.data);
        console.log('解析后数据:', data);
        console.log('消息类型:', data.type);
        
        if (data.type === 'connected') {
          console.log('🔗 SSE连接确认');
        } else if (data.type === 'plan_update' && data.plan) {
          console.log('📚 收到学习计划更新:');
          console.log('计划步骤数:', data.plan.plan?.length || 0);
          
          if (data.plan.plan) {
            data.plan.plan.forEach((step: any, index: number) => {
              console.log(`前端-步骤 ${index + 1}:`, {
                step: step.step,
                title: step.title,
                status: step.status,
                videoCount: step.videos?.length || 0
              });
            });
          }
          
          setLearningPlan(data.plan);
          setPlanUpdateStatus('completed');
          console.log('✅ 学习计划已更新到前端状态');
          
          // 保存学习计划到sessionStorage，供学习页面使用
          sessionStorage.setItem('learningPlan', JSON.stringify(data.plan));
          console.log('💾 学习计划已保存到sessionStorage');
          
          // 3秒后恢复idle状态
          setTimeout(() => {
            setPlanUpdateStatus('idle');
          }, 3000);
        }
      } catch (error) {
        console.error('❌ 解析SSE消息失败:', error);
        console.error('原始消息:', event.data);
      }
    };

    eventSource.onerror = (error) => {
      console.error('❌ SSE连接错误:', error);
      console.log('连接状态:', eventSource.readyState);
      console.log('状态说明:', {
        0: 'CONNECTING',
        1: 'OPEN', 
        2: 'CLOSED'
      }[eventSource.readyState]);
    };

    return () => {
      console.log('🔌 关闭SSE连接');
      eventSource.close();
    };
  }, [sessionId, callbackUrl, showLearningPlan]);

  const handleChatMessage = () => {
    setShowLearningPlan(true);
    setPlanUpdateStatus('updating');
  };

  // 计算步骤时长
  const calculateTotalDuration = (videos: any[]) => {
    if (!videos || videos.length === 0) return '估算中...';
    // 简单估算：取第一个视频时长作为参考
    return videos[0]?.duration || '估算中...';
  };

  // 渲染学习步骤
  const renderLearningStep = (step: LearningStep, index: number) => {
    const leftMargins = ['ml-2', 'ml-6', 'ml-4', 'ml-8', 'ml-3', 'ml-5'];
    const marginClass = leftMargins[index % leftMargins.length];
    
    // 随机颜色配置
    const colors = [
      { bg: 'bg-blue-400', text: 'text-white', border: 'border-blue-400', textColor: 'text-blue-700' },
      { bg: 'bg-green-400', text: 'text-white', border: 'border-green-400', textColor: 'text-green-700' },
      { bg: 'bg-yellow-400', text: 'text-white', border: 'border-yellow-400', textColor: 'text-yellow-700' }
    ];
    const colorScheme = colors[index % colors.length];
    
    return (
      <div
        key={step.step}
        className={`py-3 pl-4 ${marginClass} transform hover:scale-105 transition-all duration-300`}
        style={{
          transform: index % 2 === 0 ? 'rotate(0.2deg)' : 'rotate(-0.2deg)'
        }}
      >
        <div className="flex items-center space-x-4">
          {/* 步骤序号 */}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transform ${
            colorScheme.bg
          } ${colorScheme.text} ${colorScheme.border} ${
            index % 3 === 0 ? 'rotate-12' : index % 3 === 1 ? '-rotate-12' : 'rotate-6'
          }`}>
            {step.step}
          </div>
          
          {/* 标题 */}
          <h3 className={`text-base font-bold ${colorScheme.textColor}`} 
              style={{
                fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
              }}>
            {step.title}
          </h3>
          
          {/* 视频封面 - 只显示第一个视频的封面 */}
          {step.videos && step.videos.length > 0 && step.videos[0].cover && (
            <div className="w-32 h-20 bg-gray-200 rounded border transform -rotate-1 flex items-center justify-center flex-shrink-0 overflow-hidden">
              <img 
                src={(() => {
                  const originalUrl = step.videos[0].cover;
                  const finalUrl = originalUrl.startsWith('//') ? `https:${originalUrl}` : originalUrl;
                  // 使用图片代理解决防盗链问题
                  return `https://images.weserv.nl/?url=${encodeURIComponent(finalUrl.replace('https://', ''))}&w=128&h=80&fit=cover`;
                })()}
                alt={step.videos[0].title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                onError={(e) => {
                  const target = e.currentTarget;
                  console.log('图片代理加载失败，使用备用方案');
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
                onLoad={() => {
                  console.log('图片加载成功');
                }}
              />
              <span className="text-base hidden w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100 text-blue-600 font-medium text-sm">
                📹 Video
              </span>
            </div>
          )}
          
          {/* Animation Type */}
          {step.animation_type && step.animation_type !== '无' && (
            <span className="px-2 py-1 rounded text-xs transform rotate-3 bg-purple-100 text-purple-800"
                  style={{
                    fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                  }}>
              Animation: {step.animation_type}
            </span>
          )}
          
          {/* Task Type */}
          <span className={`px-2 py-1 rounded text-xs transform rotate-1 ${
            step.type === 'quiz' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
          }`} style={{
            fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
          }}>
            {step.type === 'quiz' ? '📝 Quiz' : '💻 Coding'}
          </span>
          
          {/* Difficulty Level */}
          <span className={`px-2 py-1 rounded text-xs transform -rotate-2 ${
            step.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
            step.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`} style={{
            fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
          }}>
            {step.difficulty === 'beginner' ? '🌱 Beginner' :
             step.difficulty === 'intermediate' ? '🌿 Intermediate' : '🌳 Advanced'}
          </span>
          
          {/* Duration Time */}
          {step.videos && step.videos.length > 0 && step.videos[0].duration && (
            <span className="px-2 py-1 rounded text-xs transform rotate-0.5 bg-gray-100 text-gray-700"
                  style={{
                    fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                  }}>
              ⏱️ {step.videos[0].duration}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex"
         style={{
           backgroundImage: `
             linear-gradient(to right, #f0f0f0 1px, transparent 1px),
             linear-gradient(to bottom, #f0f0f0 1px, transparent 1px)
           `,
           backgroundSize: '20px 20px'
         }}>
      {/* AI聊天区域 */}
      <div className="w-1/4 p-4">
        <div className="h-full rounded-lg border border-gray-200 shadow-sm bg-white/80 backdrop-blur-sm p-4">
          <AIChatInterface 
            className="h-full" 
            onMessageSent={handleChatMessage}
            userInputFromHome={learningInput}
            initialMessage="我来帮你定制课程"
            callbackUrl={callbackUrl}
            sessionId={sessionId}
          />
        </div>
      </div>

      {/* 中间学习计划区域 */}
      <div className="w-7/12 p-4">
        <div className="h-full flex flex-col relative">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-center text-blue-700 transform rotate-1"
                style={{
                  fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                }}>
              <span className={`px-3 py-1 rounded-lg inline-block shadow-sm transition-all duration-500 ${
                planUpdateStatus === 'updating' ? 'bg-orange-200 animate-pulse' :
                planUpdateStatus === 'completed' ? 'bg-green-200' :
                'bg-yellow-200'
              }`}>
                {planUpdateStatus === 'updating' ? (
                  <>
                    <span className="inline-block animate-spin mr-2">🔄</span>
                    Plan Updating...
                  </>
                ) : planUpdateStatus === 'completed' ? (
                  <>
                    <span className="mr-2">✅</span>
                    Plan Updated!
                  </>
                ) : (
                  <>
                    Personalized Learning Plan 📚
                  </>
                )}
              </span>
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {!learningPlan ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="bg-white/80 p-8 rounded-lg shadow-lg transform -rotate-1 border-2 border-dashed border-blue-300">
                    {showLearningPlan ? (
                      <>
                        <div className="text-4xl mb-4">🤖</div>
                        <p className="text-lg text-gray-700 mb-4"
                           style={{
                             fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                           }}>
                          AI is generating your personalized learning plan...
                        </p>
                        <div className="flex justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-lg text-gray-700 mb-4"
                           style={{
                             fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                           }}>
                          Your personalized learning plan will appear here ✨
                        </p>
                        <p className="text-sm text-gray-500"
                           style={{
                             fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                           }}>
                          Start chatting with AI assistant to generate your custom learning path 💡
                        </p>
                        
                        {/* 装饰性元素 */}
                        <div className="flex justify-center space-x-4 mt-6">
                          <div className="text-2xl transform -rotate-12">📝</div>
                          <div className="text-2xl transform rotate-12">🎯</div>
                          <div className="text-2xl transform -rotate-12">🚀</div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pb-20">
                {learningPlan.plan.map((step, index) => renderLearningStep(step, index))}
              </div>
            )}
          </div>
          
          {/* 固定在底部的开始学习按钮 */}
          {learningPlan && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
              <Link href="/en/study/custom">
                <button className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium text-base transform rotate-1 hover:rotate-0 transition-all duration-300 shadow-lg"
                        style={{
                          fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                        }}>
                  Start Learning Journey! 🚀
                </button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* 推荐课程区域 */}
      <div className="w-1/6 p-4">
        <div className="h-full flex flex-col">
          <div className="flex-1 overflow-y-auto space-y-4">
            {recommendedCourses.map((course, index) => (
              <div 
                key={course.id} 
                className={`group relative bg-white p-3 rounded-lg shadow-md transform transition-all duration-300 hover:scale-105 border-2 border-gray-200 ${
                  index % 2 === 0 ? 'rotate-1 hover:rotate-0' : '-rotate-1 hover:rotate-0'
                }`}
              >
                <div className="space-y-2">
                  <h3 className="font-bold text-sm text-gray-800"
                      style={{
                        fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                      }}>
                    {course.title}
                  </h3>
                  <p className="text-xs text-gray-600 line-clamp-2"
                     style={{
                       fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                     }}>
                    {course.description}
                  </p>
                  
                  <StarRating rating={generateRating(course.id)} />
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="bg-yellow-100 px-2 py-1 rounded transform -rotate-3 text-blue-600 font-medium"
                          style={{
                            fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                          }}>
                      {course.estimatedTime}
                    </span>
                    <span className="capitalize px-2 py-1 bg-blue-100 rounded transform rotate-3 text-blue-700"
                          style={{
                            fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                          }}>
                      {course.difficulty}
                    </span>
                  </div>
                  
                  <Link href={`/study/${course.id}`}>
                    <button className="w-full bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg font-medium transition-colors text-xs transform hover:rotate-1 shadow-md"
                            style={{
                              fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                            }}>
                      Start Learning 🚀
                    </button>
                  </Link>
                </div>
                
                {/* 图钉装饰 */}
                <div className={`absolute -top-2 -right-2 w-3 h-3 rounded-full shadow-md transform rotate-45 opacity-80 ${
                  index % 3 === 0 ? 'bg-red-400' : index % 3 === 1 ? 'bg-blue-400' : 'bg-green-400'
                }`}></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 