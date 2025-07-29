'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bot, Send, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';

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
  aiResponse?: string; // 来自首页的AI响应
  useStudyAPI?: boolean; // 是否使用学习页面的API
  userInputFromHome?: string; // 来自首页的用户输入
  skipDefaultWelcome?: boolean; // 是否跳过默认欢迎语
  callbackUrl?: string; // 计划更新回调URL
  sessionId?: string; // 会话ID
  externalMessage?: string; // 外部发送的消息
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
  callbackUrl,
  sessionId,
  externalMessage
}: AIChatInterfaceProps) {
  const t = useTranslations('LearningPlatform');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!messages.length && !skipDefaultWelcome) {
      let welcomeContent = '您好！我是您的AI学习助手。';
      
      if (aiResponse) {
        // 如果有来自首页的AI响应，使用它作为欢迎消息
        welcomeContent = aiResponse;
        console.log('使用首页AI响应作为欢迎消息:', aiResponse);
      } else if (useStudyAPI) {
        // 学习页面的特定欢迎消息
        welcomeContent = '我是你的AI助手，帮你解决学习问题';
      } else if (initialMessage) {
        // 使用自定义初始消息
        welcomeContent = initialMessage;
      } else {
        welcomeContent += '请告诉我您想学习什么，我会为您制定个性化的学习计划。';
      }
      
      const welcomeMessage: Message = {
        id: 'welcome',
        content: welcomeContent,
        role: 'assistant',
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
    }
  }, [initialMessage, messages.length, aiResponse, useStudyAPI, skipDefaultWelcome]);

  // 处理来自首页的用户输入
  useEffect(() => {
    if (userInputFromHome && messages.length > 0 && !messages.some(msg => msg.content === userInputFromHome && msg.role === 'user')) {
      console.log('处理来自首页的用户输入:', userInputFromHome);
      
      // 添加用户消息
      const userMessage: Message = {
        id: Date.now().toString(),
        content: userInputFromHome,
        role: 'user',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, userMessage]);
      setIsLoading(true);
      
      // 自动调用API，传入当前的消息历史（包括欢迎消息）
      callAPI(userMessage, messages);
    }
  }, [userInputFromHome, messages]);

  // 处理外部发送的消息
  useEffect(() => {
    if (externalMessage && !messages.some(msg => msg.content === externalMessage && msg.role === 'user')) {
      console.log('处理外部发送的消息:', externalMessage);
      
      // 添加用户消息
      const userMessage: Message = {
        id: Date.now().toString(),
        content: externalMessage,
        role: 'user',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, userMessage]);
      setIsLoading(true);
      
      // 自动调用API
      callAPI(userMessage, messages);
    }
  }, [externalMessage, messages]);

  const callAPI = async (userMessage: Message, currentMessages: Message[]) => {
    try {
      // 根据使用场景选择不同的API
      const apiEndpoint = useStudyAPI 
        ? '/api/chat/stream'
        : '/api/chat1/stream';
        
      console.log(`调用API: ${apiEndpoint} (${useStudyAPI ? '学习页面' : '课程定制页面'})`);
      
      let requestData;
      
      if (useStudyAPI) {
        // 学习页面使用 /api/chat/stream 格式
        requestData = {
          message: userMessage.content,
          conversation_history: currentMessages.map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        };
      } else {
        // 课程定制页面使用 /api/chat1/stream 格式
        requestData = {
          id: sessionId || 'user123',
          messages: currentMessages.map(msg => ({
            role: msg.role,
            content: msg.content
          })).concat([{
            role: 'user',
            content: userMessage.content
          }]),
          url: callbackUrl || ''
        };
        
        console.log('\n📤 发送给外部API的完整数据:');
        console.log('SessionId:', requestData.id);
        console.log('回调URL:', requestData.url);
        console.log('消息数量:', requestData.messages.length);
        console.log('最后一条用户消息:', userMessage.content);
      }

      // 调用对应的API
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      console.log('API响应状态:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('响应体为空');
      }

      // 创建助手消息
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: '',
        role: 'assistant',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // 处理流式响应
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
            const dataStr = line.slice(6); // 移除 'data: ' 前缀
            try {
              const data = JSON.parse(dataStr);
              
              if (data.chunk) {
                accumulatedContent += data.chunk;
                // 更新助手消息内容
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessage.id 
                    ? { ...msg, content: accumulatedContent }
                    : msg
                ));
              } else if (data.done) {
                console.log('AI响应完成，最终内容长度:', accumulatedContent.length);
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
      
      // 显示错误消息
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        content: `抱歉，AI服务暂时不可用。错误信息: ${error instanceof Error ? error.message : '未知错误'}`,
        role: 'assistant',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // 发送消息的函数
  const sendMessage = async (messageContent: string) => {
    if (!messageContent.trim()) return;

    setIsLoading(true);

    // 创建用户消息
    const userMessage: Message = {
      id: Date.now().toString(),
      content: messageContent.trim(),
      role: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    // 🔥 关键优化：带重试机制的API调用
    const callAIWithRetry = async (retries = 3): Promise<Response> => {
      for (let i = 0; i < retries; i++) {
        try {
          console.log(`📡 尝试调用AI API (第${i + 1}次)`);
          
          // 确定使用的API端点
          const apiEndpoint = useStudyAPI ? '/api/chat/stream' : '/api/chat1/stream';
          console.log('使用的API端点:', apiEndpoint);

          // 构建请求数据
          let requestData: any;
          
          if (!useStudyAPI && callbackUrl && sessionId) {
            // 🔥 课程定制页面：传递回调信息
            requestData = {
              id: sessionId,
              url: callbackUrl,
              messages: [userMessage]
            };
            
            console.log('\n📤 发送给课程定制API的完整数据:');
            console.log('SessionId:', requestData.id);
            console.log('回调URL:', requestData.url);
            console.log('消息数量:', requestData.messages.length);
            console.log('最后一条用户消息:', userMessage.content);
          } else {
            // 学习页面：发送所有消息历史
            requestData = {
              messages: [...messages, userMessage]
            };
            
            console.log('\n📤 发送给学习API的数据:');
            console.log('消息数量:', requestData.messages.length);
          }

          const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData),
          });

          console.log(`API响应状态: ${response.status}`);

          if (response.ok) {
            return response;
          }
          
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          
        } catch (error) {
          console.error(`第${i + 1}次尝试失败:`, error);
          
          if (i === retries - 1) {
            // 最后一次重试失败
            throw error;
          }
          
          // 等待后重试（递增延迟）
          const delay = 1000 * (i + 1);
          console.log(`等待${delay}ms后重试...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      throw new Error('所有重试都失败了');
    };

    try {
      // 🔥 使用重试机制调用API
      const response = await callAIWithRetry();

      if (!response.body) {
        throw new Error('响应体为空');
      }

      // 创建助手消息
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: '',
        role: 'assistant',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // 处理流式响应
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
            const dataStr = line.slice(6); // 移除 'data: ' 前缀
            try {
              const data = JSON.parse(dataStr);
              
              if (data.chunk) {
                accumulatedContent += data.chunk;
                // 更新助手消息内容
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessage.id 
                    ? { ...msg, content: accumulatedContent }
                    : msg
                ));
              } else if (data.done) {
                console.log('AI响应完成，最终内容长度:', accumulatedContent.length);
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
      
      // 显示错误消息
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        content: `抱歉，AI服务暂时不可用。错误信息: ${error instanceof Error ? error.message : '未知错误'}`,
        role: 'assistant',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    // 触发回调
    onMessageSent?.();
    
    // 使用优化后的sendMessage函数
    await sendMessage(input);
  };

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
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

  // 处理推荐问题点击
  const handleRecommendationClick = (question: string) => {
    setInput(question);
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* 消息区域 - 可滚动 */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto pr-2 scroll-smooth"
        style={{ scrollbarWidth: 'thin' }}
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
                  fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
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
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
      </div>
      
      {/* 推荐问题区域 - 位于输入框上方 */}
      {recommendations && recommendations.length > 0 && (
        <div className="flex-shrink-0 px-2 py-2 space-y-2">
          {recommendations.slice(0, 3).map((question, index) => (
            <button
              key={index}
              onClick={() => handleRecommendationClick(question)}
              className="w-full text-left p-2 bg-red-100 hover:bg-red-200 border border-red-300 rounded-lg text-xs transition-colors transform hover:rotate-0.5"
              style={{
                fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
              }}
            >
              <span className="text-red-700 font-medium">Q{index + 1}:</span> <span className="text-red-600">{question}</span>
            </button>
          ))}
        </div>
      )}
      
      {/* 输入框区域 - 固定在底部 */}
      <div className="flex-shrink-0 pt-4 border-t border-gray-200 bg-white/90 backdrop-blur-sm">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入消息..."
            disabled={isLoading}
            className="flex-1 border-gray-300 rounded-lg"
            style={{
              fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
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