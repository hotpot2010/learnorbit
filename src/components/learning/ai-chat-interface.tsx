'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bot, Send, User } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { useState, useRef, useEffect, useCallback } from 'react';

// 生成唯一ID的函数，避免冲突
let messageIdCounter = 0;
const generateUniqueId = (): string => {
  messageIdCounter += 1;
  return `${Date.now()}-${messageIdCounter}-${Math.random().toString(36).substr(2, 9)}`;
};

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  type?: 'normal' | 'task-update-suggestion' | 'task-updating' | 'task-updated' | 'task-update-confirm';
  metadata?: {
    suggestion?: string;
    taskUpdateData?: any;
    isProcessing?: boolean;
    showConfirmButtons?: boolean;
    newTaskData?: any;
    originalTaskData?: any;
    showAcceptButtons?: boolean;
  };
}

interface AIChatInterfaceProps {
  className?: string;
  initialMessage?: string;
  onMessageSent?: () => void;
  recommendations?: string[];
  aiResponse?: string;
  useStudyAPI?: boolean;
  userInputFromHome?: string;
  skipDefaultWelcome?: boolean;
  sessionId?: string;
  externalMessage?: string;
  onPlanGeneration?: (updateSteps: number[], reason: string) => void;
  onPlanUpdate?: (plan: any) => void; // 新增：直接更新计划的回调
  onStepUpdate?: (step: any, stepNumber: number, total: number) => void; // 新增：逐步更新步骤的回调
  onIntroductionUpdate?: (introduction: any) => void; // 新增：课程介绍更新回调
  currentTaskData?: any; // 新增：当前任务数据
  onTaskUpdateComplete?: (newTaskData: any) => void; // 新增：任务更新完成回调
  isMobile?: boolean; // 新增：移动端标识
  onTaskUpdateSave?: (newTaskData: any) => void; // 新增：任务更新保存回调
}

