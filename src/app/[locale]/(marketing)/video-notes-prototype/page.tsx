'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward,
  Maximize2,
  Volume2,
  MessageSquare,
  BookOpen,
  Code,
  Mic,
  Download,
  Share2,
  StickyNote,
  CheckSquare,
  Lightbulb,
  FileText,
  Search,
  Clock,
  GripVertical,
  Plus,
  X,
  Loader2,
  Sparkles
} from 'lucide-react';
import { useMobileLayout } from '@/hooks/use-mobile-layout';

// 知识点类型定义
interface KnowledgePoint {
  name: string;
  start_time: string;
  end_time: string;
}

interface VideoAnalysisResult {
  success: boolean;
  video_info?: {
    title: string;
    bv_id: string;
    url: string;
  };
  analysis?: {
    result?: {
      knowledge_points?: KnowledgePoint[];
      transcript?: string;
    };
  };
}

// Mock 数据
const mockVideoSections = [
  { id: 1, title: '什么是 Hooks？', duration: '08:32', completed: true },
  { id: 2, title: 'useState 基础用法', duration: '12:45', completed: true },
  { id: 3, title: 'useEffect 生命周期', duration: '15:20', completed: false },
  { id: 4, title: 'useContext 状态共享', duration: '10:15', completed: false },
  { id: 5, title: '自定义 Hook 实战', duration: '18:40', completed: false },
];

const mockTranscript = [
  { id: 1, time: '00:00', text: '大家好，欢迎来到 React Hooks 深入课程。', highlight: false },
  { id: 2, time: '00:05', text: '在这节课中，我们将学习什么是 Hooks，以及为什么需要 Hooks。', highlight: true },
  { id: 3, time: '00:15', text: 'Hooks 是 React 16.8 引入的新特性，它让我们可以在函数组件中使用状态和其他 React 特性。', highlight: false },
  { id: 4, time: '00:30', text: '使用 Hooks 可以让代码更加简洁，避免类组件的复杂性。', highlight: false },
  { id: 5, time: '00:45', text: '让我们从最常用的 useState 开始学习。', highlight: false },
];

const mockQuizzes = [
  { id: 1, type: 'choice', question: 'useState 返回的数组包含几个元素？', completed: true },
  { id: 2, type: 'coding', question: '实现一个简单的计数器组件', completed: false },
  { id: 3, type: 'interview', question: '解释 useEffect 的依赖数组', completed: false },
];

