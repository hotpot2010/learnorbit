'use client';

import { AIChatInterface } from '@/components/learning/ai-chat-interface';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  Circle, 
  Clock, 
  PlayCircle,
  FileText,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { LearningPlan, LearningStep, TaskGenerateRequest, TaskGenerateResponse, TaskContent, QuizQuestion, CodingTask } from '@/types/learning-plan';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';

interface StudyPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default function StudyPage({ params }: StudyPageProps) {
  const [isPathCollapsed, setIsPathCollapsed] = useState(false);
  const [routeParams, setRouteParams] = useState<{ locale: string; id: string } | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [wrongAnswers, setWrongAnswers] = useState<Set<number>>(new Set());
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<string[]>([]);
  
  // 新增状态
  const [learningPlan, setLearningPlan] = useState<LearningPlan | null>(null);
  const [currentTask, setCurrentTask] = useState<TaskContent | null>(null);
  const [isLoadingTask, setIsLoadingTask] = useState(false);
  const [codeValue, setCodeValue] = useState<string>('');
  const [codeOutput, setCodeOutput] = useState<string>('');
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isVideoExpanded, setIsVideoExpanded] = useState(false);
  
  // 任务缓存和并行生成相关状态
  const [taskCache, setTaskCache] = useState<Record<number, TaskContent>>({});
  const [taskGenerationStatus, setTaskGenerationStatus] = useState<Record<number, 'pending' | 'loading' | 'completed' | 'failed'>>({});
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  
  // 防止重复生成任务的标志
  const taskGenerationStarted = useRef<boolean>(false);

  // 上传状态
  const [isUploading, setIsUploading] = useState(false);

  // 标识是否从数据库加载
  const [isFromDatabase, setIsFromDatabase] = useState(false);

  // 防止React Strict Mode重复执行的标志
  const initialLoadCompleted = useRef<boolean>(false);

  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await params;
      setRouteParams(resolvedParams);
      
      // 防止React Strict Mode重复执行
      if (initialLoadCompleted.current) {
        console.log('⚠️ 初始加载已完成，跳过重复执行');
        return;
      }
      
      // 如果是custom课程，从sessionStorage加载学习计划
      if (resolvedParams.id === 'custom') {
        const savedPlan = sessionStorage.getItem('learningPlan');
        const fromDatabase = sessionStorage.getItem('fromDatabase');
        const savedTaskCache = sessionStorage.getItem('taskCache');
        
        console.log('🔍 检查sessionStorage状态:', {
          hasSavedPlan: !!savedPlan,
          fromDatabase: fromDatabase,
          hasSavedTaskCache: !!savedTaskCache,
          taskGenerationStarted: taskGenerationStarted.current,
          initialLoadCompleted: initialLoadCompleted.current
        });
        
        if (savedPlan) {
          try {
            const plan: LearningPlan = JSON.parse(savedPlan);
            setLearningPlan(plan);
            console.log('✅ 加载自定义学习计划:', plan);
            
            // 如果来自数据库且有任务缓存，直接加载任务
            if (fromDatabase === 'true' && savedTaskCache) {
              console.log('📁 检测到数据库课程，准备加载任务缓存...');
              
              const tasks = JSON.parse(savedTaskCache);
              setTaskCache(tasks);
              setIsFromDatabase(true); // 设置数据库标识
              
              // 设置所有任务状态为已完成
              const completedStatus: Record<number, 'completed'> = {};
              Object.keys(tasks).forEach(stepNum => {
                completedStatus[parseInt(stepNum)] = 'completed';
              });
              setTaskGenerationStatus(completedStatus);
              
              console.log('✅ 从数据库加载任务缓存，跳过任务生成:', {
                taskCount: Object.keys(tasks).length,
                taskKeys: Object.keys(tasks)
              });
              
              // 标记任务生成已完成，防止后续调用
              taskGenerationStarted.current = true;
              initialLoadCompleted.current = true;
              
              // 清除数据库标记
              sessionStorage.removeItem('fromDatabase');
              sessionStorage.removeItem('taskCache');
            } else {
              console.log('🆕 检测到新课程，需要生成任务:', {
                fromDatabase: fromDatabase,
                hasSavedTaskCache: !!savedTaskCache,
                taskGenerationStarted: taskGenerationStarted.current
              });
              
              // 启动并行任务生成（防止重复执行）
              if (!taskGenerationStarted.current) {
                console.log('🚀 启动并行任务生成...');
                taskGenerationStarted.current = true;
                initialLoadCompleted.current = true;
                generateAllTasks(plan);
              } else {
                console.log('⚠️ 任务生成已经启动，跳过重复执行');
              }
            }
            
          } catch (error) {
            console.error('解析学习计划失败:', error);
          }
        }
      }
    };
    resolveParams();
  }, [params]);

  // 并行生成所有步骤的任务
  const generateAllTasks = async (plan: LearningPlan) => {
    console.log('\n=== 🚀 开始顺序触发并行任务生成 ===');
    console.log('总步骤数:', plan.plan.length);
    
    // 初始化状态
    const initialStatus: Record<number, 'pending' | 'loading' | 'completed' | 'failed'> = {};
    plan.plan.forEach(step => {
      initialStatus[step.step] = 'loading';
    });
    setTaskGenerationStatus(initialStatus);
    
    // 使用带延时的循环来按顺序触发，但请求本身是并行执行的
    for (const step of plan.plan) {
      console.log(`📤 触发步骤 ${step.step} 的任务生成: ${step.title}`);
      
      // 立即执行异步任务，不等待它完成
      (async () => {
        try {
          console.log(`🔄 开始生成步骤 ${step.step}: ${step.title}`);
          
          // 构造正确的请求数据格式
          const requestData = {
            step: step.step,
            title: step.title,
            description: step.description,
            animation_type: step.animation_type || '无',
            status: step.status,
            type: step.type,
            difficulty: step.difficulty,
            search_keyword: step.search_keyword || step.title, // 如果没有search_keyword就用title
            videos: step.videos
          };
          
          console.log('📤 发送任务生成请求:', requestData);
          
          const response = await fetch('/api/task/generate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData),
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const result = await response.json();
          
          // 详细的调试信息
          console.log(`🔍 步骤 ${step.step} API 返回结果:`, {
            success: result.success,
            taskType: result.task?.type,
            ppt_slide: {
              exists: !!result.task?.ppt_slide,
              type: typeof result.task?.ppt_slide,
              isString: typeof result.task?.ppt_slide === 'string',
              length: result.task?.ppt_slide?.length || 0,
              preview: typeof result.task?.ppt_slide === 'string' 
                ? result.task.ppt_slide.substring(0, 100) + '...'
                : result.task?.ppt_slide,
              fullContent: result.task?.ppt_slide
            },
            task: result.task?.task ? {
              exists: true,
              type: typeof result.task.task,
              keys: Object.keys(result.task.task || {})
            } : { exists: false },
            questions: result.task?.questions ? {
              exists: true,
              type: typeof result.task.questions,
              length: Array.isArray(result.task.questions) ? result.task.questions.length : 'not array'
            } : { exists: false }
          });

          if (result.success) {
            console.log(`✅ 步骤 ${step.step} 生成成功`);
            
            // 更新缓存
            setTaskCache(prev => ({
              ...prev,
              [step.step]: result.task
            }));
            
            // 更新状态
            setTaskGenerationStatus(prev => ({
              ...prev,
              [step.step]: 'completed'
            }));
            
            console.log(`💾 步骤 ${step.step} 已缓存:`, {
              type: result.task.type,
              hasMarkdownContent: !!result.task.ppt_slide,
              hasQuestions: !!result.task.questions,
              hasTask: !!result.task.task
            });
            
            // 立即检查是否需要更新当前步骤的显示
            setTimeout(() => {
              if (learningPlan?.plan[currentStepIndex]?.step === step.step) {
                console.log(`🎯 任务生成完成，立即更新当前步骤 ${step.step} 的显示`);
                setCurrentTask(result.task);
                setIsLoadingTask(false);
                
                // 如果是编程题，设置初始代码
                if (result.task?.type === 'coding' && result.task.task) {
                  setCodeValue(result.task.task.starter_code || '');
                  console.log('💻 设置编程任务初始代码');
                }
              }
            }, 100);
            
          } else {
            throw new Error('Task generation failed');
          }
        } catch (error) {
          console.error(`❌ 步骤 ${step.step} 生成失败:`, error);
          
          // 更新失败状态
          setTaskGenerationStatus(prev => ({
            ...prev,
            [step.step]: 'failed'
          }));
        }
      })();
      
      // 等待2秒再触发下一个
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('�� 所有任务生成请求已按顺序触发 ===\n');
  };

  // 获取当前步骤的任务（从缓存）
  const getCurrentStepTask = () => {
    if (!learningPlan) return null;
    
    const currentStep = learningPlan.plan[currentStepIndex];
    if (!currentStep) return null;
    
    const cachedTask = taskCache[currentStep.step];
    const status = taskGenerationStatus[currentStep.step];
    
    console.log(`📋 检查步骤 ${currentStep.step} 任务:`, { 
      hasCached: !!cachedTask, 
      status 
    });
    
    return cachedTask || null;
  };

  // 开始轮询指定步骤的任务
  const startPollingForTask = (stepNumber: number) => {
    console.log(`🔄 开始轮询步骤 ${stepNumber} 的任务`);
    
    // 清除之前的轮询
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
    
    const interval = setInterval(() => {
      const cachedTask = taskCache[stepNumber];
      const status = taskGenerationStatus[stepNumber];
      
      console.log(`⏰ 轮询检查步骤 ${stepNumber}:`, { hasCached: !!cachedTask, status });
      
      if (cachedTask && status === 'completed') {
        console.log(`✅ 步骤 ${stepNumber} 任务已准备就绪`);
        clearInterval(interval);
        setPollingInterval(null);
        
        // 如果是当前步骤，更新显示
        if (learningPlan?.plan[currentStepIndex]?.step === stepNumber) {
          console.log(`🎯 更新当前步骤 ${stepNumber} 的显示`);
          setCurrentTask(cachedTask);
          setIsLoadingTask(false);
          
          // 如果是编程题，设置初始代码
          if (cachedTask?.type === 'coding' && cachedTask.task) {
            setCodeValue(cachedTask.task.starter_code || '');
            console.log('💻 设置编程任务初始代码');
          }
        }
      } else if (status === 'failed') {
        console.log(`❌ 步骤 ${stepNumber} 生成失败，停止轮询`);
        clearInterval(interval);
        setPollingInterval(null);
        setIsLoadingTask(false);
        
        // 设置错误状态
        if (learningPlan?.plan[currentStepIndex]?.step === stepNumber) {
          setCurrentTask({
            type: 'quiz',
            difficulty: 'beginner',
            ppt_slide: '# 任务生成失败\n\n⚠️ 任务生成失败，请稍后重试',
            videos: []
          });
        }
      }
    }, 1000); // 每秒检查一次
    
    setPollingInterval(interval);
  };

  // 当切换步骤时生成任务
  useEffect(() => {
    console.log('\n=== 🔄 步骤切换 ===');
    console.log('routeParams?.id:', routeParams?.id);
    console.log('learningPlan存在:', !!learningPlan);
    console.log('currentStepIndex:', currentStepIndex);
    console.log('当前步骤存在:', !!learningPlan?.plan[currentStepIndex]);
    
    // 清除之前的轮询
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    
    if (routeParams?.id === 'custom' && learningPlan && learningPlan.plan[currentStepIndex]) {
      const currentStep = learningPlan.plan[currentStepIndex];
      console.log(`🎯 切换到步骤 ${currentStep.step}: ${currentStep.title}`);
      
      // 尝试从缓存获取任务
      const cachedTask = getCurrentStepTask();
      const status = taskGenerationStatus[currentStep.step];
      
      if (cachedTask) {
        console.log('✅ 从缓存加载任务');
        setCurrentTask(cachedTask);
        setIsLoadingTask(false);
        
        // 如果是编程题，设置初始代码
        if (cachedTask.type === 'coding' && cachedTask.task) {
          setCodeValue(cachedTask.task.starter_code || '');
        }
      } else if (status === 'loading') {
        console.log('⏳ 任务还在生成中，开始轮询');
        setCurrentTask(null);
        setIsLoadingTask(true);
        startPollingForTask(currentStep.step);
      } else if (status === 'failed') {
        console.log('❌ 任务生成失败');
        setCurrentTask({
          type: 'quiz',
          difficulty: 'beginner',
          ppt_slide: '# 任务生成失败\n\n⚠️ 任务生成失败，请稍后重试',
          videos: currentStep.videos
        });
        setIsLoadingTask(false);
      } else {
        // 检查是否从数据库加载
        if (isFromDatabase) {
          console.log('📁 从数据库加载的课程，任务应该已存在，但未找到缓存');
          setCurrentTask({
            type: 'quiz',
            difficulty: 'beginner',
            ppt_slide: '# Task Data Missing\n\n⚠️ Task data may have issues, please re-upload the course',
            videos: currentStep.videos
          });
          setIsLoadingTask(false);
        } else {
          console.log('⏳ 任务还未开始生成，等待');
          setCurrentTask(null);
          setIsLoadingTask(true);
          startPollingForTask(currentStep.step);
        }
      }
    } else {
      console.log('❌ 条件不满足，跳过任务获取');
      if (routeParams?.id !== 'custom') {
        console.log('- 不是custom课程');
      }
      if (!learningPlan) {
        console.log('- 学习计划未加载');
      }
      if (!learningPlan?.plan[currentStepIndex]) {
        console.log('- 当前步骤不存在');
      }
    }
    
    // 重置答题状态
    setSelectedAnswers({});
    setWrongAnswers(new Set());
    setHasSubmitted(false);
    setAiRecommendations([]);
    setCodeValue('');
    setCodeOutput('');
    setCurrentVideoIndex(0); // 重置视频索引
    console.log('=== 步骤切换完成 ===\n');
  }, [currentStepIndex, learningPlan, routeParams]);

  // 清理轮询
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        console.log('🧹 清理轮询定时器');
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  // 键盘事件监听 - 支持ESC键退出视频放大
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isVideoExpanded) {
        setIsVideoExpanded(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isVideoExpanded]);

  // 监听任务缓存变化，实时更新当前步骤的任务
  useEffect(() => {
    if (!learningPlan || !learningPlan.plan[currentStepIndex]) return;
    
    const currentStep = learningPlan.plan[currentStepIndex];
    const cachedTask = taskCache[currentStep.step];
    
    if (cachedTask && (!currentTask || isLoadingTask)) {
      console.log(`🎯 缓存更新，立即显示步骤 ${currentStep.step} 的任务`);
      setCurrentTask(cachedTask);
      setIsLoadingTask(false);
      
      // 如果是编程题，设置初始代码
      if (cachedTask.type === 'coding' && cachedTask.task) {
        setCodeValue(cachedTask.task.starter_code || '');
        console.log('💻 从缓存设置编程任务初始代码');
      }
      
      // 清除轮询
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
    }
  }, [taskCache, currentStepIndex, learningPlan, currentTask, isLoadingTask, pollingInterval]);

  // 处理答案选择
  const handleAnswerSelect = (questionIndex: number, answer: string) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionIndex]: answer
    }));
  };

  // 处理提交答案
  const handleSubmitAnswers = async () => {
    if (!currentTask) return;
    
    try {
      let evaluationResponse;
      
      if (currentTask.type === 'quiz') {
        if (!currentTask.questions) return;
        
        // 准备评估请求数据
        const evaluationData = {
          task_type: 'quiz',
          submission: currentTask.questions.map((_, index) => selectedAnswers[index] || ''),
          task_data: {
            questions: currentTask.questions.map(q => ({
              question: q.question,
              answer: q.answer
            }))
          }
        };
        
        console.log('📤 提交quiz评估请求:', evaluationData);
        
        // 调用评估API
        const response = await fetch('/api/task/evaluate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(evaluationData)
        });
        
        if (!response.ok) {
          throw new Error(`评估API请求失败: ${response.status}`);
        }
        
        evaluationResponse = await response.json();
        console.log('📥 收到quiz评估结果:', evaluationResponse);
        
        // 处理评估结果
        const newWrongAnswers = new Set<number>();
        let allCorrect = evaluationResponse.is_correct;
        
        if (!allCorrect && evaluationResponse.incorrect_indices) {
          evaluationResponse.incorrect_indices.forEach((index: number) => {
            newWrongAnswers.add(index);
          });
        }
        
        setWrongAnswers(newWrongAnswers);
        setHasSubmitted(true);
        
        if (allCorrect) {
          // 答对了，切换到下一个步骤
          setTimeout(() => {
            if (currentStepIndex < (learningPlan?.plan.length || defaultLearningSteps.length) - 1) {
              setCurrentStepIndex(currentStepIndex + 1);
            }
          }, 1500);
        } else {
          // 答错了，调用问题推荐API
          try {
            const suggestData = {
              task_title: extractTitleFromMarkdown(currentTask.ppt_slide || ''),
              task_description: currentTask.ppt_slide || '',
              user_submission: currentTask.questions.map((_, index) => selectedAnswers[index] || '').join(', '),
              error_reason: evaluationResponse.error_reason || '部分答案错误'
            };
            
            console.log('📤 请求问题推荐:', suggestData);
            
            const suggestResponse = await fetch('/api/ai/suggest_questions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(suggestData)
            });
            
            if (suggestResponse.ok) {
              const suggestResult = await suggestResponse.json();
              console.log('📥 收到问题推荐:', suggestResult);
              
              if (suggestResult.questions && Array.isArray(suggestResult.questions)) {
                setAiRecommendations(suggestResult.questions.slice(0, 3)); // 最多3个问题
              } else {
                // 使用默认推荐
                setAiRecommendations([
                  "什么是强化学习中的奖励函数？它如何影响智能体的行为？",
                  "智能体如何在探索（exploration）和利用（exploitation）之间取得平衡？",
                  "强化学习与监督学习的主要区别是什么？"
                ]);
              }
            } else {
              throw new Error('问题推荐API调用失败');
            }
          } catch (suggestError) {
            console.error('🚨 问题推荐API调用失败:', suggestError);
            // 使用默认推荐
            setAiRecommendations([
              "什么是强化学习中的奖励函数？它如何影响智能体的行为？",
              "智能体如何在探索（exploration）和利用（exploitation）之间取得平衡？",
              "强化学习与监督学习的主要区别是什么？"
            ]);
          }
          
          // 重置提交状态，允许重新选择和提交
          setTimeout(() => {
            setHasSubmitted(false);
            setWrongAnswers(new Set());
          }, 2000);
        }
        
      } else if (currentTask.type === 'coding') {
        // 编程题评估
        const evaluationData = {
          task_type: 'coding',
          submission: codeValue,
          task_data: {
            task: currentTask.task
          }
        };
        
        console.log('📤 提交coding评估请求:', evaluationData);
        
        // 调用评估API
        const response = await fetch('/api/task/evaluate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(evaluationData)
        });
        
        if (!response.ok) {
          throw new Error(`评估API请求失败: ${response.status}`);
        }
        
        evaluationResponse = await response.json();
        console.log('📥 收到coding评估结果:', evaluationResponse);
        
        setHasSubmitted(true);
        
        if (evaluationResponse.is_correct) {
          // 代码正确，切换到下一个步骤
          setTimeout(() => {
            if (currentStepIndex < (learningPlan?.plan.length || defaultLearningSteps.length) - 1) {
              setCurrentStepIndex(currentStepIndex + 1);
            }
          }, 1500);
        } else {
          // 代码错误，显示反馈
          setCodeOutput(evaluationResponse.feedback || '代码存在问题，请检查');
          
          // 调用问题推荐API
          try {
            const suggestData = {
              task_title: currentTask.task?.title || 'Coding Task',
              task_description: currentTask.task?.description || '',
              user_submission: codeValue,
              error_reason: evaluationResponse.feedback || '代码实现错误'
            };
            
            console.log('📤 请求编程题问题推荐:', suggestData);
            
            const suggestResponse = await fetch('/api/ai/suggest_questions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(suggestData)
            });
            
            if (suggestResponse.ok) {
              const suggestResult = await suggestResponse.json();
              console.log('📥 收到编程题问题推荐:', suggestResult);
              
              if (suggestResult.questions && Array.isArray(suggestResult.questions)) {
                setAiRecommendations(suggestResult.questions.slice(0, 3)); // 最多3个问题
              } else {
                // 使用默认推荐
                setAiRecommendations([
                  "编程语法有什么问题吗？",
                  "逻辑实现是否正确？", 
                  "有什么更好的解决方案？"
                ]);
              }
            } else {
              throw new Error('问题推荐API调用失败');
            }
          } catch (suggestError) {
            console.error('🚨 编程题问题推荐API调用失败:', suggestError);
            // 使用默认推荐
            setAiRecommendations([
              "编程语法有什么问题吗？",
              "逻辑实现是否正确？", 
              "有什么更好的解决方案？"
            ]);
          }
          
          // 重置提交状态，允许重新提交
          setTimeout(() => {
            setHasSubmitted(false);
          }, 2000);
        }
      }
      
    } catch (error) {
      console.error('🚨 评估API调用失败:', error);
      // 降级到原来的本地逻辑
      if (currentTask.type === 'quiz' && currentTask.questions) {
        const questions = currentTask.questions;
        const newWrongAnswers = new Set<number>();
        let allCorrect = true;

        questions.forEach((question, index) => {
          const selectedAnswer = selectedAnswers[index];
          const correctAnswer = question.answer;
          
          if (selectedAnswer !== correctAnswer) {
            newWrongAnswers.add(index);
            allCorrect = false;
          }
        });

        setWrongAnswers(newWrongAnswers);
        setHasSubmitted(true);

        if (allCorrect) {
          setTimeout(() => {
            if (currentStepIndex < (learningPlan?.plan.length || defaultLearningSteps.length) - 1) {
              setCurrentStepIndex(currentStepIndex + 1);
            }
          }, 1500);
        } else {
          const recommendations = [
            "什么是强化学习中的奖励函数？它如何影响智能体的行为？",
            "智能体如何在探索（exploration）和利用（exploitation）之间取得平衡？",
            "强化学习与监督学习的主要区别是什么？"
          ];
          setAiRecommendations(recommendations);
          setTimeout(() => {
            setHasSubmitted(false);
            setWrongAnswers(new Set());
          }, 2000);
        }
      }
    }
  };

  // 从markdown内容中提取标题的工具函数
  const extractTitleFromMarkdown = (markdown: string): string => {
    const lines = markdown.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('# ')) {
        return trimmed.replace(/^#\s*/, '');
      }
    }
    return 'Learning Task';
  };

  // 使用默认步骤数据（非custom课程）
  const defaultLearningSteps = [
    {
      id: 'step-1',
      title: '理解强化学习基础概念',
      description: '学习智能体、环境、状态、动作、奖励等核心概念',
      status: 'completed' as const,
      estimatedTime: '2小时',
      type: 'theory'
    },
    {
      id: 'step-2',
      title: 'Q-Learning算法原理',
      description: '深入理解Q-Learning的数学原理和更新规则',
      status: 'completed' as const,
      estimatedTime: '3小时',
      type: 'theory'
    },
    {
      id: 'step-3',
      title: '实现简单的Q-Learning算法',
      description: '使用Python从零实现Q-Learning算法',
      status: 'current' as const,
      estimatedTime: '2小时',
      type: 'practice'
    },
    {
      id: 'step-4',
      title: '设计迷宫环境',
      description: '创建一个网格世界迷宫作为训练环境',
      status: 'pending' as const,
      estimatedTime: '2小时',
      type: 'practice'
    },
    {
      id: 'step-5',
      title: '训练智能体寻找最优路径',
      description: '在迷宫环境中训练智能体学习最优策略',
      status: 'pending' as const,
      estimatedTime: '4小时',
      type: 'practice'
    },
    {
      id: 'step-6',
      title: '可视化学习过程',
      description: '实现训练过程的可视化和结果展示',
      status: 'pending' as const,
      estimatedTime: '3小时',
      type: 'practice'
    }
  ];

  // 获取当前使用的步骤数据
  const getStepsData = () => {
    if (routeParams?.id === 'custom' && learningPlan) {
      return learningPlan.plan.map((step, index) => ({
        id: `step-${step.step}`,
        title: step.title,
        description: step.description,
        status: index < currentStepIndex ? 'completed' : 
                index === currentStepIndex ? 'current' : 'pending',
        estimatedTime: step.videos[0]?.duration || '估算中',
        type: step.type === 'coding' ? 'practice' : 'theory'
      }));
    }
    return defaultLearningSteps;
  };

  const learningSteps = getStepsData();
  const currentStep = learningSteps[currentStepIndex];

  if (!routeParams) {
    return <div className="h-[calc(100vh-4rem)] flex items-center justify-center">Loading...</div>;
  }

  // 获取当前视频URL
  const getCurrentVideoUrl = () => {
    if (routeParams?.id === 'custom' && learningPlan && learningPlan.plan[currentStepIndex]) {
      const step = learningPlan.plan[currentStepIndex];
      const videoUrl = step.videos[0]?.url || '';
      
      console.log('原始视频URL:', videoUrl);
      
      // 使用统一的视频URL处理函数
      const processedVideo = processVideoUrl(videoUrl);
      return processedVideo.url;
    }
    return '';
  };

  // 获取当前步骤的所有视频
  const getCurrentStepVideos = () => {
    if (routeParams?.id === 'custom' && learningPlan && learningPlan.plan[currentStepIndex]) {
      const step = learningPlan.plan[currentStepIndex];
      return step.videos || [];
    }
    return [];
  };

  // 处理视频URL转换
  const processVideoUrl = (videoUrl: string) => {
    console.log('处理视频URL:', videoUrl);
    
    // 开发环境下，在window对象上暴露测试函数
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      (window as any).testVideoUrl = (testUrl: string) => {
        console.log('测试视频URL处理:', testUrl);
        return processVideoUrl(testUrl);
      };
    }
    
    // 处理B站视频URL
    if (videoUrl.includes('bilibili.com/video/')) {
      // 从URL中提取视频ID，支持不同格式
      const bvMatch = videoUrl.match(/\/video\/(BV\w+)/);
      const avMatch = videoUrl.match(/\/video\/av(\d+)/);
      
      if (bvMatch) {
        // BV号格式
        const playerUrl = `//player.bilibili.com/player.html?bvid=${bvMatch[1]}&page=1&as_wide=1&high_quality=1&danmaku=0&autoplay=0`;
        console.log('转换后的BV播放器URL:', playerUrl);
        return { url: playerUrl, platform: 'bilibili' };
      } else if (avMatch) {
        // AV号格式
        const playerUrl = `//player.bilibili.com/player.html?aid=${avMatch[1]}&page=1&as_wide=1&high_quality=1&danmaku=0&autoplay=0`;
        console.log('转换后的AV播放器URL:', playerUrl);
        return { url: playerUrl, platform: 'bilibili' };
      }
    }
    
    // 处理YouTube视频URL
    if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
      let videoId = '';
      
      console.log('检测到YouTube URL，开始处理:', videoUrl);
      
      // 各种YouTube URL格式
      // 标准格式: https://www.youtube.com/watch?v=VIDEO_ID
      // 短链接: https://youtu.be/VIDEO_ID
      // 移动版: https://m.youtube.com/watch?v=VIDEO_ID
      // 嵌入格式: https://www.youtube.com/embed/VIDEO_ID
      const youtubePatterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|m\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/
      ];
      
      for (const pattern of youtubePatterns) {
        const match = videoUrl.match(pattern);
        if (match) {
          videoId = match[1];
          console.log('成功提取YouTube视频ID:', videoId);
          break;
        }
      }
      
      if (videoId) {
        const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=0&mute=0&controls=1&showinfo=0&rel=0&modestbranding=1&playsinline=1&enablejsapi=1`;
        console.log('转换后的YouTube嵌入URL:', embedUrl);
        return { url: embedUrl, platform: 'youtube' };
      } else {
        console.warn('无法从YouTube URL中提取视频ID:', videoUrl);
      }
    }
    
    // 检查是否已经是嵌入格式的URL
    if (videoUrl.includes('player.bilibili.com')) {
      console.log('已是B站播放器URL，直接使用:', videoUrl);
      return { url: videoUrl, platform: 'bilibili' };
    }
    
    if (videoUrl.includes('youtube.com/embed/')) {
      console.log('已是YouTube嵌入URL，直接使用:', videoUrl);
      return { url: videoUrl, platform: 'youtube' };
    }
    
    console.log('无法识别的视频URL格式:', videoUrl);
    return { url: videoUrl, platform: 'unknown' };
  };

  // 上传课程到数据库
  const handleUploadCourse = async () => {
    if (!learningPlan) {
      alert('学习计划不存在，无法上传。');
      return;
    }

    try {
      setIsUploading(true);
      console.log('📤 开始上传课程到数据库...');
      
      // 构造上传数据，包含课程计划和生成的任务
      const uploadData = {
        plan: learningPlan,
        tasks: taskCache
      };

      const response = await fetch('/api/user-courses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(uploadData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ 课程上传成功:', result);
      
      alert('🎉 课程已成功上传到【我的课程】！');
      
    } catch (error) {
      console.error('❌ 课程上传失败:', error);
      alert('❌ 课程上传失败，请稍后重试。');
    } finally {
      setIsUploading(false);
    }
  };

  // 检查所有任务是否已生成
  const areAllTasksGenerated = () => {
    if (!learningPlan) return false;
    return learningPlan.plan.every(step => taskGenerationStatus[step.step] === 'completed');
  };

  // 获取已生成的任务数量
  const getGeneratedTasksCount = () => {
    if (!learningPlan) return 0;
    return learningPlan.plan.filter(step => taskGenerationStatus[step.step] === 'completed').length;
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
      <div className={`${isPathCollapsed ? 'w-16' : 'w-1/6'} transition-all duration-300 relative`}>
        <div className="h-full flex flex-col">
          {!isPathCollapsed && (
            <>
              <div className="flex-1 overflow-y-auto px-4 pt-4">
                <div className="space-y-2">
                  {learningSteps.map((step, index) => (
                    <div
                      key={step.id}
                      onClick={() => setCurrentStepIndex(index)}
                      className="flex items-start space-x-3 py-2 cursor-pointer hover:bg-blue-50/50 rounded transition-colors"
                    >
                      <div className="flex-shrink-0 mt-1">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transform ${
                          index < currentStepIndex 
                            ? 'bg-green-400 text-white border-green-400 rotate-12' 
                            : index === currentStepIndex 
                            ? 'bg-blue-400 text-white border-blue-400 -rotate-12' 
                            : 'bg-gray-200 text-gray-600 border-gray-300 rotate-6'
                        }`}>
                          {index + 1}
              </div>
            </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className={`text-base font-bold ${
                            index === currentStepIndex ? 'text-blue-700' : 
                            index < currentStepIndex ? 'text-green-700' :
                            'text-gray-700'
                          }`} style={{
                            fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                          }}>
                            {step.title}
                          </h4>
                          <span className={`px-2 py-1 rounded text-xs transform rotate-3 ${
                            step.type === 'theory' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                          }`} style={{
                            fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                          }}>
                            {step.type === 'theory' ? 'Theory' : 'Practice'}
                          </span>
                          
                          {/* 任务生成状态指示器 */}
                          {routeParams?.id === 'custom' && learningPlan && (
                            <div className="ml-2">
                              {(() => {
                                const stepNumber = learningPlan.plan[index]?.step;
                                const status = taskGenerationStatus[stepNumber];
                                const hasTask = !!taskCache[stepNumber];
                                
                                if (hasTask || status === 'completed') {
                                  return <span className="text-green-500 text-xs">✅</span>;
                                } else if (status === 'loading') {
                                  return (
                                    <div className="animate-spin w-3 h-3 border border-blue-500 border-t-transparent rounded-full"></div>
                                  );
                                } else if (status === 'failed') {
                                  return <span className="text-red-500 text-xs">❌</span>;
                                } else {
                                  return <span className="text-gray-400 text-xs">⏳</span>;
                                }
                              })()}
                            </div>
                          )}
              </div>
            </div>
          </div>
                  ))}
        </div>
      </div>
              
              {/* 上传课程按钮 */}
              {routeParams?.id === 'custom' && learningPlan && (
                <div className="p-4">
                  <Button
                    onClick={handleUploadCourse}
                    disabled={!areAllTasksGenerated() || isUploading}
                    className={`w-full font-bold transform shadow-lg ${
                      areAllTasksGenerated() && !isUploading 
                        ? 'bg-primary hover:bg-primary/90 rotate-1 hover:rotate-0' 
                        : 'bg-gray-400 hover:bg-gray-400 cursor-not-allowed rotate-0'
                    }`}
                    style={{
                      fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                    }}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      {isUploading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Uploading Course...</span>
                        </>
                      ) : areAllTasksGenerated() ? (
                        <>
                          <span className="text-lg">📤</span>
                          <span>Upload Course!</span>
                        </>
                      ) : (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Generating Tasks... ({getGeneratedTasksCount()}/{learningPlan.plan.length})</span>
                        </>
                      )}
                    </div>
                  </Button>
                </div>
              )}
            </>
          )}
          
          {isPathCollapsed && (
            <div className="flex flex-col items-center space-y-2 p-2">
                {learningSteps.map((step, index) => (
                  <div
                    key={step.id}
                  onClick={() => setCurrentStepIndex(index)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2 cursor-pointer transform ${
                    index === currentStepIndex
                      ? 'bg-blue-500 text-white border-blue-500 -rotate-12'
                      : index < currentStepIndex
                      ? 'bg-blue-400 text-white border-blue-400 rotate-12'
                      : 'bg-gray-100 text-gray-600 border-gray-300 rotate-6'
                  }`}
                  title={step.title}
                >
                  {index + 1}
                </div>
              ))}
            </div>
                      )}
                    </div>
        
        <div className="absolute right-0 top-0 h-full w-px border-r-2 border-dashed border-blue-200"></div>
        
        <button
          onClick={() => setIsPathCollapsed(!isPathCollapsed)}
          className="absolute -right-2 top-1/2 transform -translate-y-1/2 w-4 h-8 bg-gray-200 hover:bg-gray-300 border rounded-r-md flex items-center justify-center transition-colors z-10"
        >
          {isPathCollapsed ? (
            <ChevronRight className="w-3 h-3" />
          ) : (
            <ChevronLeft className="w-3 h-3" />
          )}
        </button>
      </div>

      <div className={`${isPathCollapsed ? 'w-3/4' : 'w-7/12'} transition-all duration-300`}>
        <div className="h-full flex flex-col">
          {/* 合并的内容区域 */}
          <div className="h-full p-6 overflow-y-auto">
            {isLoadingTask ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-lg text-gray-700">Generating learning tasks...</p>
                  
                  {/* 调试信息 - 仅在开发环境显示 */}
                  {process.env.NODE_ENV === 'development' && learningPlan && (
                    <div className="mt-4 text-sm text-gray-500">
                      <p>Current Step: {learningPlan.plan[currentStepIndex]?.step}</p>
                      <p>Status: {taskGenerationStatus[learningPlan.plan[currentStepIndex]?.step]}</p>
                      <p>Cached: {taskCache[learningPlan.plan[currentStepIndex]?.step] ? 'Yes' : 'No'}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : currentTask ? (
              <div className="space-y-12">
                {/* PPT 标题和内容 */}
                <div className="space-y-4">
                  <ReactMarkdown 
                    components={{
                      h1: ({ children, ...props }) => (
                        <h1 className="text-3xl font-bold text-center text-blue-700 relative mb-8" {...props}>
                          <span className="bg-yellow-200 px-3 py-1 rounded-lg inline-block transform -rotate-1 shadow-sm">
                            {children}
                          </span>
                        </h1>
                      ),
                      h2: ({ children, ...props }) => (
                        <h2 className="text-xl font-bold text-blue-700 mb-6 mt-8" style={{
                          fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                        }} {...props}>
                          {children}
                        </h2>
                      ),
                      h3: ({ children, ...props }) => (
                        <h3 className="text-lg font-bold text-purple-700 mb-5 mt-7" style={{
                          fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                        }} {...props}>
                          {children}
                        </h3>
                      ),
                      p: ({ children, ...props }) => (
                        <div className="flex items-start space-x-3 mb-8 ml-6">
                          <div className="w-6 h-6 rounded-full bg-yellow-400 text-black text-sm font-bold flex items-center justify-center mt-1 transform rotate-12 shadow-sm">
                            📝
                          </div>
                          <div className="flex-1">
                            <p className="text-base leading-loose text-gray-800 font-bold" style={{
                              fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                            }} {...props}>
                              {children}
                            </p>
                          </div>
                        </div>
                      ),
                      ul: ({ children, ...props }) => (
                        <div className="flex items-start space-x-3 mb-8 ml-6">
                          <div className="w-6 h-6 rounded-full bg-blue-400 text-white text-sm font-bold flex items-center justify-center mt-1 transform rotate-12 shadow-sm">
                            📋
                          </div>
                          <div className="flex-1">
                            <ul className="list-disc list-inside text-gray-800 space-y-4" style={{
                              fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                            }} {...props}>
                              {children}
                            </ul>
                          </div>
                        </div>
                      ),
                      ol: ({ children, ...props }) => (
                        <div className="flex items-start space-x-3 mb-8 ml-6">
                          <div className="w-6 h-6 rounded-full bg-purple-400 text-white text-sm font-bold flex items-center justify-center mt-1 transform rotate-12 shadow-sm">
                            🔢
                          </div>
                          <div className="flex-1">
                            <ol className="list-decimal list-inside text-gray-800 space-y-4" style={{
                              fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                            }} {...props}>
                              {children}
                            </ol>
                          </div>
                        </div>
                      ),
                      li: ({ children, ...props }) => (
                        <li className="text-base text-gray-800 leading-loose" style={{
                          fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                        }} {...props}>
                          {children}
                        </li>
                      ),
                      strong: ({ children, ...props }) => (
                        <strong className="text-gray-900 font-bold mx-1" {...props}>{children}</strong>
                      ),
                      em: ({ children, ...props }) => (
                        <em className="text-gray-700 italic mx-1" {...props}>{children}</em>
                      ),
                      code: ({ children, ...props }) => (
                        <code className="bg-gray-200 text-gray-800 px-2 py-1 rounded font-mono text-sm" {...props}>
                          {children}
                        </code>
                      ),
                      pre: ({ children, ...props }) => (
                        <div className="flex items-start space-x-3 mb-8 ml-6">
                          <div className="w-6 h-6 rounded-full bg-green-400 text-white text-sm font-bold flex items-center justify-center mt-1 transform rotate-12 shadow-sm">
                            💻
                          </div>
                          <div className="flex-1">
                            <pre className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto" {...props}>
                              {children}
                            </pre>
                          </div>
                        </div>
                      ),
                      blockquote: ({ children, ...props }) => (
                        <div className="flex items-start space-x-3 mb-8 ml-6">
                          <div className="w-6 h-6 rounded-full bg-orange-400 text-white text-sm font-bold flex items-center justify-center mt-1 transform rotate-12 shadow-sm">
                            💡
                          </div>
                          <div className="flex-1">
                            <blockquote className="bg-orange-50 text-gray-800 p-3 rounded-lg italic border-l-4 border-orange-400" style={{
                              fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                            }} {...props}>
                              {children}
                            </blockquote>
                          </div>
                        </div>
                      ),
                    }}
                  >
                    {currentTask.ppt_slide || ''}
                  </ReactMarkdown>
                 </div>

                {/* 推荐视频区域 */}
                {getCurrentStepVideos().length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-xl font-bold text-blue-700" style={{
                      fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                    }}>
                      Recommended Videos:
                    </h4>
                    
                    <div className="relative">
                      {/* 单个视频显示 - 支持简单放大 */}
                      {getCurrentStepVideos()[currentVideoIndex] && (
                        <div className={`${isVideoExpanded ? 'w-[768px]' : 'w-96'} relative group transition-all duration-300`}>
                          <div className="bg-white p-2 rounded-lg shadow-lg">
                            <div className="w-full aspect-video rounded-lg overflow-hidden shadow-md bg-black relative transition-all duration-300">
                              {(() => {
                                const processedVideo = processVideoUrl(getCurrentStepVideos()[currentVideoIndex].url);
                                const { url, platform } = processedVideo;
                                
                                // 只有YouTube视频使用iframe嵌入
                                if (platform === 'youtube') {
                                  return (
                                    <iframe 
                                      src={url}
                                      frameBorder="0"
                                      allowFullScreen={true}
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                      className="w-full h-full"
                                      onError={(e) => {
                                        console.error(`YouTube视频播放器加载失败:`, e);
                                      }}
                                      onLoad={() => {
                                        console.log('YouTube视频加载成功:', url);
                                      }}
                                    />
                                  );
                                } else if (platform === 'bilibili') {
                                  // B站视频显示预览图和播放按钮，点击跳转到新窗口
                                  const video = getCurrentStepVideos()[currentVideoIndex];
                                  return (
                                    <div 
                                      className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-800 cursor-pointer hover:from-blue-700 hover:to-blue-900 transition-all duration-300"
                                      onClick={() => {
                                        // 使用原始URL在新窗口打开B站视频
                                        window.open(video.url, '_blank', 'noopener,noreferrer');
                                      }}
                                    >
                                      <div className="text-center text-white">
                                        {video.cover ? (
                                          <div className="relative">
                                            <img 
                                              src={video.cover} 
                                              alt={video.title}
                                              className="w-full h-full object-cover rounded-lg opacity-80"
                                              onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                              }}
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 rounded-lg">
                                              <div className="text-center">
                                                <PlayCircle className="w-16 h-16 mx-auto mb-2 text-white opacity-90 hover:opacity-100 transition-opacity" />
                                                <p className="text-sm font-medium">点击观看 Bilibili 视频</p>
                                                <p className="text-xs opacity-75 mt-1">将在新窗口打开</p>
                                              </div>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="text-center">
                                            <PlayCircle className="w-16 h-16 mx-auto mb-4 text-white opacity-90 hover:opacity-100 transition-opacity" />
                                            <p className="text-lg font-medium mb-2">Bilibili Video</p>
                                            <p className="text-sm opacity-75 mb-1">点击观看视频</p>
                                            <p className="text-xs opacity-60">将在新窗口打开</p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                } else {
                                  // 无法识别的视频格式
                                  return (
                                    <div className="w-full h-full flex items-center justify-center bg-gray-800 text-white">
                                      <div className="text-center">
                                        <PlayCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm opacity-75">Unsupported video format</p>
                                        <p className="text-xs opacity-50 mt-1 text-yellow-300">
                                          Currently supports: YouTube (embedded), Bilibili (new window)
                                        </p>
                                        <p className="text-xs opacity-50 mt-1 break-all max-w-xs">{url}</p>
                                      </div>
                                    </div>
                                  );
                                }
                              })()}
                              
                              {/* 放大/缩小按钮 */}
                              <button
                                onClick={() => setIsVideoExpanded(!isVideoExpanded)}
                                className="absolute top-2 right-2 bg-black bg-opacity-60 hover:bg-opacity-80 text-white p-2 rounded-lg transition-all duration-300 hover:scale-110"
                                title={isVideoExpanded ? "缩小视频" : "放大视频"}
                              >
                                {isVideoExpanded ? (
                                  <Minimize2 className="w-4 h-4" />
                                ) : (
                                  <Maximize2 className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                            
                            {/* 视频标题 */}
                            <div className="mt-2 px-1">
                              <p className="text-sm font-medium text-gray-700 truncate" style={{
                                fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                              }}>
                                {getCurrentStepVideos()[currentVideoIndex].title}
                              </p>
                              {getCurrentStepVideos()[currentVideoIndex].duration && (
                                <p className="text-xs text-gray-500">
                                  {getCurrentStepVideos()[currentVideoIndex].duration}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* 视频切换按钮 */}
                      {getCurrentStepVideos().length > 1 && (
                        <div className="absolute bottom-4 right-4 z-10">
                          <div className="bg-yellow-100 p-2 rounded-lg shadow-lg transform rotate-3 border-2 border-dashed border-yellow-400">
                            <button
                              onClick={() => {
                                const nextIndex = (currentVideoIndex + 1) % getCurrentStepVideos().length;
                                setCurrentVideoIndex(nextIndex);
                                console.log(`🔄 切换到视频 ${nextIndex + 1}/${getCurrentStepVideos().length}`);
                              }}
                              className="bg-blue-200 hover:bg-blue-300 text-blue-800 w-10 h-10 rounded-full flex items-center justify-center transform hover:rotate-12 transition-all duration-300 shadow-md border-2 border-blue-400 font-bold text-sm"
                              title="切换视频"
                              style={{
                                fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                              }}
                            >
                              🔄
                            </button>
                            <p className="text-xs text-blue-700 text-center mt-1 font-bold transform -rotate-2" style={{
                              fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                            }}>
                              {currentVideoIndex + 1}/{getCurrentStepVideos().length}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 推荐资料区域 */}
                {currentTask?.web_res?.results && currentTask.web_res.results.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-xl font-bold text-blue-700" style={{
                      fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                    }}>
                      Recommended Resources:
                    </h4>
                    
                    <div className="space-y-1">
                      {currentTask.web_res.results.slice(0, 8).map((result, index) => (
                        <div 
                          key={index} 
                          className="group cursor-pointer hover:text-blue-600 transition-colors duration-200"
                          onClick={() => window.open(result.url, '_blank')}
                        >
                          <div className="flex items-center space-x-2">
                            <span className={`text-base font-bold ${
                              index % 3 === 0 ? 'text-blue-500' : 
                              index % 3 === 1 ? 'text-green-500' : 
                              'text-purple-500'
                            }`}>
                              {index + 1}.
                            </span>
                            
                            <h5 className="text-base font-bold text-gray-800 hover:text-blue-600 transition-colors flex-1" style={{
                              fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                            }}>
                              {result.title}
                            </h5>
                            
                            <span className="text-sm">
                              {result.score > 0.9 ? '🔥' :
                               result.score > 0.8 ? '👍' : '📖'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 答题区域 */}
                <div className="space-y-4">
                  {currentTask?.type === 'coding' ? (
                    /* 代码题 */
                    <div className="space-y-4">
                      {currentTask.task && (
                        <>
                          {/* 题目描述 - 使用quiz同款样式 */}
                          <h4 className={`font-bold text-base text-gray-800 border-b-2 border-dashed border-blue-400 pb-2 mb-3`} style={{
                            fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                          }}>
                            <span className="mr-2 text-blue-700">
                              Task:
                            </span>
                            {currentTask.task.description}
                          </h4>
                          
                          <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                            <Editor
                              height="280px"
                              defaultLanguage="python"
                              value={codeValue}
                              onChange={(value: string | undefined) => setCodeValue(value || '')}
                              theme="vs-dark"
                              options={{
                                minimap: { enabled: false },
                                fontSize: 16,
                                fontFamily: '"Fira Code", "JetBrains Mono", "Monaco", "Consolas", monospace',
                                lineNumbers: 'on',
                                wordWrap: 'on',
                                scrollBeyondLastLine: true,
                                automaticLayout: true,
                                tabSize: 4,
                                insertSpaces: true,
                                renderWhitespace: 'selection',
                                renderLineHighlight: 'all',
                                cursorStyle: 'line',
                                cursorBlinking: 'blink',
                                smoothScrolling: true,
                                mouseWheelZoom: true,
                                scrollbar: {
                                  vertical: 'visible',
                                  horizontal: 'visible',
                                  verticalScrollbarSize: 10,
                                  horizontalScrollbarSize: 10
                                },
                                overviewRulerBorder: false,
                                bracketPairColorization: { enabled: true },
                                guides: {
                                  indentation: true,
                                  bracketPairs: true
                                }
                              }}
                            />
                          </div>
                          
                          {codeOutput && (
                            <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm border border-gray-700">
                              <div className="flex items-center mb-2">
                                <span className="text-gray-400">💻 输出结果：</span>
                              </div>
                              <pre className="whitespace-pre-wrap">{codeOutput}</pre>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    /* 选择题 */
                    <div className="space-y-4">
                      {currentTask?.questions?.map((question, qIndex) => (
                        <div key={qIndex} className="space-y-2">
                          <h4 className={`font-bold text-base text-gray-800 border-b-2 border-dashed pb-2 mb-3 ${
                            wrongAnswers.has(qIndex) ? 'border-red-400 text-red-700' : 'border-blue-400'
                          }`} style={{
                            fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                          }}>
                            <span className={`mr-2 ${wrongAnswers.has(qIndex) ? 'text-red-700' : 'text-blue-700'}`}>
                              Question {qIndex + 1}:
                            </span>
                            {question.question}
                          </h4>
                          <div className="grid grid-cols-3 gap-3">
                            {question.options.map((option: string, index: number) => {
                              const stickyStyles = [
                                'bg-sky-50 border-sky-200 transform rotate-1 hover:rotate-0',
                                'bg-slate-50 border-slate-200 transform -rotate-1 hover:rotate-0', 
                                'bg-sky-50 border-sky-200 transform rotate-0.5 hover:rotate-0'
                              ];
                              const shadowStyles = [
                                'shadow-sky-100/50',
                                'shadow-slate-100/50',
                                'shadow-sky-100/50'
                              ];
                              
                              const isSelected = selectedAnswers[qIndex] === option;
                              const isWrongAnswer = hasSubmitted && isSelected && option !== question.answer;
                              
                              return (
                                <label key={index} className={`flex items-center space-x-2 p-3 border-2 rounded-lg cursor-pointer text-sm transition-all duration-300 hover:scale-105 shadow-lg ${
                                  isWrongAnswer ? 'bg-red-200 border-red-400 text-red-800' :
                                  isSelected ? 'ring-2 ring-blue-400' : stickyStyles[index % 3]
                                } ${!isWrongAnswer ? shadowStyles[index % 3] : ''}`}>
                                  <input 
                                    type="radio" 
                                    name={`question-${qIndex}`}
                                    value={option}
                                    checked={isSelected}
                                    onChange={(e) => handleAnswerSelect(qIndex, e.target.value)}
                                    className="text-primary scale-75" 
                                  />
                                  <span className="text-xs leading-tight font-medium" style={{
                                    fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                                  }}>
                                    {String.fromCharCode(65 + index)}. {option}
                                  </span>
                                  {isWrongAnswer && (
                                    <span className="text-red-600 text-sm font-bold">✗</span>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 提交按钮 */}
                <div className="flex justify-end pt-4">
                  {!hasSubmitted ? (
                    <Button 
                      onClick={handleSubmitAnswers}
                      disabled={currentTask?.type === 'quiz' && Object.keys(selectedAnswers).length !== (currentTask?.questions?.length || 0)}
                      className="bg-primary hover:bg-primary/90 transform rotate-1 shadow-lg font-bold"
                      style={{
                        fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                      }}
                    >
                      Submit Answer 🚀
                    </Button>
                  ) : wrongAnswers.size === 0 ? (
                    <div className="text-green-600 font-bold transform rotate-1" style={{
                      fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                    }}>
                      Correct! Switching to the next step... ✨
                    </div>
                  ) : (
                    <Button 
                      onClick={handleSubmitAnswers}
                      disabled={currentTask?.type === 'quiz' && Object.keys(selectedAnswers).length !== (currentTask?.questions?.length || 0)}
                      className="bg-primary hover:bg-primary/90 transform rotate-1 shadow-lg font-bold"
                      style={{
                        fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                      }}
                    >
                      Re-submit 🔄
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <p>暂无内容</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="w-1/4 transition-all duration-300">
        <div className="h-full p-4">
          <div className="h-full rounded-lg border border-gray-200 shadow-sm bg-white/80 backdrop-blur-sm p-4">
            <AIChatInterface 
              className="h-full"
              initialMessage="I am learning Q-Learning algorithm"
              recommendations={aiRecommendations}
              useStudyAPI={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
} 