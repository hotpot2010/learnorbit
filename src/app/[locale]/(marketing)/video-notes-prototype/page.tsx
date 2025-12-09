'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import Editor from '@monaco-editor/react';
import html2canvas from 'html2canvas';
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
  CheckCircle,
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
  ChevronUp,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useMobileLayout } from '@/hooks/use-mobile-layout';
import { buildApiUrl, API_ENDPOINTS, API_BASE_URL } from '@/config/api';
import { useTranslations, useLocale } from 'next-intl';

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
  validationResult?: ValidationResult;  // 答案验证结果
  isValidating?: boolean;  // 是否正在验证答案
}

// 答案验证结果类型
interface ValidationResult {
  passed: boolean;
  score?: number;
  feedback?: string;
}

interface PartInfo {
  part_number: number;
  part_title: string;
  duration: number;
  url: string;
  bv_id: string;
}

interface VideoAnalysisResult {
  success: boolean;
  is_series?: boolean;
  series_title?: string;
  total_parts?: number;
  parts?: PartInfo[];
  video_info?: {
    title: string;
    bv_id: string;
    url: string;
    part_number?: number;
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
  const locale = useLocale();
  const t = useTranslations('LearningPlatform.videoNotes');
  
  // 加载YouTube iframe API（仅在英文模式下需要）
  useEffect(() => {
    if (locale === 'en' && !(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      
      (window as any).onYouTubeIframeAPIReady = () => {
        console.log('✅ YouTube iframe API loaded');
      };
    }
  }, [locale]);

  // 视频相关状态
  const [videoUrl, setVideoUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({
    stage: '' as 'idle' | 'creating_task' | 'downloading_video' | 'uploading_video' | 'extracting_audio' | 'transcribing' | 'analyzing_content' | 'extracting_knowledge' | 'completed',
    message: '',
    progress: 0, // 0-100
    estimatedTime: '', // 预计剩余时间
    currentStep: '', // 当前步骤详情
  });
  const [analysisResult, setAnalysisResult] = useState<VideoAnalysisResult | null>(null);
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [cdnVideoUrl, setCdnVideoUrl] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const youtubePlayerRef = useRef<any>(null); // YouTube Player API实例
  const youtubeVideoIdRef = useRef<string>(''); // 当前YouTube视频ID（用于截图）
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentKnowledgeIndex, setCurrentKnowledgeIndex] = useState(0);
  
  // 已处理视频的相关状态
  const [isProcessedVideo, setIsProcessedVideo] = useState(false);
  const [processedTaskData, setProcessedTaskData] = useState<any>(null);
  // 使用 ref 来存储，确保在异步操作中也能访问到最新值
  const processedTaskDataRef = useRef<any>(null);
  const isProcessedVideoRef = useRef<boolean>(false);

  // 检查URL参数，加载已处理视频数据
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlVideoUrl = urlParams.get('videoUrl');
    const isProcessed = urlParams.get('processed') === 'true';
    const taskId = urlParams.get('taskId');

    if (urlVideoUrl) {
      setVideoUrl(decodeURIComponent(urlVideoUrl));
      
      // 如果是已处理的视频，从后端API获取完整数据
      if (isProcessed && taskId) {
        console.log('📚 加载已处理视频数据, taskId:', taskId);
        setIsProcessedVideo(true); // 🔥 立即标记为已处理视频
        isProcessedVideoRef.current = true; // 同时设置 ref
        
        const loadProcessedData = async () => {
          try {
            setIsAnalyzing(true);
            setAnalysisProgress({
              stage: 'extracting_knowledge',
              message: '正在加载已处理的视频数据...',
              progress: 30,
              estimatedTime: '',
              currentStep: '从后端获取任务信息',
            });

            // 从后端API获取任务详情
            const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const response = await fetch(`${BACKEND_API_URL}/open-api/offline-video/tasks/${taskId}`);
            
            if (!response.ok) {
              throw new Error(`获取任务详情失败: ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ 获取任务数据:', data);

            if (!data.success || !data.task) {
              throw new Error('任务数据格式错误');
            }

            const task = data.task;
            setProcessedTaskData(task); // 保存任务数据
            processedTaskDataRef.current = task; // 同时设置 ref
            console.log('🔥 已保存任务数据到state和ref');
            console.log('🔥 isProcessedVideoRef.current=', isProcessedVideoRef.current);
            console.log('🔥 processedTaskDataRef.current=', !!processedTaskDataRef.current);
            
            // 检查是否是多P视频
            const seriesParts = task.series_parts;
            if (seriesParts && Array.isArray(seriesParts) && seriesParts.length > 1) {
              setIsSeries(true);
              setSeriesTitle(task.title || task.video_title || '未知标题');
              setAllParts(seriesParts);
              setCurrentPartIndex(0); // 设置当前分P索引
              console.log(`✅ 多P视频，共 ${seriesParts.length} 个分P`);
              
              // 设置分析结果，模拟已完成的分析（避免触发新的分析流程）
              setAnalysisResult({
                success: true,
                is_series: true,
                series_title: task.title || task.video_title,
                total_parts: seriesParts.length,
                parts: seriesParts,
              });
            }
            
            // 设置视频URL（取第一个分P）
            const videoUrls = task.video_url;
            if (videoUrls) {
              const videoUrlArray = typeof videoUrls === 'string' 
                ? (videoUrls.startsWith('[') ? JSON.parse(videoUrls) : [videoUrls])
                : videoUrls;
              const firstVideoUrl = Array.isArray(videoUrlArray) ? videoUrlArray[0] : videoUrlArray;
              setCdnVideoUrl(firstVideoUrl);
              console.log('✅ 设置CDN视频URL:', firstVideoUrl);
            }

            setAnalysisProgress({
              stage: 'extracting_knowledge',
              message: '正在加载知识点数据...',
              progress: 60,
              estimatedTime: '',
              currentStep: '从CDN加载',
            });

            // 加载知识点JSON
            const kpUrls = task.knowledge_points_result_url;
            if (kpUrls) {
              const kpUrlArray = typeof kpUrls === 'string'
                ? (kpUrls.startsWith('[') ? JSON.parse(kpUrls) : [kpUrls])
                : kpUrls;
              const firstKpUrl = Array.isArray(kpUrlArray) ? kpUrlArray[0] : kpUrlArray;
              
              const kpResponse = await fetch(firstKpUrl);
              const kpData = await kpResponse.json();
              
              console.log('✅ 加载知识点数据:', kpData);
              
              // 支持两种格式：直接数组 或 {knowledge_points: [...]}
              let kpArray = kpData;
              if (!Array.isArray(kpData) && kpData.knowledge_points) {
                kpArray = kpData.knowledge_points;
              }
              
              if (Array.isArray(kpArray) && kpArray.length > 0) {
                setKnowledgePoints(kpArray);
                console.log(`✅ 设置 ${kpArray.length} 个知识点`);
                // 自动全部展开
                const allIndexes = kpArray.map((_, idx) => idx);
                setExpandedKnowledgePoints(new Set(allIndexes));
                setIsAllExpanded(true);
              } else {
                console.log(`ℹ️ 知识点数据为空（可能视频内容较少或无教学内容）`);
              }
            }

            setAnalysisProgress({
              stage: 'completed',
              message: '已处理视频加载完成！',
              progress: 100,
              estimatedTime: '',
              currentStep: '完成',
            });
            
            setTimeout(() => {
              setIsAnalyzing(false);
            }, 1000);
          } catch (error) {
            console.error('❌ 加载已处理数据失败:', error);
            setIsAnalyzing(false);
            setAnalysisProgress({
              stage: 'idle',
              message: '加载失败',
              progress: 0,
              estimatedTime: '',
              currentStep: '',
            });
          }
        };

        loadProcessedData();
      }
    }
  }, []); // 只在组件挂载时执行一次

  // 初始化YouTube播放器（必须在cdnVideoUrl定义之后）
  useEffect(() => {
    if (locale !== 'en' || !cdnVideoUrl) {
      return;
    }
    
    const isYouTube = cdnVideoUrl.includes('youtube.com') || cdnVideoUrl.includes('youtu.be');
    if (!isYouTube) {
      return;
    }
    
    // 提取YouTube视频ID
    const videoIdMatch = cdnVideoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    const videoId = videoIdMatch ? videoIdMatch[1] : '';
    
    if (!videoId) {
      return;
    }
    
    // 保存videoId用于截图
    youtubeVideoIdRef.current = videoId;
    
    // 先销毁旧的播放器实例（如果存在）
    if (youtubePlayerRef.current && typeof youtubePlayerRef.current.destroy === 'function') {
      try {
        youtubePlayerRef.current.destroy();
        console.log('🗑️ 已销毁旧的YouTube播放器');
      } catch (error) {
        console.error('❌ YouTube播放器销毁失败:', error);
      }
      youtubePlayerRef.current = null;
    }
    
    const initYouTubePlayer = () => {
      const playerElement = document.getElementById('youtube-player');
      if (!playerElement) {
        console.warn('⚠️ YouTube播放器DOM元素未找到，延迟重试...');
        // 如果DOM元素还没渲染，延迟重试
        setTimeout(initYouTubePlayer, 200);
        return;
      }
      
      if ((window as any).YT && (window as any).YT.Player) {
        // YouTube API已加载，初始化播放器
        if (!youtubePlayerRef.current) {
          try {
            youtubePlayerRef.current = new (window as any).YT.Player('youtube-player', {
              videoId: videoId,
              width: '100%',
              height: '100%',
              playerVars: {
                enablejsapi: 1,
                origin: window.location.origin,
                controls: 1,
                rel: 0,
                modestbranding: 1,
                playsinline: 1,
              },
              events: {
                onReady: (event: any) => {
                  console.log('✅ YouTube播放器就绪');
                  youtubePlayerRef.current = event.target;
                },
                onStateChange: (event: any) => {
                  // 更新播放状态
                  const state = event.data;
                  if (state === (window as any).YT.PlayerState.PLAYING) {
                    setIsPlaying(true);
                  } else if (state === (window as any).YT.PlayerState.PAUSED) {
                    setIsPlaying(false);
                  } else if (state === (window as any).YT.PlayerState.ENDED) {
                    setIsPlaying(false);
                    handleVideoEnded();
                  }
                },
                onError: (event: any) => {
                  console.error('❌ YouTube播放器错误:', event.data);
                },
              },
            });
            console.log('🎬 YouTube播放器初始化完成');
          } catch (error) {
            console.error('❌ YouTube播放器初始化失败:', error);
          }
        }
      } else {
        // YouTube API未加载，等待加载完成
        let attempts = 0;
        const maxAttempts = 100; // 最多等待10秒（100 * 100ms）
        
        const checkYT = setInterval(() => {
          attempts++;
          if ((window as any).YT && (window as any).YT.Player) {
            clearInterval(checkYT);
            const playerElement = document.getElementById('youtube-player');
            if (playerElement && !youtubePlayerRef.current) {
              try {
                youtubePlayerRef.current = new (window as any).YT.Player('youtube-player', {
                  videoId: videoId,
                  width: '100%',
                  height: '100%',
                  playerVars: {
                    enablejsapi: 1,
                    origin: window.location.origin,
                    controls: 1,
                    rel: 0,
                    modestbranding: 1,
                    playsinline: 1,
                  },
                  events: {
                    onReady: (event: any) => {
                      console.log('✅ YouTube播放器就绪');
                      youtubePlayerRef.current = event.target;
                    },
                    onStateChange: (event: any) => {
                      const state = event.data;
                      if (state === (window as any).YT.PlayerState.PLAYING) {
                        setIsPlaying(true);
                      } else if (state === (window as any).YT.PlayerState.PAUSED) {
                        setIsPlaying(false);
                      } else if (state === (window as any).YT.PlayerState.ENDED) {
                        setIsPlaying(false);
                        handleVideoEnded();
                      }
                    },
                    onError: (event: any) => {
                      console.error('❌ YouTube播放器错误:', event.data);
                    },
                  },
                });
                console.log('🎬 YouTube播放器初始化完成（延迟加载）');
              } catch (error) {
                console.error('❌ YouTube播放器初始化失败:', error);
              }
            }
          } else if (attempts >= maxAttempts) {
            clearInterval(checkYT);
            console.error('❌ YouTube API加载超时');
          }
        }, 100);
      }
    };
    
    // 延迟初始化，确保DOM已渲染
    const timer = setTimeout(initYouTubePlayer, 300);
    
    return () => {
      clearTimeout(timer);
      // 清理：销毁播放器实例
      if (youtubePlayerRef.current && typeof youtubePlayerRef.current.destroy === 'function') {
        try {
          youtubePlayerRef.current.destroy();
          console.log('🗑️ 清理YouTube播放器');
        } catch (error) {
          console.error('❌ YouTube播放器销毁失败:', error);
        }
        youtubePlayerRef.current = null;
      }
    };
  }, [cdnVideoUrl, locale]);
  
  // 视频序列相关状态
  const [isSeries, setIsSeries] = useState(false);
  const [seriesTitle, setSeriesTitle] = useState<string>('');
  const [allParts, setAllParts] = useState<PartInfo[]>([]);
  const [currentPartIndex, setCurrentPartIndex] = useState(0);
  const [loadingPartIndex, setLoadingPartIndex] = useState<number | null>(null);
  const [partsPage, setPartsPage] = useState(0); // 分P列表当前页码
  const PARTS_PER_PAGE = 10; // 每页显示10个分P
  
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
  const [expandedKnowledgePoints, setExpandedKnowledgePoints] = useState<Set<number>>(new Set()); // 展开的知识点索引（默认空，加载后全部展开）
  const [isAllExpanded, setIsAllExpanded] = useState(true); // 全部展开/折叠状态
  const knowledgeListRef = useRef<HTMLDivElement>(null); // 知识点列表引用
  const previousKnowledgeIndexRef = useRef<number>(-1); // 上一次的知识点索引，用于避免重复滚动
  const [askingKnowledgeIndex, setAskingKnowledgeIndex] = useState<number | null>(null); // 正在提问的知识点索引
  const [questionInput, setQuestionInput] = useState<string>(''); // 问题输入

  // 检查是否为YouTube视频（英文模式）- 必须在useEffect之前定义
  const isYouTubeVideo = (): boolean => {
    return !!(cdnVideoUrl && (cdnVideoUrl.includes('youtube.com') || cdnVideoUrl.includes('youtu.be')) && locale === 'en');
  };

  // YouTube播放器时间更新监听（使用setInterval）- 必须在cdnVideoUrl定义之后
  useEffect(() => {
    if (!isYouTubeVideo() || !youtubePlayerRef.current) {
      return;
    }

    const interval = setInterval(() => {
      try {
        const player = youtubePlayerRef.current;
        if (player && typeof player.getCurrentTime === 'function') {
          const time = player.getCurrentTime();
          setCurrentTime(time);
          
          // 查找当前时间对应的知识点（从后往前查找，找到最后一个匹配的）
          if (knowledgePoints.length > 0) {
            let matchedIndex = -1;
            for (let i = knowledgePoints.length - 1; i >= 0; i--) {
              const point = knowledgePoints[i];
              const startSeconds = timeToSeconds(point.start_time);
              const endSeconds = timeToSeconds(point.end_time);
              
              if (time >= startSeconds && time <= endSeconds) {
                matchedIndex = i;
                break;
              }
            }
            
            // 如果找到了匹配的知识点，且与当前不同，则更新
            if (matchedIndex >= 0 && previousKnowledgeIndexRef.current !== matchedIndex) {
              previousKnowledgeIndexRef.current = matchedIndex;
              setCurrentKnowledgeIndex(matchedIndex);
              
              // 自动展开当前知识点
              setExpandedKnowledgePoints(prev => {
                const newSet = new Set(prev);
                newSet.add(matchedIndex);
                return newSet;
              });
              
              // 延迟滚动，确保DOM更新完成
              setTimeout(() => {
                scrollToKnowledgePoint(matchedIndex);
              }, 100);
            }
          }
        }
      } catch (error) {
        console.error('❌ YouTube时间更新错误:', error);
      }
    }, 500); // 每500ms更新一次

    return () => clearInterval(interval);
  }, [cdnVideoUrl, locale, knowledgePoints]); // 使用依赖值而不是函数调用

  // 从 URL 参数中读取 videoUrl（客户端）
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('🔍 完整 URL:', window.location.href);
      console.log('🔍 URL 参数字符串:', window.location.search);
      
      const urlParams = new URLSearchParams(window.location.search);
      console.log('🔍 所有参数:', Array.from(urlParams.entries()));
      
      const urlFromParam = urlParams.get('videoUrl');
      console.log('🔍 获取到的 videoUrl 参数:', urlFromParam);
      
      if (urlFromParam) {
        const decoded = decodeURIComponent(urlFromParam);
        console.log('✅ 成功解码视频地址:', decoded);
        setVideoUrl(decoded);
      } else {
        console.log('⚠️ 未找到 videoUrl 参数');
      }
    }
  }, []); // 只在组件挂载时执行一次

  const getFontFamily = () => {
    if (isMobile) {
      return 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    }
    return '"Comic Sans MS", "Marker Felt", "Kalam", cursive';
  };
  
  // 加载单个分P
  const loadPart = async (part: PartInfo, partIndex: number) => {
    setLoadingPartIndex(partIndex);
    setCurrentPartIndex(partIndex);
    
    // 自动翻页到包含该分P的页面
    const targetPage = Math.floor(partIndex / PARTS_PER_PAGE);
    if (targetPage !== partsPage) {
      setPartsPage(targetPage);
    }
    
    try {
      console.log(`📺 加载第 ${part.part_number} P:`, part.part_title);
      console.log(`🔥 [DEBUG] isProcessedVideo=${isProcessedVideo}, processedTaskData=${!!processedTaskData}`);
      console.log(`🔥 [DEBUG] isProcessedVideoRef=${isProcessedVideoRef.current}, processedTaskDataRef=${!!processedTaskDataRef.current}`);
      
      // 如果是已处理的视频，直接从保存的数据中加载（使用ref确保获取到最新值）
      if (isProcessedVideoRef.current && processedTaskDataRef.current) {
        console.log(`✅ 从已处理数据中加载第 ${partIndex + 1} P`);
        
        // 获取视频URL
        const videoUrls = processedTaskDataRef.current.video_url;
        if (videoUrls) {
          const videoUrlArray = typeof videoUrls === 'string' 
            ? (videoUrls.startsWith('[') ? JSON.parse(videoUrls) : [videoUrls])
            : videoUrls;
          const videoUrl = Array.isArray(videoUrlArray) ? videoUrlArray[partIndex] : videoUrlArray;
          if (videoUrl) {
            setCdnVideoUrl(videoUrl);
            console.log(`✅ 设置视频URL (P${partIndex + 1}):`, videoUrl);
          }
        }
        
        // 获取知识点数据
        const kpUrls = processedTaskDataRef.current.knowledge_points_result_url;
        if (kpUrls) {
          const kpUrlArray = typeof kpUrls === 'string'
            ? (kpUrls.startsWith('[') ? JSON.parse(kpUrls) : [kpUrls])
            : kpUrls;
          const kpUrl = Array.isArray(kpUrlArray) ? kpUrlArray[partIndex] : kpUrlArray;
          
          if (kpUrl) {
            console.log(`📥 [DEBUG] 正在获取知识点URL (P${partIndex + 1}):`, kpUrl);
            const kpResponse = await fetch(kpUrl);
            const kpData = await kpResponse.json();
            
            console.log(`✅ 加载知识点数据 (P${partIndex + 1}):`, kpData);
            console.log(`🔍 [DEBUG] 完整JSON内容:`, JSON.stringify(kpData, null, 2));
            
            // 支持两种格式：直接数组 或 {knowledge_points: [...]}
            let kpArray = kpData;
            if (!Array.isArray(kpData) && kpData.knowledge_points) {
              kpArray = kpData.knowledge_points;
            }
            
            if (Array.isArray(kpArray) && kpArray.length > 0) {
              setKnowledgePoints(kpArray);
              console.log(`✅ 设置 ${kpArray.length} 个知识点`);
              // 自动全部展开
              const allIndexes = kpArray.map((_, idx) => idx);
              setExpandedKnowledgePoints(new Set(allIndexes));
              setIsAllExpanded(true);
            } else {
              console.log(`ℹ️ P${partIndex + 1} 知识点数据为空（可能视频内容较少或无教学内容）`);
            }
          }
        }
        
        setLoadingPartIndex(null);
        return;
      }
      
      // 否则，正常调用API分析（原有逻辑）
      console.log(`⚠️ 未检测到已处理视频标记，将调用API分析`);
      const response = await fetch(buildApiUrl(API_ENDPOINTS.batchAnalyzePart), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_url: part.url,
          prompt: '提取视频中的知识点',
          part_number: part.part_number,
          locale: locale,  // 传递语言环境
        }),
      });
      
      const data = await response.json();
      
      console.log('🔍 API响应数据:', data);
      console.log('🔍 data.success:', data.success);
      console.log('🔍 data.data:', data.data);
      
      if (data.success && data.data) {
        const result = data.data;
        
        console.log('🔍 result对象:', result);
        console.log('🔍 from_cache:', result.from_cache);
        
        // 更新当前P的知识点
        // 注意：新分析和缓存的数据结构不同
        // - 新分析: result.result.knowledge_points
        // - 缓存: result.analysis.result.knowledge_points
        const points = result.result?.knowledge_points || 
                      result.analysis?.result?.knowledge_points || 
                      [];
        console.log('🔍 提取的知识点数组:', points);
        console.log('🔍 知识点数量:', points.length);
        
        // 按时间排序知识点
        const sortedPoints = sortKnowledgePointsByTime(points);
        console.log('✅ 知识点已按时间排序');
        setKnowledgePoints(sortedPoints);
        
        // 🎬 直接使用缓存的视频URL
        console.log('🎬 [loadPart] 检查缓存中的视频URL...');
        
        // 优先使用上传后的CDN URL（公司CDN，永久有效）或YouTube URL
        const videoUrlFromResult = result.video_info?.url ||  // 顶层video_info中的URL
                      result.result?.video_info?.url ||  // result.video_info中的URL
                      result.analysis?.result?.video_info?.url ||  // analysis.result.video_info中的URL
                      '';
        
        // 检查是否为YouTube URL（英文模式）
        const isYouTubeUrl = videoUrlFromResult && (videoUrlFromResult.includes('youtube.com') || videoUrlFromResult.includes('youtu.be')) && locale === 'en';
        
        if (isYouTubeUrl) {
          console.log('✅ [loadPart] 找到YouTube URL:', videoUrlFromResult.substring(0, 100) + '...');
          setCdnVideoUrl(videoUrlFromResult);
          console.log('✅ [loadPart] setCdnVideoUrl 已调用，使用YouTube URL');
        } else if (videoUrlFromResult && (videoUrlFromResult.startsWith('http://file.gsxservice.com') || videoUrlFromResult.startsWith('https://file.gsxservice.com'))) {
          console.log('✅ [loadPart] 找到CDN URL（公司CDN）:', videoUrlFromResult.substring(0, 100) + '...');
          setCdnVideoUrl(videoUrlFromResult);
          console.log('✅ [loadPart] setCdnVideoUrl 已调用，使用公司CDN URL');
        } else if (locale !== 'en') {
          // 如果没有CDN URL，尝试获取B站播放URL（作为后备，仅中文模式）
          console.log('⚠️ [loadPart] 未找到CDN URL，尝试获取B站播放URL...');
          try {
            const playUrlResponse = await fetch(buildApiUrl(API_ENDPOINTS.batchGetPlayUrl), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                video_url: part.url,
                quality: 'best',
              }),
            });
            
            const playUrlData = await playUrlResponse.json();
            
            if (playUrlData.success && playUrlData.play_url) {
              console.log('✅ [loadPart] 获取到B站播放URL（后备方案）');
              setCdnVideoUrl(playUrlData.play_url);
            } else {
              console.error('❌ [loadPart] 无法获取播放URL');
            }
          } catch (error) {
            console.error('❌ [loadPart] 获取播放URL异常:', error);
          }
        }
        
        // 更新视频标题（使用分P标题）
        console.log('🔍 设置视频标题:', part.part_title);
        setVideoTitle(part.part_title);
        
        // 更新逐字稿
        const transcript = result.result?.transcript || 
                          result.analysis?.result?.transcript || 
                          '';
        console.log('🔍 逐字稿长度:', transcript.length);
        setFullTranscript(transcript);
        
        // 保存原始视频URL（用于笔记缓存）
        setCurrentVideoUrl(part.url);
        
        // 重置知识点展开状态和当前索引
        setExpandedKnowledgePoints(new Set([0]));
        setCurrentKnowledgeIndex(0);
        previousKnowledgeIndexRef.current = -1; // 重置上一次索引
        
        // 重置视频播放状态
        if (isYouTubeVideo()) {
          if (youtubePlayerRef.current) {
            try {
              youtubePlayerRef.current.seekTo(0, true);
            } catch (error) {
              console.error('❌ YouTube播放器重置失败:', error);
            }
          }
        } else if (videoRef.current) {
          videoRef.current.currentTime = 0;
        }
        
        console.log(`✅ P${part.part_number} 加载完成，提取到`, points.length, '个知识点');
        console.log(`✅ 状态更新完成 - 知识点: ${points.length}, 视频URL:已设置, 标题:已设置`);
      } else {
        console.error(`❌ P${part.part_number} 加载失败:`, data);
        alert(`${t('loadingPart')} ${part.part_number} ${t('error')}: ${data.error || t('error')}`);
      }
    } catch (error) {
      console.error(`❌ P${part.part_number} 加载异常:`, error);
      alert(`${t('loadingPart')} ${part.part_number} ${t('error')}: ${error}`);
    } finally {
      setLoadingPartIndex(null);
    }
  };
  
  // 视频播放结束处理
  const handleVideoEnded = () => {
    setIsPlaying(false);
    
    // 如果是视频序列且不是最后一P，自动播放下一P
    if (isSeries && currentPartIndex < allParts.length - 1) {
      const nextPartIndex = currentPartIndex + 1;
      const nextPart = allParts[nextPartIndex];
      console.log(`🎬 自动播放下一P: P${nextPart.part_number}`);
      loadPart(nextPart, nextPartIndex);
    }
  };
  
  // 解析视频
  const handleAnalyzeVideo = useCallback(async () => {
    if (!videoUrl || !videoUrl.trim()) {
      console.warn('⚠️ videoUrl 为空，无法开始分析');
      return;
    }
    
    setIsAnalyzing(true);
    setAnalysisProgress({ 
      stage: 'creating_task', 
      message: '正在创建分析任务...', 
      progress: 10,
      estimatedTime: '预计 2-5 分钟',
      currentStep: '正在向服务器提交视频分析请求...'
    });
    
    try {
      console.log('📤 发送视频解析请求:', {
        video_urls: [videoUrl],
        prompt: '提取视频中的知识点',
        job_name: '视频笔记测试'
      });
      
      const response = await fetch(buildApiUrl(API_ENDPOINTS.batchJobs), {
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
      
      // 检查响应状态
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          console.error('❌ 错误响应数据:', errorData);
          errorMessage = errorData.detail || errorData.message || errorData.error || errorMessage;
        } catch (e) {
          const errorText = await response.text();
          console.error('❌ 错误响应文本:', errorText);
          errorMessage = errorText || errorMessage;
        }
        
        console.error('❌ 创建任务失败:', errorMessage);
        setAnalysisProgress({ 
          stage: 'idle', 
          message: '任务创建失败', 
          progress: 0,
          estimatedTime: '',
          currentStep: ''
        });
        alert(`创建任务失败: ${errorMessage}\n\n请检查：\n1. 后端服务是否运行\n2. 视频URL是否正确\n3. 查看浏览器控制台了解详情`);
        setIsAnalyzing(false);
        return;
      }
      
      const data = await response.json();
      console.log('📦 响应数据:', data);
      
      if (data.success && data.job_id) {
        console.log('✅ 任务创建成功, Job ID:', data.job_id);
        setAnalysisProgress({ 
          stage: 'downloading_video', 
          message: '任务已创建，正在下载视频...', 
          progress: 20,
          estimatedTime: '预计 30-90 秒',
          currentStep: '从 B站 下载视频文件到服务器...'
        });
        // 轮询任务状态
        await pollJobStatus(data.job_id);
      } else {
        const errorMsg = data.error || data.detail || data.message || '未知错误';
        console.error('❌ 创建任务失败:', data);
        setAnalysisProgress({ 
          stage: 'idle', 
          message: '任务创建失败', 
          progress: 0,
          estimatedTime: '',
          currentStep: ''
        });
        alert(`创建任务失败: ${errorMsg}\n\n请检查：\n1. 后端服务是否运行\n2. 视频URL是否正确\n3. 查看浏览器控制台了解详情`);
        setIsAnalyzing(false);
      }
    } catch (error) {
      console.error('❌ 解析视频异常:', error);
      setAnalysisProgress({ 
        stage: 'idle', 
        message: '解析失败', 
        progress: 0,
        estimatedTime: '',
        currentStep: ''
      });
      alert(`解析视频失败: ${error}\n\n请检查：\n1. 后端服务是否在运行 (${API_BASE_URL})\n2. 网络连接是否正常\n3. 浏览器控制台查看详细错误`);
      setIsAnalyzing(false); // 只在出错时关闭
    }
    // ⚠️ 注意：不在 finally 中关闭 isAnalyzing
    // 因为 pollJobStatus 是异步的，会在完成时关闭
  }, [videoUrl]); // 依赖 videoUrl
  
  // 自动解析视频（仅在 videoUrl 存在时）
  useEffect(() => {
    // 确保 videoUrl 已从URL参数中读取
    if (videoUrl && videoUrl.trim()) {
      console.log('🚀 自动开始分析视频:', videoUrl);
      handleAnalyzeVideo();
    } else {
      console.log('⚠️ 未找到视频URL，跳过自动分析');
    }
  }, [videoUrl, handleAnalyzeVideo]); // 依赖 videoUrl 和 handleAnalyzeVideo
  
  // 轮询任务状态
  const pollJobStatus = async (jobId: string) => {
    const maxAttempts = 240; // 最多等待20分钟（适应长视频切分处理）
    let attempts = 0;
    const startTime = Date.now(); // 记录开始时间
    
    const checkStatus = async () => {
      try {
        attempts++;
        
        // 更智能的进度更新（基于实际状态和时间）
        const elapsedTime = Math.floor((Date.now() - startTime) / 1000); // 秒
        
        if (attempts === 1) {
          // 第一次轮询：上传视频阶段
          setAnalysisProgress({ 
            stage: 'uploading_video', 
            message: '正在上传视频到服务器...', 
            progress: 15,
            estimatedTime: '预计 1-3 分钟',
            currentStep: '视频文件上传中，请耐心等待...'
          });
        } else if (attempts === 3) {
          // 上传完成，开始ASR
          setAnalysisProgress({ 
            stage: 'transcribing', 
            message: '正在识别视频内容...', 
            progress: 30,
            estimatedTime: `预计 ${Math.ceil(elapsedTime * 1.5 / 60)} 分钟`,
            currentStep: '使用 AI 识别语音，提取逐字稿...'
          });
        } else if (attempts === 8) {
          // ASR 进行中
          setAnalysisProgress({ 
            stage: 'transcribing', 
            message: '正在识别视频内容...', 
            progress: 50,
            estimatedTime: `预计 ${Math.max(1, Math.ceil((elapsedTime * 0.8) / 60))} 分钟`,
            currentStep: '语音识别进行中，已完成 50%...'
          });
        } else if (attempts === 15) {
          // ASR 接近完成
          setAnalysisProgress({ 
            stage: 'analyzing_content', 
            message: '正在分析视频内容...', 
            progress: 70,
            estimatedTime: '预计 30-60 秒',
            currentStep: '分析逐字稿，理解视频内容...'
          });
        } else if (attempts === 20) {
          // 知识点提取
          setAnalysisProgress({ 
            stage: 'extracting_knowledge', 
            message: '正在提取知识点...', 
            progress: 85,
            estimatedTime: '预计 20-40 秒',
            currentStep: '使用 AI 提取结构化知识点...'
          });
        } else if (attempts > 3 && attempts % 5 === 0) {
          // 每5次更新一次进度（避免过于频繁）
          const baseProgress = Math.min(90, 20 + attempts * 2);
          setAnalysisProgress(prev => ({ 
            ...prev,
            progress: baseProgress,
            estimatedTime: `预计 ${Math.max(1, Math.ceil((maxAttempts - attempts) * 5 / 60))} 分钟`,
          }));
        }
        
        const response = await fetch(buildApiUrl(`${API_ENDPOINTS.batchJobs}/${jobId}`));
        const data = await response.json();
        
        if (data.success && data.data) {
          const job = data.data;
          
          if (job.status === 'completed' && job.results.length > 0) {
            setAnalysisProgress({ 
              stage: 'completed', 
              message: '分析完成！', 
              progress: 100,
              estimatedTime: '已完成',
              currentStep: `总耗时 ${Math.ceil(elapsedTime / 60)} 分钟 ${elapsedTime % 60} 秒`
            });
            const result = job.results[0];
            setAnalysisResult(result);
            
            // 检查是否是视频序列
            if (result.is_series && result.parts && result.parts.length > 0) {
              console.log('🎬 检测到视频序列:', result.series_title);
              console.log('📊 共', result.total_parts, '个分P');
              
              // 设置序列信息
              setIsSeries(true);
              setSeriesTitle(result.series_title || '');
              setAllParts(result.parts);
              
              // 检查URL中是否指定了分P（如?p=3）
              let initialPartIndex = 0;
              const urlParams = new URLSearchParams(window.location.search);
              const pParam = urlParams.get('p');
              if (pParam) {
                const partNum = parseInt(pParam, 10);
                if (!isNaN(partNum) && partNum >= 1 && partNum <= result.parts.length) {
                  initialPartIndex = partNum - 1; // 转换为0-based索引
                  console.log(`📍 URL指定加载P${partNum}`);
                }
              }
              
              setCurrentPartIndex(initialPartIndex);
              
              // 自动加载指定的P
              await loadPart(result.parts[initialPartIndex], initialPartIndex);
              
              // ✅ 延迟关闭加载状态（视频序列），让用户看到"完成"提示
              setTimeout(() => {
                setIsAnalyzing(false);
              }, 1500); // 1.5秒后关闭
              return true;
            }
            
            // 单视频处理
            // 提取知识点
            const points = result.analysis?.result?.knowledge_points || [];
            
            // 按时间排序知识点
            const sortedPoints = sortKnowledgePointsByTime(points);
            console.log('✅ 知识点已按时间排序');
            setKnowledgePoints(sortedPoints);
            
            // 🎬 直接使用缓存的视频URL
            console.log('🎬 [pollJobStatus] 检查缓存中的视频URL...');
            
            // 优先使用上传后的CDN URL（公司CDN，永久有效）或YouTube URL
            const videoUrlFromResult = result.video_info?.url ||  // 顶层video_info中的URL
                          result.analysis?.result?.video_info?.url ||  // analysis.result.video_info中的URL
                          '';
            
            // 检查是否为YouTube URL（英文模式）
            const isYouTubeUrl = videoUrlFromResult && (videoUrlFromResult.includes('youtube.com') || videoUrlFromResult.includes('youtu.be')) && locale === 'en';
            
            if (isYouTubeUrl) {
              console.log('✅ [pollJobStatus] 找到YouTube URL:', videoUrlFromResult.substring(0, 100) + '...');
              setCdnVideoUrl(videoUrlFromResult);
              console.log('✅ [pollJobStatus] setCdnVideoUrl 已调用，使用YouTube URL');
            } else if (videoUrlFromResult && (videoUrlFromResult.startsWith('http://file.gsxservice.com') || videoUrlFromResult.startsWith('https://file.gsxservice.com'))) {
              console.log('✅ [pollJobStatus] 找到CDN URL（公司CDN）:', videoUrlFromResult.substring(0, 100) + '...');
              setCdnVideoUrl(videoUrlFromResult);
              console.log('✅ [pollJobStatus] setCdnVideoUrl 已调用，使用公司CDN URL');
            } else if (locale !== 'en') {
              // 如果没有CDN URL，尝试获取B站播放URL（作为后备，仅中文模式）
              console.log('⚠️ [pollJobStatus] 未找到CDN URL，尝试获取B站播放URL...');
              try {
                const playUrlResponse = await fetch(buildApiUrl(API_ENDPOINTS.batchGetPlayUrl), {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    video_url: videoUrl,
                    quality: 'best',
                  }),
                });
                
                const playUrlData = await playUrlResponse.json();
                
                if (playUrlData.success && playUrlData.play_url) {
                  console.log('✅ [pollJobStatus] 获取到B站播放URL（后备方案）');
                  setCdnVideoUrl(playUrlData.play_url);
                } else {
                  console.error('❌ [pollJobStatus] 无法获取播放URL');
                }
              } catch (error) {
                console.error('❌ [pollJobStatus] 获取播放URL异常:', error);
              }
            }
            
            // 提取视频标题
            const title = result.video_info?.title || '视频笔记';
            setVideoTitle(title);
            
            // 提取完整逐字稿
            const transcript = result.analysis?.result?.transcript || '';
            setFullTranscript(transcript);
            
            // 保存原始视频URL（用于笔记缓存）
            setCurrentVideoUrl(videoUrl);
            
            console.log('✅ 解析完成，提取到', points.length, '个知识点');
            console.log('📝 视频标题:', title);
            console.log('📄 逐字稿长度:', transcript.length);
            console.log('🔗 原始视频URL:', videoUrl);
            
            // ✅ 延迟关闭加载状态，让用户看到"完成"提示
            setTimeout(() => {
              setIsAnalyzing(false);
            }, 1500); // 1.5秒后关闭
            return true;
          } else if (job.status === 'failed') {
            console.error('❌ 任务失败');
            alert('视频分析失败，请重试');
            
            // ❌ 关闭加载状态
            setIsAnalyzing(false);
            return true;
          } else if (attempts < maxAttempts) {
            attempts++;
            setTimeout(checkStatus, 5000); // 5秒后再次检查
          } else {
            // ⏱️ 超时（20分钟）
            console.error('❌ 任务超时（已等待20分钟）');
            alert('视频分析超时（已等待20分钟）。可能原因：\n1. 视频过长（建议<30分钟）\n2. 服务器负载过高\n3. 网络连接问题\n\n请稍后重试或联系技术支持。');
            setIsAnalyzing(false);
            return true;
          }
        }
      } catch (error) {
        console.error('❌ 检查任务状态失败:', error);
        setIsAnalyzing(false);
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
    } else if (parts.length === 3) {
      const [hours, minutes, seconds] = parts.map(Number);
      return hours * 3600 + minutes * 60 + seconds;
    }
    return 0;
  };
  
  // 按时间排序知识点
  const sortKnowledgePointsByTime = (points: KnowledgePoint[]): KnowledgePoint[] => {
    return [...points].sort((a, b) => {
      const timeA = timeToSeconds(a.start_time || '00:00');
      const timeB = timeToSeconds(b.start_time || '00:00');
      return timeA - timeB;
    });
  };
  
  // 跳转到指定时间
  const handleTimeJump = (time: string) => {
    const seconds = timeToSeconds(time);
    
    if (isYouTubeVideo()) {
      // YouTube iframe播放器：使用YouTube API跳转
      if (youtubePlayerRef.current) {
        try {
          youtubePlayerRef.current.seekTo(seconds, true);
          youtubePlayerRef.current.playVideo();
          setIsPlaying(true);
          console.log('🎯 YouTube跳转到时间:', time, '(', seconds, '秒)');
        } catch (error) {
          console.error('❌ YouTube跳转失败:', error);
        }
      } else {
        console.warn('⚠️ YouTube播放器未初始化，无法跳转时间');
      }
      return;
    }
    
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play();
      setIsPlaying(true);
      console.log('🎯 跳转到时间:', time, '(', seconds, '秒)');
    }
  };
  
  // 切换播放/暂停
  const togglePlay = () => {
    if (isYouTubeVideo()) {
      // YouTube iframe播放器：使用YouTube API控制播放
      if (youtubePlayerRef.current) {
        try {
          if (isPlaying) {
            youtubePlayerRef.current.pauseVideo();
          } else {
            youtubePlayerRef.current.playVideo();
          }
          setIsPlaying(!isPlaying);
        } catch (error) {
          console.error('❌ YouTube播放控制失败:', error);
        }
      }
      return;
    }
    
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
    if (isYouTubeVideo()) {
      // YouTube iframe播放器：使用YouTube API设置播放速度
      if (youtubePlayerRef.current) {
        try {
          youtubePlayerRef.current.setPlaybackRate(rate);
          setPlaybackRate(rate);
          console.log('⚡ YouTube播放速度:', rate + 'x');
        } catch (error) {
          console.error('❌ YouTube播放速度设置失败:', error);
        }
      }
      return;
    }
    
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
      
      console.log('⏭️ 跳转到下一个知识点:', nextPoint.name);
    }
  };
  
  // 更新当前播放时间和高亮知识点
  const handleTimeUpdate = () => {
    if (isYouTubeVideo()) {
      // YouTube iframe播放器：使用YouTube API获取当前时间
      // 注意：这需要YouTube iframe API，暂时跳过时间更新
      // 知识点高亮功能在YouTube模式下可能受限
      return;
    }
    
    if (videoRef.current && knowledgePoints.length > 0) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      
      // 查找当前时间对应的知识点（从后往前查找，找到最后一个匹配的）
      let matchedIndex = -1;
      for (let i = knowledgePoints.length - 1; i >= 0; i--) {
        const point = knowledgePoints[i];
        const startSeconds = timeToSeconds(point.start_time);
        const endSeconds = timeToSeconds(point.end_time);
        
        if (time >= startSeconds && time <= endSeconds) {
          matchedIndex = i;
          break;
        }
      }
      
      // 如果找到了匹配的知识点，且与当前不同，则更新
      if (matchedIndex >= 0 && previousKnowledgeIndexRef.current !== matchedIndex) {
        previousKnowledgeIndexRef.current = matchedIndex;
        setCurrentKnowledgeIndex(matchedIndex);
        // 移除自动展开
      } else if (matchedIndex < 0 && previousKnowledgeIndexRef.current >= 0) {
        // 如果不在任何知识点范围内，清除之前的索引（但不改变当前显示的知识点）
        // 这样可以保持最后一个知识点的显示
      }
    }
  };
  
  // YouTube播放器时间更新监听（使用setInterval）- 必须在所有依赖函数定义之后
  useEffect(() => {
    if (!isYouTubeVideo() || !youtubePlayerRef.current) {
      return;
    }

    const interval = setInterval(() => {
      try {
        const player = youtubePlayerRef.current;
        if (player && typeof player.getCurrentTime === 'function') {
          const time = player.getCurrentTime();
          setCurrentTime(time);
          
          // 查找当前时间对应的知识点（从后往前查找，找到最后一个匹配的）
          if (knowledgePoints.length > 0) {
            let matchedIndex = -1;
            for (let i = knowledgePoints.length - 1; i >= 0; i--) {
              const point = knowledgePoints[i];
              const startSeconds = timeToSeconds(point.start_time);
              const endSeconds = timeToSeconds(point.end_time);
              
              if (time >= startSeconds && time <= endSeconds) {
                matchedIndex = i;
                break;
              }
            }
            
            // 如果找到了匹配的知识点，且与当前不同，则更新
            if (matchedIndex >= 0 && previousKnowledgeIndexRef.current !== matchedIndex) {
              previousKnowledgeIndexRef.current = matchedIndex;
              setCurrentKnowledgeIndex(matchedIndex);
              
              // 自动展开当前知识点
              setExpandedKnowledgePoints(prev => {
                const newSet = new Set(prev);
                newSet.add(matchedIndex);
                return newSet;
              });
              
              // 延迟滚动，确保DOM更新完成
              setTimeout(() => {
                scrollToKnowledgePoint(matchedIndex);
              }, 100);
            }
          }
        }
      } catch (error) {
        console.error('❌ YouTube时间更新错误:', error);
      }
    }, 500); // 每500ms更新一次

    return () => clearInterval(interval);
  }, [cdnVideoUrl, locale, knowledgePoints]); // 使用依赖值而不是函数调用

  // 滚动到指定知识点（滚动到顶部）
  const scrollToKnowledgePoint = (index: number) => {
    if (knowledgeListRef.current && index >= 0 && index < knowledgePoints.length) {
      // 等待 DOM 更新完成
      requestAnimationFrame(() => {
        const knowledgeCard = knowledgeListRef.current?.children[index] as HTMLElement;
        if (knowledgeCard) {
          knowledgeCard.scrollIntoView({
            behavior: 'smooth',
            block: 'center',  // 改为 'center'，使知识点显示在视口中央，更容易看到
            inline: 'nearest'
          });
          console.log(`📍 已滚动到知识点 ${index + 1}: ${knowledgePoints[index]?.name}`);
        } else {
          console.warn(`⚠️ 未找到知识点卡片，索引: ${index}, 总数: ${knowledgePoints.length}`);
        }
      });
    }
  };

  // YouTube播放器时间更新监听（使用setInterval）- 必须在所有依赖函数定义之后
  useEffect(() => {
    if (!isYouTubeVideo() || !youtubePlayerRef.current) {
      return;
    }

    const interval = setInterval(() => {
      try {
        const player = youtubePlayerRef.current;
        if (player && typeof player.getCurrentTime === 'function') {
          const time = player.getCurrentTime();
          setCurrentTime(time);
          
          // 查找当前时间对应的知识点（从后往前查找，找到最后一个匹配的）
          if (knowledgePoints.length > 0) {
            let matchedIndex = -1;
            for (let i = knowledgePoints.length - 1; i >= 0; i--) {
              const point = knowledgePoints[i];
              const startSeconds = timeToSeconds(point.start_time);
              const endSeconds = timeToSeconds(point.end_time);
              
              if (time >= startSeconds && time <= endSeconds) {
                matchedIndex = i;
                break;
              }
            }
            
            // 如果找到了匹配的知识点，且与当前不同，则更新
            if (matchedIndex >= 0 && previousKnowledgeIndexRef.current !== matchedIndex) {
              previousKnowledgeIndexRef.current = matchedIndex;
              setCurrentKnowledgeIndex(matchedIndex);
              
              // 自动展开当前知识点
              setExpandedKnowledgePoints(prev => {
                const newSet = new Set(prev);
                newSet.add(matchedIndex);
                return newSet;
              });
              
              // 延迟滚动，确保DOM更新完成
              setTimeout(() => {
                scrollToKnowledgePoint(matchedIndex);
              }, 100);
            }
          }
        }
      } catch (error) {
        console.error('❌ YouTube时间更新错误:', error);
      }
    }, 500); // 每500ms更新一次

    return () => clearInterval(interval);
  }, [cdnVideoUrl, locale, knowledgePoints]); // 使用依赖值而不是函数调用
  
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
  
  // 全部展开/折叠
  const toggleAllKnowledgePoints = () => {
    if (isAllExpanded) {
      // 全部折叠
      setExpandedKnowledgePoints(new Set());
      setIsAllExpanded(false);
    } else {
      // 全部展开
      const allIndexes = knowledgePoints.map((_, index) => index);
      setExpandedKnowledgePoints(new Set(allIndexes));
      setIsAllExpanded(true);
    }
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
    if (isYouTubeVideo()) {
      // YouTube视频：使用YouTube缩略图API获取当前时间点的缩略图
      // 注意：YouTube API不直接支持获取任意时间点的缩略图，我们使用默认缩略图
      // 或者尝试从iframe截图（可能因CORS失败）
      const videoId = youtubeVideoIdRef.current;
      if (videoId) {
        try {
          // 方法1：尝试使用YouTube的maxresdefault缩略图（最高质量）
          const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
          console.log('📸 YouTube缩略图URL:', thumbnailUrl);
          
          // 由于无法直接获取当前帧，我们返回缩略图URL
          // 但前端需要base64，所以我们需要将图片转换为base64
          // 这里先返回空字符串，后续可以通过fetch获取图片并转换为base64
          return '';
        } catch (error) {
          console.error('❌ YouTube缩略图获取失败:', error);
          return '';
        }
      }
      return '';
    }
    
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

  // 异步获取YouTube缩略图并转换为base64
  const captureYouTubeThumbnail = async (videoId: string, timeSeconds: number): Promise<string> => {
    try {
      // YouTube不直接支持获取任意时间点的缩略图
      // 我们使用默认的高质量缩略图
      const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      
      // 尝试获取缩略图并转换为base64
      const response = await fetch(thumbnailUrl);
      if (response.ok) {
        const blob = await response.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = reader.result as string;
            resolve(base64data);
          };
          reader.onerror = () => {
            console.error('❌ 读取YouTube缩略图失败');
            resolve('');
          };
          reader.readAsDataURL(blob);
        });
      }
    } catch (error) {
      console.error('❌ YouTube缩略图获取失败:', error);
    }
    return '';
  };
  
  // 生成知识点笔记
  const generateNote = async (index: number) => {
    const point = knowledgePoints[index];
    
    // 自动暂停视频
    if (isYouTubeVideo()) {
      if (youtubePlayerRef.current) {
        try {
          const playerState = youtubePlayerRef.current.getPlayerState();
          if (playerState === (window as any).YT.PlayerState.PLAYING) {
            youtubePlayerRef.current.pauseVideo();
            setIsPlaying(false);
            console.log('⏸️ YouTube video paused for note generation');
          }
        } catch (error) {
          console.error('❌ YouTube播放器暂停失败:', error);
        }
      }
    } else if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
      setIsPlaying(false);
      console.log('⏸️ Video paused for note generation');
    }
    
    // 标记为正在生成
    setKnowledgePoints(prev => prev.map((p, i) => 
      i === index ? { ...p, isGeneratingNote: true } : p
    ));
    
    try {
      // 捕获当前视频截图（可能因CORS失败，但不影响笔记生成）
      let thumbnail = '';
      if (isYouTubeVideo()) {
        // YouTube视频：尝试从播放器获取当前帧截图
        if (youtubePlayerRef.current) {
          try {
            // 跳转到知识点开始时间
            const timeSeconds = timeToSeconds(point.start_time);
            youtubePlayerRef.current.seekTo(timeSeconds, true);
            
            // 等待一帧后尝试截图（YouTube API不支持直接截图，使用缩略图API）
            // 注意：YouTube不提供当前帧的API，我们使用知识点开始时间的缩略图
            const videoId = youtubeVideoIdRef.current;
            if (videoId) {
              // 使用知识点开始时间对应的缩略图（虽然YouTube API不支持精确时间点，但比默认缩略图更相关）
              thumbnail = await captureYouTubeThumbnail(videoId, timeSeconds);
              if (!thumbnail) {
                console.log('⚠️ YouTube缩略图获取失败，继续生成笔记（无缩略图）');
              } else {
                console.log(`📸 YouTube缩略图已获取（时间点：${point.start_time}）`);
              }
            }
          } catch (error) {
            console.error('❌ YouTube截图失败:', error);
          }
        }
      } else {
        // B站视频：使用Canvas截图当前播放帧
        thumbnail = captureVideoThumbnail();
        if (!thumbnail) {
          console.log('⚠️ Screenshot not available (CORS issue), continuing without thumbnail');
        } else {
          console.log('📸 视频截图已捕获');
        }
      }
      
      // 提取对应的逐字稿片段
      const transcriptSegment = extractTranscriptSegment(point.start_time, point.end_time);
      
      console.log('📝 Generating note for:', point.name);
      console.log('📄 Transcript segment:', transcriptSegment.substring(0, 100), '...');
      
      // 调用后端API生成笔记
      const apiUrl = buildApiUrl(API_ENDPOINTS.notesGenerate);
      console.log('🔗 Calling backend API:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          knowledge_point_name: point.name,
          transcript_segment: transcriptSegment,
          video_title: videoTitle,
          video_url: videoUrl,  // 传递视频URL用于缓存
          locale: locale,  // 传递语言环境
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
        alert(`${t('generatingNotes')} ${t('error')}: ${errorMsg}`);
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
      alert(t('questionPlaceholder'));
      return;
    }
    
    const point = knowledgePoints[index];
    
    // 暂停视频
    if (isYouTubeVideo()) {
      if (youtubePlayerRef.current && isPlaying) {
        try {
          youtubePlayerRef.current.pauseVideo();
          setIsPlaying(false);
        } catch (error) {
          console.error('❌ YouTube播放器暂停失败:', error);
        }
      }
    } else if (videoRef.current && isPlaying) {
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
      const response = await fetch(buildApiUrl(API_ENDPOINTS.notesAnswerQuestion), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: question,
          knowledge_point_name: point.name,
          transcript_segment: transcriptSegment,
          video_title: videoTitle,
          video_url: currentVideoUrl,
          locale: locale,  // 传递语言环境
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
        if (isYouTubeVideo()) {
          if (youtubePlayerRef.current) {
            try {
              youtubePlayerRef.current.playVideo();
              setIsPlaying(true);
            } catch (error) {
              console.error('❌ YouTube播放器播放失败:', error);
            }
          }
        } else if (videoRef.current) {
          videoRef.current.play();
          setIsPlaying(true);
        }
      } else {
        throw new Error(data.error || '回答生成失败');
      }
    } catch (error) {
      console.error('❌ Error asking question:', error);
      alert(`${t('askQuestion')} ${t('error')}: ${error}`);
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
  
  // 封面模板列表（10种）
  const coverTemplates = [
    (topic: string) => `10分钟搞懂${topic}`,
    (topic: string) => `${topic}的5个必考点`,
    (topic: string) => `零基础学会${topic}`,
    (topic: string) => `${topic}完全指南`,
    (topic: string) => `从入门到精通：${topic}`,
    (topic: string) => `${topic}核心知识点总结`,
    (topic: string) => `快速掌握${topic}的秘诀`,
    (topic: string) => `${topic}学习笔记`,
    (topic: string) => `深入理解${topic}`,
    (topic: string) => `${topic}实战教程`,
  ];
  
  // 生成封面标题（使用模板）
  const generateCoverTitle = (): string => {
    // 提取核心知识点（取第一个知识点名称，或前几个合并）
    let coreTopic = '';
    if (knowledgePoints.length > 0) {
      // 如果知识点较多，取前2-3个合并
      if (knowledgePoints.length >= 3) {
        coreTopic = knowledgePoints
          .slice(0, 3)
          .map(p => p.name)
          .join('、');
      } else {
        coreTopic = knowledgePoints[0].name;
      }
    } else {
      coreTopic = videoTitle || '知识点';
    }
    
    // 随机选择一个模板
    const templateIndex = Math.floor(Math.random() * coverTemplates.length);
    const template = coverTemplates[templateIndex];
    
    // 使用模板生成标题
    return template(coreTopic);
  };
  
  // 保存笔记为多张图片（小红书风格，3:4比例）
  const saveNotesAsImage = async () => {
    try {
      console.log('📸 开始导出笔记...');
      
      // 筛选有内容的知识点（有笔记、Q&A或练习）
      const pointsWithContent = knowledgePoints.filter(point => 
        point.note || 
        (point.qaList && point.qaList.length > 0) || 
        point.exercise
      );
      
      if (pointsWithContent.length === 0) {
        alert(t('noNotes'));
        return;
      }
      
      console.log(`📝 找到 ${pointsWithContent.length} 个有内容的知识点`);
      
      // 生成封面标题（使用模板）
      const coverTitleText = generateCoverTitle();
      console.log(`✅ 封面标题: ${coverTitleText}`);
      
      // 图片尺寸：3:4比例，确保清晰度
      const IMAGE_WIDTH = 900;  // 宽度
      const IMAGE_HEIGHT = 1200; // 高度（3:4比例）
      const SCALE = 2; // 缩放比例，提高清晰度
      
      // 辅助函数：创建临时容器
      const createContainer = () => {
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.style.width = `${IMAGE_WIDTH}px`;
        container.style.height = 'auto';
        container.style.minHeight = `${IMAGE_HEIGHT}px`;
        container.style.background = 'linear-gradient(135deg, #fef3e2 0%, #fce8d6 50%, #f9e8d7 100%)';
        container.style.padding = '60px 50px';
        container.style.fontFamily = '"Comic Sans MS", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
        container.style.color = '#2d2d2d';
        container.style.boxShadow = '0 0 100px rgba(0,0,0,0.05)';
        container.style.boxSizing = 'border-box';
        document.body.appendChild(container);
        return container;
      };
      
      // 辅助函数：生成图片并下载
      const generateAndDownloadImage = async (container: HTMLElement, fileName: string) => {
        const canvas = await html2canvas(container, {
          backgroundColor: '#ffffff',
          scale: SCALE,
          width: IMAGE_WIDTH,
          height: container.scrollHeight,
          useCORS: true,
          allowTaint: true,
          logging: false,
        });
        
        return new Promise<void>((resolve) => {
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.download = fileName;
              link.href = url;
              link.click();
              URL.revokeObjectURL(url);
              console.log(`✅ ${fileName} 导出成功`);
            }
            resolve();
          }, 'image/png');
        });
      };
      
      // 1. 生成首图（大字报风格）
      console.log('🎨 生成首图...');
      const coverContainer = createContainer();
      
      // 顶部装饰条
      const topDecor = document.createElement('div');
      topDecor.style.cssText = `
        height: 12px;
        background: linear-gradient(90deg, #ff6b6b, #ffd93d, #6bcf7f, #4d96ff);
        border-radius: 50px;
        margin-bottom: 50px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      `;
      coverContainer.appendChild(topDecor);
      
      // 大字报标题（超大字体）- 使用生成的封面标题
      const coverTitle = document.createElement('div');
      coverTitle.style.cssText = `
        font-size: 72px;
        font-weight: 900;
        color: #333;
        margin-bottom: 30px;
        text-align: center;
        text-shadow: 4px 4px 0px rgba(255, 200, 124, 0.4);
        letter-spacing: 4px;
        font-family: '"Comic Sans MS", "Marker Felt", cursive';
        line-height: 1.2;
        padding: 0 20px;
      `;
      coverTitle.textContent = coverTitleText;
      coverContainer.appendChild(coverTitle);
      
      // 统计信息卡片
      const statsCard = document.createElement('div');
      statsCard.style.cssText = `
        background: #ffffff;
        padding: 40px;
        border-radius: 30px;
        margin: 40px 0;
        box-shadow: 0 12px 32px rgba(0,0,0,0.1);
        text-align: center;
      `;
      
      const statsContent = document.createElement('div');
      statsContent.style.cssText = `
        font-size: 28px;
        color: #333;
        line-height: 2;
        font-weight: 600;
      `;
      statsContent.innerHTML = `
        <div style="margin-bottom: 20px;">📝 知识点数量：<span style="color: #ff6b6b; font-weight: 900;">${pointsWithContent.length}</span></div>
        <div style="margin-bottom: 20px;">📅 创建日期：${new Date().toLocaleDateString('zh-CN')}</div>
        <div>🎬 来自 LearnOrbit AI学习平台</div>
      `;
      statsCard.appendChild(statsContent);
      coverContainer.appendChild(statsCard);
      
      // 底部装饰
      const coverFooter = document.createElement('div');
      coverFooter.style.cssText = `
        margin-top: 60px;
        text-align: center;
        font-size: 48px;
      `;
      coverFooter.textContent = '✨📚✨';
      coverContainer.appendChild(coverFooter);
      
      await generateAndDownloadImage(coverContainer, `${videoTitle || '视频笔记'}_封面_${new Date().getTime()}.png`);
      document.body.removeChild(coverContainer);
      
      // 2. 为每个知识点生成单独的图片
      for (let index = 0; index < pointsWithContent.length; index++) {
        const point = pointsWithContent[index];
        console.log(`🎨 生成知识点 ${index + 1}/${pointsWithContent.length} 的图片...`);
        
        const pointContainer = createContainer();
        
        // 顶部装饰条
        const topDecor = document.createElement('div');
        topDecor.style.cssText = `
          height: 12px;
          background: linear-gradient(90deg, #ff6b6b, #ffd93d, #6bcf7f, #4d96ff);
          border-radius: 50px;
          margin-bottom: 40px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        pointContainer.appendChild(topDecor);
        
        // 知识点序号标签（大号）
        const badge = document.createElement('div');
        badge.style.cssText = `
          display: inline-block;
          background: linear-gradient(135deg, #ff6b6b, #ff8e53);
          color: white;
          font-size: 24px;
          font-weight: 900;
          padding: 12px 28px;
          border-radius: 50px;
          margin-bottom: 30px;
          box-shadow: 0 6px 16px rgba(255,107,107,0.4);
          letter-spacing: 2px;
        `;
        badge.textContent = `${t('knowledgePoints')} ${index + 1}`;
        pointContainer.appendChild(badge);
        
        // 知识点标题（大字体，确保清晰）
        const pointTitle = document.createElement('div');
        pointTitle.style.cssText = `
          font-size: 42px;
          font-weight: 900;
          color: #222;
          margin-bottom: 20px;
          line-height: 1.3;
          font-family: '"Comic Sans MS", "Marker Felt", cursive';
          letter-spacing: 1px;
        `;
        pointTitle.textContent = point.name;
        pointContainer.appendChild(pointTitle);
        
        // 时间戳（大字体）
        const timestamp = document.createElement('div');
        timestamp.style.cssText = `
          font-size: 22px;
          color: #666;
          margin-bottom: 30px;
          padding: 12px 24px;
          background: rgba(107,114,128,0.1);
          border-radius: 50px;
          display: inline-block;
          font-weight: 700;
        `;
        timestamp.textContent = `⏱️ ${point.start_time} - ${point.end_time}`;
        pointContainer.appendChild(timestamp);
        
        // 知识点卡片容器
        const card = document.createElement('div');
        card.style.cssText = `
          padding: 30px;
          border-radius: 30px;
          background: #ffffff;
          box-shadow: 0 12px 32px rgba(0,0,0,0.1);
          position: relative;
          overflow: hidden;
        `;
        
        // 卡片装饰
        const cornerDecor = document.createElement('div');
        cornerDecor.style.cssText = `
          position: absolute;
          top: -30px;
          right: -30px;
          width: 150px;
          height: 150px;
          background: linear-gradient(135deg, rgba(255,107,107,0.15), rgba(255,217,61,0.15));
          border-radius: 50%;
        `;
        card.appendChild(cornerDecor);
        
        // 笔记内容（大字体，确保清晰）
        if (point.note) {
          const noteSection = document.createElement('div');
          noteSection.style.cssText = `
            margin-top: 30px;
            padding: 30px;
            background: linear-gradient(135deg, #fff5eb 0%, #fff8f0 100%);
            border-radius: 24px;
            border: 4px dashed #ffa94d;
            position: relative;
          `;
          
          // 笔记图标装饰（大号）
          const noteIcon = document.createElement('div');
          noteIcon.style.cssText = `
            position: absolute;
            top: -20px;
            left: 30px;
            background: linear-gradient(135deg, #ffd93d, #ffa94d);
            color: white;
            font-size: 20px;
            padding: 10px 24px;
            border-radius: 50px;
            font-weight: 900;
            box-shadow: 0 6px 16px rgba(255,169,77,0.5);
          `;
          noteIcon.textContent = `📝 ${t('notes')}`;
          noteSection.appendChild(noteIcon);
          
          const noteContent = document.createElement('div');
          noteContent.style.cssText = `
            font-size: 28px;
            color: #4a4a4a;
            line-height: 2;
            margin-top: 30px;
            font-family: '"Comic Sans MS", "Apple Color Emoji", sans-serif';
            letter-spacing: 0.5px;
            white-space: pre-wrap;
            font-weight: 500;
          `;
          noteContent.textContent = point.note;
          noteSection.appendChild(noteContent);
          
          // 缩略图
          if (point.thumbnail) {
            const img = document.createElement('img');
            img.src = point.thumbnail;
            img.style.cssText = `
              width: 100%;
              max-width: 100%;
              margin-top: 30px;
              border-radius: 20px;
              box-shadow: 0 12px 32px rgba(0,0,0,0.15);
              border: 6px solid white;
            `;
            noteSection.appendChild(img);
          }
          
          card.appendChild(noteSection);
        }
        
        // Q&A内容（大字体，确保清晰）
        if (point.qaList && point.qaList.length > 0) {
          const qaSection = document.createElement('div');
          qaSection.style.cssText = `
            margin-top: 30px;
          `;
          
          point.qaList.forEach((qa, qaIndex) => {
            const qaItem = document.createElement('div');
            qaItem.style.cssText = `
              padding: 28px;
              background: linear-gradient(135deg, #e0f2fe 0%, #ecfeff 100%);
              border-radius: 24px;
              margin-bottom: 24px;
              border: 4px solid #7dd3fc;
              box-shadow: 0 6px 16px rgba(125,211,252,0.3);
              position: relative;
            `;
            
            // Q&A序号标签（大号）
            const qaBadge = document.createElement('div');
            qaBadge.style.cssText = `
              position: absolute;
              top: -18px;
              left: 24px;
              background: linear-gradient(135deg, #0ea5e9, #38bdf8);
              color: white;
              font-size: 18px;
              padding: 8px 20px;
              border-radius: 50px;
              font-weight: 900;
              box-shadow: 0 4px 12px rgba(14,165,233,0.4);
            `;
            qaBadge.textContent = `💬 Q&A ${qaIndex + 1}`;
            qaItem.appendChild(qaBadge);
            
            const question = document.createElement('div');
            question.style.cssText = `
              font-size: 26px;
              color: #0c4a6e;
              margin-bottom: 20px;
              margin-top: 24px;
              font-weight: 900;
              font-family: '"Comic Sans MS", cursive';
              letter-spacing: 0.5px;
            `;
            question.textContent = `Q: ${qa.question}`;
            qaItem.appendChild(question);
            
            const answer = document.createElement('div');
            answer.style.cssText = `
              font-size: 24px;
              color: #374151;
              line-height: 2;
              padding-left: 24px;
              border-left: 6px solid #0ea5e9;
              font-family: '"Comic Sans MS", sans-serif';
              font-weight: 500;
            `;
            answer.textContent = `A: ${qa.answer}`;
            qaItem.appendChild(answer);
            
            qaSection.appendChild(qaItem);
          });
          
          card.appendChild(qaSection);
        }
        
        // 练习内容（大字体，确保清晰）
        if (point.exercise) {
          const exerciseSection = document.createElement('div');
          exerciseSection.style.cssText = `
            margin-top: 30px;
            padding: 28px;
            background: #fef3c7;
            border-radius: 20px;
            border: 4px solid #fbbf24;
          `;
          
          const exerciseLabel = document.createElement('div');
          exerciseLabel.style.cssText = `
            font-size: 24px;
            font-weight: 800;
            color: #92400e;
            margin-bottom: 16px;
          `;
          exerciseLabel.textContent = `💻 练习：${point.exercise.title}`;
          exerciseSection.appendChild(exerciseLabel);
          
          const exerciseDesc = document.createElement('div');
          exerciseDesc.style.cssText = `
            font-size: 22px;
            color: #78350f;
            margin-bottom: 20px;
            line-height: 1.8;
            font-weight: 500;
          `;
          exerciseDesc.textContent = point.exercise.description;
          exerciseSection.appendChild(exerciseDesc);
          
          // 用户代码（大字体）
          if (point.userCode) {
            const codeBlock = document.createElement('pre');
            codeBlock.style.cssText = `
              background: #1f2937;
              color: #f9fafb;
              padding: 20px;
              border-radius: 12px;
              font-size: 18px;
              overflow-x: auto;
              font-family: 'Courier New', monospace;
              white-space: pre-wrap;
              word-wrap: break-word;
              line-height: 1.6;
            `;
            codeBlock.textContent = point.userCode;
            exerciseSection.appendChild(codeBlock);
          }
          
          // 验证结果（大字体）
          if (point.validationResult) {
            const resultDiv = document.createElement('div');
            resultDiv.style.cssText = `
              margin-top: 20px;
              padding: 20px;
              background: ${point.validationResult.passed ? '#d1fae5' : '#fee2e2'};
              border-radius: 16px;
              border: 3px solid ${point.validationResult.passed ? '#10b981' : '#f87171'};
            `;
            
            const resultText = document.createElement('div');
            resultText.style.cssText = `
              font-size: 22px;
              font-weight: 700;
              color: ${point.validationResult.passed ? '#065f46' : '#991b1b'};
            `;
            resultText.textContent = `${point.validationResult.passed ? `✓ ${t('correct')}` : `✗ ${t('incorrect')}`} - ${t('score')}: ${point.validationResult.score}`;
            resultDiv.appendChild(resultText);
            
            exerciseSection.appendChild(resultDiv);
          }
          
          card.appendChild(exerciseSection);
        }
        
        pointContainer.appendChild(card);
        
        // 生成并下载该知识点的图片
        const fileName = `${videoTitle || '视频笔记'}_知识点${index + 1}_${point.name}_${new Date().getTime()}.png`;
        await generateAndDownloadImage(pointContainer, fileName);
        document.body.removeChild(pointContainer);
      }
      
      console.log('✅ 所有笔记图片导出完成！');
      alert(`${t('exportSuccess')}: ${pointsWithContent.length + 1} ${t('image')} (1 ${t('exportFormat')} + ${pointsWithContent.length} ${t('knowledgePoints')})`);
      
    } catch (error) {
      console.error('❌ 导出笔记失败:', error);
      alert(`${t('exportFailed')}: ${error}`);
    }
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
      const response = await fetch(buildApiUrl(API_ENDPOINTS.notesGenerateExercise), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          knowledge_point_name: point.name,
          transcript_segment: transcriptSegment,
          video_title: videoTitle,
          video_url: currentVideoUrl,
          locale: locale,  // 传递语言环境
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
      alert(`${t('generateExercise')} ${t('error')}: ${error}`);
      setKnowledgePoints(prev => prev.map((p, i) => 
        i === index ? { ...p, isGeneratingExercise: false } : p
      ));
    }
  };
  
  // 运行代码
  const runCode = async (index: number) => {
    const point = knowledgePoints[index];
    if (!point.exercise || !point.userCode) {
      alert(t('writeCodeFirst'));
      return;
    }
    
    console.log('🏃 运行代码:', point.name);
    
    // 标记为正在运行
    setKnowledgePoints(prev => prev.map((p, i) => 
      i === index ? { 
        ...p, 
        isRunningCode: true, 
        codeOutput: '', 
        codeError: '' 
      } : p
    ));
    
    try {
      const response = await fetch('http://localhost:8000/open-api/notes/execute-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: point.userCode,
          language: point.exercise.language
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      console.log('📤 代码执行结果:', data);
      
      setKnowledgePoints(prev => prev.map((p, i) => {
        if (i === index) {
          return {
            ...p,
            isRunningCode: false,
            codeOutput: data.success ? data.output : '',
            codeError: data.error || (data.warning ? `⚠️ ${data.warning}\n\n${data.output || ''}` : null)
          };
        }
        return p;
      }));
      
    } catch (error) {
      console.error('❌ Error running code:', error);
      setKnowledgePoints(prev => prev.map((p, i) => 
        i === index ? { 
          ...p, 
          isRunningCode: false,
          codeError: `执行失败: ${error}`
        } : p
      ));
    }
  };
  
  // 验证答案
  const validateAnswer = async (index: number) => {
    const point = knowledgePoints[index];
    if (!point.exercise || !point.userCode) {
      alert(t('writeCodeFirst'));
      return;
    }
    
    console.log('🎯 验证答案:', point.name);
    
    // 标记为正在验证
    setKnowledgePoints(prev => prev.map((p, i) => 
      i === index ? { ...p, isValidating: true } : p
    ));
    
    try {
      const response = await fetch(buildApiUrl(API_ENDPOINTS.notesValidateAnswer), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_code: point.userCode,
          exercise: point.exercise,
          language: point.exercise.language,
          video_url: currentVideoUrl,
          knowledge_point_name: point.name
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      console.log('📊 验证结果:', data);
      
      if (data.success) {
        setKnowledgePoints(prev => prev.map((p, i) => {
          if (i === index) {
            return {
              ...p,
              isValidating: false,
              validationResult: {
                passed: data.passed,
                score: data.score,
                feedback: data.feedback,
                test_results: data.test_results
              }
            };
          }
          return p;
        }));
        
        // 显示通知
        if (data.passed) {
          alert(`🎉 ${t('correct')}! ${t('score')}: ${data.score}`);
        } else {
          alert(`${t('incorrect')}! ${t('score')}: ${data.score}\n${t('feedback')}`);
        }
      } else {
        throw new Error(data.error || '验证失败');
      }
      
    } catch (error) {
      console.error('❌ Error validating answer:', error);
      alert(`${t('validate')} ${t('error')}: ${error}`);
      setKnowledgePoints(prev => prev.map((p, i) => 
        i === index ? { ...p, isValidating: false } : p
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
            {/* 序列标题和P标签 */}
            {isSeries ? (
              <div className="px-2 flex-shrink-0 space-y-3">
                {/* 序列标题 */}
                <h2 className="text-xl font-bold text-gray-800" style={{ fontFamily: getFontFamily() }}>
                  {seriesTitle}
                </h2>
                
                {/* P标签横向列表 */}
                <div className="relative flex items-center gap-2">
                  {/* 左箭头 */}
                  {partsPage > 0 && (
                    <button
                      onClick={() => setPartsPage(prev => Math.max(0, prev - 1))}
                      className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white flex items-center justify-center shadow-lg transition-all hover:scale-110 z-10"
                      aria-label="上一页"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  )}
                  
                  {/* 分P列表 */}
                  <div className="flex-1 overflow-hidden">
                    <div className="flex gap-2 pb-2">
                      {allParts
                        .slice(partsPage * PARTS_PER_PAGE, (partsPage + 1) * PARTS_PER_PAGE)
                        .map((part, index) => {
                          const actualIndex = partsPage * PARTS_PER_PAGE + index;
                          const isActive = actualIndex === currentPartIndex;
                          const isLoading = actualIndex === loadingPartIndex;
                          
                          return (
                            <button
                              key={part.part_number}
                              onClick={() => loadPart(part, actualIndex)}
                              disabled={isLoading}
                              className={`
                                flex-shrink-0 px-4 py-2 rounded-lg font-medium text-sm transition-all
                                ${isActive 
                                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg scale-105' 
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }
                                ${isLoading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
                              `}
                            >
                              {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin inline" />
                              ) : (
                                <>
                                  <span>P{part.part_number}</span>
                                  {isActive && (
                                    <span className="ml-2 text-xs opacity-90">
                                      {part.part_title.length > 15 ? part.part_title.substring(0, 15) + '...' : part.part_title}
                                    </span>
                                  )}
                                </>
                              )}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                  
                  {/* 右箭头 */}
                  {(partsPage + 1) * PARTS_PER_PAGE < allParts.length && (
                    <button
                      onClick={() => setPartsPage(prev => Math.min(Math.ceil(allParts.length / PARTS_PER_PAGE) - 1, prev + 1))}
                      className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white flex items-center justify-center shadow-lg transition-all hover:scale-110 z-10"
                      aria-label="下一页"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  )}
                  
                  {/* 页码指示器（当有多页时显示） */}
                  {allParts.length > PARTS_PER_PAGE && (
                    <div className="flex-shrink-0 text-xs text-gray-500 font-medium">
                      {partsPage + 1} / {Math.ceil(allParts.length / PARTS_PER_PAGE)}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* 单视频标题 */
              videoTitle && (
                <div className="px-2 flex-shrink-0">
                  <h2 className="text-2xl font-bold text-gray-800" style={{ fontFamily: getFontFamily() }}>
                    {videoTitle}
                  </h2>
                </div>
              )
            )}
            
            {/* 视频播放器 */}
            <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 overflow-hidden flex-shrink-0">
            {!videoUrl && !isAnalyzing ? (
              // 没有视频URL时的输入界面
              <div className="relative aspect-video bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-8">
                <div className="text-center w-full max-w-lg">
                  <div className="mb-6">
                    <Search className="w-16 h-16 text-indigo-500 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-gray-800 mb-2" style={{ fontFamily: getFontFamily() }}>
                      请输入视频地址
                    </h3>
                    <p className="text-gray-600 text-sm">
                      粘贴B站视频链接，开始学习之旅
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        placeholder={t('questionPlaceholder')}
                        className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 text-sm"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && videoUrl.trim()) {
                            handleAnalyzeVideo();
                          }
                        }}
                      />
                      <Button
                        onClick={() => {
                          if (videoUrl.trim()) {
                            handleAnalyzeVideo();
                          }
                        }}
                        disabled={!videoUrl.trim()}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg"
                      >
                        开始分析
                      </Button>
                    </div>
                    
                    <p className="text-gray-500 text-xs">
                      提示：也可以从 <a href="/zh/video-entry" className="text-indigo-600 hover:underline">视频入口页</a> 选择视频
                    </p>
                  </div>
                </div>
              </div>
            ) : isAnalyzing ? (
              <div className="relative aspect-video bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center p-8">
                <div className="text-center w-full max-w-md">
                  {/* 动画图标 */}
                  <div className="relative mb-6">
                    <Loader2 className="w-20 h-20 text-white animate-spin mx-auto" />
                    <Sparkles className="w-8 h-8 text-yellow-300 absolute top-0 right-1/3 animate-pulse" />
                  </div>
                  
                  {/* 主标题 */}
                  <p className="text-white text-2xl font-bold mb-2" style={{ fontFamily: getFontFamily() }}>
                    {analysisProgress.message || '正在解析视频...'}
                  </p>
                  
                  {/* 进度条 */}
                  <div className="w-full bg-white/20 rounded-full h-3 mb-4 overflow-hidden">
                    <div 
                      className="bg-white h-full rounded-full transition-all duration-500 ease-out shadow-lg"
                      style={{ width: `${analysisProgress.progress}%` }}
                    />
                  </div>
                  
                  {/* 进度百分比 */}
                  <p className="text-white/90 text-lg font-semibold mb-4">
                    {analysisProgress.progress}%
                  </p>
                  
                  {/* 阶段说明 */}
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-left">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-1">
                        {analysisProgress.stage === 'creating_task' && '📋'}
                        {analysisProgress.stage === 'downloading_video' && '📥'}
                        {analysisProgress.stage === 'uploading_video' && '📤'}
                        {analysisProgress.stage === 'extracting_audio' && '🎵'}
                        {analysisProgress.stage === 'transcribing' && '✍️'}
                        {analysisProgress.stage === 'analyzing_content' && '🧠'}
                        {analysisProgress.stage === 'extracting_knowledge' && '💡'}
                        {analysisProgress.stage === 'completed' && '✅'}
                      </div>
                      <div className="flex-1">
                        <p className="text-white/80 text-sm leading-relaxed font-medium">
                          {analysisProgress.stage === 'creating_task' && '正在向服务器提交分析任务...'}
                          {analysisProgress.stage === 'downloading_video' && '正在从B站下载视频文件...'}
                          {analysisProgress.stage === 'uploading_video' && '正在上传视频到文件服务器...'}
                          {analysisProgress.stage === 'extracting_audio' && '正在提取视频中的音频轨道...'}
                          {analysisProgress.stage === 'transcribing' && '正在使用AI识别语音内容...'}
                          {analysisProgress.stage === 'analyzing_content' && '正在分析视频内容和逐字稿...'}
                          {analysisProgress.stage === 'extracting_knowledge' && '正在提取关键知识点...'}
                          {analysisProgress.stage === 'completed' && '分析完成，正在加载内容...'}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* 提示文字 */}
                  <p className="text-white/60 text-xs mt-4">
                    预计需要 1-3 分钟，请耐心等待
                  </p>
                </div>
              </div>
            ) : cdnVideoUrl ? (
              <div className="relative aspect-video bg-black">
                {/* 检测是否为YouTube视频 */}
                {(() => {
                  const isYouTube = cdnVideoUrl.includes('youtube.com') || cdnVideoUrl.includes('youtu.be');
                  const isEnglish = locale === 'en';
                  
                  // 英文模式且为YouTube视频：使用YouTube Player API
                  if (isYouTube && isEnglish) {
                    // 提取YouTube视频ID
                    const videoIdMatch = cdnVideoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
                    const videoId = videoIdMatch ? videoIdMatch[1] : '';
                    
                    if (videoId) {
                      return (
                        <div 
                          id="youtube-player" 
                          className="w-full h-full"
                          style={{ minHeight: '400px' }}
                        />
                      );
                    }
                  }
                  
                  // B站视频或中文模式：使用HTML5 video标签
                  return (
                    <video
                      ref={videoRef}
                      src={cdnVideoUrl}
                      className="w-full h-full"
                      controls
                      crossOrigin="anonymous"
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={handleVideoEnded}
                      onTimeUpdate={handleTimeUpdate}
                    >
                      您的浏览器不支持 video 标签。
                    </video>
                  );
                })()}
                
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
                    {t('loadingVideo')}
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
              {t('next')} {t('knowledgePoints')}
            </Button>
            
            {/* 提问按钮 - 蓝色 */}
            <Button
              onClick={() => {
                // 打开提问框时暂停视频
                if (isYouTubeVideo()) {
                  if (youtubePlayerRef.current && isPlaying) {
                    try {
                      youtubePlayerRef.current.pauseVideo();
                      setIsPlaying(false);
                    } catch (error) {
                      console.error('❌ YouTube播放器暂停失败:', error);
                    }
                  }
                } else if (videoRef.current && isPlaying) {
                  videoRef.current.pause();
                  setIsPlaying(false);
                }
                setAskingKnowledgeIndex(currentKnowledgeIndex);
              }}
              className="flex-1 max-w-xs py-6 text-lg font-bold bg-blue-500 text-white shadow-lg hover:bg-blue-600 transition-colors"
              size="lg"
            >
              <MessageSquare className="w-5 h-5 mr-2" />
              {t('askQuestion')}
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
                  {t('generatingNotes')}
                </>
              ) : (
                <>
                  <StickyNote className="w-5 h-5 mr-2" />
                  {t('notes')}
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
                  {t('generatingNotes')}
                </>
              ) : (
                <>
                  <CheckSquare className="w-5 h-5 mr-2" />
                  {t('exercises')}
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
              <div className="text-center py-12 px-4">
                {/* 加载动画 */}
                <div className="relative mb-6">
                  <Loader2 className="w-16 h-16 text-indigo-500 animate-spin mx-auto" />
                  <Sparkles className="w-6 h-6 text-yellow-400 absolute top-0 right-1/3 animate-pulse" />
                </div>
                
                {/* 进度信息 */}
                <div className="space-y-4">
                  <p className="text-gray-800 text-lg font-bold" style={{ fontFamily: getFontFamily() }}>
                    {analysisProgress.message}
                  </p>
                  
                  {/* 简化进度条 */}
                  <div className="w-full max-w-xs mx-auto bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${analysisProgress.progress}%` }}
                    />
                  </div>
                  
                  <p className="text-indigo-600 text-sm font-semibold">
                    {analysisProgress.progress}%
                  </p>
                  
                  {/* 当前阶段 - 简化显示，只保留步骤标题 */}
                  <div className="inline-block bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2">
                    <p className="text-indigo-700 text-xs font-medium">
                      {analysisProgress.stage === 'creating_task' && `📋 ${t('loading')}`}
                      {analysisProgress.stage === 'downloading_video' && `📥 ${t('loadingVideo')}`}
                      {analysisProgress.stage === 'uploading_video' && `📤 ${t('loading')}`}
                      {analysisProgress.stage === 'extracting_audio' && `🎵 ${t('loading')}`}
                      {analysisProgress.stage === 'transcribing' && `✍️ ${t('loading')}`}
                      {analysisProgress.stage === 'analyzing_content' && `🧠 ${t('analyzingVideo')}`}
                      {analysisProgress.stage === 'extracting_knowledge' && `💡 ${t('extractingKnowledge')}`}
                      {analysisProgress.stage === 'completed' && `✅ ${t('loading')}`}
                    </p>
                  </div>
                </div>
              </div>
            ) : knowledgePoints.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-3">🎓</div>
                <p className="text-gray-500 text-sm" style={{ fontFamily: getFontFamily() }}>
                  {t('noKnowledgePoints')}
                  <br />
                  {t('loadingVideo')}
                </p>
              </div>
            ) : (
              <>
                {/* 顶部：全部展开/折叠按钮 */}
                <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-gray-200">
                  <h3 className="text-sm font-bold text-gray-700" style={{ fontFamily: getFontFamily() }}>
                    📚 知识点笔记 ({knowledgePoints.length})
                  </h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={toggleAllKnowledgePoints}
                    className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-7"
                  >
                    {isAllExpanded ? '📕 全部折叠' : '📖 全部展开'}
                  </Button>
                </div>

                {/* 知识点列表 */}
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
                            // 不再自动滚动和展开
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
                                    {t('save')}
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingNoteIndex(null);
                                    }}
                                    className="px-3 py-1 bg-gray-300 text-gray-700 rounded-md text-xs hover:bg-gray-400"
                                  >
                                    {t('cancel')}
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
                                  title={t('edit')}
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
                                    {point.exercise.type === 'fill_blank' ? t('exercises') :
                                     point.exercise.type === 'guided_steps' ? t('exercises') :
                                     point.exercise.type === 'code_choice' ? t('exercises') :
                                     t('exercises')}
                                  </span>
                                  <span className={`px-2 py-1 rounded ${
                                    point.exercise.difficulty === 'beginner' ? 'bg-green-600' :
                                    point.exercise.difficulty === 'intermediate' ? 'bg-yellow-600' :
                                    'bg-red-600'
                                  }`}>
                                    {point.exercise.difficulty === 'beginner' ? t('loading') :
                                     point.exercise.difficulty === 'intermediate' ? t('loading') :
                                     t('loading')}
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
                                      💡 {t('hint')} ({point.exercise.hints.length})
                                      <span className="text-xs text-gray-400">({t('expand')})</span>
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
                                
                                
                                {/* 提交答案按钮 */}
                                <button
                                  onClick={() => validateAnswer(index)}
                                  disabled={point.isValidating || !point.userCode}
                                  className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center font-semibold text-base shadow-md"
                                >
                                  {point.isValidating ? (
                                    <>
                                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                      {t('validate')}...
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="w-5 h-5 mr-2" />
                                      {t('submit')}
                                    </>
                                  )}
                                </button>
                                
                                {/* 答案验证结果 */}
                                {point.validationResult && (
                                  <div className={`mt-4 rounded-xl p-5 border-2 shadow-lg ${
                                    point.validationResult.passed
                                      ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-400'
                                      : 'bg-gradient-to-br from-orange-50 to-red-50 border-orange-400'
                                  }`}>
                                    {/* 头部：通过/未通过 + 分数 */}
                                    <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-gray-200">
                                      <div className="flex items-center gap-3">
                                        {point.validationResult.passed ? (
                                          <>
                                            <CheckCircle className="w-8 h-8 text-green-600" />
                                            <span className="text-xl font-bold text-green-800">通过 ✓</span>
                                          </>
                                        ) : (
                                          <>
                                            <X className="w-8 h-8 text-orange-600" />
                                            <span className="text-xl font-bold text-orange-800">未通过 ✗</span>
                                          </>
                                        )}
                                      </div>
                                      {typeof point.validationResult.score === 'number' && (
                                        <div className={`text-3xl font-bold ${
                                          point.validationResult.passed ? 'text-green-700' : 'text-orange-700'
                                        }`}>
                                          {point.validationResult.score} <span className="text-xl">分</span>
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* 反馈内容（优化样式） */}
                                    {point.validationResult.feedback && (
                                      <div className="bg-white rounded-lg p-4 shadow-sm">
                                        <div className="prose prose-sm max-w-none text-gray-800">
                                          <style jsx>{`
                                            :global(.prose p) {
                                              color: #1f2937;
                                              line-height: 1.7;
                                            }
                                            :global(.prose strong) {
                                              color: #111827;
                                              font-weight: 700;
                                            }
                                            :global(.prose ul) {
                                              list-style-type: none;
                                              padding-left: 0;
                                            }
                                            :global(.prose li) {
                                              padding-left: 1.5em;
                                              position: relative;
                                              color: #374151;
                                              margin-bottom: 0.5em;
                                            }
                                            :global(.prose li::before) {
                                              content: "•";
                                              position: absolute;
                                              left: 0.5em;
                                              color: #6366f1;
                                              font-weight: bold;
                                            }
                                          `}</style>
                                          <ReactMarkdown>{point.validationResult.feedback}</ReactMarkdown>
                                        </div>
                                      </div>
                                    )}
                                    
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
            )}
            
            {/* 保存笔记按钮 */}
            {knowledgePoints.length > 0 && (
              <div className="mt-4 px-4">
                <button
                  onClick={saveNotesAsImage}
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
                  {t('exportNotes')}
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
                <span className="font-bold text-gray-800">{t('askQuestion')}：</span>
                <span className="text-sm text-gray-600">{knowledgePoints[askingKnowledgeIndex]?.name}</span>
              </div>
              <button
                onClick={() => {
                  setAskingKnowledgeIndex(null);
                  setQuestionInput('');
                  // 继续播放视频
                  const isYouTube = cdnVideoUrl && (cdnVideoUrl.includes('youtube.com') || cdnVideoUrl.includes('youtu.be')) && locale === 'en';
                  if (isYouTube) {
                    if (youtubePlayerRef.current && !isPlaying) {
                      try {
                        youtubePlayerRef.current.playVideo();
                        setIsPlaying(true);
                      } catch (error) {
                        console.error('❌ YouTube播放器播放失败:', error);
                      }
                    }
                  } else if (videoRef.current && !isPlaying) {
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
                placeholder={t('questionPlaceholder')}
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
                    {t('loading')}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {t('askQuestion')}
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

