'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bot, Send, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
}: AIChatInterfaceProps) {
  const t = useTranslations('LearningPlatform');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFirstMessage, setIsFirstMessage] = useState(true); // 新增：跟踪是否是第一条消息
  const messagesContainerRef = useRef<HTMLDivElement>(null);

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
        // 来自首页的输入，直接生成学习计划
        handleFirstMessagePlanGeneration(userMessage, messages);
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
      if (analysisResult.updateSteps && analysisResult.updateSteps.length > 0) {
        console.log('📋 需要更新步骤:', analysisResult.updateSteps);
        console.log('📝 更新原因:', analysisResult.reason);

        // 显示修改步骤信息
        const stepNumbers = analysisResult.updateSteps.join('、');
        const updateMessage: Message = {
          id: generateUniqueId(),
          content: `为你修改第${stepNumbers}步`,
          role: 'assistant',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, updateMessage]);

        // 创建并添加AI助手回复消息
        const assistantMessage: Message = {
          id: generateUniqueId(),
          content: analysisResult.response || t('aiAssistant.helpCustomize'),
          role: 'assistant',
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // 通知父组件开始计划生成（这里会设置updating状态）
        onPlanGeneration?.(
          analysisResult.updateSteps,
          analysisResult.reason || ''
        );

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

      // 构造学习计划生成请求
      const planRequestData = {
        id: requestData.id,
        messages: requestData.messages,
        advise: JSON.stringify({
          updateSteps: analysisResult.updateSteps,
          reason: analysisResult.reason || '用户需求分析',
        }),
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

  // 新增：处理第一条消息的学习计划生成
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

      // 标记已经不是第一条消息了
      setIsFirstMessage(false);
      
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
      console.log('📤 发送计划生成请求:', requestData);
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
        body: JSON.stringify(requestData),
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
                console.log('✅ JSON解析成功:', Object.keys(data));

                if (data.error) {
                  console.error('❌ 计划生成错误:', data.error);
                  throw new Error(data.error);
                } else if (data.warning) {
                  console.warn('⚠️ 计划生成警告:', data.warning);
                } else if (data.message) {
                  console.log('📨 计划生成消息:', data.message);
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
      await callStudyAPI(userMessage, messages);
    } else {
      // 课程定制页面：判断是否是第一条消息
      if (isFirstMessage) {
        // 第一条消息：直接生成学习计划
        await handleFirstMessagePlanGeneration(userMessage, messages);
      } else {
        // 后续消息：使用两步式流程
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
          {messages.map((message) => (
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
          ))}

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
      <div className="flex-shrink-0 pt-4 border-t border-gray-200 bg-white/90 backdrop-blur-sm">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1 border-gray-300 rounded-lg"
            style={{
              fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
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
      </div>
    </div>
  );
}
