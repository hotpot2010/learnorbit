'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import Editor from '@monaco-editor/react';
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
  Sparkles,
  Edit2,
  Check,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useMobileLayout } from '@/hooks/use-mobile-layout';

// QA对类型定义
interface QAPair {
  question: string;
  answer: string;
  timestamp: string;  // 提问时间
}

// 练习题类型
type ExerciseType = 'fill_blank' | 'guided_steps' | 'code_choice' | 'complete';

interface Exercise {
  type: ExerciseType;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  language: string;
  starter_code: string;
  solution: string;
  hints: string[];
  test_cases: Array<{
    input: string;
    expected: string;
  }>;
}

// 知识点类型定义
interface KnowledgePoint {
  name: string;
  start_time: string;
  end_time: string;
  note?: string;  // AI生成的笔记
  thumbnail?: string;  // 视频截图缩略图
  isGeneratingNote?: boolean;  // 是否正在生成笔记
  qaList?: QAPair[];  // Q&A列表
  isAsking?: boolean;  // 是否正在提问
  exercise?: Exercise;  // 练习题
  isGeneratingExercise?: boolean;  // 是否正在生成练习
  userCode?: string;  // 用户编写的代码
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
  const [cdnVideoUrl, setCdnVideoUrl] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentKnowledgeIndex, setCurrentKnowledgeIndex] = useState(0);
  
  // UI状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTranscript, setShowTranscript] = useState(true);
  const [selectedSection, setSelectedSection] = useState(mockVideoSections[2]);
  const [notes, setNotes] = useState(mockNotes);
  const [showAIChat, setShowAIChat] = useState(false);
  const [isDragging, setIsDragging] = useState<number | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set([1])); // 默认展开第一条
  const [videoTitle, setVideoTitle] = useState<string>(''); // 视频标题
  const [fullTranscript, setFullTranscript] = useState<string>(''); // 完整逐字稿
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null); // 正在编辑的笔记索引
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string>(''); // 当前视频URL（用于缓存）
  const [expandedKnowledgePoints, setExpandedKnowledgePoints] = useState<Set<number>>(new Set([0])); // 展开的知识点索引
  const knowledgeListRef = useRef<HTMLDivElement>(null); // 知识点列表引用
  const [askingKnowledgeIndex, setAskingKnowledgeIndex] = useState<number | null>(null); // 正在提问的知识点索引
  const [questionInput, setQuestionInput] = useState<string>(''); // 问题输入
  
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
      console.log('📤 发送视频解析请求:', {
        video_urls: [videoUrl],
        prompt: '提取视频中的知识点',
        job_name: '视频笔记测试'
      });
      
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

      console.log('📡 响应状态:', response.status, response.statusText);
      
      const data = await response.json();
      console.log('📦 响应数据:', data);
      
      if (data.success && data.job_id) {
        console.log('✅ 任务创建成功, Job ID:', data.job_id);
        // 轮询任务状态
        await pollJobStatus(data.job_id);
      } else {
        console.error('❌ 创建任务失败:', data);
        alert(`创建任务失败: ${data.error || '未知错误'}\n\n请检查：\n1. 后端服务是否运行\n2. 视频URL是否正确\n3. 查看浏览器控制台了解详情`);
      }
    } catch (error) {
      console.error('❌ 解析视频异常:', error);
      alert(`解析视频失败: ${error}\n\n请检查：\n1. 后端服务是否在运行 (http://localhost:8000)\n2. 网络连接是否正常\n3. 浏览器控制台查看详细错误`);
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
            
            // 提取CDN视频URL
            const videoUrl = result.analysis?.result?.video_info?.url || '';
            setCdnVideoUrl(videoUrl);
            
            // 提取视频标题
            const title = result.video_info?.title || '视频笔记';
            setVideoTitle(title);
            
            // 提取完整逐字稿
            const transcript = result.analysis?.result?.transcript || '';
            setFullTranscript(transcript);
            
            // 保存原始视频URL（用于笔记缓存）
            setCurrentVideoUrl(videoUrl);
            
            console.log('✅ 解析完成，提取到', points.length, '个知识点');
            console.log('🎬 CDN视频链接:', videoUrl);
            console.log('📝 视频标题:', title);
            console.log('📄 逐字稿长度:', transcript.length);
            console.log('🔗 原始视频URL:', videoUrl);
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
    
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play();
      setIsPlaying(true);
      console.log('🎯 跳转到时间:', time, '(', seconds, '秒)');
    }
  };
  
  // 切换播放/暂停
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };
  
  // 改变播放速度
  const changePlaybackRate = (rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
      console.log('⚡ 播放速度:', rate + 'x');
    }
  };
  
  // 跳转到下一个知识点
  const jumpToNextKnowledge = () => {
    if (currentKnowledgeIndex < knowledgePoints.length - 1) {
      const nextIndex = currentKnowledgeIndex + 1;
      const nextPoint = knowledgePoints[nextIndex];
      handleTimeJump(nextPoint.start_time);
      setCurrentKnowledgeIndex(nextIndex);
      
      // ✅ 自动展开当前知识点，收起其他
      setExpandedKnowledgePoints(new Set([nextIndex]));
      
      // ✅ 滚动到顶部
      scrollToKnowledgePoint(nextIndex);
      
      console.log('⏭️ 跳转到下一个知识点:', nextPoint.name);
    }
  };
  
  // 更新当前播放时间和高亮知识点
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      
      // 查找当前时间对应的知识点
      for (let i = 0; i < knowledgePoints.length; i++) {
        const point = knowledgePoints[i];
        const startSeconds = timeToSeconds(point.start_time);
        const endSeconds = timeToSeconds(point.end_time);
        
        if (time >= startSeconds && time <= endSeconds) {
          if (currentKnowledgeIndex !== i) {
            setCurrentKnowledgeIndex(i);
            // 自动展开当前知识点，收起其他
            setExpandedKnowledgePoints(new Set([i]));
            // 滚动到当前知识点
            scrollToKnowledgePoint(i);
          }
          break;
        }
      }
    }
  };
  
  // 滚动到指定知识点（滚动到顶部）
  const scrollToKnowledgePoint = (index: number) => {
    if (knowledgeListRef.current) {
      const knowledgeCard = knowledgeListRef.current.children[index] as HTMLElement;
      if (knowledgeCard) {
        knowledgeCard.scrollIntoView({
          behavior: 'smooth',
          block: 'start'  // 改为 'start'，使其显示在顶部
        });
      }
    }
  };
  
  // 切换知识点展开/收起
  const toggleKnowledgePoint = (index: number) => {
    setExpandedKnowledgePoints(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };
  
  // 提取知识点对应的逐字稿片段
  const extractTranscriptSegment = (startTime: string, endTime: string): string => {
    if (!fullTranscript) return '';
    
    const startSeconds = timeToSeconds(startTime);
    const endSeconds = timeToSeconds(endTime);
    
    // 逐字稿格式: [MM:SS - MM:SS] 文本
    const lines = fullTranscript.split('\n');
    const relevantLines = lines.filter(line => {
      const timeMatch = line.match(/\[(\d{2}:\d{2}) - (\d{2}:\d{2})\]/);
      if (timeMatch) {
        const lineStart = timeToSeconds(timeMatch[1]);
        const lineEnd = timeToSeconds(timeMatch[2]);
        return lineStart >= startSeconds && lineEnd <= endSeconds;
      }
      return false;
    });
    
    return relevantLines.join('\n');
  };
  
  // 捕获视频截图
  const captureVideoThumbnail = (): string => {
    if (!videoRef.current) {
      console.log('⚠️ Video ref not available');
      return '';
    }
    
    try {
      const canvas = document.createElement('canvas');
      const video = videoRef.current;
      
      // 设置canvas大小为视频大小
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
      
      console.log(`📸 Capturing screenshot: ${canvas.width}x${canvas.height}`);
      
      // 绘制当前帧到canvas
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        try {
          // 转换为base64图片
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          console.log('✅ Screenshot captured successfully');
          return dataUrl;
        } catch (error) {
          console.error('❌ Canvas toDataURL error (CORS issue):', error);
          // 如果CORS问题导致无法导出，返回空字符串
          // 笔记仍然可以生成，只是没有缩略图
          return '';
        }
      }
    } catch (error) {
      console.error('❌ Screenshot capture error:', error);
    }
    
    return '';
  };
  
  // 生成知识点笔记
  const generateNote = async (index: number) => {
    const point = knowledgePoints[index];
    
    // 标记为正在生成
    setKnowledgePoints(prev => prev.map((p, i) => 
      i === index ? { ...p, isGeneratingNote: true } : p
    ));
    
    try {
      // 捕获当前视频截图（可能因CORS失败，但不影响笔记生成）
      const thumbnail = captureVideoThumbnail();
      if (!thumbnail) {
        console.log('⚠️ Screenshot not available (CORS issue), continuing without thumbnail');
      }
      
      // 提取对应的逐字稿片段
      const transcriptSegment = extractTranscriptSegment(point.start_time, point.end_time);
      
      console.log('📝 Generating note for:', point.name);
      console.log('📄 Transcript segment:', transcriptSegment.substring(0, 100), '...');
      
      // 调用后端API生成笔记
      console.log('🔗 Calling backend API:', 'http://localhost:8000/notes/generate');
      
      const response = await fetch('http://localhost:8000/notes/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          knowledge_point_name: point.name,
          transcript_segment: transcriptSegment,
          video_title: videoTitle,
          video_url: videoUrl  // 传递视频URL用于缓存
        }),
      });
      
      console.log('📡 Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('📦 Response data:', data);
      
      if (data.success && data.note) {
        // 更新知识点，添加笔记和缩略图（如果有）
        setKnowledgePoints(prev => prev.map((p, i) => 
          i === index ? { 
            ...p, 
            note: data.note,
            thumbnail: thumbnail || undefined, // 只在有截图时添加
            isGeneratingNote: false 
          } : p
        ));
        
        if (data.from_cache) {
          console.log('✅ Note loaded from cache');
        } else {
          console.log('✅ Note generated by LLM and cached');
        }
        
        if (thumbnail) {
          console.log('✅ Thumbnail included');
        }
      } else {
        const errorMsg = data.error || 'Unknown error';
        console.error('❌ Failed to generate note:', errorMsg);
        console.error('Full response:', data);
        alert(`生成笔记失败: ${errorMsg}`);
        setKnowledgePoints(prev => prev.map((p, i) => 
          i === index ? { ...p, isGeneratingNote: false } : p
        ));
      }
    } catch (error) {
      console.error('❌ Error generating note:', error);
      setKnowledgePoints(prev => prev.map((p, i) => 
        i === index ? { ...p, isGeneratingNote: false } : p
      ));
    }
  };
  
  // 更新笔记内容（编辑后）
  const updateNote = (index: number, newNote: string) => {
    setKnowledgePoints(prev => prev.map((p, i) => 
      i === index ? { ...p, note: newNote } : p
    ));
    setEditingNoteIndex(null);
  };
  
  // 处理提问
  const handleAskQuestion = async (index: number) => {
    const question = questionInput.trim();
    if (!question) {
      alert('请输入问题');
      return;
    }
    
    const point = knowledgePoints[index];
    
    // 暂停视频
    if (videoRef.current && isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    
    // 标记为正在提问
    setKnowledgePoints(prev => prev.map((p, i) => 
      i === index ? { ...p, isAsking: true } : p
    ));
    
    try {
      // 提取对应的逐字稿片段作为上下文
      const transcriptSegment = extractTranscriptSegment(point.start_time, point.end_time);
      
      console.log('🤔 Asking question:', question);
      console.log('📄 Context:', transcriptSegment.substring(0, 100), '...');
      
      // 调用LLM API回答问题
      const response = await fetch('http://localhost:8000/notes/answer-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: question,
          knowledge_point_name: point.name,
          transcript_segment: transcriptSegment,
          video_title: videoTitle,
          video_url: currentVideoUrl
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.answer) {
        // 创建QA对
        const qaPair: QAPair = {
          question: question,
          answer: data.answer,
          timestamp: new Date().toISOString()
        };
        
        // 更新知识点，添加QA对
        setKnowledgePoints(prev => prev.map((p, i) => {
          if (i === index) {
            const qaList = p.qaList || [];
            return {
              ...p,
              qaList: [...qaList, qaPair],
              isAsking: false
            };
          }
          return p;
        }));
        
        console.log('✅ Question answered:', qaPair);
        
        // 清空输入框，关闭弹窗
        setQuestionInput('');
        setAskingKnowledgeIndex(null);
        
        // 继续播放视频
        if (videoRef.current) {
          videoRef.current.play();
          setIsPlaying(true);
        }
      } else {
        throw new Error(data.error || '回答生成失败');
      }
    } catch (error) {
      console.error('❌ Error asking question:', error);
      alert(`提问失败: ${error}`);
      setKnowledgePoints(prev => prev.map((p, i) => 
        i === index ? { ...p, isAsking: false } : p
      ));
    }
  };
  
  // 更新用户代码
  const updateUserCode = (index: number, code: string) => {
    setKnowledgePoints(prev => prev.map((p, i) => 
      i === index ? { ...p, userCode: code } : p
    ));
  };
  
  // 生成练习题
  const generateExercise = async (index: number) => {
    const point = knowledgePoints[index];
    
    // 暂停视频
    if (videoRef.current && isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
      console.log('⏸️ 视频已暂停，开始生成练习');
    }
    
    // 标记为正在生成
    setKnowledgePoints(prev => prev.map((p, i) => 
      i === index ? { ...p, isGeneratingExercise: true } : p
    ));
    
    try {
      // 提取对应的逐字稿片段作为上下文
      const transcriptSegment = extractTranscriptSegment(point.start_time, point.end_time);
      
      console.log('💪 Generating exercise for:', point.name);
      console.log('📄 Context:', transcriptSegment.substring(0, 100), '...');
      
      // 调用LLM API生成练习
      const response = await fetch('http://localhost:8000/notes/generate-exercise', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          knowledge_point_name: point.name,
          transcript_segment: transcriptSegment,
          video_title: videoTitle,
          video_url: currentVideoUrl
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.exercise) {
        // 更新知识点，添加练习题
        setKnowledgePoints(prev => prev.map((p, i) => {
          if (i === index) {
            return {
              ...p,
              exercise: data.exercise,
              userCode: data.exercise.starter_code,  // 初始化用户代码
              isGeneratingExercise: false
            };
          }
          return p;
        }));
        
        console.log('✅ Exercise generated:', data.exercise);
      } else {
        throw new Error(data.error || '练习生成失败');
      }
    } catch (error) {
      console.error('❌ Error generating exercise:', error);
      alert(`生成练习失败: ${error}`);
      setKnowledgePoints(prev => prev.map((p, i) => 
        i === index ? { ...p, isGeneratingExercise: false } : p
      ));
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
      className="flex flex-col bg-gray-50"
      style={{
        backgroundImage: `
          linear-gradient(to right, #f0f0f0 1px, transparent 1px),
          linear-gradient(to bottom, #f0f0f0 1px, transparent 1px)
        `,
        backgroundSize: '20px 20px',
        height: 'calc(100vh - var(--navbar-height, 64px))', // 减去导航栏高度
      }}
    >
      {/* 主要内容区域 */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        
        {/* 左侧：视频和功能按钮区域 (2/3) */}
        <div className="w-2/3 flex flex-col gap-4 justify-center overflow-y-auto">
          
          {/* 视频和按钮容器 */}
          <div className="flex flex-col gap-4">
            {/* 视频标题 - 无底框 */}
            {videoTitle && (
              <div className="px-2 flex-shrink-0">
                <h2 className="text-2xl font-bold text-gray-800" style={{ fontFamily: getFontFamily() }}>
                  {videoTitle}
                </h2>
              </div>
            )}
            
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
            ) : cdnVideoUrl ? (
              <div className="relative aspect-video bg-black">
                {/* HTML5 视频播放器 */}
                <video
                  ref={videoRef}
                  src={cdnVideoUrl}
                  className="w-full h-full"
                  controls
                  crossOrigin="anonymous"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  onTimeUpdate={handleTimeUpdate}
                >
                  您的浏览器不支持 video 标签。
                </video>
                
                {/* 自定义播放速度控制 */}
                <div className="absolute top-4 right-4 bg-black/70 rounded-lg p-2 flex gap-1">
                  {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => changePlaybackRate(rate)}
                      className={`px-2 py-1 text-xs rounded transition-all ${
                        playbackRate === rate
                          ? 'bg-green-500 text-white font-bold'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="relative aspect-video bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-8xl mb-4">🎥</div>
                  <p className="text-white text-xl font-bold" style={{ fontFamily: getFontFamily() }}>
                    等待视频加载...
                  </p>
                </div>
              </div>
            )}
            </div>

            {/* 功能按钮区域 - 无底框，不同颜色 */}
            <div className="flex gap-4 justify-center flex-shrink-0">
            {/* Next知识点按钮 - 绿色 */}
            <Button
              onClick={jumpToNextKnowledge}
              disabled={currentKnowledgeIndex >= knowledgePoints.length - 1}
              className="flex-1 max-w-xs py-6 text-lg font-bold bg-green-500 hover:bg-green-600 text-white shadow-lg"
              size="lg"
            >
              <SkipForward className="w-5 h-5 mr-2" />
              Next 知识点
            </Button>
            
            {/* 提问按钮 - 蓝色 */}
            <Button
              onClick={() => setAskingKnowledgeIndex(currentKnowledgeIndex)}
              className="flex-1 max-w-xs py-6 text-lg font-bold bg-blue-500 text-white shadow-lg hover:bg-blue-600 transition-colors"
              size="lg"
            >
              <MessageSquare className="w-5 h-5 mr-2" />
              提问
            </Button>
            
            {/* 笔记按钮 - 紫色 */}
            <Button
              onClick={() => generateNote(currentKnowledgeIndex)}
              disabled={!knowledgePoints[currentKnowledgeIndex] || knowledgePoints[currentKnowledgeIndex]?.isGeneratingNote}
              className="flex-1 max-w-xs py-6 text-lg font-bold bg-purple-500 hover:bg-purple-600 text-white shadow-lg disabled:bg-purple-500/50 disabled:cursor-not-allowed"
              size="lg"
            >
              {knowledgePoints[currentKnowledgeIndex]?.isGeneratingNote ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <StickyNote className="w-5 h-5 mr-2" />
                  笔记
                </>
              )}
            </Button>
            
            {/* 练习按钮 - 橙色 */}
            <Button
              onClick={() => generateExercise(currentKnowledgeIndex)}
              disabled={!knowledgePoints[currentKnowledgeIndex] || knowledgePoints[currentKnowledgeIndex]?.isGeneratingExercise}
              className="flex-1 max-w-xs py-6 text-lg font-bold bg-orange-500 text-white shadow-lg hover:bg-orange-600 transition-colors disabled:bg-orange-500/50 disabled:cursor-not-allowed"
              size="lg"
            >
              {knowledgePoints[currentKnowledgeIndex]?.isGeneratingExercise ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <CheckSquare className="w-5 h-5 mr-2" />
                  练习
                </>
              )}
            </Button>
            </div>
          </div>
        </div>

        {/* 右侧：知识点区域 (1/3) */}
        <div className="w-1/3 flex flex-col overflow-hidden">
          {/* 知识点内容区域 - 移除标题 */}
          <div ref={knowledgeListRef} className="flex-1 overflow-y-auto pr-2">
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
                {knowledgePoints.map((point, index) => {
                  const isActive = index === currentKnowledgeIndex;
                  const hasNote = !!point.note;
                  const isExpanded = expandedKnowledgePoints.has(index);
                  
                  return (
                    <div
                      key={index}
                      className="group transition-all duration-300"
                    >
                      <div className={`rounded-lg p-4 border-2 transition-all duration-200 ${
                        isActive
                          ? 'bg-green-100 border-green-500 shadow-lg'
                          : 'bg-white border-green-200 hover:border-green-400 hover:shadow-md'
                      }`}>
                        {/* 名称和时间戳在同一行 */}
                        <div 
                          className="flex items-center justify-between gap-3 cursor-pointer"
                          onClick={() => {
                            handleTimeJump(point.start_time);
                            setCurrentKnowledgeIndex(index);
                            // 自动展开当前知识点
                            setExpandedKnowledgePoints(new Set([index]));
                            // 滚动到顶部
                            scrollToKnowledgePoint(index);
                          }}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm ${
                              isActive
                                ? 'bg-green-600 text-white'
                                : 'bg-green-500 text-white'
                            }`}>
                              {index + 1}
                            </div>
                            <h4 className={`font-bold text-sm transition-colors truncate ${
                              isActive
                                ? 'text-green-700'
                                : 'text-gray-800 group-hover:text-green-600'
                            }`}>
                              {point.name}
                            </h4>
                            {hasNote && (
                              <StickyNote className="w-4 h-4 text-purple-500 flex-shrink-0" />
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {/* 时间戳区间 */}
                            <div className={`text-xs font-mono px-2 py-1 rounded font-bold ${
                              isActive
                                ? 'bg-green-600 text-white'
                                : 'bg-green-500 text-white'
                            }`}>
                              {point.start_time} - {point.end_time}
                            </div>
                            
                            {/* 展开/收起图标 */}
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-gray-500" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-500" />
                            )}
                          </div>
                        </div>
                        
                        {/* 笔记内容区域 - 只在展开时显示 */}
                        {hasNote && isExpanded && (
                          <div className="mt-3 pt-3 border-t border-green-200">
                            {/* 缩略图 */}
                            {point.thumbnail && (
                              <div className="mb-2">
                                <img 
                                  src={point.thumbnail} 
                                  alt="视频截图" 
                                  className="w-full rounded-md shadow-sm"
                                />
                              </div>
                            )}
                            
                            {/* 笔记文本 */}
                            {editingNoteIndex === index ? (
                              <div className="space-y-2">
                                <textarea
                                  value={point.note}
                                  onChange={(e) => {
                                    setKnowledgePoints(prev => prev.map((p, i) => 
                                      i === index ? { ...p, note: e.target.value } : p
                                    ));
                                  }}
                                  className="w-full p-2 border border-gray-300 rounded-md text-sm resize-none"
                                  rows={4}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingNoteIndex(null);
                                    }}
                                    className="flex items-center gap-1 px-3 py-1 bg-green-500 text-white rounded-md text-xs hover:bg-green-600"
                                  >
                                    <Check className="w-3 h-3" />
                                    完成
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingNoteIndex(null);
                                    }}
                                    className="px-3 py-1 bg-gray-300 text-gray-700 rounded-md text-xs hover:bg-gray-400"
                                  >
                                    取消
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="relative group/note">
                                <div className="prose prose-sm max-w-none text-gray-700">
                                  <ReactMarkdown>{point.note}</ReactMarkdown>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingNoteIndex(index);
                                  }}
                                  className="absolute top-0 right-0 opacity-0 group-hover/note:opacity-100 transition-opacity p-1 bg-purple-500 text-white rounded-md hover:bg-purple-600"
                                  title="编辑笔记"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Q&A 列表 */}
                        {point.qaList && point.qaList.length > 0 && isExpanded && (
                          <div className="mt-4 pt-4 border-t border-green-200 space-y-3">
                            {point.qaList.map((qa, qaIndex) => (
                              <div 
                                key={qaIndex}
                                className="bg-blue-50 rounded-lg p-3 border-2 border-blue-200"
                                style={{
                                  fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                                }}
                              >
                                <div className="mb-2">
                                  <span className="font-bold text-blue-700">Q：</span>
                                  <span className="text-gray-800">{qa.question}</span>
                                </div>
                                <div>
                                  <span className="font-bold text-blue-700">A：</span>
                                  <span className="text-gray-700">{qa.answer}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* 练习题编辑器 */}
                        {point.exercise && isExpanded && (
                          <div className="mt-4 pt-4 border-t border-green-200">
                            <div className="bg-gray-900 rounded-lg overflow-hidden">
                              {/* 题目信息栏 */}
                              <div className="bg-gray-800 p-4 text-white">
                                <h4 className="font-bold text-lg mb-2">{point.exercise.title}</h4>
                                <p className="text-sm text-gray-300 mb-3">{point.exercise.description}</p>
                                <div className="flex gap-2 text-xs">
                                  <span className={`px-2 py-1 rounded ${
                                    point.exercise.type === 'fill_blank' ? 'bg-blue-600' :
                                    point.exercise.type === 'guided_steps' ? 'bg-green-600' :
                                    point.exercise.type === 'code_choice' ? 'bg-purple-600' :
                                    'bg-red-600'
                                  }`}>
                                    {point.exercise.type === 'fill_blank' ? '填空题' :
                                     point.exercise.type === 'guided_steps' ? '分步引导' :
                                     point.exercise.type === 'code_choice' ? '代码选择' :
                                     '完整编程'}
                                  </span>
                                  <span className={`px-2 py-1 rounded ${
                                    point.exercise.difficulty === 'beginner' ? 'bg-green-600' :
                                    point.exercise.difficulty === 'intermediate' ? 'bg-yellow-600' :
                                    'bg-red-600'
                                  }`}>
                                    {point.exercise.difficulty === 'beginner' ? '初级' :
                                     point.exercise.difficulty === 'intermediate' ? '中级' :
                                     '高级'}
                                  </span>
                                  <span className="px-2 py-1 bg-purple-600 rounded">
                                    {point.exercise.language}
                                  </span>
                                </div>
                              </div>
                              
                              {/* 代码编辑器 */}
                              <Editor
                                height="300px"
                                language={point.exercise.language}
                                value={point.userCode || point.exercise.starter_code}
                                onChange={(value) => updateUserCode(index, value || '')}
                                theme="vs-dark"
                                options={{
                                  minimap: { enabled: false },
                                  fontSize: 14,
                                  lineNumbers: 'on',
                                  scrollBeyondLastLine: false,
                                  automaticLayout: true,
                                  tabSize: 4,
                                  wordWrap: 'on',
                                }}
                              />
                              
                              {/* 提示和测试用例 */}
                              <div className="bg-gray-800 p-4 text-white space-y-3">
                                {/* 提示 */}
                                {point.exercise.hints && point.exercise.hints.length > 0 && (
                                  <details className="group">
                                    <summary className="cursor-pointer text-yellow-400 hover:text-yellow-300 font-medium flex items-center gap-2">
                                      💡 查看提示 ({point.exercise.hints.length})
                                      <span className="text-xs text-gray-400">(点击展开)</span>
                                    </summary>
                                    <ul className="mt-2 space-y-1 text-sm pl-4">
                                      {point.exercise.hints.map((hint, i) => (
                                        <li key={i} className="text-gray-300 leading-relaxed">
                                          • {hint}
                                        </li>
                                      ))}
                                    </ul>
                                  </details>
                                )}
                                
                                {/* 测试用例 */}
                                {point.exercise.test_cases && point.exercise.test_cases.length > 0 && (
                                  <details className="group">
                                    <summary className="cursor-pointer text-blue-400 hover:text-blue-300 font-medium flex items-center gap-2">
                                      🧪 测试用例 ({point.exercise.test_cases.length})
                                      <span className="text-xs text-gray-400">(点击展开)</span>
                                    </summary>
                                    <div className="mt-2 space-y-2 text-sm">
                                      {point.exercise.test_cases.map((test, i) => (
                                        <div key={i} className="bg-gray-700 p-3 rounded">
                                          <div className="text-gray-400 mb-1">
                                            <span className="font-semibold">输入:</span> {test.input}
                                          </div>
                                          <div className="text-gray-400">
                                            <span className="font-semibold">期望:</span> {test.expected}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </details>
                                )}
                                
                                {/* 提交按钮（暂未实现） */}
                                <button 
                                  disabled
                                  className="w-full py-2 bg-gray-600 text-gray-400 rounded cursor-not-allowed hover:bg-gray-600 transition-colors"
                                >
                                  提交答案（功能开发中）
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* 保存笔记按钮 */}
            {knowledgePoints.length > 0 && (
              <div className="mt-4 px-4">
                <button
                  onClick={() => {
                    // TODO: 实现保存笔记功能
                    alert('保存笔记功能待实现');
                  }}
                  className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium rounded-lg shadow-md hover:shadow-lg hover:from-green-600 hover:to-emerald-600 transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <svg 
                    className="w-5 h-5" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" 
                    />
                  </svg>
                  保存笔记
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* 提问输入框 - 页面内弹出 */}
      {askingKnowledgeIndex !== null && (
        <div 
          className="fixed bottom-0 left-0 right-0 bg-white border-t-4 border-blue-500 shadow-2xl z-50 animate-in slide-in-from-bottom duration-200"
          style={{ maxHeight: '40vh' }}
        >
          <div className="max-w-4xl mx-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-500" />
                <span className="font-bold text-gray-800">提问：</span>
                <span className="text-sm text-gray-600">{knowledgePoints[askingKnowledgeIndex]?.name}</span>
              </div>
              <button
                onClick={() => {
                  setAskingKnowledgeIndex(null);
                  setQuestionInput('');
                  // 继续播放视频
                  if (videoRef.current && !isPlaying) {
                    videoRef.current.play();
                    setIsPlaying(true);
                  }
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex gap-2">
              <input
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && questionInput.trim() && !knowledgePoints[askingKnowledgeIndex]?.isAsking) {
                    e.preventDefault();
                    handleAskQuestion(askingKnowledgeIndex);
                  }
                }}
                placeholder="输入你的问题，按Enter提问..."
                className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition-colors text-sm"
                autoFocus
              />
              <button
                onClick={() => handleAskQuestion(askingKnowledgeIndex)}
                disabled={!questionInput.trim() || knowledgePoints[askingKnowledgeIndex]?.isAsking}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2 min-w-[100px]"
              >
                {knowledgePoints[askingKnowledgeIndex]?.isAsking ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    思考中
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    提问
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

