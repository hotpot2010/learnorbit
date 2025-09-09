'use client';

import { useState, useEffect } from 'react';
import { AIChatInterface } from './ai-chat-interface';
import { CourseRecommendationGrid } from './course-recommendation-grid';
import { FlowDiagram } from './flow-diagram';
import { LearningPlan, LearningStep } from '@/types/learning-plan';
import { LocaleLink, useLocaleRouter } from '@/i18n/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useCurrentUser } from '@/hooks/use-current-user';
import { ChevronDown, ChevronUp, Send } from 'lucide-react';
import { trackKeyActionSafely } from '@/lib/key-actions-analytics';
import ReactMarkdown from 'react-markdown';
import { useMobileLayout } from '@/hooks/use-mobile-layout';
import { MobileFlowDiagram } from '@/components/mobile/mobile-flow-diagram';

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

// 清理描述内容，移除tasktype相关信息
const cleanDescription = (description: string): string => {
  if (!description) return '';
  
  // 移除可能包含tasktype的模式
  return description
    // 移除类似 "tasktype: quiz" 或 "taskType: coding" 的行
    .replace(/^.*task[tT]ype?\s*[:：]\s*\w+.*$/gm, '')
    // 移除类似 "Type: quiz" 或 "类型: 编程" 的行
    .replace(/^.*[类型Type]\s*[:：]\s*\w+.*$/gm, '')
    // 移除多余的空行
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    // 移除开头和结尾的空白
    .trim();
};