const mockNotes = [
  {
    id: 1,
    type: 'ai-answer',
    content: `# 什么是 Hooks？

✨ **React Hooks** 是 React 16.8 引入的革命性特性！

## 核心优势
- 🎯 让函数组件拥有状态管理能力
- 💡 代码更简洁，逻辑更清晰
- 🔄 更容易复用状态逻辑
- 📦 告别繁琐的 class 组件

> 💭 Hooks 改变了我们写 React 的方式，让代码更加优雅～`,
    timestamp: '00:15',
    relatedClip: '什么是 Hooks？'
  },
  {
    id: 2,
    type: 'transcript',
    content: `# useState 基础用法

🎨 **useState** 是最常用的 Hook，用于添加状态！

### 基本语法
\`\`\`javascript
const [count, setCount] = useState(0);
\`\`\`

### 工作原理
1. 📌 返回一个数组，包含两个元素
2. 🎯 第一个元素是当前状态值
3. 🔧 第二个元素是更新状态的函数

⚡ **小提示**：每次调用 setCount 都会触发组件重新渲染哦～`,
    timestamp: '05:30',
    relatedClip: 'useState 基础用法'
  },
  {
    id: 3,
    type: 'ai-answer',
    content: `# useEffect 生命周期

🌟 **useEffect** 让我们在函数组件中执行副作用操作！

## 常见应用场景
- 🌐 数据获取（API 调用）
- 📡 订阅外部数据源
- ⏰ 设置定时器
- 🎨 手动修改 DOM

### 依赖数组的秘密
- \`[]\` 空数组 → 只在组件挂载时执行 ✨
- \`[value]\` 有依赖 → 依赖变化时执行 🔄
- 不传 → 每次渲染都执行 ⚠️

💡 记得清理副作用，避免内存泄漏！`,
    timestamp: '12:45',
    relatedClip: 'useEffect 生命周期'
  },
  {
    id: 4,
    type: 'transcript',
    content: `# 自定义 Hook 实战

🎪 **自定义 Hook** 是 React 的精华所在！

## 为什么要自定义 Hook？
- 🔁 复用组件逻辑
- 📦 封装复杂状态管理
- 🎯 让代码更易维护
- ✨ 提升开发效率

### 命名规范
🚨 **重要**：自定义 Hook 必须以 \`use\` 开头！

\`\`\`javascript
function useUserData(userId) {
  const [user, setUser] = useState(null);
  // ... 更多逻辑
  return user;
}
\`\`\`

🎉 这样就可以在任何组件中重复使用啦～`,
    timestamp: '18:20',
    relatedClip: '自定义 Hook 实战'
  },
  {
    id: 5,
    type: 'ai-answer',
    content: `# useContext 状态共享

🌈 **useContext** 解决了 props 层层传递的痛点！

## 使用步骤
1. 📝 创建 Context：\`createContext()\`
2. 🎁 提供数据：\`<Provider value={...}>\`
3. 🎯 消费数据：\`useContext(MyContext)\`

### 适用场景
- 🎨 主题切换（暗黑/明亮）
- 🌍 国际化（多语言）
- 👤 用户信息
- 🔐 权限管理

⚡ **性能提示**：Context 变化会导致所有消费组件重新渲染，要注意优化哦～`,
    timestamp: '22:10',
    relatedClip: 'useContext 状态共享'
  },
  {
    id: 6,
    type: 'transcript',
    content: `# Hooks 最佳实践

🏆 掌握这些技巧，让你的代码更专业！

## 黄金法则
1. ✅ 只在最顶层使用 Hook
2. ✅ 只在 React 函数中调用 Hook
3. ❌ 不要在循环、条件或嵌套函数中调用

### 常见陷阱
- 🚫 忘记添加依赖项
- 🚫 依赖项写错导致无限循环
- 🚫 在条件语句中使用 Hook

💪 遵循这些规则，bug 少 90%！

🎯 **记住**：Hooks 是工具，合理使用才是王道～`,
    timestamp: '28:50',
    relatedClip: 'Hooks 最佳实践'
  },
];