export function AIChatInterface({
  className,
  initialMessage,
  onMessageSent,
  recommendations,
  aiResponse,
  useStudyAPI = false,
  userInputFromHome,
  skipDefaultWelcome = false,
  sessionId,
  externalMessage,
  onPlanGeneration,
  onPlanUpdate,
  onStepUpdate,
  onIntroductionUpdate,
  currentTaskData,
  onTaskUpdateComplete,
  onTaskUpdateSave,
  isMobile = false,
}: AIChatInterfaceProps) {
  const t = useTranslations('LearningPlatform');
  const locale = useLocale();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 获取字体样式函数
  const getFontFamily = () => {
    if (isMobile) {
      // 移动端使用更正常的字体
      return 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif';
    } else {
      // 桌面端保持原有的卡通字体
      return '"Comic Sans MS", "Marker Felt", "Kalam", cursive';
    }
  };
  // 移除 isFirstMessage 状态，改用实时计算消息数量
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // 任务更新API调用函数
  const callDetectAPI = async (userMessage: string, sessionId: string, taskData: any) => {
    const response = await fetch('/api/task/update/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_data: taskData,
        user_message: userMessage,
        lang: 'zh',
        chat_id: sessionId
      })
    });
    
    if (!response.ok) {
      throw new Error(`Detect API failed: ${response.status}`);
    }
    
    return await response.json();
  };

  const callExecuteAPI = async (suggestion: string, sessionId: string, taskData: any) => {
    const response = await fetch('/api/task/update/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_data: taskData,
        suggestion: suggestion,
        lang: 'zh',
        chat_id: sessionId
      })
    });
    
    if (!response.ok) {
      throw new Error(`Execute API failed: ${response.status}`);
    }
    
    return await response.json();
  };

  // 初始化欢迎消息
  useEffect(() => {
    if (!messages.length && !skipDefaultWelcome) {
      let welcomeContent = t('aiAssistant.welcome');

      if (aiResponse) {
        welcomeContent = aiResponse;
        console.log('使用首页AI响应作为欢迎消息:', aiResponse);
      } else if (useStudyAPI) {
        welcomeContent = t('aiAssistant.welcomeStudy');
      } else if (initialMessage) {
        welcomeContent = initialMessage;
      } else {
        welcomeContent += t('aiAssistant.tellMeWhatToLearn');
      }

      const welcomeMessage: Message = {
        id: 'welcome',
        content: welcomeContent,
        role: 'assistant',
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, [
    initialMessage,
    messages.length,
    aiResponse,
    useStudyAPI,
    skipDefaultWelcome,
    t
  ]);

  // 处理来自首页的用户输入
  useEffect(() => {
    if (
      userInputFromHome &&
      messages.length > 0 &&
      !messages.some(
        (msg) => msg.content === userInputFromHome && msg.role === 'user'
      )
    ) {
      console.log('处理来自首页的用户输入:', userInputFromHome);

      const userMessage: Message = {
        id: generateUniqueId(),
        content: userInputFromHome,
        role: 'user',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      if (useStudyAPI) {
        callStudyAPI(userMessage, messages);
      } else {
        // 来自首页的输入，也遵循新的两轮消息规则
        // 第一轮：仅聊天回复，不生成计划
        handleFirstMessageChatOnly(userMessage, messages);
      }
    }
  }, [userInputFromHome, messages]);

  // 处理外部发送的消息（课程卡片点击）
  useEffect(() => {
    if (
      externalMessage &&
      !messages.some(
        (msg) => msg.content === externalMessage && msg.role === 'user'
      )
    ) {
      console.log('处理外部发送的消息:', externalMessage);

      const userMessage: Message = {
        id: generateUniqueId(),
        content: externalMessage,
        role: 'user',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      if (useStudyAPI) {
        callStudyAPI(userMessage, messages);
      } else {
        // 来自课程卡片的点击，直接生成学习计划
        handleFirstMessagePlanGeneration(userMessage, messages);
      }
    }
  }, [externalMessage, messages]);

  // 第二条消息并行处理函数
  const handleSecondMessageParallel = async (
    userMessage: Message,
    currentMessages: Message[]
  ) => {
    try {
      console.log('\n=== 🔄 第二条消息并行处理 ===');
      
      // 立即添加计划生成开始的提示消息
      const planStartMessage: Message = {
        id: generateUniqueId(),
        content: locale === 'zh' ? '现在开始为您生成计划~' : 'Now generating your personalized plan~',
        role: 'assistant',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, planStartMessage]);
      
      // 检查是否有上传的文件
      const hasUploadedFile = typeof window !== 'undefined' 
        ? sessionStorage.getItem('hasUploadedFile') === 'true'
        : false;

      const requestData = {
        id: sessionId || 'user123',
        messages: currentMessages
          .map((msg) => ({
            role: msg.role,
            content: msg.content,
          }))
          .concat([
            {
              role: 'user',
              content: userMessage.content,
            },
          ]),
        ...(hasUploadedFile && { retrive_enabled: true }),
      };

      // 并行调用两个接口
      const [chatResponse, planResponse] = await Promise.all([
        // 聊天接口
        fetch('/api/chat1/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData),
        }),
        // 计划生成接口
        fetch('/api/learning/plan/stream_generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData),
        })
      ]);

      // 处理聊天响应
      if (chatResponse.ok) {
        const chatResult = await chatResponse.json();
        console.log('📥 聊天API响应:', chatResult);
        
        // 添加聊天回复到消息列表
        const assistantMessage: Message = {
          id: generateUniqueId(),
          content: chatResult.response || '开始为您生成个性化学习计划...',
          role: 'assistant',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }

      // 处理计划生成响应（流式）
      if (planResponse.ok) {
        console.log('✅ 计划生成API调用成功，开始处理流式响应');
        
        // 通知父组件开始计划生成
        onPlanGeneration?.([1], '第二轮消息触发初次计划生成');
        
        // 处理流式响应
        if (planResponse.body) {
          const reader = planResponse.body.getReader();
          const decoder = new TextDecoder();
          let stepCount = 0;
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              console.log('✅ 学习计划流式响应处理完成');
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim() && line.startsWith('data: ')) {
                const dataStr = line.slice(6).trim();
                try {
                  const data = JSON.parse(dataStr);

                  if (data.error) {
                    console.error('❌ 计划生成错误:', data.error);
                    throw new Error(data.error);
                  } else if (data.introduction) {
                    // 调用回调通知父组件显示课程介绍
                    onIntroductionUpdate?.(data.introduction);
                  } else if (data.step) {
                    stepCount += 1;
                    const step = data.step;
                    const stepNumber = data.step_number || stepCount;
                    const total = data.total || '未知';

                    console.log(`📋 生成步骤 ${stepNumber}/${total}:`, step.title);
                    onStepUpdate?.(step, stepNumber, total);
                  } else if (data.done && data.done === true) {
                    console.log('✅ 计划生成完成!');

                    if (data.plan) {
                      const plan = data.plan;
                      console.log(`📚 生成的计划包含 ${plan.plan?.length || 0} 个步骤`);
                      onPlanUpdate?.(plan);
                    }
                    break;
                  }
                } catch (e) {
                  console.warn('❌ JSON解析失败:', e);
                }
              }
            }
          }
        }
      }

    } catch (error) {
      console.error('❌ 第二条消息并行处理失败:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: generateUniqueId(),
          content: '抱歉，生成学习计划时出现了错误，请稍后重试。',
          role: 'assistant',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // 两步式流程处理函数
  const handleTwoStepFlow = async (
    userMessage: Message,
    currentMessages: Message[]
  ) => {
    try {
      console.log('\n=== 🔄 开始两步式流程 ===');

      // 第一步：调用 /api/chat1/stream 获取非流式响应
      const requestData = {
        id: sessionId || 'user123',
        messages: currentMessages
          .map((msg) => ({
            role: msg.role,
            content: msg.content,
          }))
          .concat([
            {
              role: 'user',
              content: userMessage.content,
            },
          ]),
      };

      console.log('📤 第一步：调用课程分析API');
      console.log('发送数据:', requestData);

      const analysisResponse = await fetch('/api/chat1/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!analysisResponse.ok) {
        throw new Error(`分析API错误: ${analysisResponse.status}`);
      }

      const analysisResult = await analysisResponse.json();
      console.log('📥 第一步响应:', analysisResult);

      // 第二步：检查是否需要生成学习计划
      // 计算当前用户消息数量（排除AI消息）
      const userMessageCount = currentMessages.filter(msg => msg.role === 'user').length + 1; // +1 是当前这条消息
      const isSecondUserMessage = userMessageCount === 2;
      const isThirdOrLaterMessage = userMessageCount >= 3;
      
      // 第二条消息：并行调用两个接口，不需要分析结果判断
      // 第三条及以后：串行调用，根据分析结果判断是否更新计划
      const shouldGeneratePlan = isSecondUserMessage || (isThirdOrLaterMessage && analysisResult.updateSteps && analysisResult.updateSteps.length > 0);
      
      if (shouldGeneratePlan) {
        console.log('📋 需要更新步骤:', analysisResult.updateSteps);
        console.log('📝 更新原因:', analysisResult.reason);
        console.log('🔢 当前是第', userMessageCount, '条用户消息');

        // 根据情况显示不同的提示信息
        if (isSecondUserMessage && (!analysisResult.updateSteps || analysisResult.updateSteps.length === 0)) {
          // 第二条消息的初次计划生成
          const generateMessage: Message = {
            id: generateUniqueId(),
            content: '开始为您生成个性化学习计划...',
            role: 'assistant',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, generateMessage]);
        } else if (analysisResult.updateSteps && analysisResult.updateSteps.length > 0) {
          // 计划更新
          const stepNumbers = analysisResult.updateSteps.join('、');
          const updateMessage: Message = {
            id: generateUniqueId(),
            content: t('aiAssistant.modifyingSteps', { steps: stepNumbers }),
            role: 'assistant',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, updateMessage]);
        }

        // 创建并添加AI助手回复消息
        const assistantMessage: Message = {
          id: generateUniqueId(),
          content: analysisResult.response || t('aiAssistant.helpCustomize'),
          role: 'assistant',
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // 通知父组件开始计划生成（这里会设置updating状态）
        const updateSteps = isSecondUserMessage && (!analysisResult.updateSteps || analysisResult.updateSteps.length === 0) 
          ? [1] // 初次生成时使用 [1] 作为标识
          : analysisResult.updateSteps;
        const reason = isSecondUserMessage && (!analysisResult.updateSteps || analysisResult.updateSteps.length === 0)
          ? '第二轮消息触发初次计划生成'
          : (analysisResult.reason || '');
        
        onPlanGeneration?.(updateSteps, reason);

        // 调用流式计划生成API
        await generateLearningPlan(requestData, analysisResult);
      } else {
        console.log('ℹ️ 无需更新学习计划');

        // 只显示AI回复
        const assistantMessage: Message = {
          id: generateUniqueId(),
          content: analysisResult.response || t('aiAssistant.helpCustomize'),
          role: 'assistant',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('❌ 两步式流程错误:', error);

      const errorMessage: Message = {
        id: generateUniqueId(),
        content: `抱歉，处理您的请求时出现了问题：${error instanceof Error ? error.message : '未知错误'}`,
        role: 'assistant',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // 生成学习计划的函数
  const generateLearningPlan = async (
    requestData: any,
    analysisResult: any
  ) => {
    try {
      console.log('\n📚 第二步：开始流式生成学习计划');

      // 检查是否有上传的文件
      const hasUploadedFile = typeof window !== 'undefined' 
        ? sessionStorage.getItem('hasUploadedFile') === 'true'
        : false;

      // 构造学习计划生成请求
      const planRequestData = {
        id: requestData.id,
        messages: requestData.messages,
        advise: JSON.stringify({
          updateSteps: analysisResult.updateSteps,
          reason: analysisResult.reason || '用户需求分析',
        }),
        ...(hasUploadedFile && { retrive_enabled: true }),
      };

      console.log('📤 发送计划生成请求:', planRequestData);

      const planResponse = await fetch('/api/learning/plan/stream_generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(planRequestData),
      });

      if (!planResponse.ok) {
        throw new Error(`计划生成API错误: ${planResponse.status}`);
      }

      // 不在聊天区域显示计划生成进度，直接处理流式响应
      // 计划内容将通过SSE机制更新到中间的计划展示区域
      console.log('✅ 计划更新API调用成功，流式结果将通过SSE更新到计划展示区');

      // 处理流式响应（仅用于日志记录，不显示在聊天区）
      if (planResponse.body) {
        const reader = planResponse.body.getReader();
        const decoder = new TextDecoder();
        let stepCount = 0;
        let buffer = ''; // 用于缓存不完整的数据
        let sawNoUpdateMessage = false;

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            console.log('✅ 学习计划流式响应处理完成');
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // 按行分割处理
          const lines = buffer.split('\n');
          // 保留最后一行（可能不完整）
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim() && line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim();
              try {
                const data = JSON.parse(dataStr);

                if (data.error) {
                  console.error('❌ 计划生成错误:', data.error);
                  throw new Error(data.error);
                } else if (data.warning) {
                  console.warn('⚠️ 计划生成警告:', data.warning);
                } else if (data.message) {
                  console.log('📨 计划生成消息:', data.message);
                  const msg = String(data.message);
                  if (msg.includes('无需更新计划') || msg.toLowerCase().includes('no update')) {
                    sawNoUpdateMessage = true;
                  }
                } else if (data.introduction) {
                  // 调用回调通知父组件显示课程介绍
                  onIntroductionUpdate?.(data.introduction);
                } else if (data.step) {
                  stepCount += 1;
                  const step = data.step;
                  const stepNumber = data.step_number || stepCount;
                  const total = data.total || '未知';

                  console.log(
                    `📋 生成步骤 ${stepNumber}/${total}:`,
                    step.title
                  );
                  // 不在聊天区域更新，计划内容通过SSE显示在计划区域
                  onStepUpdate?.(step, stepNumber, total);
                } else if (data.done && data.done === true) {
                  console.log('✅ 计划生成完成!');

                  if (data.plan) {
                    const plan = data.plan;
                    console.log(
                      `📚 生成的计划包含 ${plan.plan?.length || 0} 个步骤`
                    );
                    onPlanUpdate?.(plan); // 调用回调通知父组件更新计划
                  } else {
                    // 没有返回plan，通知父组件结束“更新中”（表示无变更）
                    if (typeof onPlanUpdate === 'function') {
                      onPlanUpdate(undefined as any);
                    }
                  }
                  return; // 完成后直接返回
                }
              } catch (e) {
                console.warn('JSON解析失败:', e);
                console.warn('原始数据:', dataStr);
              }
            }
          }
        }

        // 处理缓冲区中剩余的数据
        if (buffer.trim() && buffer.startsWith('data: ')) {
          const dataStr = buffer.slice(6).trim();
          try {
            const data = JSON.parse(dataStr);
            if (data.done && data.done === true && data.plan) {
              console.log('✅ 从缓冲区处理完成的计划');
              onPlanUpdate?.(data.plan);
            } else if (data.done && data.done === true && !data.plan) {
              if (typeof onPlanUpdate === 'function') {
                onPlanUpdate(undefined as any);
              }
            }
          } catch (e) {
            console.warn('缓冲区JSON解析失败:', e);
          }
        }
      }
    } catch (error) {
      console.error('❌ 学习计划生成失败:', error);

      // 不在聊天区域显示错误信息，只记录日志
    }
  };

  // 学习页面API调用
  const callStudyAPI = async (
    userMessage: Message,
    currentMessages: Message[]
  ) => {
    try {
      const requestData = {
        message: userMessage.content,
        conversation_history: currentMessages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      };

      console.log('📤 调用学习页面API:', requestData);

      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('响应体为空');
      }

      const assistantMessage: Message = {
        id: generateUniqueId(),
        content: '',
        role: 'assistant',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log('流式响应完成，内容长度:', accumulatedContent.length);
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.trim() && line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            try {
              const data = JSON.parse(dataStr);

              if (data.chunk) {
                accumulatedContent += data.chunk;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessage.id
                      ? { ...msg, content: accumulatedContent }
                      : msg
                  )
                );
              } else if (data.done) {
                console.log(
                  'AI响应完成，最终内容长度:',
                  accumulatedContent.length
                );
                break;
              } else if (data.error) {
                console.error('AI响应错误:', data.error);
                throw new Error(data.error);
              }
            } catch (e) {
              // 静默处理解析错误
            }
          }
        }
      }
    } catch (error) {
      console.error('调用AI接口失败:', error);

      const errorMessage: Message = {
        id: generateUniqueId(),
        content: `抱歉，AI服务暂时不可用。错误信息: ${error instanceof Error ? error.message : '未知错误'}`,
        role: 'assistant',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // 新增：处理第一轮消息，仅聊天回复，不生成计划
  const handleFirstMessageChatOnly = async (
    userMessage: Message,
    currentMessages: Message[]
  ) => {
    try {
      console.log('\n=== 💬 第一轮消息：仅聊天回复，不生成计划 ===');

      // 构造请求数据
      const requestData = {
        id: sessionId || 'user123',
        messages: currentMessages
          .map((msg) => ({
            role: msg.role,
            content: msg.content,
          }))
          .concat([
            {
              role: 'user',
              content: userMessage.content,
            },
          ]),
      };

      console.log('📤 发送聊天请求:', requestData);

      // 只调用聊天API，不生成学习计划
      const chatResponse = await fetch('/api/chat1/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!chatResponse.ok) {
        throw new Error(`聊天API错误: ${chatResponse.status}`);
      }

      const chatResult = await chatResponse.json();
      console.log('📥 聊天API响应:', chatResult);

      // 显示AI回复
      const assistantMessage: Message = {
        id: generateUniqueId(),
        content: chatResult.response || t('aiAssistant.helpAnalyze'),
        role: 'assistant',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      console.log('✅ 第一轮消息处理完成，下轮消息将可以触发计划生成');

    } catch (error) {
      console.error('❌ 第一轮消息处理错误:', error);

      const errorMessage: Message = {
        id: generateUniqueId(),
        content: '抱歉，AI暂时无法回复，请稍后再试。',
        role: 'assistant',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // 原有：处理第一条消息的学习计划生成（现在改为第二轮使用）
  const handleFirstMessagePlanGeneration = async (
    userMessage: Message,
    currentMessages: Message[]
  ) => {
    try {
      console.log('\n=== 🚀 第一条消息：并行处理回复 + 学习计划 ===');

      // 构造请求数据
      const requestData = {
        id: sessionId || 'user123',
        messages: currentMessages
          .map((msg) => ({
            role: msg.role,
            content: msg.content,
          }))
          .concat([
            {
              role: 'user',
              content: userMessage.content,
            },
          ]),
      };

      console.log('📤 并行启动两个API请求:', requestData);

      // 通知父组件开始计划生成（这里会设置updating状态）
      onPlanGeneration?.([1], '初次生成学习计划');

      // 立即启动学习计划生成（不等待结果）
      console.log('🔹 启动学习计划生成（异步）');
      generateLearningPlanDirect(requestData).catch(error => {
        console.error('❌ 学习计划生成失败:', error);
      });

      // 同时处理聊天回复（独立执行）
      console.log('🔹 处理聊天回复（独立）');
      const chatResponse = await fetch('/api/chat1/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!chatResponse.ok) {
        throw new Error(`聊天API错误: ${chatResponse.status}`);
      }

      const chatResult = await chatResponse.json();
      console.log('📥 聊天API响应:', chatResult);

      // 立即显示AI回复（不等待学习计划）
      const assistantMessage: Message = {
        id: generateUniqueId(),
        content:
          chatResult.response || t('aiAssistant.helpAnalyze'),
        role: 'assistant',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // 已移除 isFirstMessage 状态管理
      
      console.log('✅ 聊天回复已显示，学习计划仍在后台生成');
    } catch (error) {
      console.error('❌ 第一条消息处理错误:', error);

      const errorMessage: Message = {
        id: generateUniqueId(),
        content: `抱歉，处理您的请求时出现了问题：${error instanceof Error ? error.message : '未知错误'}`,
        role: 'assistant',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // 新增：直接生成学习计划（用于第一条消息）
  const generateLearningPlanDirect = async (requestData: any) => {
    try {
      console.log('\n📚 ============ 直接流式生成学习计划 ============');
      
      // 检查是否有上传的文件
      const hasUploadedFile = typeof window !== 'undefined' 
        ? sessionStorage.getItem('hasUploadedFile') === 'true'
        : false;

      // 添加retrive_enabled参数
      const enhancedRequestData = {
        ...requestData,
        ...(hasUploadedFile && { retrive_enabled: true }),
      };

      console.log('📤 发送计划生成请求:', enhancedRequestData);
      console.log('🌐 当前语言环境:', {
        locale: document.documentElement.lang,
        pathname: window.location.pathname,
        cookieLocale: document.cookie.split(';').find(c => c.trim().startsWith('NEXT_LOCALE='))?.split('=')[1]
      });

      const planResponse = await fetch('/api/learning/plan/stream_generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(enhancedRequestData),
      });

      console.log('📡 API响应状态:', planResponse.status, planResponse.statusText);
      console.log('📡 响应头:', Object.fromEntries(planResponse.headers.entries()));

      if (!planResponse.ok) {
        throw new Error(`计划生成API错误: ${planResponse.status} - ${planResponse.statusText}`);
      }

      // 不在聊天区域显示计划生成进度，直接处理流式响应
      // 计划内容将通过SSE机制更新到中间的计划展示区域
      console.log('✅ 计划生成API调用成功，开始处理流式响应...');

      // 处理流式响应（仅用于日志记录，不显示在聊天区）
      if (planResponse.body) {
        const reader = planResponse.body.getReader();
        const decoder = new TextDecoder();
        let stepCount = 0;
        let buffer = ''; // 用于缓存不完整的数据
        let totalChunks = 0;

        console.log('🔄 开始读取流式数据...');

        while (true) {
          const { done, value } = await reader.read();
          totalChunks++;

          if (done) {
            console.log('✅ 学习计划流式响应处理完成');
            console.log(`📊 统计: 总共处理了 ${totalChunks} 个数据块, 生成了 ${stepCount} 个步骤`);
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          
          console.log(`📦 第${totalChunks}个数据块:`, {
            chunkLength: chunk.length,
            bufferLength: buffer.length,
            preview: chunk.substring(0, 100) + (chunk.length > 100 ? '...' : '')
          });

          // 按行分割处理
          const lines = buffer.split('\n');
          // 保留最后一行（可能不完整）
          buffer = lines.pop() || '';

          console.log(`🔍 处理 ${lines.length} 行数据`);

          for (const line of lines) {
            if (line.trim() && line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim();
              console.log(`📋 解析SSE数据:`, dataStr.substring(0, 200) + (dataStr.length > 200 ? '...' : ''));
              
              try {
                const data = JSON.parse(dataStr);

                if (data.error) {
                  console.error('❌ 计划生成错误:', data.error);
                  throw new Error(data.error);
                } else if (data.warning) {
                  console.warn('⚠️ 计划生成警告:', data.warning);
                } else if (data.message) {
                  console.log('📨 计划生成消息:', data.message);
                } else if (data.introduction) {
                  // 调用回调通知父组件显示课程介绍
                  onIntroductionUpdate?.(data.introduction);
                } else if (data.step) {
                  stepCount += 1;
                  const step = data.step;
                  const stepNumber = data.step_number || stepCount;
                  const total = data.total || '未知';

                  console.log('\n🎯 ========== 收到新步骤 ==========');
                  console.log(`📋 步骤 ${stepNumber}/${total}:`, step.title);
                  console.log('📋 步骤详情:', {
                    step: step.step,
                    title: step.title,
                    description: step.description?.substring(0, 100) + '...',
                    type: step.type,
                    difficulty: step.difficulty,
                    videos: step.videos?.length || 0
                  });
                  console.log('📋 调用onStepUpdate回调...');
                  
                  // 不在聊天区域更新，计划内容通过SSE显示在计划区域
                  onStepUpdate?.(step, stepNumber, total);
                  
                  console.log('✅ onStepUpdate回调执行完成');
                  console.log('========== 步骤处理结束 ==========\n');
                } else if (data.done && data.done === true) {
                  console.log('\n🎉 ========== 计划生成完成 ==========');

                  if (data.plan) {
                    const plan = data.plan;
                    console.log(`📚 完整计划包含 ${plan.plan?.length || 0} 个步骤`);
                    console.log('📚 调用onPlanUpdate回调...');
                    onPlanUpdate?.(plan); // 调用回调通知父组件更新计划
                    console.log('✅ onPlanUpdate回调执行完成');
                  }
                  console.log('========== 完成处理结束 ==========\n');
                  return; // 完成后直接返回
                } else {
                  console.log('🤔 未知的数据格式:', Object.keys(data));
                }
              } catch (e) {
                console.warn('❌ JSON解析失败:', e);
                console.warn('❌ 原始数据:', dataStr);
                console.warn('❌ 数据长度:', dataStr.length);
              }
            } else if (line.trim()) {
              console.log('📄 非SSE格式的行:', line.substring(0, 100));
            }
          }
        }

        // 处理缓冲区中剩余的数据
        if (buffer.trim() && buffer.startsWith('data: ')) {
          const dataStr = buffer.slice(6).trim();
          try {
            const data = JSON.parse(dataStr);
            if (data.done && data.done === true && data.plan) {
              console.log('✅ 从缓冲区处理完成的计划');
              onPlanUpdate?.(data.plan);
            }
          } catch (e) {
            console.warn('缓冲区JSON解析失败:', e);
          }
        }
      }
    } catch (error) {
      console.error('❌ 直接学习计划生成失败:', error);

      // 不在聊天区域显示错误信息，只记录日志
    }
  };

  // 任务更新处理函数
  const handleConfirmTaskUpdate = async (messageId: string) => {
    const targetMessage = messages.find(msg => msg.id === messageId);
    if (!targetMessage?.metadata?.suggestion) return;
    
    // 显示处理状态
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { 
            ...msg, 
            metadata: { 
              ...msg.metadata, 
              showConfirmButtons: false,
              isProcessing: true 
            } 
          }
        : msg
    ));
    
    try {
      const executeResult = await callExecuteAPI(
        targetMessage.metadata.suggestion,
        sessionId || 'user123',
        currentTaskData
      );
      
      // 移除处理状态
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { 
              ...msg, 
              metadata: { 
                ...msg.metadata, 
                isProcessing: false 
              } 
            }
          : msg
      ));
      
      // 先立即预览新任务内容，让用户看到效果
      onTaskUpdateComplete?.(executeResult.result.task);

      // 添加确认消息，让用户选择是否保存此更新
      const confirmMessage: Message = {
        id: generateUniqueId(),
        content: `✅ ${t('taskUpdate.complete.message')}`,
        role: 'assistant',
        timestamp: new Date(),
        type: 'task-update-confirm',
        metadata: {
          newTaskData: executeResult.result.task,
          originalTaskData: currentTaskData,
          showAcceptButtons: true
        }
      };
      
      setMessages(prev => [...prev, confirmMessage]);
      
    } catch (error) {
      console.error('Execute API 调用失败:', error);
      
      // 恢复确认按钮，显示错误
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { 
              ...msg, 
              metadata: { 
                ...msg.metadata, 
                showConfirmButtons: true,
                isProcessing: false 
              } 
            }
          : msg
      ));
      
      const errorMessage: Message = {
        id: generateUniqueId(),
        content: `❌ ${t('taskUpdate.error.failed')}`,
        role: 'assistant',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleCancelTaskUpdate = async (messageId: string) => {
    // 隐藏确认按钮
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { 
            ...msg, 
            metadata: { 
              ...msg.metadata, 
              showConfirmButtons: false 
            } 
          }
        : msg
    ));
    
    // 添加取消消息
    const cancelMessage: Message = {
      id: generateUniqueId(),
      content: t('taskUpdate.success.cancelled'),
      role: 'assistant',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, cancelMessage]);
  };

  // 处理接受任务更新（保存当前预览的内容）
  const handleAcceptTaskUpdate = async (messageId: string) => {
    const targetMessage = messages.find(msg => msg.id === messageId);
    if (!targetMessage?.metadata?.newTaskData) return;

    // 隐藏接受按钮
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { 
            ...msg, 
            metadata: { 
              ...msg.metadata, 
              showAcceptButtons: false 
            } 
          }
        : msg
    ));

    // 调用保存回调，持久化任务数据
    onTaskUpdateSave?.(targetMessage.metadata.newTaskData);
    console.log('📚 用户确认保存任务更新');
  };

  // 处理拒绝任务更新（恢复到原有内容）
  const handleRejectTaskUpdate = async (messageId: string) => {
    const targetMessage = messages.find(msg => msg.id === messageId);
    if (!targetMessage?.metadata?.originalTaskData) return;

    // 隐藏接受按钮
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { 
            ...msg, 
            metadata: { 
              ...msg.metadata, 
              showAcceptButtons: false 
            } 
          }
        : msg
    ));

    // 添加拒绝消息
    const rejectMessage: Message = {
      id: generateUniqueId(),
      content: `❌ ${t('taskUpdate.success.rollback')}`,
      role: 'assistant',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, rejectMessage]);

    // 恢复原有任务数据
    onTaskUpdateComplete?.(targetMessage.metadata.originalTaskData);
    console.log('🔄 用户选择回滚，恢复原有任务内容');
  };

  // 发送消息
  const sendMessage = async (messageContent: string) => {
    if (!messageContent.trim()) return;

    setIsLoading(true);

    const userMessage: Message = {
      id: generateUniqueId(),
      content: messageContent.trim(),
      role: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    if (useStudyAPI) {
      // 学习页面：先检查是否需要任务更新
      console.log('🔍 学习页面聊天检查:', {
        useStudyAPI,
        hasCurrentTaskData: !!currentTaskData,
        currentTaskData,
        messageContent
      });
      
      if (currentTaskData) {
        try {
          console.log('📞 开始调用 Detect API...');
          const detectResult = await callDetectAPI(messageContent, sessionId || 'user123', currentTaskData);
          console.log('📋 Detect API 结果:', detectResult);
          
          if (detectResult.result?.needUpdate) {
            // 创建带 suggestion 内容的 AI 回复消息
            const suggestionMessage: Message = {
              id: generateUniqueId(),
              content: detectResult.result.suggestion,
              role: 'assistant',
              timestamp: new Date(),
              type: 'task-update-suggestion',
              metadata: {
                suggestion: detectResult.result.suggestion,
                showConfirmButtons: true
              }
            };
            
            setMessages(prev => [...prev, suggestionMessage]);
            setIsLoading(false);
            return; // 不继续普通聊天流程
          }
        } catch (error) {
          console.error('Detect API 调用失败:', error);
          // 降级到普通聊天
        }
      }
      
      await callStudyAPI(userMessage, messages);
    } else {
      // 课程定制页面：根据消息轮次判断处理方式
      // 计算用户消息数量（包括当前这条）
      const userMessageCount = messages.filter(msg => msg.role === 'user').length + 1;
      
      if (userMessageCount === 1) {
        // 第一轮消息：仅聊天回复，不生成计划
        await handleFirstMessageChatOnly(userMessage, messages);
      } else if (userMessageCount === 2) {
        // 第二轮消息：并行调用聊天和计划生成接口
        await handleSecondMessageParallel(userMessage, messages);
      } else {
        // 第三轮及后续消息：串行调用，先分析再决定是否生成计划
        await handleTwoStepFlow(userMessage, messages);
      }
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    onMessageSent?.();
    await sendMessage(input);
  };

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleRecommendationClick = (question: string) => {
    setInput(question);
  };

  return (
    <div className={`ai-chat-interface flex flex-col h-full ${className}`}>
      {/* 消息区域 */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto pr-2 scroll-smooth"
        style={{ scrollbarWidth: 'thin' }}
        data-chat-area="true"
      >
        <div className="space-y-4 pb-4">
          {messages.map((message) => {
            // 任务更新确认消息的特殊渲染
            if (message.type === 'task-update-suggestion') {
              return (
                <div key={message.id} className="flex items-start gap-3">
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarFallback>
                      <Bot className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 max-w-[85%]">
                    <div className="text-sm text-gray-800 mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">🔄</span>
                        <span className="font-medium text-yellow-800">{t('taskUpdate.suggestion.title')}</span>
                      </div>
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {t('taskUpdate.suggestion.description')}
                      </p>
                    </div>
                    
                    {message.metadata?.showConfirmButtons && !message.metadata?.isProcessing && (
                      <div className="flex space-x-2">
                        <Button 
                          size="sm" 
                          onClick={() => handleConfirmTaskUpdate(message.id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1"
                        >
                          ✅ {t('taskUpdate.suggestion.confirmButton')}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleCancelTaskUpdate(message.id)}
                          className="border-gray-300 text-xs px-3 py-1"
                        >
                          ❌ {t('taskUpdate.suggestion.cancelButton')}
                        </Button>
                      </div>
                    )}
                    
                    {message.metadata?.isProcessing && (
                      <div className="flex items-center space-x-2 text-sm text-blue-600">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span>{t('taskUpdate.updating.message')}</span>
                      </div>
                    )}
                    
                    <span className="text-xs opacity-70 mt-2 block">
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              );
            }

            // 任务更新完成确认消息的特殊渲染
            if (message.type === 'task-update-confirm') {
              return (
                <div key={message.id} className="flex items-start gap-3">
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarFallback>
                      <Bot className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 max-w-[85%]">
                    <div className="text-sm text-gray-800 mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">✅</span>
                        <span className="font-medium text-green-800">{t('taskUpdate.complete.title')}</span>
                      </div>
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        📋 {t('taskUpdate.complete.description')}
                      </p>
                    </div>
                    
                    {message.metadata?.showAcceptButtons && (
                      <div className="flex space-x-2">
                        <Button 
                          size="sm" 
                          onClick={() => handleAcceptTaskUpdate(message.id)}
                          className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1"
                        >
                          ✅ {t('taskUpdate.complete.saveButton')}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleRejectTaskUpdate(message.id)}
                          className="border-gray-300 text-xs px-3 py-1"
                        >
                          ❌ {t('taskUpdate.complete.rollbackButton')}
                        </Button>
                      </div>
                    )}
                    
                    <span className="text-xs opacity-70 mt-2 block">
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              );
            }
            
            // 普通消息渲染
            return (
              <div
                key={message.id}
                className={`flex items-start gap-3 ${
                  message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarFallback>
                    {message.role === 'user' ? (
                      <User className="w-4 h-4" />
                    ) : (
                      <Bot className="w-4 h-4" />
                    )}
                  </AvatarFallback>
                </Avatar>

                <div
                  className={`rounded-lg px-4 py-2 max-w-[80%] ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white ml-auto'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                  style={{
                    fontFamily:
                      '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                  }}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <span className="text-xs opacity-70 mt-1 block">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-start gap-3">
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarFallback>
                  <Bot className="w-4 h-4" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-gray-100 rounded-lg px-4 py-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0.1s' }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0.2s' }}
                  ></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 推荐问题区域 */}
      {recommendations && recommendations.length > 0 && (
        <div className="flex-shrink-0 px-2 py-2 space-y-2">
          {recommendations.slice(0, 3).map((question, index) => (
            <button
              key={index}
              onClick={() => handleRecommendationClick(question)}
              className="w-full text-left p-2 bg-red-100 hover:bg-red-200 border border-red-300 rounded-lg text-xs transition-colors transform hover:rotate-0.5"
              style={{
                fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
              }}
            >
              <span className="text-red-700 font-medium">Q{index + 1}:</span>{' '}
              <span className="text-red-600">{question}</span>
            </button>
          ))}
        </div>
      )}

      {/* 输入框区域 */}
      <div className={`flex-shrink-0 border-t border-gray-200 bg-white/90 backdrop-blur-sm ${isMobile ? 'p-4' : 'pt-4'}`}>
        {isMobile ? (
          // 移动端：与折叠状态完全一致的样式
          <div className="flex items-center space-x-3 px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 transition-colors">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Chat with AI Assistant..."
              disabled={isLoading}
              className="flex-1 text-gray-900 text-sm bg-transparent border-none outline-none placeholder-gray-500"
              style={{ fontSize: '16px', fontFamily: getFontFamily() }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="text-gray-400 hover:text-blue-500 transition-colors disabled:opacity-50"
            >
              💬
            </button>
          </div>
        ) : (
          // 桌面端：保持原有样式
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={isLoading}
              className="flex-1 border-gray-300 rounded-lg"
              style={{
                fontFamily: getFontFamily(),
              }}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="bg-blue-500 hover:bg-blue-600 rounded-lg shadow-md"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
