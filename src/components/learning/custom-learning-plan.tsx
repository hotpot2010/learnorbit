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
  onSendMessage?: (message: string) => void; // 新增：发送消息的回调
}

export function CustomLearningPlan({ recommendedCourses, onSendMessage }: CustomLearningPlanProps) {
  const [showLearningPlan, setShowLearningPlan] = useState(false);
  const [learningInput, setLearningInput] = useState<string>('');
  const [learningPlan, setLearningPlan] = useState<LearningPlan | null>(null);
  const [partialPlan, setPartialPlan] = useState<LearningPlan | null>(null); // 新增：用于逐步构建的计划
  const [planUpdateStatus, setPlanUpdateStatus] = useState<'idle' | 'updating' | 'completed' | 'error'>('idle');
  const [externalMessage, setExternalMessage] = useState<string>(''); // 新增：外部消息状态
  const [newStepIndex, setNewStepIndex] = useState<number | null>(null); // 新增：用于动画效果的新步骤索引
  const [updatedStepIndex, setUpdatedStepIndex] = useState<number | null>(null); // 新增：用于更新步骤动画效果的索引
  const [updatingSteps, setUpdatingSteps] = useState<number[]>([]); // 新增：正在更新的步骤列表
  const [sessionId] = useState(() => {
    const id = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log('🆔 生成SessionId:', id);
    return id;
  });

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
    }
  }, [sessionId]);

  const handleChatMessage = () => {
    setShowLearningPlan(true);
    setPlanUpdateStatus('updating');
  };

  // 新增：处理计划生成的回调
  const handlePlanGeneration = (updateSteps: number[], reason: string) => {
    console.log('🚀 开始计划生成:', { updateSteps, reason });
    setShowLearningPlan(true);
    // 只有当需要更新步骤时才设置为updating状态
    if (updateSteps.length > 0) {
      setPlanUpdateStatus('updating');
      setPartialPlan(null); // 重置部分计划
      // 只有在非初次生成时才设置更新步骤（初次生成的标识是reason包含"初次"）
      if (!reason.includes('初次')) {
        setUpdatingSteps(updateSteps); // 设置正在更新的步骤
      }
    }
  };

  // 新增：逐步更新步骤的回调
  const handleStepUpdate = (step: any, stepNumber: number, total: number) => {
    console.log(`\n📋 ===== 步骤更新开始 =====`);
    console.log(`收到步骤更新 ${stepNumber}/${total}:`, step.title);
    console.log('步骤详细信息:', {
      stepNumber,        // API传入的步骤编号
      stepStep: step.step,  // 步骤对象的step字段
      stepTitle: step.title
    });
    
    // 如果这个步骤正在更新中，从更新列表中移除
    setUpdatingSteps(prev => {
      const filtered = prev.filter(s => s !== stepNumber);
      console.log('更新updatingSteps:', { prev, filtered });
      return filtered;
    });
    
    setPartialPlan(prevPlan => {
      console.log('当前partialPlan状态:', prevPlan);
      
      // 🔧 修复：如果没有partialPlan，但有learningPlan，则使用learningPlan作为基础
      const basePlan = prevPlan || learningPlan;
      console.log('使用的基础计划:', basePlan ? 'basePlan存在' : 'basePlan为空', basePlan);
      
      if (!basePlan) {
        console.log('🆕 创建新的部分计划（无任何现有计划）');
        const newPlan: LearningPlan = {
          plan: [step]
        };
        console.log('📚 创建新的部分计划:', newPlan);
        
        // 设置新增动画效果
        console.log('🎬 设置新增动画: setNewStepIndex(0)');
        setNewStepIndex(0);
        setTimeout(() => {
          console.log('🎬 清除新增动画: setNewStepIndex(null)');
          setNewStepIndex(null);
        }, 1000);
        
        return newPlan;
      } else {
        console.log('🔄 基于现有计划进行更新');
        console.log('基础计划步骤:', basePlan.plan.map((s, idx) => ({ 
          arrayIndex: idx, 
          stepNumber: s.step, 
          title: s.title 
        })));
        
        // 检查是否是更新现有步骤还是添加新步骤
        const existingStepIndex = basePlan.plan.findIndex(s => s.step === step.step);
        
        console.log('📋 🔍 关键调试信息:');
        console.log({
          '查找目标': `step.step = ${step.step}`,
          '查找结果': `existingStepIndex = ${existingStepIndex}`,
          '是否找到': existingStepIndex !== -1,
          '数组长度': basePlan.plan.length,
          '所有步骤的step值': basePlan.plan.map(s => s.step)
        });
        
        if (existingStepIndex !== -1) {
          console.log(`✅ 找到现有步骤，数组索引: ${existingStepIndex}`);
          console.log(`将要更新的步骤:`, basePlan.plan[existingStepIndex]);
          
          // 更新现有步骤
          const updatedPlan: LearningPlan = {
            plan: basePlan.plan.map((s, index) => {
              const isTarget = index === existingStepIndex;
              console.log(`映射步骤 ${index}: ${isTarget ? '🎯 目标步骤' : '普通步骤'} - ${s.title}`);
              return isTarget ? step : s;
            })
          };
          
          console.log('📚 更新后的计划:', updatedPlan.plan.map((s, idx) => ({ 
            arrayIndex: idx, 
            stepNumber: s.step, 
            title: s.title 
          })));
          
          // 设置更新动画效果
          console.log(`🎬 设置更新动画: setUpdatedStepIndex(${existingStepIndex})`);
          setUpdatedStepIndex(existingStepIndex);
          setTimeout(() => {
            console.log('🎬 清除更新动画: setUpdatedStepIndex(null)');
            setUpdatedStepIndex(null);
          }, 1000);
          
          console.log(`📋 ===== 步骤更新结束 (更新模式) =====\n`);
          return updatedPlan;
        } else {
          console.log(`🆕 未找到现有步骤，将作为新步骤添加`);
          
          // 添加新步骤
          const updatedPlan: LearningPlan = {
            plan: [...basePlan.plan, step]
          };
          console.log(`📚 添加新步骤，当前步骤数: ${updatedPlan.plan.length}/${total}`);
          
          // 设置新增动画效果
          const newIndex = updatedPlan.plan.length - 1;
          console.log(`🎬 设置新增动画: setNewStepIndex(${newIndex})`);
          setNewStepIndex(newIndex);
          setTimeout(() => {
            console.log('🎬 清除新增动画: setNewStepIndex(null)');
            setNewStepIndex(null);
          }, 1000);
          
          console.log(`📋 ===== 步骤更新结束 (新增模式) =====\n`);
          return updatedPlan;
        }
      }
    });
  };

  // 新增：直接更新计划的回调
  const handlePlanUpdate = (plan: any) => {
    console.log('📚 收到完整计划更新:', plan);
    setLearningPlan(plan);
    
    // 🔧 修复：只有在非更新状态时才清除部分计划
    // 如果正在更新中，保留partialPlan以供后续步骤更新使用
    if (planUpdateStatus !== 'updating') {
      setPartialPlan(null);
      console.log('🧹 清除部分计划（非更新状态）');
    } else {
      console.log('⚠️ 保留部分计划（正在更新中）');
    }
    
    setUpdatingSteps([]); // 清除正在更新的步骤
    setPlanUpdateStatus('completed');
    
    // 保存学习计划到sessionStorage，供学习页面使用
    sessionStorage.setItem('learningPlan', JSON.stringify(plan));
    console.log('💾 学习计划已保存到sessionStorage');
    
    // 3秒后恢复idle状态并清除部分计划
    setTimeout(() => {
      setPlanUpdateStatus('idle');
      setPartialPlan(null);
      console.log('🧹 延迟清除部分计划');
    }, 3000);
  };

  // 处理推荐课程点击
  const handleRecommendedCourseClick = (course: any) => {
    const message = `我要学习${course.title}`;
    setExternalMessage(message);
    // 清除之前的消息，确保每次点击都能触发
    setTimeout(() => setExternalMessage(''), 100);
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
    
    // 检查是否是新添加的步骤
    const isNewStep = newStepIndex === index;
    
    // 检查是否是刚更新的步骤
    const isUpdatedStep = updatedStepIndex === index;
    
    // 检查是否是正在更新的步骤
    const isUpdatingStep = updatingSteps.includes(step.step);
    
    // 调试日志：只在有动画状态时打印
    if (isNewStep || isUpdatedStep || isUpdatingStep) {
      console.log(`🎬 渲染步骤 ${index} (step.step=${step.step}) 动画状态:`, {
        stepTitle: step.title,
        arrayIndex: index,
        stepNumber: step.step,
        isNewStep: isNewStep,
        isUpdatedStep: isUpdatedStep,
        isUpdatingStep: isUpdatingStep,
        newStepIndex: newStepIndex,
        updatedStepIndex: updatedStepIndex,
        updatingSteps: updatingSteps
      });
    }
    
    return (
      <div
        key={step.step}
        className={`py-3 pl-4 ${marginClass} transform hover:scale-105 transition-all duration-300 ${
          isNewStep ? 'animate-pulse scale-110 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-2 border-blue-300' : ''
        } ${
          isUpdatedStep ? 'animate-pulse scale-105 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-300' : ''
        } ${
          isUpdatingStep ? 'animate-pulse bg-gradient-to-r from-orange-50 to-red-50 rounded-lg border-2 border-orange-300' : ''
        }`}
        style={{
          transform: index % 2 === 0 ? 'rotate(0.2deg)' : 'rotate(-0.2deg)',
          animation: isNewStep ? 'slideInFromRight 0.8s ease-out, pulse 1s ease-in-out' : 
                    isUpdatedStep ? 'updateBounce 0.6s ease-out' :
                    isUpdatingStep ? 'blink 1s infinite' : undefined
        }}
      >
        <div className="flex items-center space-x-4">
          {/* 步骤序号 */}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transform ${
            colorScheme.bg
          } ${colorScheme.text} ${colorScheme.border} ${
            index % 3 === 0 ? 'rotate-12' : index % 3 === 1 ? '-rotate-12' : 'rotate-6'
          } ${
            isNewStep ? 'animate-bounce' : 
            isUpdatedStep ? 'animate-pulse bg-green-400 border-green-400' :
            isUpdatingStep ? 'animate-pulse bg-orange-400 border-orange-400' : ''
          }`}>
            {step.step}
          </div>
          
          {/* 标题 */}
          <h3 className={`text-base font-bold ${colorScheme.textColor} ${
            isNewStep ? 'animate-pulse' : ''
          } ${
            isUpdatedStep ? 'text-green-700 animate-pulse' : ''
          } ${
            isUpdatingStep ? 'text-orange-700 animate-pulse' : ''
          }`} 
              style={{
                fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
              }}>
            {step.title}
            {isNewStep && <span className="ml-2 text-sm">✨ 新增!</span>}
            {isUpdatedStep && <span className="ml-2 text-sm text-green-600">✅ 更新完成!</span>}
            {isUpdatingStep && <span className="ml-2 text-sm text-orange-600">🔄 更新中...</span>}
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
    <>
      {/* 动画样式定义 */}
      <style jsx>{`
        @keyframes slideInFromRight {
          0% {
            transform: translateX(100%) rotate(5deg);
            opacity: 0;
          }
          50% {
            transform: translateX(-10px) rotate(-2deg);
            opacity: 0.8;
          }
          100% {
            transform: translateX(0) rotate(0deg);
            opacity: 1;
          }
        }
        @keyframes blink {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        @keyframes updateBounce {
          0% { transform: scale(1); }
          30% { transform: scale(1.05); }
          60% { transform: scale(0.98); }
          100% { transform: scale(1); }
        }
      `}</style>
      
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
            sessionId={sessionId}
            externalMessage={externalMessage}
            onPlanGeneration={handlePlanGeneration}
            onPlanUpdate={handlePlanUpdate}
            onStepUpdate={handleStepUpdate}
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
                planUpdateStatus === 'error' ? 'bg-red-200' :
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
                ) : planUpdateStatus === 'error' ? (
                  <>
                    <span className="mr-2">❌</span>
                    Generation Failed
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
            {!learningPlan && !partialPlan ? (
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
                {/* 显示部分计划或完整计划 */}
                {(learningPlan || partialPlan)?.plan.map((step, index) => renderLearningStep(step, index))}
                
                {/* 如果正在更新且只有部分计划，显示生成中的提示 */}
                {partialPlan && planUpdateStatus === 'updating' && (
                  <div className="flex items-center justify-center py-8">
                    <div className="bg-blue-50 p-4 rounded-lg border-2 border-dashed border-blue-300">
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                        <span className="text-blue-700 font-medium" style={{
                          fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                        }}>
                          正在生成更多学习步骤... ✨
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* 固定在底部的开始学习按钮 */}
          {(learningPlan || partialPlan) && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
              <Link href="/en/study/custom">
                <button 
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium text-base transform rotate-1 hover:rotate-0 transition-all duration-300 shadow-lg"
                  style={{
                    fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                  }}
                  onClick={() => {
                    // 保存当前计划（完整计划优先，否则使用部分计划）
                    const currentPlan = learningPlan || partialPlan;
                    if (currentPlan) {
                      sessionStorage.setItem('learningPlan', JSON.stringify(currentPlan));
                      console.log('💾 点击开始学习，已保存当前计划到sessionStorage');
                    }
                  }}
                >
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
                  
                  <button 
                    onClick={() => handleRecommendedCourseClick(course)}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg font-medium transition-colors text-xs transform hover:rotate-1 shadow-md"
                    style={{
                      fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                    }}>
                    Start Learning 🚀
                  </button>
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
    </>
  );
}