export default function VideoNotesPrototypePage() {
  const { isMobile } = useMobileLayout();
  
  // 视频相关状态
  const [videoUrl, setVideoUrl] = useState('https://www.bilibili.com/video/BV1Jgf6YvE8e?p=3');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<VideoAnalysisResult | null>(null);
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // UI状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTranscript, setShowTranscript] = useState(true);
  const [selectedSection, setSelectedSection] = useState(mockVideoSections[2]);
  const [notes, setNotes] = useState(mockNotes);
  const [showAIChat, setShowAIChat] = useState(false);
  const [isDragging, setIsDragging] = useState<number | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set([1])); // 默认展开第一条
  
  // 自动解析默认视频
  useEffect(() => {
    handleAnalyzeVideo();
  }, []);

  const getFontFamily = () => {
    if (isMobile) {
      return 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    }
    return '"Comic Sans MS", "Marker Felt", "Kalam", cursive';
  };
  
  // 解析视频
  const handleAnalyzeVideo = async () => {
    setIsAnalyzing(true);
    try {
      const response = await fetch('http://localhost:8000/batch/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_urls: [videoUrl],
          prompt: '提取视频中的知识点',
          job_name: '视频笔记测试'
        }),
      });

      const data = await response.json();
      
      if (data.success && data.job_id) {
        // 轮询任务状态
        await pollJobStatus(data.job_id);
      } else {
        console.error('创建任务失败:', data);
      }
    } catch (error) {
      console.error('解析视频失败:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // 轮询任务状态
  const pollJobStatus = async (jobId: string) => {
    const maxAttempts = 60; // 最多等待5分钟
    let attempts = 0;
    
    const checkStatus = async () => {
      try {
        const response = await fetch(`http://localhost:8000/batch/jobs/${jobId}`);
        const data = await response.json();
        
        if (data.success && data.data) {
          const job = data.data;
          
          if (job.status === 'completed' && job.results.length > 0) {
            const result = job.results[0];
            setAnalysisResult(result);
            
            // 提取知识点
            const points = result.analysis?.result?.knowledge_points || [];
            setKnowledgePoints(points);
            
            console.log('✅ 解析完成，提取到', points.length, '个知识点');
            return true;
          } else if (job.status === 'failed') {
            console.error('任务失败');
            return true;
          } else if (attempts < maxAttempts) {
            attempts++;
            setTimeout(checkStatus, 5000); // 5秒后再次检查
          }
        }
      } catch (error) {
        console.error('检查任务状态失败:', error);
      }
    };
    
    await checkStatus();
  };
  
  // 时间字符串转秒数
  const timeToSeconds = (time: string): number => {
    const parts = time.split(':');
    if (parts.length === 2) {
      const [minutes, seconds] = parts.map(Number);
      return minutes * 60 + seconds;
    }
    return 0;
  };
  
  // 跳转到指定时间
  const handleTimeJump = (time: string) => {
    const seconds = timeToSeconds(time);
    
    // 构建带时间参数的B站URL
    const bvMatch = videoUrl.match(/BV[\w]+/);
    const pMatch = videoUrl.match(/p=(\d+)/);
    
    if (bvMatch) {
      const bvid = bvMatch[0];
      const p = pMatch ? pMatch[1] : '1';
      const newUrl = `https://player.bilibili.com/player.html?bvid=${bvid}&page=${p}&t=${seconds}`;
      
      if (iframeRef.current) {
        iframeRef.current.src = newUrl;
      }
      
      console.log('🎯 跳转到时间:', time, '(', seconds, '秒)');
    }
  };

  const handleAddToNotes = (item: any) => {
    const newNote = {
      id: Date.now(),
      type: item.type,
      content: item.text || item.content,
      timestamp: item.time || selectedSection.duration,
      relatedClip: selectedSection.title
    };
    setNotes([...notes, newNote]);
  };

  const handleRemoveNote = (noteId: number) => {
    setNotes(notes.filter(n => n.id !== noteId));
  };

  const toggleNoteExpansion = (noteId: number) => {
    setExpandedNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(noteId)) {
        newSet.delete(noteId);
      } else {
        newSet.add(noteId);
      }
      return newSet;
    });
  };

  if (isMobile) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="text-center py-12 px-4">
          <div className="text-6xl mb-4">📱</div>
          <h2 className="text-2xl font-bold text-gray-700 mb-2">移动端预览</h2>
          <p className="text-gray-500">请在桌面端查看完整的视频笔记原型</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="h-screen bg-gray-50 flex flex-col overflow-hidden"
      style={{
        backgroundImage: `
          linear-gradient(to right, #f0f0f0 1px, transparent 1px),
          linear-gradient(to bottom, #f0f0f0 1px, transparent 1px)
        `,
        backgroundSize: '20px 20px',
      }}
    >
      {/* 顶部导航 - 精简版 */}
      <div className="bg-white border-b-2 border-gray-200 shadow-sm flex-shrink-0">
        <div className="px-6 py-3">
          <h1 
            className="text-xl font-bold text-indigo-600 transform -rotate-1"
            style={{ fontFamily: getFontFamily() }}
          >
            🎬 视频笔记学习系统
          </h1>
        </div>
      </div>

      {/* 主要内容区域 - 铺满全屏 */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        
        {/* 左侧：视频和逐字稿区域 (2/3) */}
        <div className="w-2/3 flex flex-col gap-4 overflow-hidden">
          
          {/* 视频播放器 */}
          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 overflow-hidden flex-shrink-0">
            {isAnalyzing ? (
              <div className="relative aspect-video bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="w-16 h-16 text-white animate-spin mb-4 mx-auto" />
                  <p className="text-white text-xl font-bold" style={{ fontFamily: getFontFamily() }}>
                    正在解析视频...
                  </p>
                  <p className="text-white/80 text-sm mt-2">
                    正在提取知识点，请稍候
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative aspect-video bg-black">
                <iframe
                  ref={iframeRef}
                  src={(() => {
                    const bvMatch = videoUrl.match(/BV[\w]+/);
                    const pMatch = videoUrl.match(/p=(\d+)/);
                    if (bvMatch) {
                      const bvid = bvMatch[0];
                      const p = pMatch ? pMatch[1] : '1';
                      return `https://player.bilibili.com/player.html?bvid=${bvid}&page=${p}&high_quality=1&danmaku=0`;
                    }
                    return '';
                  })()}
                  className="w-full h-full"
                  allowFullScreen
                  scrolling="no"
                  border="0"
                  frameBorder="no"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            )}
          </div>

          {/* 逐字稿区域 - 显示在视频下方 */}
          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 flex-1 overflow-hidden flex flex-col">
            <div className="border-b-2 border-gray-200 p-3">
              <h3 className="font-bold text-gray-800 flex items-center" style={{ fontFamily: getFontFamily() }}>
                <FileText className="w-5 h-5 mr-2 text-indigo-500" />
                视频逐字稿
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                {mockTranscript.map((item) => (
                  <div
                    key={item.id}
                    className={`group p-3 rounded-lg border-2 transition-all ${
                      item.highlight
                        ? 'bg-yellow-50 border-yellow-300'
                        : 'bg-gray-50 border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-xs font-mono text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded">
                            {item.time}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {item.text}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-2 border-indigo-300 text-indigo-600 hover:bg-indigo-50 flex-shrink-0"
                        onClick={() => handleAddToNotes({ type: 'transcript', text: item.text, time: item.time })}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        添加
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 右侧：知识点区域 (1/3) */}
        <div className="w-1/3 flex flex-col overflow-hidden">
          {/* 知识点头部 */}
          <div className="mb-4">
            <h3 className="font-bold text-gray-800 text-2xl flex items-center transform -rotate-1" style={{ fontFamily: getFontFamily() }}>
              <span className="bg-green-200 px-4 py-2 rounded-lg shadow-sm inline-block border-2 border-green-300 flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                知识点
                {knowledgePoints.length > 0 && (
                  <span className="bg-green-500 text-white text-sm px-2 py-0.5 rounded-full">
                    {knowledgePoints.length}
                  </span>
                )}
              </span>
            </h3>
          </div>

          {/* 知识点内容区域 */}
          <div className="flex-1 overflow-y-auto pr-2">
            {isAnalyzing ? (
              <div className="text-center py-12">
                <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-3 mx-auto" />
                <p className="text-gray-500 text-sm" style={{ fontFamily: getFontFamily() }}>
                  正在提取知识点...
                </p>
              </div>
            ) : knowledgePoints.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-3">🎓</div>
                <p className="text-gray-500 text-sm" style={{ fontFamily: getFontFamily() }}>
                  暂无知识点
                  <br />
                  等待视频解析完成
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {knowledgePoints.map((point, index) => (
                  <div
                    key={index}
                    className="group cursor-pointer"
                    onClick={() => handleTimeJump(point.start_time)}
                  >
                    <div className="bg-white rounded-lg p-4 border-2 border-green-200 hover:border-green-400 hover:shadow-lg transition-all duration-200">
                      {/* 序号和名称 */}
                      <div className="flex items-start gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-bold transform rotate-6 flex-shrink-0 shadow-md">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-gray-800 text-base transform -rotate-0.5 hover:text-green-600 transition-colors" style={{ fontFamily: getFontFamily() }}>
                            {point.name}
                          </h4>
                        </div>
                      </div>
                      
                      {/* 时间戳 */}
                      <div className="flex items-center gap-2 ml-11">
                        <button 
                          className="text-sm font-mono text-white bg-green-500 hover:bg-green-600 px-3 py-1 rounded-full font-bold inline-flex items-center gap-1 shadow-sm transform -rotate-1 transition-all hover:scale-105"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTimeJump(point.start_time);
                          }}
                        >
                          <Clock className="w-3 h-3" />
                          {point.start_time} - {point.end_time}
                        </button>
                        <span className="text-xs text-gray-500">点击跳转</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