// 描述展示组件
const DescriptionSection = ({ 
  description, 
  stepNumber,
  fontFamily = '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
}: { 
  description: string; 
  stepNumber: number;
  fontFamily?: string;
}) => {
  if (!description || description.trim() === '') return null;
  
  // 清理描述内容
  const cleanedDescription = cleanDescription(description);
  
  return (
    <div className="mt-3 ml-12 mr-4">
      {/* 描述内容 */}
      <div className="flex items-start space-x-2">
        {/* 图标指示 */}
        <span className="text-lg transform rotate-12 flex-shrink-0 mt-1">📝</span>
        
        {/* 描述文本 */}
        <div className="flex-1">
          <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
               style={{
                 fontFamily: fontFamily
               }}>
            <ReactMarkdown
              components={{
                p: ({ children, ...props }) => (
                  <p className="mb-2 last:mb-0" {...props}>
                    {children}
                  </p>
                ),
                ul: ({ children, ...props }) => (
                  <ul className="list-disc list-inside space-y-1 ml-2" {...props}>
                    {children}
                  </ul>
                ),
                li: ({ children, ...props }) => (
                  <li className="text-sm" {...props}>
                    {children}
                  </li>
                ),
                strong: ({ children, ...props }) => (
                  <strong className="font-bold text-gray-800" {...props}>
                    {children}
                  </strong>
                ),
                code: ({ children, ...props }) => (
                  <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono" {...props}>
                    {children}
                  </code>
                ),
              }}
            >
              {cleanedDescription}
            </ReactMarkdown>
          </div>
        </div>
      </div>
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
  const t = useTranslations('LearningPlatform');
  const currentUser = useCurrentUser();
  const { isMobile } = useMobileLayout();
  const locale = useLocale();
  const [showLearningPlan, setShowLearningPlan] = useState(false);

  // 获取字体样式函数
  const getFontFamily = () => {
    if (isMobile && locale === 'en') {
      // 移动端英文模式使用正常字体
      return 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif';
    } else if (isMobile) {
      // 移动端中文模式保持卡通字体
      return '"Comic Sans MS", "Marker Felt", "Kalam", cursive';
    } else {
      // 桌面端保持原有的卡通字体
      return '"Comic Sans MS", "Marker Felt", "Kalam", cursive';
    }
  };
  
  // 移动端专用状态
  const [mobileChatExpanded, setMobileChatExpanded] = useState(false);
  const [showMobilePlan, setShowMobilePlan] = useState(false);
  
  // 聊天状态管理 - 避免重复初始化
  const [chatInitialized, setChatInitialized] = useState(false);
  const [learningInput, setLearningInput] = useState<string>('');
  const [learningPlan, setLearningPlan] = useState<LearningPlan | null>(null);
  const [partialPlan, setPartialPlan] = useState<LearningPlan | null>(null); // 新增：用于逐步构建的计划
  const [courseIntroduction, setCourseIntroduction] = useState<any>(null); // 新增：课程介绍状态
  const [planUpdateStatus, setPlanUpdateStatus] = useState<'idle' | 'updating' | 'completed' | 'error'>('idle');
  const [externalMessage, setExternalMessage] = useState<string>(''); // 新增：外部消息状态
  const [newStepIndex, setNewStepIndex] = useState<number | null>(null); // 新增：用于动画效果的新步骤索引
  const [updatedStepIndex, setUpdatedStepIndex] = useState<number | null>(null); // 新增：用于更新步骤动画效果的索引
  const [updatingSteps, setUpdatingSteps] = useState<number[]>([]); // 新增：正在更新的步骤列表
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle'); // 新增：保存状态
  const [taskGenerationStatus, setTaskGenerationStatus] = useState<'idle' | 'generating' | 'completed' | 'error'>('idle'); // 任务生成状态
  const [showCompletionNotification, setShowCompletionNotification] = useState(false); // 新增：显示完成通知
  const [isGeneratingCourse, setIsGeneratingCourse] = useState(false); // 整体课程生成状态
  const [planStartTime, setPlanStartTime] = useState<number | null>(null); // 计划生成开始时间
  
  // 新增：任务缓存和生成状态管理
  const [taskCache, setTaskCache] = useState<Record<number, any>>({});
  const [stepTaskStatus, setStepTaskStatus] = useState<Record<number, 'pending' | 'generating' | 'completed' | 'failed'>>({});
  const [taskGenerationQueue, setTaskGenerationQueue] = useState<number[]>([]);
  const [activeGenerations, setActiveGenerations] = useState<Set<number>>(new Set());
  const [stepContentHash, setStepContentHash] = useState<Record<number, string>>({});
  



  
  const [sessionId] = useState(() => {
    // 优先使用上传文件时的sessionId，确保文档关联正确
    if (typeof window !== 'undefined') {
      const uploadSessionId = sessionStorage.getItem('uploadSessionId');
      if (uploadSessionId) {
        console.log('🆔 使用上传文件的SessionId:', uploadSessionId);
        return uploadSessionId;
      }
    }
    
    // 如果没有上传文件，生成新的sessionId（格式与上传保持一致）
    const id = crypto.randomUUID().replace(/-/g, '_');
    console.log('🆔 生成新的SessionId:', id);
    return id;
  });

  const router = useLocaleRouter();

  // 生成步骤内容的哈希值，用于检测变更
  const generateStepHash = (step: any) => {
    const key = `${step.title}-${step.description}-${step.type}-${step.difficulty}`;
    try {
      // 使用更安全的编码方式，支持中文字符
      // 先转换为UTF-8字节，再进行base64编码
      const encoder = new TextEncoder();
      const data = encoder.encode(key);
      const base64 = btoa(String.fromCharCode(...data));
      return base64.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
    } catch (error) {
      console.warn('⚠️ 生成步骤哈希失败，使用备用方案:', error);
      // 备用方案：使用简单的字符串哈希
      let hash = 0;
      for (let i = 0; i < key.length; i++) {
        const char = key.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 转换为32位整数
      }
      return Math.abs(hash).toString(36).substring(0, 16);
    }
  };

  // 检查步骤是否需要重新生成任务
  const shouldRegenerateTask = (step: any, stepNumber: number) => {
    const currentHash = generateStepHash(step);
    const storedHash = stepContentHash[stepNumber];
    return !storedHash || storedHash !== currentHash;
  };

  // 添加任务到生成队列
  const addToTaskQueue = (stepNumber: number) => {
    setTaskGenerationQueue(prev => {
      if (!prev.includes(stepNumber)) {
        console.log(`🎯 添加步骤 ${stepNumber} 到任务生成队列`);
        return [...prev, stepNumber].sort((a, b) => a - b); // 按步骤顺序排序
      }
      return prev;
    });
    
    setStepTaskStatus(prev => ({
      ...prev,
      [stepNumber]: 'pending'
    }));
  };

  // 从队列中移除任务
  const removeFromTaskQueue = (stepNumber: number) => {
    setTaskGenerationQueue(prev => prev.filter(n => n !== stepNumber));
  };

  // 前端重试配置
  const FRONTEND_RETRY_CONFIG = {
    maxRetries: 2,
    baseDelay: 2000, // 2秒基础延迟
    backoffMultiplier: 1.5,
  };

  // 前端重试函数
  const fetchWithRetry = async (url: string, options: RequestInit, retryCount = 0): Promise<Response> => {
    try {
      console.log(`🔄 前端API调用 (第${retryCount + 1}次):`, url);
      
      const response = await fetch(url, options);
      
      // 如果是5xx错误或网络错误，进行重试
      if (!response.ok && (response.status >= 500 || response.status === 0)) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return response;
    } catch (error) {
      console.error(`❌ 前端第${retryCount + 1}次请求失败:`, error);
      
      // 检查是否应该重试
      if (retryCount < FRONTEND_RETRY_CONFIG.maxRetries) {
        const delayMs = FRONTEND_RETRY_CONFIG.baseDelay * Math.pow(FRONTEND_RETRY_CONFIG.backoffMultiplier, retryCount);
        console.log(`⏳ ${delayMs}ms后进行前端第${retryCount + 2}次重试...`);
        
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return fetchWithRetry(url, options, retryCount + 1);
      }
      
      throw error;
    }
  };

  // 生成单个任务
  const generateSingleTask = async (step: any, stepNumber: number) => {
    try {
      console.log(`🚀 开始生成步骤 ${stepNumber} 的任务:`, step.title);
      
      // 更新状态为生成中
      setStepTaskStatus(prev => ({
        ...prev,
        [stepNumber]: 'generating'
      }));
      
      setActiveGenerations(prev => new Set([...prev, stepNumber]));

      // 构造请求数据（补全后端所需字段）
      const userId = (currentUser as any)?.id || 'anonymous';
      const lang = typeof document !== 'undefined'
        ? (document.documentElement.lang || 'en')
        : 'en';
      const courseContent = (learningPlan?.plan || partialPlan?.plan || []);
      const previousStepsContext = (learningPlan?.plan || partialPlan?.plan || [])
        .filter((s: any) => (typeof s.step === 'number' ? s.step : -1) < stepNumber);
      const previousStepsMapped = previousStepsContext.map((s: any) => ({ title: s?.title, description: s?.description }));

      // 检查是否有上传的文件
      const hasUploadedFile = typeof window !== 'undefined' 
        ? sessionStorage.getItem('hasUploadedFile') === 'true'
        : false;

      const requestData = {
        // 必填/已有字段
        step: stepNumber,
        title: step.title,
        description: step.description,
        animation_type: step.animation_type || '无',
        status: step.status,
        type: step.type,
        difficulty: step.difficulty,
        search_keyword: step.search_keyword || step.title,
        videos: step.videos || [],
        // 追加字段（仅三项）
        id: userId,
        previous_steps_context: previousStepsMapped,
        lang,
        ...(hasUploadedFile && { retrive_enabled: true }),
      } as const;

      console.log(`📤 发送任务生成请求 (步骤 ${stepNumber}):`, requestData);

      // 使用带重试的fetch
      const response = await fetchWithRetry('/api/task/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const result = await response.json();

      if (result.success) {
        console.log(`✅ 步骤 ${stepNumber} 任务生成成功`);
        
        // 更新任务缓存
        setTaskCache(prev => ({
          ...prev,
          [stepNumber]: result.task
        }));
        
        // 更新状态为完成
        setStepTaskStatus(prev => ({
          ...prev,
          [stepNumber]: 'completed'
        }));
        
        // 更新步骤内容哈希
        setStepContentHash(prev => ({
          ...prev,
          [stepNumber]: generateStepHash(step)
        }));

        console.log(`💾 步骤 ${stepNumber} 任务已缓存:`, {
          type: result.task.type,
          hasContent: !!result.task.ppt_slide
        });

      } else {
        throw new Error(`Task generation failed: ${result.error || 'Unknown error'}`);
      }

    } catch (error) {
      console.error(`❌ 步骤 ${stepNumber} 任务生成失败 (所有重试已用完):`, error);
      
      setStepTaskStatus(prev => ({
        ...prev,
        [stepNumber]: 'failed'
      }));
    } finally {
      // 从活跃生成列表中移除
      setActiveGenerations(prev => {
        const newSet = new Set(prev);
        newSet.delete(stepNumber);
        return newSet;
      });
      
      // 从队列中移除
      removeFromTaskQueue(stepNumber);
    }
  };

  // 处理任务生成队列（并发控制）
  const processTaskQueue = async () => {
    const maxConcurrency = 2; // 最多同时生成2个任务
    const currentActive = activeGenerations.size;
    const availableSlots = maxConcurrency - currentActive;
    
    if (availableSlots <= 0 || taskGenerationQueue.length === 0) {
      return;
    }

    // 获取可以开始生成的任务
    const tasksToStart = taskGenerationQueue
      .filter(stepNumber => !activeGenerations.has(stepNumber))
      .slice(0, availableSlots);

    // 并发生成任务
    const currentPlan = learningPlan || partialPlan;
    if (currentPlan && tasksToStart.length > 0) {
      console.log(`🎯 开始并发生成 ${tasksToStart.length} 个任务:`, tasksToStart);
      
      const generatePromises = tasksToStart.map(stepNumber => {
        const step = currentPlan.plan.find(s => s.step === stepNumber);
        if (step) {
          return generateSingleTask(step, stepNumber);
        }
        return Promise.resolve();
      });

      await Promise.allSettled(generatePromises);
    }
  };

  // 队列处理效果 - 当队列变化时处理任务生成
  useEffect(() => {
    if (taskGenerationQueue.length > 0) {
      const timer = setTimeout(() => {
        processTaskQueue();
      }, 500); // 防抖处理
      
      return () => clearTimeout(timer);
    }
  }, [taskGenerationQueue, activeGenerations]);

  // 保存任务缓存到sessionStorage
  useEffect(() => {
    if (Object.keys(taskCache).length > 0) {
      sessionStorage.setItem('taskCache', JSON.stringify(taskCache));
      sessionStorage.setItem('stepTaskStatus', JSON.stringify(stepTaskStatus));
      console.log('💾 任务缓存已保存到sessionStorage:', Object.keys(taskCache).length, '个任务');
    }
  }, [taskCache, stepTaskStatus]);

  // 页面离开警告 - 当课程正在生成时
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // 只有在课程正在生成且还未完成时才显示警告
      if (planUpdateStatus === 'updating' || (partialPlan && !learningPlan)) {
        e.preventDefault();
        e.returnValue = 'Course is being generated. Leaving the page will lose the current generated content. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [planUpdateStatus, partialPlan, learningPlan]);

  // 监听任务生成完成状态，显示完成通知
  useEffect(() => {
    if (taskGenerationStatus === 'completed' && saveStatus === 'success' && !showCompletionNotification) {
      console.log('🎉 课程和任务都已生成完成，显示完成通知');
      setShowCompletionNotification(true);
      setIsGeneratingCourse(false); // 停止整体生成状态
      // 8秒后自动隐藏通知（给用户更多时间阅读）
      setTimeout(() => {
        setShowCompletionNotification(false);
        console.log('🔕 自动隐藏完成通知');
      }, 8000);
    }
  }, [taskGenerationStatus, saveStatus, showCompletionNotification]);

  useEffect(() => {
    // 从sessionStorage读取首页的输入
    if (typeof window !== 'undefined') {
      const savedInput = sessionStorage.getItem('learningInput');

      if (savedInput) {
        setLearningInput(savedInput);
        console.log('课程定制页面读取到用户输入:', savedInput);
        // 不立即显示学习计划，等实际开始生成时再显示
      }
    }
  }, [sessionId]);

  const handleChatMessage = () => {
    setShowLearningPlan(true);
    setPlanUpdateStatus('updating');
    setChatInitialized(true); // 标记聊天已初始化
  };

  // 新增：处理计划生成的回调
  const handlePlanGeneration = (updateSteps: number[], reason: string) => {
    console.log('🚀 开始计划生成:', { updateSteps, reason });
    
    // 记录计划生成开始时间（用于打点统计）
    if (reason.includes('初次') || !planStartTime) {
      setPlanStartTime(Date.now());
    }
    
    // 移动端：在开始生成计划时切换到计划展示模式
    if (isMobile && reason.includes('初次')) {
      setShowMobilePlan(true);
      setMobileChatExpanded(false);
    }
    
    // 不立即显示学习计划区域，等收到数据时再显示
    // 只准备相关状态
    if (updateSteps.length > 0) {
      setPartialPlan(null); // 重置部分计划
      // 只有在非初次生成时才设置更新步骤（初次生成的标识是reason包含"初次"）
      if (!reason.includes('初次')) {
        setUpdatingSteps(updateSteps); // 设置正在更新的步骤
      }
    }
    
    // 如果是初次生成，清理之前的课程介绍
    if (reason.includes('初次')) {
      setCourseIntroduction(null);
    }
  };

  // 新增：处理课程介绍的回调
  const handleIntroductionUpdate = (introduction: any) => {
    setShowLearningPlan(true); // 收到课程介绍时显示学习计划区域
    setCourseIntroduction(introduction);
  };

  // 新增：逐步更新步骤的回调
  const handleStepUpdate = (step: any, stepNumber: number, total: number) => {
    // 收到第一个步骤时设置状态
    if (planUpdateStatus === 'idle') {
      console.log('🔄 收到第一个步骤，设置为updating状态');
      setShowLearningPlan(true); // 显示学习计划区域
      setPlanUpdateStatus('updating');
    }
    
    console.log(`\n📋 ===== 步骤更新开始 =====`);
    console.log(`收到步骤更新 ${stepNumber}/${total}:`, step.title);
    console.log('步骤详细信息:', {
      stepNumber,        // API传入的步骤编号
      stepStep: step.step,  // 步骤对象的step字段
      stepTitle: step.title,
      stepType: step.type,
      stepDifficulty: step.difficulty,
      currentLocale: typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : 'unknown'
    });

    // 检查是否需要重新生成任务
    const needsRegeneration = shouldRegenerateTask(step, step.step);
    console.log(`🔄 步骤 ${step.step} 是否需要重新生成任务:`, needsRegeneration);
    
    if (needsRegeneration) {
      console.log(`🔄 步骤 ${step.step} 内容已变更，需要重新生成任务`);
      
      // 清除旧的任务缓存
      setTaskCache(prev => {
        const newCache = { ...prev };
        delete newCache[step.step];
        console.log(`🗑️ 清除步骤 ${step.step} 的旧任务缓存`);
        return newCache;
      });
      
      // 如果正在生成，取消当前生成
      if (stepTaskStatus[step.step] === 'generating') {
        console.log(`⚠️ 取消步骤 ${step.step} 正在进行的任务生成`);
        setActiveGenerations(prev => {
          const newSet = new Set(prev);
          newSet.delete(step.step);
          return newSet;
        });
      }
    }

    // 如果这个步骤正在更新中，从更新列表中移除
    setUpdatingSteps(prev => {
      const filtered = prev.filter(s => s !== stepNumber);
      console.log('更新updatingSteps:', { prev, filtered });
      return filtered;
    });

    // 🔧 修复：立即更新learningPlan，确保UI实时显示变化
    if (learningPlan) {
      setLearningPlan(prevPlan => {
        if (!prevPlan) return prevPlan;
        
        const existingStepIndex = prevPlan.plan.findIndex(s => s.step === step.step);
        
        if (existingStepIndex !== -1) {
          console.log(`🎯 立即更新learningPlan中的步骤 ${step.step}: ${step.title}`);
          
          // 立即更新learningPlan中的对应步骤
          const updatedPlan: LearningPlan = {
            plan: prevPlan.plan.map((s, index) => 
              index === existingStepIndex ? step : s
            )
          };
          
          // 设置更新动画效果
          setUpdatedStepIndex(existingStepIndex);
          setTimeout(() => {
            setUpdatedStepIndex(null);
          }, 1000);
          
          // 触发任务生成（如果需要）
          if (needsRegeneration) {
            setTimeout(() => {
              console.log(`🎯 为立即更新的步骤 ${step.step} 触发任务生成`);
              addToTaskQueue(step.step);
            }, 100);
          }
          
          return updatedPlan;
        }
        
        return prevPlan;
      });
    }

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

        // 触发任务生成
        setTimeout(() => {
          console.log(`🎯 为新步骤 ${step.step} 触发任务生成 (新建计划)`);
          console.log(`🎯 当前任务状态:`, stepTaskStatus);
          console.log(`🎯 当前生成队列:`, taskGenerationQueue);
          addToTaskQueue(step.step);
        }, 100);

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

          // 触发任务生成（如果需要）
          if (needsRegeneration) {
            setTimeout(() => {
              console.log(`🎯 为更新的步骤 ${step.step} 触发任务生成 (更新现有)`);
              console.log(`🎯 当前任务状态:`, stepTaskStatus);
              console.log(`🎯 当前生成队列:`, taskGenerationQueue);
              addToTaskQueue(step.step);
            }, 100);
          } else {
            console.log(`⏭️ 步骤 ${step.step} 无需重新生成任务，跳过队列添加`);
          }

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

          // 触发任务生成
          setTimeout(() => {
            console.log(`🎯 为新步骤 ${step.step} 触发任务生成 (添加新步骤)`);
            console.log(`🎯 当前任务状态:`, stepTaskStatus);
            console.log(`🎯 当前生成队列:`, taskGenerationQueue);
            addToTaskQueue(step.step);
          }, 100);

          console.log(`📋 ===== 步骤更新结束 (新增模式) =====\n`);
          return updatedPlan;
        }
      }
    });
  };

  // 新增：直接更新计划的回调
  const handlePlanUpdate = (plan: any) => {
    console.log('📚 收到计划更新回调:', plan);
    if (plan) {
      // 🔧 修复：不直接覆盖learningPlan，而是合并更新
      // 因为我们在handleStepUpdate中已经实时更新了learningPlan
      console.log('📚 最终计划更新 - 保持现有的实时更新状态');
      setLearningPlan(prevPlan => {
        // 如果已经有更新过的计划，保持现有状态
        if (prevPlan && prevPlan.plan.length > 0) {
          console.log('✅ 保持现有的实时更新计划');
          // 合并课程介绍信息
          const enhancedPlan = {
            ...prevPlan,
            introduction: courseIntroduction,
            title: courseIntroduction?.title || prevPlan.title,
            description: courseIntroduction?.course_info || prevPlan.description
          };
          return enhancedPlan;
        }
        // 否则使用新计划，并合并课程介绍信息
        const enhancedPlan = {
          ...plan,
          introduction: courseIntroduction,
          title: courseIntroduction?.title || plan.title,
          description: courseIntroduction?.course_info || plan.description
        };
        return enhancedPlan;
      });
    } else {
      // 无变更，仅结束更新状态
      console.log('ℹ️ 本次计划无变更，结束更新态');
    }

    // 🔧 修复：只有在非更新状态时才清除部分计划
    // 如果正在更新中，保留partialPlan以供后续步骤更新使用
    if (plan && planUpdateStatus !== 'updating') {
      setPartialPlan(null);
      console.log('🧹 清除部分计划（非更新状态）');
    } else {
      console.log('⚠️ 保留部分计划（正在更新中）');
    }

    setUpdatingSteps([]); // 清除正在更新的步骤
    setPlanUpdateStatus('completed');

    // 保存增强后的学习计划到sessionStorage，供学习页面使用
    if (plan) {
      const enhancedPlan = {
        ...plan,
        introduction: courseIntroduction,
        title: courseIntroduction?.title || plan.title,
        description: courseIntroduction?.course_info || plan.description
      };
      sessionStorage.setItem('learningPlan', JSON.stringify(enhancedPlan));
      console.log('💾 增强后的学习计划已保存到sessionStorage');
    }

    // 3秒后恢复idle状态并清除部分计划
    setTimeout(() => {
      setPlanUpdateStatus('idle');
      setPartialPlan(null);
      // 注意：不清除课程介绍，因为它在整个会话中应该保持显示
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

    // 保存课程到数据库
  const saveCourseToDatabase = async (coursePlan: LearningPlan) => {
    try {
      setSaveStatus('saving');
      console.log('💾 开始保存课程到sessionStorage:', coursePlan);
      console.log('💾 当前任务缓存:', Object.keys(taskCache).length, '个任务');
      console.log('💾 任务状态:', stepTaskStatus);

      // 确保课程计划包含课程介绍信息
      const enhancedCoursePlan = {
        ...coursePlan,
        introduction: courseIntroduction,
        title: courseIntroduction?.title || coursePlan.title,
        description: courseIntroduction?.course_info || coursePlan.description
      };

      // 1. 保存增强后的课程计划到sessionStorage供学习页面使用
      sessionStorage.setItem('learningPlan', JSON.stringify(enhancedCoursePlan));

      // 2. 保存任务缓存和状态
      if (Object.keys(taskCache).length > 0) {
        sessionStorage.setItem('taskCache', JSON.stringify(taskCache));
        sessionStorage.setItem('stepTaskStatus', JSON.stringify(stepTaskStatus));
        console.log('💾 任务缓存和状态已保存到sessionStorage');
      }
      
      // 3. 设置标记表示来自课程定制页面
      sessionStorage.setItem('fromCustomPage', 'true');

      setSaveStatus('success');

      // 4. 直接跳转到 custom 学习页面
      router.push('/study/custom');

    } catch (error) {
      console.error('🚨 保存课程失败:', error);
      setSaveStatus('error');

      // 即使保存失败，也允许用户继续学习
      setTimeout(() => {
        const enhancedCoursePlan = {
          ...coursePlan,
          introduction: courseIntroduction,
          title: courseIntroduction?.title || coursePlan.title,
          description: courseIntroduction?.course_info || coursePlan.description
        };
        sessionStorage.setItem('learningPlan', JSON.stringify(enhancedCoursePlan));
        if (Object.keys(taskCache).length > 0) {
          sessionStorage.setItem('taskCache', JSON.stringify(taskCache));
          sessionStorage.setItem('stepTaskStatus', JSON.stringify(stepTaskStatus));
        }
        sessionStorage.setItem('fromCustomPage', 'true');
        router.push('/study/custom');
      }, 1000);
    }
  };

  // 计算步骤时长
  const calculateTotalDuration = (videos: any[]) => {
    if (!videos || videos.length === 0) return '估算中...';
    // 简单估算：取第一个视频时长作为参考
    return videos[0]?.duration || '估算中...';
  };

  // 渲染课程介绍
  const renderCourseIntroduction = (introduction: any) => {
    if (!introduction) {
      return null;
    }
    
    // 只显示 background、overview、prerequisites
    const displayFields = ['background', 'overview', 'prerequisites'];
    const filteredIntroduction = Object.entries(introduction)
      .filter(([key]) => displayFields.includes(key));
    
    if (filteredIntroduction.length === 0) {
      return null;
    }
    
    return (
      <div className="mb-6">
        <div className="bg-yellow-50 p-5 rounded-lg border border-yellow-200 shadow-sm"
             style={{ 
               fontFamily: getFontFamily()
             }}>
          <div className="space-y-4">
            {filteredIntroduction.map(([key, value]) => (
              <div key={key} className="text-gray-800">
                <h4 className="font-bold text-gray-700 mb-2 text-base">
                  {key === 'background' ? `🌟 ${t('courseIntroduction.background')}` :
                   key === 'overview' ? `🗺️ ${t('courseIntroduction.overview')}` :
                   `⚡ ${t('courseIntroduction.prerequisites')}`}
                </h4>
                <div className="text-gray-600 text-base leading-relaxed pl-3 border-l-2 border-yellow-300">
                  {String(value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
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

    // 获取任务生成状态
    const taskStatus = stepTaskStatus[step.step] || 'pending';
    const hasTaskCache = !!taskCache[step.step];

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
        updatingSteps: updatingSteps,
        taskStatus: taskStatus,
        hasTaskCache: hasTaskCache
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
                fontFamily: getFontFamily()
              }}>
            {step.title}
            {isNewStep && <span className="ml-2 text-sm">✨ New!</span>}
            {isUpdatedStep && <span className="ml-2 text-sm text-green-600">✅ Updated!</span>}
            {isUpdatingStep && <span className="ml-2 text-sm text-orange-600">🔄 Updating...</span>}
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



          {/* Task Type */}
          <span className={`px-2 py-1 rounded text-xs transform rotate-1 ${
            step.type === 'quiz' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
          }`} style={{
            fontFamily: getFontFamily()
          }}>
            {step.type === 'quiz' ? '📝 Quiz' : '💻 Coding'}
          </span>

          {/* Difficulty Level */}
          <span className={`px-2 py-1 rounded text-xs transform -rotate-2 ${
            step.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
            step.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`} style={{
            fontFamily: getFontFamily()
          }}>
            {step.difficulty === 'beginner' ? '🌱 Beginner' :
             step.difficulty === 'intermediate' ? '🌿 Intermediate' : '🌳 Advanced'}
          </span>

          {/* Duration Time */}
          {step.videos && step.videos.length > 0 && step.videos[0].duration && (
            <span className="px-2 py-1 rounded text-xs transform rotate-0.5 bg-gray-100 text-gray-700"
                  style={{
                    fontFamily: getFontFamily()
                  }}>
              ⏱️ {step.videos[0].duration}
            </span>
          )}

          {/* 任务生成状态指示器 - 移动到最右侧，只显示图标 */}
          <div className="ml-auto flex-shrink-0">
            {taskStatus === 'pending' && (
              <span className="text-lg transform rotate-1" title="Task Pending">
                ⏳
              </span>
            )}
            {taskStatus === 'generating' && (
              <span className="text-lg transform -rotate-1 animate-pulse" title="Generating Task...">
                🔄
              </span>
            )}
            {taskStatus === 'completed' && (
              <span className="text-lg transform rotate-2" title="Task Ready">
                ✅
              </span>
            )}
            {taskStatus === 'failed' && (
              <button
                onClick={() => addToTaskQueue(step.step)}
                className="text-lg transform -rotate-1 transition-transform hover:scale-110 cursor-pointer"
                title="Task Failed - Click to retry"
              >
                ❌
              </button>
            )}
          </div>
        </div>

        {/* 描述区域 - 全部显示 */}
        <DescriptionSection 
          description={step.description} 
          stepNumber={step.step}
          fontFamily={getFontFamily()}
        />
      </div>
    );
  };

  return (
    <>
      {/* 动画样式定义 */}
      <style jsx global>{`
        /* 移动端聊天顶部padding */
        .mobile-chat-padding [data-chat-area="true"] > div {
          padding-top: 1rem !important;
        }
      `}</style>
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
      `}</style>

      {/* 整体加载状态覆盖层 */}
      {isGeneratingCourse && (
        <div className="fixed inset-0 z-40 bg-white bg-opacity-90 flex items-center justify-center">
          <div className="text-center space-y-6 max-w-md mx-auto p-8">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
              <div className="absolute inset-0 w-20 h-20 border-4 border-transparent border-r-blue-400 rounded-full animate-ping mx-auto"></div>
            </div>
            <div className="space-y-3">
              <h2 className="text-3xl font-bold text-gray-800 transform -rotate-1"
                  style={{ fontFamily: getFontFamily() }}>
                ✨ Generating complete course...
              </h2>
              <div className="space-y-2">
                <p className="text-gray-600 transform rotate-0.5"
                   style={{ fontFamily: getFontFamily() }}>
                  {saveStatus === 'saving' && '💾 Saving course plan...'}
                  {saveStatus === 'success' && taskGenerationStatus === 'generating' && '🚀 Generating course content...'}
                  {taskGenerationStatus === 'completed' && '🎉 Course generation completed!'}
                </p>
                <div className="flex justify-center space-x-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 桌面端布局 */}
      <div className={`h-[calc(100vh-4rem)] ${isMobile ? 'hidden' : 'flex'}`}
           style={{
             backgroundImage: `
               linear-gradient(to right, #f0f0f0 1px, transparent 1px),
               linear-gradient(to bottom, #f0f0f0 1px, transparent 1px)
             `,
             backgroundSize: '20px 20px'
           }}>
        {/* AI聊天区域 */}
        <div className="w-1/3 p-4">
          <div className="h-full rounded-lg border border-gray-200 shadow-sm bg-white/80 backdrop-blur-sm p-4">
            <AIChatInterface
              className="h-full"
              onMessageSent={handleChatMessage}
              userInputFromHome={learningInput}
              initialMessage={t('aiAssistant.welcomeCustomize')}
              isMobile={false}
              sessionId={sessionId}
              externalMessage={externalMessage}
              onPlanGeneration={handlePlanGeneration}
              onPlanUpdate={handlePlanUpdate}
              onStepUpdate={handleStepUpdate}
              onIntroductionUpdate={handleIntroductionUpdate}
            />
          </div>
        </div>

        {/* 学习计划区域 */}
        <div className="w-2/3 p-4">
        <div className="h-full flex flex-col relative">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-center text-blue-700 transform rotate-1"
                style={{
                  fontFamily: getFontFamily()
                }}>
              <span className="px-3 py-1 rounded-lg inline-block shadow-sm bg-yellow-200">
                Personalized Learning Plan 📚
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
                             fontFamily: getFontFamily()
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
                             fontFamily: getFontFamily()
                           }}>
                          Your personalized learning plan will appear here ✨
                        </p>
                        <p className="text-sm text-gray-500"
                           style={{
                             fontFamily: getFontFamily()
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
                {/* 显示课程介绍 */}
                {courseIntroduction && renderCourseIntroduction(courseIntroduction)}
                
                {/* 显示部分计划或完整计划 */}
                <FlowDiagram
                  steps={(learningPlan || partialPlan)?.plan || []}
                  newStepIndex={newStepIndex}
                  updatedStepIndex={updatedStepIndex}
                  updatingSteps={updatingSteps}
                  stepTaskStatus={stepTaskStatus}
                  taskCache={taskCache}
                />

                {/* 如果正在更新且只有部分计划，显示生成中的提示 */}
                {partialPlan && planUpdateStatus === 'updating' && (
                  <div className="flex items-center justify-center py-8">
                    <div className="bg-blue-50 p-4 rounded-lg border-2 border-dashed border-blue-300">
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                        <span className="text-blue-700 font-medium" style={{
                          fontFamily: getFontFamily()
                        }}>
                          Generating more learning steps... ✨
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
              <button
                className={`text-white px-6 py-2 rounded-lg font-medium text-base transform rotate-1 hover:rotate-0 transition-all duration-300 shadow-lg ${
                  saveStatus === 'saving' || isGeneratingCourse
                    ? 'bg-gray-500 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600'
                }`}
                style={{
                  fontFamily: getFontFamily()
                }}
                disabled={saveStatus === 'saving' || isGeneratingCourse}
                onClick={() => {
                  // 保存当前计划（完整计划优先，否则使用部分计划）
                  const currentPlan = learningPlan || partialPlan;
                  if (currentPlan) {
                    // 🎯 关键行为打点：开始学习
                    trackKeyActionSafely('start_learning', {
                      plan_id: `plan_${Date.now()}`, // 生成一个临时ID
                      plan_type: learningPlan ? 'complete' : 'partial',
                      total_steps: currentPlan.plan?.length || 0,
                      estimated_duration: 'unknown', // LearningPlan中没有estimatedDuration字段
                      course_title: currentPlan.title || 'unknown',
                      has_custom_modifications: false, // 暂时设为false，后续可以根据用户修改情况调整
                      plan_generation_time: Date.now() - (planStartTime || Date.now()), // 计划生成耗时
                    }, currentUser);
                    
                    saveCourseToDatabase(currentPlan);
                  } else {
                    console.warn('⚠️ 没有可保存的学习计划');
                  }
                }}
              >
                {saveStatus === 'saving' ? (
                  <>
                    <span className="inline-block animate-spin mr-2">⏳</span>
                    Saving Course...
                  </>
                ) : isGeneratingCourse ? (
                  <>
                    <span className="inline-block animate-spin mr-2">🚀</span>
                    Generating Content...
                  </>
                ) : (
                  'Start Learning Journey! 🚀'
                )}
              </button>

              {saveStatus === 'error' && (
                <div className="mt-2 text-center">
                  <p className="text-red-500 text-sm" style={{
                    fontFamily: getFontFamily()
                  }}>
                    ⚠️ 保存失败，但您仍可以继续学习
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>


    </div>

    {/* 移动端布局 */}
    <div className={`${isMobile ? 'block' : 'hidden'} h-screen flex flex-col`}
         style={{
           backgroundImage: `
             linear-gradient(to right, #f0f0f0 1px, transparent 1px),
             linear-gradient(to bottom, #f0f0f0 1px, transparent 1px)
           `,
           backgroundSize: '20px 20px'
         }}>
      
      {/* 计划展示区域 - 当有计划时显示，否则隐藏 */}
      {showMobilePlan && (
        <div className={`flex-1 overflow-y-auto p-4 pb-20 ${mobileChatExpanded ? 'hidden' : 'block'}`}>
          {!learningPlan && !partialPlan ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-gray-500 py-8">
                <div className="text-4xl mb-4">🤖</div>
                <p className="font-medium">AI正在为您生成个性化学习计划...</p>
                <p className="text-sm mt-2">请稍候，这可能需要几分钟时间</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 显示课程介绍 */}
              {courseIntroduction && renderCourseIntroduction(courseIntroduction)}
              
              {/* 显示部分计划或完整计划 - 移动端使用3行布局 */}
              <MobileFlowDiagram
                steps={(learningPlan || partialPlan)?.plan || []}
                newStepIndex={newStepIndex}
                updatedStepIndex={updatedStepIndex}
                updatingSteps={updatingSteps}
                stepTaskStatus={stepTaskStatus}
                taskCache={taskCache}
              />

              {/* 如果正在更新且只有部分计划，显示生成中的提示 */}
              {partialPlan && planUpdateStatus === 'updating' && (
                <div className="flex items-center justify-center py-8">
                  <div className="bg-blue-50 p-4 rounded-lg border-2 border-dashed border-blue-300">
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                      <span className="text-blue-700 font-medium" style={{
                        fontFamily: getFontFamily()
                      }}>
                        Generating more learning steps... ✨
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 开始学习按钮 - 与桌面端样式一致 */}
              {(learningPlan || partialPlan) && (
                <div className="flex justify-center pt-8 pb-6">
                  <button
                    className={`text-white px-6 py-2 rounded-lg font-medium text-base transform rotate-1 hover:rotate-0 transition-all duration-300 shadow-lg ${
                      saveStatus === 'saving' || taskGenerationStatus === 'generating'
                        ? 'bg-gray-500 cursor-not-allowed'
                        : 'bg-blue-500 hover:bg-blue-600'
                    }`}
                    style={{
                      fontFamily: getFontFamily()
                    }}
                    disabled={saveStatus === 'saving' || taskGenerationStatus === 'generating'}
                    onClick={() => {
                      const currentPlan = learningPlan || partialPlan;
                      if (currentPlan) {
                        // 🎯 关键行为打点：开始学习
                        trackKeyActionSafely('start_learning', {
                          plan_id: `plan_${Date.now()}`, // 生成一个临时ID
                          plan_type: learningPlan ? 'complete' : 'partial',
                          total_steps: currentPlan.plan?.length || 0,
                          estimated_duration: 'unknown', // LearningPlan中没有estimatedDuration字段
                          course_title: currentPlan.title || 'unknown',
                          has_custom_modifications: false, // 暂时设为false，后续可以根据用户修改情况调整
                          plan_generation_time: Date.now() - (planStartTime || Date.now()), // 计划生成耗时
                        }, currentUser);
                        
                        saveCourseToDatabase(currentPlan);
                      } else {
                        console.warn('⚠️ 没有可保存的学习计划');
                      }
                    }}
                  >
                    {saveStatus === 'saving' ? (
                      <>
                        <span className="inline-block animate-spin mr-2">⏳</span>
                        Saving Course...
                      </>
                    ) : taskGenerationStatus === 'generating' ? (
                      <>
                        <span className="inline-block animate-spin mr-2">🚀</span>
                        Generating Content...
                      </>
                    ) : (
                      'Start Learning Journey! 🚀'
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 统一的聊天界面 - 根据状态显示不同样式 */}
      <div className={`${
        !showMobilePlan || mobileChatExpanded 
          ? 'flex flex-col' 
          : 'hidden'
      }`}
      style={!showMobilePlan || mobileChatExpanded ? {
        height: 'calc(100dvh - 4rem)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
      } : {}}>
        
        {/* 折叠按钮 - 只在展开状态且有计划时显示 */}
        {showMobilePlan && mobileChatExpanded && (
          <div className="flex justify-end p-2 border-b bg-white">
            <button 
              onClick={() => setMobileChatExpanded(false)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="折叠聊天"
            >
              <ChevronDown className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        )}
        
        {/* 聊天界面主体 - 同一个组件实例，调整高度计算 */}
        <div className={`flex-1 ${showMobilePlan && mobileChatExpanded ? 'h-[calc(100%-3rem)]' : ''}`}>
          <AIChatInterface
            className="h-full mobile-chat-padding"
            onMessageSent={handleChatMessage}
            userInputFromHome={!chatInitialized ? learningInput : undefined}
            initialMessage={t('aiAssistant.welcomeCustomize')}
            isMobile={isMobile}
            sessionId={sessionId}
            externalMessage={externalMessage}
            onPlanGeneration={handlePlanGeneration}
            onPlanUpdate={handlePlanUpdate}
            onStepUpdate={handleStepUpdate}
            onIntroductionUpdate={handleIntroductionUpdate}
            skipDefaultWelcome={chatInitialized}
          />
        </div>
      </div>

      {/* 底部聊天入口 - 只在有计划且聊天未展开时显示 */}
      {showMobilePlan && !mobileChatExpanded && (
        <div 
          className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-gray-200 z-40 mobile-chat-container-safe"
        >
          <div className="mobile-chat-input-safe" style={{ paddingLeft: '1rem', paddingRight: '1rem', paddingTop: '1rem' }}>
            <div 
              onClick={() => setMobileChatExpanded(true)}
              className="cursor-pointer"
            >
              <div className="flex items-center space-x-3 px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex-1 text-gray-500 text-sm" style={{ fontSize: '16px', fontFamily: getFontFamily() }}>
                  Chat with AI Assistant...
                </div>
                <div className="text-gray-400">
                  💬
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* 课程生成完成通知 */}
    {showCompletionNotification && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md mx-4 transform animate-pulse">
          <div className="text-center space-y-4">
            <div className="text-6xl">🎉</div>
            <h3 className="text-2xl font-bold text-green-600 transform -rotate-1"
                style={{ fontFamily: getFontFamily() }}>
              Course Saved!
            </h3>
            <p className="text-gray-600"
               style={{ fontFamily: getFontFamily() }}>
              您的个性化课程已经保存到数据库！<br/>
              现在可以在 My Courses 页面查看和管理您的课程。
            </p>
            <div className="flex space-x-3 justify-center">
              <button
                onClick={() => setShowCompletionNotification(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors transform hover:rotate-1"
                style={{ fontFamily: getFontFamily() }}
              >
                Got it
              </button>
              <LocaleLink href="/my-courses">
                <button
                  onClick={() => setShowCompletionNotification(false)}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors transform hover:rotate-1"
                  style={{ fontFamily: getFontFamily() }}
                >
                  View My Courses 📚
                </button>
              </LocaleLink>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
