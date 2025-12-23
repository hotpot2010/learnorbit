'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import Editor from '@monaco-editor/react';
import html2canvas from 'html2canvas';
import { mathMarkdownPlugins, autoWrapLatex } from '@/lib/math-renderer';
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
  XCircle,
  Loader2,
  Sparkles,
  Edit2,
  Check,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Eye,
  PlayCircle,
  ArrowLeft,
  RotateCcw,
  Tag,
} from 'lucide-react';
import { useMobileLayout } from '@/hooks/use-mobile-layout';
import { buildApiUrl, API_ENDPOINTS, API_BASE_URL } from '@/config/api';
import { useTranslations, useLocale } from 'next-intl';
import { NoteEditor } from '@/components/learning/tiptap/note-editor';
import { useCurrentUser } from '@/hooks/use-current-user';
import { trackKeyActionSafely } from '@/lib/key-actions-analytics';

// QA对类型定义
interface QAPair {
  question: string;
  answer: string;
  timestamp: string;  // 提问时间
}

// 搜索结果类型定义
interface SearchResult {
  knowledgePointName: string;
  partIndex: number;  // 分P索引
  partTitle: string;   // 分P标题
  knowledgePointIndex: number;  // 知识点索引
  startTime: string;
  endTime: string;
  thumbnail?: string;  // 视频缩略图
  note?: string;  // 笔记内容
  videoUrl?: string; // 视频URL
}

// 练习题类型
type ExerciseType = 'multiple_choice' | 'fill_blank' | 'code_choice' | 'complete';

// 选择题选项
interface ChoiceOption {
  label: string; // A, B, C, D
  content: string;
}

interface Exercise {
  type: ExerciseType;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  language?: string; // 代码题才有
  starter_code?: string; // 代码题才有
  solution: string;
  hints: string[];
  // 数学题专用字段
  question?: string; // 题目内容（支持LaTeX）
  choices?: ChoiceOption[]; // 选择题选项
  answer_type?: 'single' | 'multiple' | 'text'; // 答案类型
  blanks?: number; // 填空题有几个空
}

// 知识点类型定义
interface KnowledgePoint {
  name: string;
  start_time: string;
  end_time: string;
  note?: string;  // AI生成的笔记
  transcript_segment?: string;  // 知识点对应的逐字稿片段
  thumbnail?: string;  // 视频截图缩略图
  isGeneratingNote?: boolean;  // 是否正在生成笔记
  qaList?: QAPair[];  // Q&A列表
  isAsking?: boolean;  // 是否正在提问
  screenshots?: string[];  // 截图列表（base64或URL）
  exercise?: Exercise;  // 练习题（已废弃，保留用于兼容）
  exercises?: Exercise[];  // 练习题卡片列表（卡槽）
  isGeneratingExercise?: boolean;  // 是否正在生成练习
  userCode?: string;  // 用户编写的代码（代码题）
  userAnswer?: string;  // 用户的答案（选择题/填空题）
  validationResult?: ValidationResult;  // 答案验证结果
  isValidating?: boolean;  // 是否正在验证答案
  searchResults?: SearchResult[];  // 搜索结果引用列表
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

// 视频兼容性检测组件
const VideoCompatibilityChecker = ({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement | null> }) => {
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const checkVideo = () => {
      // 如果已经有警告，就不再检测
      if (showWarning) return;

      // 检测是否有画面（HEVC在Chrome下可能只有声音无画面）
      // readyState >= 1 表示 metadata 已加载
      // videoWidth === 0 表示没有画面尺寸，或者解码失败
      if (video.readyState >= 1) {
        // 部分浏览器（如Chrome）在不支持HEVC时，可能videoWidth为0，也可能正常显示尺寸但不渲染画面
        // 另一种检测方法是 webkitVideoDecodedByteCount (仅Chrome)
        const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
        
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          setShowWarning(true);
        } else if (isChrome) {
          // 在Chrome中，如果解码字节数一直为0，说明硬解码失败
          // 延时检测，给它一点缓冲时间
          setTimeout(() => {
            if (video.paused) return; // 没播放就不检测
            
            // @ts-ignore
            if (video.webkitVideoDecodedByteCount === 0 && video.currentTime > 0.5) {
              setShowWarning(true);
            }
          }, 2000);
        }
      }
    };

    video.addEventListener('loadeddata', checkVideo);
    video.addEventListener('timeupdate', checkVideo);
    
    return () => {
      video.removeEventListener('loadeddata', checkVideo);
      video.removeEventListener('timeupdate', checkVideo);
    };
  }, [videoRef, showWarning]);

  if (!showWarning) return null;

  return (
    <div className="absolute top-0 left-0 right-0 bg-yellow-100 border-b border-yellow-300 p-3 flex items-center justify-between z-20 animate-in slide-in-from-top duration-300">
      <div className="flex items-center gap-2 text-yellow-800 text-sm">
        <span className="text-lg">⚠️</span>
        <div>
          <p className="font-bold">视频画面无法显示</p>
          <p className="text-xs">检测到只有声音，可能是浏览器不支持此视频格式 (HEVC/H.265)。</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button 
          onClick={() => setShowWarning(false)}
          className="px-3 py-1 bg-white border border-yellow-300 rounded text-xs text-yellow-700 hover:bg-yellow-50"
        >
          忽略
        </button>
      </div>
    </div>
  );
};

// 截图选择器组件
const ScreenshotSelector = ({ imageUrl, onConfirm, onCancel, isUploading }: {
  imageUrl: string;
  onConfirm: (croppedImage: string) => void;
  onCancel: () => void;
  isUploading: boolean;
}) => {
  const [cropArea, setCropArea] = useState<{x: number; y: number; width: number; height: number} | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startPoint, setStartPoint] = useState<{x: number; y: number} | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({width: 0, height: 0});

  // 将屏幕坐标转换为canvas坐标
  const getCanvasCoordinates = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return {x: 0, y: 0};

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasCoordinates(e.clientX, e.clientY);
    setIsDragging(true);
    setStartPoint(point);
    setCropArea(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !startPoint) return;

    const currentPoint = getCanvasCoordinates(e.clientX, e.clientY);
    const width = currentPoint.x - startPoint.x;
    const height = currentPoint.y - startPoint.y;

    setCropArea({
      x: width > 0 ? startPoint.x : currentPoint.x,
      y: height > 0 ? startPoint.y : currentPoint.y,
      width: Math.abs(width),
      height: Math.abs(height)
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setStartPoint(null);
  };

  const handleConfirm = () => {
    if (!cropArea || cropArea.width === 0 || cropArea.height === 0) {
      // 如果没有选择区域，使用整张图片
      onConfirm(imageUrl);
      return;
    }

    // 创建裁剪后的图片
    const sourceCanvas = canvasRef.current;
    if (!sourceCanvas) {
      onConfirm(imageUrl);
      return;
    }

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = cropArea.width;
    outputCanvas.height = cropArea.height;
    
    const ctx = outputCanvas.getContext('2d');
    if (ctx) {
      // 从源canvas中提取选中区域
      ctx.drawImage(
        sourceCanvas,
        cropArea.x,
        cropArea.y,
        cropArea.width,
        cropArea.height,
        0,
        0,
        cropArea.width,
        cropArea.height
      );
      
      const croppedImage = outputCanvas.toDataURL('image/jpeg', 0.9);
      onConfirm(croppedImage);
    }
  };

  // 绘制canvas内容
  useEffect(() => {
    if (!imageLoaded || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 加载图片
    const img = new Image();
    img.onload = () => {
      // 设置canvas内部尺寸为图片实际尺寸
      canvas.width = img.width;
      canvas.height = img.height;
      
      // 绘制原图
      ctx.drawImage(img, 0, 0);
      
      // 绘制选择区域
      if (cropArea) {
        // 绘制半透明遮罩
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 清除选中区域的遮罩
        ctx.clearRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
        
        // 重新绘制选中区域（保持清晰）
        ctx.drawImage(
          img,
          cropArea.x,
          cropArea.y,
          cropArea.width,
          cropArea.height,
          cropArea.x,
          cropArea.y,
          cropArea.width,
          cropArea.height
        );
        
        // 绘制选择框边框
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 3;
        ctx.strokeRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
      }
    };
    img.src = imageUrl;
  }, [cropArea, imageUrl, imageLoaded]);

  // 图片加载完成后初始化canvas
  const handleImageLoad = () => {
    setImageLoaded(true);
    
    // 预加载图片以获取尺寸
    const img = new Image();
    img.onload = () => {
      setImageDimensions({width: img.width, height: img.height});
    };
    img.src = imageUrl;
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-bold text-gray-900">选择截图区域</h3>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-700 p-1">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex-1 p-4 overflow-auto flex items-center justify-center" ref={containerRef}>
          <div className="relative">
            {/* 预加载图片以触发初始化 */}
            <img
              src={imageUrl}
              alt="Screenshot"
              className="hidden"
              onLoad={handleImageLoad}
            />
            
            {/* Canvas用于显示和选择 */}
            {imageLoaded && (
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="max-w-full max-h-[60vh] cursor-crosshair border-2 border-gray-300 rounded"
                style={{
                  width: 'auto',
                  height: 'auto',
                  maxWidth: '100%',
                  maxHeight: '60vh'
                }}
              />
            )}
            
            {!imageLoaded && (
              <div className="w-96 h-64 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            )}
          </div>
        </div>
        
        <div className="p-4 border-t flex items-center justify-between">
          <p className="text-sm text-gray-500">拖动鼠标选择区域，或直接确认使用整张图片</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} disabled={isUploading}>
              取消
            </Button>
            <Button onClick={handleConfirm} disabled={isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  上传中...
                </>
              ) : (
                '确认'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 视频缩略图组件
const VideoThumbnail = ({ videoUrl, time, screenshotUrl, fallbackUrl, onClick }: { videoUrl: string, time: string, screenshotUrl?: string, fallbackUrl: string, onClick?: (e: React.MouseEvent) => void }) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    // 如果有 screenshotUrl（数据库预生成的截图），直接使用，不再实时截取
    if (screenshotUrl) {
      console.log('✅ 使用数据库预生成的截图:', screenshotUrl.substring(0, 80) + '...');
      setThumbnailUrl(screenshotUrl);
      setIsLoading(false);
      return;
    }
    
    // 没有 screenshotUrl 时才实时截取
    if (!videoUrl || !time) return;
    
    // 切换视频或时间点时，先重置状态
    setThumbnailUrl(null); 
    setIsLoading(true);

    let isMounted = true;

    const generateThumbnail = async () => {
      // ... (generation logic) ...
      try {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous'; // 关键：允许跨域
        video.src = videoUrl;
        video.muted = true;
        
        // 将时间字符串转换为秒
        const [minutes, seconds] = time.split(':').map(Number);
        const timeInSeconds = minutes * 60 + seconds;
        
        video.currentTime = timeInSeconds;
        
        // 等待 seek 完成
        await new Promise((resolve, reject) => {
          video.onseeked = resolve;
          video.onerror = reject;
          // 设置超时，避免一直挂起
          setTimeout(() => reject(new Error('Timeout')), 10000); // 增加超时时间到10秒
        });

        if (!isMounted) return;

        // 截图
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth / 4; // 缩小尺寸以提升性能
        canvas.height = video.videoHeight / 4;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          try {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
            if (isMounted) {
              setThumbnailUrl(dataUrl);
              setIsLoading(false);
            }
          } catch (e) {
            console.warn('📸 Canvas导出失败 (CORS限制):', e);
            if (isMounted) setIsLoading(false);
          }
        }
      } catch (error) {
        // console.warn('📸 生成缩略图失败:', error);
        if (isMounted) setIsLoading(false);
      }
    };

    // 使用 requestIdleCallback 在空闲时生成，避免卡顿
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => generateThumbnail());
    } else {
      setTimeout(generateThumbnail, 1000); // 降级方案
    }

    return () => {
      isMounted = false;
    };
  }, [videoUrl, time, screenshotUrl]);

  return (
    <div 
      className="relative aspect-video rounded-md overflow-hidden bg-gray-100 shadow-sm border border-gray-200 cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all group/thumb"
      onClick={onClick}
    >
      <img 
        src={thumbnailUrl || fallbackUrl} 
        alt="视频截图" 
        className={`w-full h-full object-cover transition-opacity duration-500 ${thumbnailUrl ? 'opacity-100' : 'opacity-90'}`}
      />
      
      {isLoading && !thumbnailUrl && (
        <div className="absolute top-1 left-1">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
        </div>
      )}
      
      {/* 时间戳覆盖层 */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60 group-hover/thumb:opacity-40 transition-opacity" />
      <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-mono flex items-center gap-1">
        <Play className="w-2 h-2" />
        {time}
      </div>
    </div>
  );
};

// 格式化笔记内容，优化换行
const formatNoteContent = (content?: string) => {
  if (!content) return '';
  // 在句号、分号、冒号后添加换行
  return content.replace(/([。；：])/g, '$1\n\n');
};

export default function VideoNotesPrototypePage() {
  const { isMobile } = useMobileLayout();
  const locale = useLocale();
  const t = useTranslations('LearningPlatform.videoNotes');
  const currentUser = useCurrentUser();
  
  // 使用 ref 确保只打点一次
  const hasTrackedStartLearning = useRef(false);
  
  // 记录开始学习事件（页面加载）
  useEffect(() => {
    // 只在有用户且未打点时执行
    if (currentUser?.id && !hasTrackedStartLearning.current) {
      const urlParams = new URLSearchParams(window.location.search);
      const taskId = urlParams.get('taskId');
      const videoUrl = urlParams.get('videoUrl');
      
      trackKeyActionSafely(
        'start_video_learning',
        {
          task_id: taskId || 'unknown',
          video_url: videoUrl || 'unknown',
          timestamp: Date.now(),
        },
        currentUser
      );
      
      hasTrackedStartLearning.current = true;
    }
  }, [currentUser]); // 依赖 currentUser，当用户信息加载完成后执行
  
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
  
  // 从完整逐字稿中提取知识点对应的片段（保留时间戳格式）
  const extractTranscriptSegmentWithTimestamp = (startTime: string, endTime: string, fullTranscript: string): string => {
    if (!fullTranscript) return '';
    
    // 解析时间为秒数
    const timeToSeconds = (timeStr: string): number => {
      try {
        const parts = timeStr.trim().split(':');
        if (parts.length === 2) {
          const [minutes, seconds] = parts;
          return parseInt(minutes) * 60 + parseInt(seconds);
        }
      } catch {
        // ignore
      }
      return 0;
    };
    
    const startSeconds = timeToSeconds(startTime);
    const endSeconds = timeToSeconds(endTime);
    
    // 支持两种ASR时间戳格式并保留原始格式
    const timePattern1 = /\[(\d+:\d+)\s*-\s*(\d+:\d+)\]\s*(.*)/;
    const timePattern2 = /\[(\d+:\d+)\]\s*(.*)/;
    
    const lines = fullTranscript.split('\n');
    const matchedLines: string[] = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      // 尝试匹配范围格式 [MM:SS - MM:SS]
      const match1 = timePattern1.exec(trimmedLine);
      if (match1) {
        const [fullMatch, lineStart, lineEnd, text] = match1;
        const lineStartSec = timeToSeconds(lineStart);
        const lineEndSec = timeToSeconds(lineEnd);
        
        // 检查时间范围是否重叠
        if (lineStartSec <= endSeconds && lineEndSec >= startSeconds) {
          matchedLines.push(trimmedLine); // 保留完整行（包括时间戳）
        }
        continue;
      }
      
      // 尝试匹配单点格式 [MM:SS]
      const match2 = timePattern2.exec(trimmedLine);
      if (match2) {
        const [fullMatch, lineTime, text] = match2;
        const lineSeconds = timeToSeconds(lineTime);
        
        if (lineSeconds >= startSeconds && lineSeconds <= endSeconds) {
          matchedLines.push(trimmedLine); // 保留完整行（包括时间戳）
        }
      }
    }
    
    const result = matchedLines.join('\n');
    console.log(`📝 提取带时间戳的逐字稿片段 (${startTime}-${endTime}): ${matchedLines.length} 行`);
    return result;
  };

  // 从完整逐字稿中提取知识点对应的片段
  const extractTranscriptSegment = (startTime: string, endTime: string, fullTranscript: string): string => {
    if (!fullTranscript) return '';
    
    // 解析时间为秒数
    const timeToSeconds = (timeStr: string): number => {
      try {
        const parts = timeStr.trim().split(':');
        if (parts.length === 2) {
          const [minutes, seconds] = parts;
          return parseInt(minutes) * 60 + parseInt(seconds);
        }
      } catch {
        // ignore
      }
      return 0;
    };
    
    const startSeconds = timeToSeconds(startTime);
    const endSeconds = timeToSeconds(endTime);
    
    // 支持两种ASR时间戳格式:
    // 1. [MM:SS - MM:SS] 文本内容
    // 2. [MM:SS] 文本内容
    const timePattern1 = /\[(\d+:\d+)\s*-\s*(\d+:\d+)\]\s*(.*)/;
    const timePattern2 = /\[(\d+:\d+)\]\s*(.*)/;
    
    const lines = fullTranscript.split('\n');
    const matchedTexts: string[] = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      // 尝试匹配范围格式 [MM:SS - MM:SS]
      const match1 = timePattern1.exec(trimmedLine);
      if (match1) {
        const [, lineStart, lineEnd, text] = match1;
        const lineStartSec = timeToSeconds(lineStart);
        const lineEndSec = timeToSeconds(lineEnd);
        
        // 检查时间范围是否重叠
        if (lineStartSec <= endSeconds && lineEndSec >= startSeconds) {
          matchedTexts.push(text.trim());
        }
        continue;
      }
      
      // 尝试匹配单点格式 [MM:SS]
      const match2 = timePattern2.exec(trimmedLine);
      if (match2) {
        const [, lineTime, text] = match2;
        const lineSeconds = timeToSeconds(lineTime);
        
        if (lineSeconds >= startSeconds && lineSeconds <= endSeconds) {
          matchedTexts.push(text.trim());
        }
      }
    }
    
    const result = matchedTexts.join(' ');
    console.log(`📝 提取逐字稿片段 (${startTime}-${endTime}): ${result.length} 字符`);
    return result;
  };
  
  // 已处理视频的相关状态
  const [isProcessedVideo, setIsProcessedVideo] = useState(false);
  const [processedTaskData, setProcessedTaskData] = useState<any>(null);
  // 使用 ref 来存储，确保在异步操作中也能访问到最新值
  const processedTaskDataRef = useRef<any>(null);
  const isProcessedVideoRef = useRef<boolean>(false);
  
  // ASR逐字稿数据（从数据库加载）
  const [fullTranscript, setFullTranscript] = useState<string>('');
  const fullTranscriptRef = useRef<string>(''); // 使用ref确保能在回调中访问

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
              
              // 确保使用 HTTPS
              const secureVideoUrl = ensureHttps(firstVideoUrl) as string;
              setCdnVideoUrl(secureVideoUrl);
              console.log('✅ 设置CDN视频URL:', secureVideoUrl);
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
              
              // 确保使用 HTTPS
              const secureKpUrl = ensureHttps(firstKpUrl) as string;
              
              const kpResponse = await fetch(secureKpUrl);
              const kpData = await kpResponse.json();
              
              console.log('✅ 加载知识点数据:', kpData);
              
              // 支持两种格式：直接数组 或 {knowledge_points: [...]}
              let kpArray = kpData;
              if (!Array.isArray(kpData) && kpData.knowledge_points) {
                kpArray = kpData.knowledge_points;
              }
              
              // 🔍 检查是否包含 transcript_segment 字段
              if (Array.isArray(kpArray) && kpArray.length > 0) {
                const firstKp = kpArray[0];
                console.log('🔍 [DEBUG] 第一个知识点的所有字段:', Object.keys(firstKp));
                console.log('🔍 [DEBUG] 第一个知识点的 transcript_segment:', firstKp.transcript_segment);
                
                const hasTranscriptCount = kpArray.filter(kp => kp.transcript_segment).length;
                if (hasTranscriptCount > 0) {
                  console.log(`✅ 发现 ${hasTranscriptCount}/${kpArray.length} 个知识点包含逐字稿`);
                  console.log('✅ 逐字稿字段示例:', firstKp.transcript_segment?.substring(0, 100) + '...');
                } else {
                  console.warn('⚠️ 逐字稿字段不存在！这是旧版本的知识点数据。');
                  console.warn('💡 解决方案：需要重新分析视频以生成包含逐字稿的新数据。');
                  console.warn('📝 操作步骤：');
                  console.warn('   1. 在视频列表中找到这个视频');
                  console.warn('   2. 删除旧任务（如果需要）');
                  console.warn('   3. 重新上传/分析视频');
                  console.warn('   4. 新生成的知识点数据将自动包含逐字稿片段');
                }
              }
              
              if (Array.isArray(kpArray) && kpArray.length > 0) {
                // 检查是否有预生成的截图
                const screenshotsUrls = task.screenshots_result_url;
                let finalKpArray = kpArray;
                
                if (screenshotsUrls) {
                  console.log('🔍 检测到数据库中的截图URL，开始加载...');
                  const screenshotsUrlArray = typeof screenshotsUrls === 'string'
                    ? (screenshotsUrls.startsWith('[') ? JSON.parse(screenshotsUrls) : [screenshotsUrls])
                    : screenshotsUrls;
                  const firstScreenshotsUrl = Array.isArray(screenshotsUrlArray) ? screenshotsUrlArray[0] : screenshotsUrlArray;
                  
                  if (firstScreenshotsUrl) {
                    finalKpArray = await loadScreenshotsForKnowledgePoints(kpArray, firstScreenshotsUrl);
                  }
                }
                
                // 🔍 加载ASR逐字稿数据
                const asrUrls = task.asr_result_url;
                if (asrUrls) {
                  console.log('📝 检测到数据库中的ASR结果URL，开始加载...');
                  const asrUrlArray = typeof asrUrls === 'string'
                    ? (asrUrls.startsWith('[') ? JSON.parse(asrUrls) : [asrUrls])
                    : asrUrls;
                  const firstAsrUrl = Array.isArray(asrUrlArray) ? asrUrlArray[0] : asrUrls;
                  
                  if (firstAsrUrl) {
                    try {
                      const secureAsrUrl = ensureHttps(firstAsrUrl) as string;
                      console.log('📥 加载ASR逐字稿:', secureAsrUrl);
                      const asrResponse = await fetch(secureAsrUrl);
                      const asrText = await asrResponse.text();
                      console.log(`✅ ASR逐字稿加载成功，长度: ${asrText.length} 字符`);
                      console.log('📝 逐字稿预览 (前200字符):', asrText.substring(0, 200));
                      
                      // 保存完整逐字稿
                      setFullTranscript(asrText);
                      fullTranscriptRef.current = asrText;
                    } catch (error) {
                      console.error('❌ 加载ASR逐字稿失败:', error);
                    }
                  }
                }
                
                setKnowledgePoints(finalKpArray);
                console.log(`✅ 设置 ${finalKpArray.length} 个知识点`);
                // 自动全部展开
                const allIndexes = finalKpArray.map((_, idx) => idx);
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
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null); // 正在编辑的笔记索引
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string>(''); // 当前视频URL（用于缓存）
  const [expandedKnowledgePoints, setExpandedKnowledgePoints] = useState<Set<number>>(new Set()); // 展开的知识点索引（默认空，加载后全部展开）
  const [isAllExpanded, setIsAllExpanded] = useState(true); // 全部展开/折叠状态
  const knowledgeListRef = useRef<HTMLDivElement>(null); // 知识点列表引用
  const previousKnowledgeIndexRef = useRef<number>(-1); // 上一次的知识点索引，用于避免重复滚动
  const [askingKnowledgeIndex, setAskingKnowledgeIndex] = useState<number | null>(null); // 正在提问的知识点索引
  const [questionInput, setQuestionInput] = useState<string>(''); // 问题输入
  const [conversationHistory, setConversationHistory] = useState<QAPair[]>([]); // 多轮对话历史
  const conversationEndRef = useRef<HTMLDivElement>(null); // 对话底部引用，用于自动滚动
  const [currentQACard, setCurrentQACard] = useState<QAPair | null>(null); // 当前待处理的QA卡片
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null); // 查看卡片详情的索引
  const [currentScreenshot, setCurrentScreenshot] = useState<string | null>(null); // 当前查看的截图
  const [showSearchDialog, setShowSearchDialog] = useState(false); // 显示搜索对话框
  const [searchKeyword, setSearchKeyword] = useState(''); // 搜索关键词
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]); // 搜索结果
  const [isSearching, setIsSearching] = useState(false); // 是否正在搜索
  const [currentSearchResult, setCurrentSearchResult] = useState<SearchResult | null>(null); // 当前查看的搜索结果
  const [isPlayingResultVideo, setIsPlayingResultVideo] = useState(false); // 是否正在播放搜索结果视频
  const [showExerciseDialog, setShowExerciseDialog] = useState(false); // 显示练习生成对话框
  const [generatedExercise, setGeneratedExercise] = useState<Exercise | null>(null); // 生成的练习
  const [isGeneratingExercise, setIsGeneratingExercise] = useState(false); // 是否正在生成练习
  const [exerciseKnowledgePointIndex, setExerciseKnowledgePointIndex] = useState<number | null>(null); // 生成练习的知识点索引
  const [currentExerciseCard, setCurrentExerciseCard] = useState<Exercise | null>(null); // 当前查看的练习卡片
  const [exerciseUserAnswer, setExerciseUserAnswer] = useState<string>(''); // 用户选择的答案（卡槽中的卡片）
  const [showScreenshotSelector, setShowScreenshotSelector] = useState(false); // 显示截图选择器
  const [screenshotImage, setScreenshotImage] = useState<string | null>(null); // 当前视频帧截图
  const [isUploadingScreenshot, setIsUploadingScreenshot] = useState(false); // 是否正在上传截图
  const [attachedImages, setAttachedImages] = useState<Array<{id: string, url: string, thumbnail: string}>>([]);// 已附加的图片
  const [exerciseSubmitted, setExerciseSubmitted] = useState<boolean>(false); // 是否已提交答案（卡槽中的卡片）
  const [exerciseShowHints, setExerciseShowHints] = useState<boolean>(false); // 是否显示提示（卡槽中的卡片反转）
  const [generatedExerciseUserAnswer, setGeneratedExerciseUserAnswer] = useState<string>(''); // 用户选择的答案（生成对话框）
  const [generatedExerciseSubmitted, setGeneratedExerciseSubmitted] = useState<boolean>(false); // 是否已提交答案（生成对话框）
  const [generatedExerciseShowHints, setGeneratedExerciseShowHints] = useState<boolean>(false); // 是否显示提示（生成对话框反转）

  // 保存笔记相关状态
  const [isSavingNote, setIsSavingNote] = useState(false); // 是否正在保存笔记
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null); // 已保存的笔记ID
  const [saveStatus, setSaveStatus] = useState<'unsaved' | 'saving' | 'saved' | 'error'>('unsaved'); // 保存状态
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null); // 最后保存时间

  // 检查是否为YouTube视频（英文模式）- 必须在useEffect之前定义
  const isYouTubeVideo = (): boolean => {
    return !!(cdnVideoUrl && (cdnVideoUrl.includes('youtube.com') || cdnVideoUrl.includes('youtu.be')) && locale === 'en');
  };

  // 工具函数：确保 URL 使用 HTTPS（修复 Mixed Content 错误）
  const ensureHttps = (url: string | string[] | null | undefined): string | string[] => {
    if (!url) return '';
    
    // 处理数组
    if (Array.isArray(url)) {
      return url.map(u => ensureHttps(u) as string);
    }
    
    // 处理单个 URL：将 http://file.gsxservice.com 替换为 https://
    if (typeof url === 'string' && url.startsWith('http://file.gsxservice.com')) {
      return url.replace('http://file.gsxservice.com', 'https://file.gsxservice.com');
    }
    
    return url;
  };

  // 从数据库加载知识点截图并匹配到知识点
  const loadScreenshotsForKnowledgePoints = async (
    knowledgePoints: KnowledgePoint[],
    screenshotsResultUrl: string
  ): Promise<KnowledgePoint[]> => {
    try {
      console.log('📸 加载数据库中的知识点截图:', screenshotsResultUrl);
      
      const secureUrl = ensureHttps(screenshotsResultUrl) as string;
      const response = await fetch(secureUrl);
      const data = await response.json();
      
      const screenshots = data.screenshots || [];
      console.log(`✅ 获取到 ${screenshots.length} 张预生成的截图`);
      
      // 将截图按顺序匹配到知识点（第i个知识点对应第i张截图）
      const updatedKnowledgePoints = knowledgePoints.map((kp, index) => {
        if (index < screenshots.length && screenshots[index]) {
          return {
            ...kp,
            thumbnail: screenshots[index]  // 使用数据库中的截图
          };
        }
        return kp;
      });
      
      const matchedCount = updatedKnowledgePoints.filter(kp => kp.thumbnail).length;
      console.log(`✅ 成功匹配 ${matchedCount}/${knowledgePoints.length} 个知识点的截图`);
      
      return updatedKnowledgePoints;
    } catch (error) {
      console.error('❌ 加载知识点截图失败:', error);
      return knowledgePoints;  // 失败时返回原始知识点
    }
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

  // 加载已保存的笔记（当知识点加载完成后）
  useEffect(() => {
    if (knowledgePoints.length > 0 && processedTaskData?.task_id && saveStatus === 'unsaved') {
      loadSavedNote(processedTaskData.task_id);
    }
  }, [knowledgePoints.length, processedTaskData?.task_id]); // 当知识点加载完成时执行

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
            // 确保使用 HTTPS
            const secureVideoUrl = ensureHttps(videoUrl) as string;
            setCdnVideoUrl(secureVideoUrl);
            console.log(`✅ 设置视频URL (P${partIndex + 1}):`, secureVideoUrl);
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
            
            // 确保使用 HTTPS
            const secureKpUrl = ensureHttps(kpUrl) as string;
            
            const kpResponse = await fetch(secureKpUrl);
            const kpData = await kpResponse.json();
            
            console.log(`✅ 加载知识点数据 (P${partIndex + 1}):`, kpData);
            console.log(`🔍 [DEBUG] 完整JSON内容:`, JSON.stringify(kpData, null, 2));
            
            // 支持两种格式：直接数组 或 {knowledge_points: [...]}
            let kpArray = kpData;
            if (!Array.isArray(kpData) && kpData.knowledge_points) {
              kpArray = kpData.knowledge_points;
            }
            
            // 🔍 检查是否包含 transcript_segment 字段
            if (Array.isArray(kpArray) && kpArray.length > 0) {
              const firstKp = kpArray[0];
              console.log('🔍 [DEBUG] 第一个知识点的所有字段:', Object.keys(firstKp));
              console.log('🔍 [DEBUG] 第一个知识点的 transcript_segment:', firstKp.transcript_segment);
              
              const hasTranscriptCount = kpArray.filter(kp => kp.transcript_segment).length;
              if (hasTranscriptCount > 0) {
                console.log(`✅ 发现 ${hasTranscriptCount}/${kpArray.length} 个知识点包含逐字稿`);
                console.log('✅ 逐字稿字段示例:', firstKp.transcript_segment?.substring(0, 100) + '...');
              } else {
                console.warn('⚠️ 逐字稿字段不存在！这是旧版本的知识点数据。');
                console.warn('💡 解决方案：需要重新分析视频以生成包含逐字稿的新数据。');
                console.warn('📝 操作步骤：');
                console.warn('   1. 在视频列表中找到这个视频');
                console.warn('   2. 删除旧任务（如果需要）');
                console.warn('   3. 重新上传/分析视频');
                console.warn('   4. 新生成的知识点数据将自动包含逐字稿片段');
              }
            }
            
            if (Array.isArray(kpArray) && kpArray.length > 0) {
              // 检查是否有预生成的截图
              const screenshotsUrls = processedTaskDataRef.current.screenshots_result_url;
              let finalKpArray = kpArray;
              
              if (screenshotsUrls) {
                console.log('🔍 检测到数据库中的截图URL，开始加载...');
                const screenshotsUrlArray = typeof screenshotsUrls === 'string'
                  ? (screenshotsUrls.startsWith('[') ? JSON.parse(screenshotsUrls) : [screenshotsUrls])
                  : screenshotsUrls;
                const screenshotsUrl = Array.isArray(screenshotsUrlArray) ? screenshotsUrlArray[partIndex] : screenshotsUrlArray;
                
                if (screenshotsUrl) {
                  finalKpArray = await loadScreenshotsForKnowledgePoints(kpArray, screenshotsUrl);
                }
              }
              
              // 🔍 加载ASR逐字稿数据
              const asrUrls = processedTaskDataRef.current.asr_result_url;
              if (asrUrls) {
                console.log('📝 检测到数据库中的ASR结果URL，开始加载...');
                const asrUrlArray = typeof asrUrls === 'string'
                  ? (asrUrls.startsWith('[') ? JSON.parse(asrUrls) : [asrUrls])
                  : asrUrls;
                const asrUrl = Array.isArray(asrUrlArray) ? asrUrlArray[partIndex] : asrUrlArray;
                
                if (asrUrl) {
                  try {
                    const secureAsrUrl = ensureHttps(asrUrl) as string;
                    console.log('📥 加载ASR逐字稿:', secureAsrUrl);
                    const asrResponse = await fetch(secureAsrUrl);
                    const asrText = await asrResponse.text();
                    console.log(`✅ ASR逐字稿加载成功，长度: ${asrText.length} 字符`);
                    console.log('📝 逐字稿预览 (前200字符):', asrText.substring(0, 200));
                    
                    // 保存完整逐字稿
                    setFullTranscript(asrText);
                    fullTranscriptRef.current = asrText;
                  } catch (error) {
                    console.error('❌ 加载ASR逐字稿失败:', error);
                  }
                }
              }
              
              setKnowledgePoints(finalKpArray);
              console.log(`✅ 设置 ${finalKpArray.length} 个知识点`);
              // 自动全部展开
              const allIndexes = finalKpArray.map((_, idx) => idx);
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
              // 确保使用 HTTPS
              const secureVideoUrl = ensureHttps(videoUrlFromResult) as string;
              setCdnVideoUrl(secureVideoUrl);
              console.log('✅ [loadPart] setCdnVideoUrl 已调用，使用公司CDN URL (HTTPS)');
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
              // 确保使用 HTTPS
              const secureVideoUrl = ensureHttps(videoUrlFromResult) as string;
              setCdnVideoUrl(secureVideoUrl);
              console.log('✅ [pollJobStatus] setCdnVideoUrl 已调用，使用公司CDN URL (HTTPS)');
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
  
  // 搜索知识点
  const searchKnowledgePoints = async () => {
    if (!searchKeyword.trim()) {
      alert('请输入搜索关键词');
      return;
    }
    
    // 记录搜索事件
    trackKeyActionSafely(
      'video_search',
      {
        keyword: searchKeyword,
        timestamp: Date.now(),
      },
      currentUser
    );
    
    setIsSearching(true);
    
    try {
      const results: SearchResult[] = [];
      
      console.log('🔍 开始搜索...');
      
      // 辅助函数：解析URL字段
      const parseUrlField = (field: any): string[] | string | null => {
        if (!field) return null;
        if (Array.isArray(field)) return field as string[];
        if (typeof field === 'string') {
          if (field.startsWith('[')) {
            try {
              return JSON.parse(field);
            } catch (e) {
              return field; // 解析失败当作普通字符串
            }
          }
          return field;
        }
        return null;
      };

      // 获取截图URL数组和视频URL数组
      const screenshotsResultUrls = processedTaskData?.screenshots_result_url;
      const screenshotsUrlArray = parseUrlField(screenshotsResultUrls);
      
      const videoUrls = processedTaskData?.video_url;
      const videoUrlArray = parseUrlField(videoUrls);
      
      // 如果是多P视频，搜索所有分P的知识点
      if (isSeries && allParts.length > 0) {
        // 获取知识点URL数组
        const kpUrls = processedTaskData?.knowledge_points_result_url;
        const kpUrlArray = parseUrlField(kpUrls);
        
        if (kpUrlArray) {
          for (let partIndex = 0; partIndex < allParts.length; partIndex++) {
            const part = allParts[partIndex];
            const kpUrl = Array.isArray(kpUrlArray) ? kpUrlArray[partIndex] : kpUrlArray;
            
            if (kpUrl) {
              try {
                const secureKpUrl = ensureHttps(kpUrl as string) as string;
                const response = await fetch(secureKpUrl);
                const kpData = await response.json();
                
                let kpArray = kpData;
                if (!Array.isArray(kpData) && kpData.knowledge_points) {
                  kpArray = kpData.knowledge_points;
                }
                
                if (Array.isArray(kpArray)) {
                  // 过滤匹配的知识点
                  const matchedKPs = kpArray.filter((kp: any) => 
                    kp.name && kp.name.toLowerCase().includes(searchKeyword.toLowerCase())
                  );

                  if (matchedKPs.length > 0) {
                    // 如果有匹配，加载该分P的截图（如果存在）
                    let screenshots: string[] = [];
                    const screenshotsUrl = Array.isArray(screenshotsUrlArray) ? screenshotsUrlArray[partIndex] : screenshotsUrlArray;
                    
                    if (screenshotsUrl) {
                      try {
                        const sResponse = await fetch(ensureHttps(screenshotsUrl as string) as string);
                        const sData = await sResponse.json();
                        screenshots = sData.screenshots || [];
                      } catch (e) {
                        console.error('加载截图失败:', e);
                      }
                    }

                    // 获取该分P的视频URL
                    let partVideoUrl = '';
                    const vUrl = Array.isArray(videoUrlArray) ? videoUrlArray[partIndex] : videoUrlArray;
                    if (vUrl) partVideoUrl = ensureHttps(vUrl as string) as string;

                    matchedKPs.forEach((kp: any) => {
                      // 找到原始索引以匹配截图
                      const originalIndex = kpArray.indexOf(kp);
                      results.push({
                        knowledgePointName: kp.name,
                        partIndex: partIndex,
                        partTitle: part.part_title || `P${partIndex + 1}`,
                        knowledgePointIndex: originalIndex,
                        startTime: kp.start_time || '00:00',
                        endTime: kp.end_time || '00:00',
                        thumbnail: screenshots[originalIndex] || kp.thumbnail,
                        note: kp.note,
                        videoUrl: partVideoUrl
                      });
                    });
                  }
                }
              } catch (error) {
                console.error(`❌ 获取 P${partIndex + 1} 知识点失败:`, error);
              }
            }
          }
        }
      } else {
        // 单P视频
        const matchedKPs = knowledgePoints.filter(kp => 
          kp.name.toLowerCase().includes(searchKeyword.toLowerCase())
        );

        if (matchedKPs.length > 0) {
           const vUrl = Array.isArray(videoUrlArray) ? videoUrlArray[0] : videoUrlArray;
           const partVideoUrl = vUrl ? (ensureHttps(vUrl as string) as string) : cdnVideoUrl;

           matchedKPs.forEach(kp => {
             const originalIndex = knowledgePoints.indexOf(kp);
             results.push({
               knowledgePointName: kp.name,
               partIndex: 0,
               partTitle: videoTitle || '当前视频',
               knowledgePointIndex: originalIndex,
               startTime: kp.start_time,
               endTime: kp.end_time,
               thumbnail: kp.thumbnail,
               note: kp.note,
               videoUrl: partVideoUrl || undefined
             });
           });
        }
      }
      
      console.log(`✅ 搜索完成，找到 ${results.length} 个结果`);
      
      if (results.length > 0) {
        // 排序：优先当前分P，其次离当前时间最近（如果是同分P）
        // 这里简化为：如果是同分P，算时间差绝对值
        const currentSeconds = isYouTubeVideo() && youtubePlayerRef.current 
            ? youtubePlayerRef.current.getCurrentTime() 
            : (videoRef.current?.currentTime || 0);

        results.sort((a, b) => {
           if (a.partIndex === currentPartIndex && b.partIndex !== currentPartIndex) return -1;
           if (a.partIndex !== currentPartIndex && b.partIndex === currentPartIndex) return 1;
           
           if (a.partIndex === currentPartIndex) {
             const timeA = timeToSeconds(a.startTime);
             const timeB = timeToSeconds(b.startTime);
             return Math.abs(timeA - currentSeconds) - Math.abs(timeB - currentSeconds);
           }
           return 0;
        });

        setCurrentSearchResult(results[0]);
        setSearchResults([]); // 清空列表
      } else {
        setCurrentSearchResult(null);
        alert('未找到相关知识点');
      }
      
    } catch (error) {
      console.error('❌ 搜索失败:', error);
      alert('搜索失败，请重试');
    } finally {
      setIsSearching(false);
    }
  };
  
  // 播放搜索结果的知识点
  const playSearchResult = (result: SearchResult) => {
    // 如果是多P视频且不是当前分P，需要切换分P
    if (isSeries && result.partIndex !== currentPartIndex) {
      console.log(`📺 切换到 P${result.partIndex + 1}: ${result.partTitle}`);
      
      // 从 allParts 中找到对应的 part 对象
      const targetPart = allParts[result.partIndex];
      if (targetPart) {
        loadPart(targetPart, result.partIndex);
      
      // 等待分P加载完成后跳转到知识点
      setTimeout(() => {
        handleTimeJump(result.startTime);
        setCurrentKnowledgeIndex(result.knowledgePointIndex);
      }, 1000);
      }
    } else {
      // 同一分P，直接跳转
      handleTimeJump(result.startTime);
      setCurrentKnowledgeIndex(result.knowledgePointIndex);
    }
    
    // 关闭搜索对话框
    setShowSearchDialog(false);
    setCurrentSearchResult(null);
    
    console.log(`⏯️ 播放知识点: ${result.knowledgePointName} (${result.startTime})`);
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
  
  // 仅截图功能（不调用LLM）
  const captureScreenshotOnly = async (index: number) => {
    console.log('🎯 captureScreenshotOnly called, index:', index);
    
    if (!knowledgePoints[index]) {
      console.error('❌ 无效的知识点索引:', index);
      alert('截图失败：无效的知识点');
      return;
    }
    
    const point = knowledgePoints[index];
    console.log('📍 当前知识点:', point.name, point.start_time);
    
    // 记录截图事件
    trackKeyActionSafely(
      'video_screenshot',
      {
        knowledge_point: point.name,
        timestamp: Date.now(),
      },
      currentUser
    );
    
    // 暂停视频
    if (isYouTubeVideo()) {
      if (youtubePlayerRef.current) {
        try {
          const playerState = youtubePlayerRef.current.getPlayerState();
          if (playerState === (window as any).YT.PlayerState.PLAYING) {
            youtubePlayerRef.current.pauseVideo();
            setIsPlaying(false);
            console.log('⏸️ YouTube视频已暂停以进行截图');
          }
        } catch (error) {
          console.error('❌ YouTube播放器暂停失败:', error);
        }
      }
    } else if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
      setIsPlaying(false);
      console.log('⏸️ 视频已暂停以进行截图');
    }
    
    try {
      console.log('📸 开始截图...');
      
      // 捕获视频截图
      let thumbnail = '';
      if (isYouTubeVideo()) {
        console.log('🎬 检测到YouTube视频');
        // YouTube视频
        if (youtubePlayerRef.current) {
          try {
            // 跳转到知识点开始时间
            const timeSeconds = timeToSeconds(point.start_time);
            console.log('⏰ 跳转到时间:', timeSeconds, 'seconds');
            youtubePlayerRef.current.seekTo(timeSeconds, true);
            
            // 等待一小段时间让视频加载
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const videoId = youtubeVideoIdRef.current;
            console.log('🆔 Video ID:', videoId);
            if (videoId) {
              thumbnail = await captureYouTubeThumbnail(videoId, timeSeconds);
              if (!thumbnail) {
                console.log('⚠️ YouTube缩略图获取失败');
                alert('截图失败：无法获取YouTube视频缩略图');
                return;
              } else {
                console.log(`✅ YouTube缩略图已获取（时间点：${point.start_time}）`);
              }
            } else {
              console.error('❌ 未找到YouTube视频ID');
              alert('截图失败：未找到视频ID');
              return;
            }
          } catch (error) {
            console.error('❌ YouTube截图失败:', error);
            alert('截图失败：' + error);
            return;
          }
        } else {
          console.error('❌ YouTube播放器未初始化');
          alert('截图失败：播放器未初始化');
          return;
        }
      } else {
        console.log('🎬 检测到非YouTube视频（B站/CDN）');
        // B站等其他视频：使用Canvas截图当前播放帧
        thumbnail = captureVideoThumbnail();
        console.log('📸 captureVideoThumbnail 返回:', thumbnail ? `${thumbnail.substring(0, 50)}...` : '空');
        if (!thumbnail) {
          console.log('⚠️ 截图失败（可能是CORS限制）');
          alert('截图失败：无法截取视频画面（跨域限制）');
          return;
        } else {
          console.log('✅ 视频截图已捕获');
        }
      }
      
      // 将截图保存到知识点的 screenshots 数组
      console.log('📝 准备保存截图到知识点');
      
      // 更新知识点，将截图添加到 screenshots 数组
      setKnowledgePoints(prev => prev.map((p, i) => 
        i === index ? { 
          ...p, 
          screenshots: [...(p.screenshots || []), thumbnail]
        } : p
      ));
      
      console.log('✅ 截图已保存到笔记');
      alert('截图成功！已保存到笔记');
      
    } catch (error) {
      console.error('❌ 截图过程出错:', error);
      alert('截图失败：' + error);
    }
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
      const transcriptSegment = fullTranscriptRef.current 
        ? extractTranscriptSegment(point.start_time, point.end_time, fullTranscriptRef.current)
        : '';
      
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
  
  // 捕获截图并打开选择器
  const handleCaptureScreenshot = () => {
    const screenshot = captureVideoThumbnail();
    if (screenshot) {
      setScreenshotImage(screenshot);
      setShowScreenshotSelector(true);
      // 暂停视频
      if (videoRef.current) {
        videoRef.current.pause();
      }
    } else {
      alert('截图失败，请稍后重试');
    }
  };

  // 上传截图到CDN
  const uploadScreenshotToCDN = async (imageDataUrl: string): Promise<string | null> => {
    try {
      setIsUploadingScreenshot(true);
      
      // 将base64转换为blob
      const response = await fetch(imageDataUrl);
      const blob = await response.blob();
      
      // 创建FormData
      const formData = new FormData();
      const filename = `screenshot_${Date.now()}.jpg`;
      formData.append('file0', blob, filename);
      
      // 调用后端上传接口
      const uploadResponse = await fetch(`${API_BASE_URL}/open-api/upload`, {
        method: 'POST',
        body: formData,
      });
      
      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }
      
      const result = await uploadResponse.json();
      
      // 解析CDN URL
      let cdnUrl: string | null = null;
      if (result.files && result.files[0]) {
        cdnUrl = result.files[0].url || result.files[0].path;
      } else if (result.url) {
        cdnUrl = result.url;
      }
      
      // 确保URL是完整的
      if (cdnUrl && !cdnUrl.startsWith('http')) {
        cdnUrl = `http://file.gsxservice.com/${cdnUrl.replace(/^\//, '')}`;
      }
      
      console.log('✅ Screenshot uploaded to CDN:', cdnUrl);
      return cdnUrl;
    } catch (error) {
      console.error('❌ Screenshot upload failed:', error);
      return null;
    } finally {
      setIsUploadingScreenshot(false);
    }
  };

  // 处理截图确认
  const handleScreenshotConfirm = async (croppedImage: string) => {
    const cdnUrl = await uploadScreenshotToCDN(croppedImage);
    
    if (cdnUrl) {
      // 生成唯一ID
      const imageId = `img_${Date.now()}`;
      
      // 添加到附加图片列表
      setAttachedImages(prev => [...prev, {
        id: imageId,
        url: cdnUrl,
        thumbnail: croppedImage
      }]);
      
      // 在输入框中插入标签（使用占位符空格让宽度匹配样式层显示）
      const imageNumber = attachedImages.length + 1;
      // 添加4个全角空格作为占位符，匹配图标+删除按钮的宽度
      setQuestionInput(prev => prev + `【图${imageNumber}　　　】`);
      
      // 关闭选择器
      setShowScreenshotSelector(false);
      setScreenshotImage(null);
    } else {
      alert('上传失败，请重试');
    }
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
      // 优先使用知识点中的 transcript_segment 字段，如果没有则从完整逐字稿中动态提取
      const transcriptSegment = point.transcript_segment || 
        (fullTranscriptRef.current
          ? extractTranscriptSegment(point.start_time, point.end_time, fullTranscriptRef.current)
          : '');
      
      console.log('🤔 Asking question:', question);
      console.log('📄 Context length:', transcriptSegment.length, 'chars');
      console.log('📄 Context preview:', transcriptSegment.substring(0, 100), '...');
      
      if (!transcriptSegment) {
        console.warn('⚠️ 没有可用的逐字稿片段，将使用空上下文');
      }
      
      // 提取图片标签并替换为实际URL
      let questionWithImages = question;
      const imageUrls: string[] = [];
      
      // 查找所有图片标签（格式：【图1】、【图2】等，可能包含占位符空格）
      const imageTagPattern = /【图(\d+)[　\s]*】/g;
      const matches = [...question.matchAll(imageTagPattern)];
      
      for (const match of matches) {
        const imageNumber = parseInt(match[1]);
        const imageIndex = imageNumber - 1;
        
        if (imageIndex >= 0 && imageIndex < attachedImages.length) {
          const img = attachedImages[imageIndex];
          // 替换标签为markdown格式
          questionWithImages = questionWithImages.replace(match[0], `[图片${imageNumber}](${img.url})`);
          // 避免重复添加同一张图片URL
          if (!imageUrls.includes(img.url)) {
            imageUrls.push(img.url);
          }
        }
      }
      
      // 调用LLM API回答问题
      const response = await fetch(buildApiUrl(API_ENDPOINTS.notesAnswerQuestion), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: questionWithImages,
          knowledge_point_name: point.name,
          transcript_segment: transcriptSegment,
          video_title: videoTitle,
          video_url: currentVideoUrl,
          locale: locale,  // 传递语言环境
          image_urls: imageUrls.length > 0 ? imageUrls : undefined, // 附加的截图URLs
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
        
        // 添加到对话历史（支持多轮对话）
        setConversationHistory(prev => [...prev, qaPair]);
        
        // 清空输入框和附加图片，但保持对话框打开
        setQuestionInput('');
        setAttachedImages([]);
        
        // 标记为不在提问状态
        setKnowledgePoints(prev => prev.map((p, i) => 
          i === index ? { ...p, isAsking: false } : p
        ));
        
        console.log('✅ Question answered, added to conversation:', qaPair);
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
  
  // 当对话历史更新时，自动滚动到底部
  useEffect(() => {
    if (conversationHistory.length > 0 && conversationEndRef.current) {
      conversationEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [conversationHistory]);
  
  // 将搜索结果添加到当前知识点
  const addSearchResultToKnowledgePoint = () => {
    if (!currentSearchResult || currentKnowledgeIndex === null) return;
    
        setKnowledgePoints(prev => prev.map((p, i) => {
      if (i === currentKnowledgeIndex) {
        const searchResults = p.searchResults || [];
            return {
              ...p,
          searchResults: [...searchResults, currentSearchResult],
            };
          }
          return p;
        }));
        
    // 关闭搜索对话框
    setShowSearchDialog(false);
    setCurrentSearchResult(null);
    setIsPlayingResultVideo(false);
    
    console.log('✅ 搜索结果已添加到当前知识点笔记');
  };
  
  // 将QA卡片添加到当前知识点
  const addQACardToKnowledgePoint = () => {
    if (!currentQACard || currentKnowledgeIndex === null) return;
    
    setKnowledgePoints(prev => prev.map((p, i) => {
      if (i === currentKnowledgeIndex) {
        const qaList = p.qaList || [];
        return {
          ...p,
          qaList: [...qaList, currentQACard],
        };
      }
      return p;
    }));
        
    // 关闭浮动卡片，继续播放视频
    setCurrentQACard(null);
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
    
    console.log('✅ QA卡片已添加到知识点');
  };
  
  // 关闭QA卡片（不添加到笔记）
  const closeQACard = () => {
    setCurrentQACard(null);
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
    console.log('❌ QA卡片已关闭，未添加到笔记');
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
  
  // 保存笔记为一张长图（所有知识点拼接）
  const saveNotesAsLongImage = async () => {
    try {
      console.log('📸 开始导出长图笔记...');
      
      // 筛选有内容的知识点
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
      
      // 生成封面标题
      const coverTitleText = generateCoverTitle();
      console.log(`✅ 封面标题: ${coverTitleText}`);
      
      // 图片尺寸
      const IMAGE_WIDTH = 900;
      const SCALE = 2;
      
      // 创建主容器
      const mainContainer = document.createElement('div');
      mainContainer.style.position = 'absolute';
      mainContainer.style.left = '-9999px';
      mainContainer.style.top = '0';
      mainContainer.style.width = `${IMAGE_WIDTH}px`;
      mainContainer.style.background = 'linear-gradient(135deg, #fef3e2 0%, #fce8d6 50%, #f9e8d7 100%)';
      mainContainer.style.padding = '60px 50px';
      mainContainer.style.fontFamily = '"Comic Sans MS", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
      mainContainer.style.color = '#2d2d2d';
      mainContainer.style.boxShadow = '0 0 100px rgba(0,0,0,0.05)';
      mainContainer.style.boxSizing = 'border-box';
      document.body.appendChild(mainContainer);
      
      // 1. 添加首图内容到主容器
      console.log('🎨 生成首图部分...');
      
      // 顶部装饰条
      const topDecor = document.createElement('div');
      topDecor.style.cssText = `
        height: 12px;
        background: linear-gradient(90deg, #ff6b6b, #ffd93d, #6bcf7f, #4d96ff);
        border-radius: 50px;
        margin-bottom: 50px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      `;
      mainContainer.appendChild(topDecor);
      
      // 大字报标题
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
      mainContainer.appendChild(coverTitle);
      
      // 统计信息卡片
      const statsCard = document.createElement('div');
      statsCard.style.cssText = `
        background: #ffffff;
        padding: 40px;
        border-radius: 30px;
        margin: 40px 0 60px 0;
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
      mainContainer.appendChild(statsCard);
      
      // 分隔线
      const divider = document.createElement('div');
      divider.style.cssText = `
        height: 4px;
        background: linear-gradient(90deg, transparent, #ddd, transparent);
        margin: 60px 0;
      `;
      mainContainer.appendChild(divider);
      
      // 2. 逐个添加知识点内容
      for (let index = 0; index < pointsWithContent.length; index++) {
        const point = pointsWithContent[index];
        console.log(`🎨 添加知识点 ${index + 1}/${pointsWithContent.length}...`);
        
        // 知识点容器
        const pointSection = document.createElement('div');
        pointSection.style.cssText = `
          margin-bottom: 80px;
        `;
        
        // 知识点序号标签
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
        pointSection.appendChild(badge);
        
        // 知识点标题
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
        pointSection.appendChild(pointTitle);
        
        // 时间戳
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
        pointSection.appendChild(timestamp);
        
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
        
        // 笔记内容
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
          
          card.appendChild(noteSection);
        }
        
        // 视频截图
        if (point.thumbnail) {
          const thumbnailSection = document.createElement('div');
          thumbnailSection.style.cssText = `
            margin-top: 30px;
            padding: 30px;
            background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
            border-radius: 24px;
            border: 4px solid #38bdf8;
            position: relative;
          `;
          
          const thumbnailIcon = document.createElement('div');
          thumbnailIcon.style.cssText = `
            position: absolute;
            top: -20px;
            left: 30px;
            background: linear-gradient(135deg, #0ea5e9, #38bdf8);
            color: white;
            font-size: 20px;
            padding: 10px 24px;
            border-radius: 50px;
            font-weight: 900;
            box-shadow: 0 6px 16px rgba(14,165,233,0.5);
          `;
          thumbnailIcon.textContent = '📸 视频截图';
          thumbnailSection.appendChild(thumbnailIcon);
          
          const thumbnailImg = document.createElement('img');
          thumbnailImg.style.cssText = `
            width: 100%;
            border-radius: 16px;
            margin-top: 30px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.15);
          `;
          thumbnailImg.src = point.thumbnail;
          thumbnailImg.crossOrigin = 'anonymous';
          thumbnailSection.appendChild(thumbnailImg);
          
          card.appendChild(thumbnailSection);
        }
        
        // Q&A内容
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
        
        // 练习内容
        if (point.exercise) {
          const exerciseSection = document.createElement('div');
          exerciseSection.style.cssText = `
            margin-top: 30px;
            padding: 28px;
            background: linear-gradient(135deg, #fef3c7 0%, #fef9e7 100%);
            border-radius: 24px;
            border: 4px solid #fbbf24;
            position: relative;
          `;
          
          const exerciseIcon = document.createElement('div');
          exerciseIcon.style.cssText = `
            position: absolute;
            top: -20px;
            left: 30px;
            background: linear-gradient(135deg, #f59e0b, #fbbf24);
            color: white;
            font-size: 20px;
            padding: 10px 24px;
            border-radius: 50px;
            font-weight: 900;
            box-shadow: 0 6px 16px rgba(251,191,36,0.5);
          `;
          exerciseIcon.textContent = `💪 ${point.exercise.type === 'multiple_choice' ? '选择题' : point.exercise.type === 'fill_blank' ? '填空题' : '练习'}`;
          exerciseSection.appendChild(exerciseIcon);
          
          // 练习标题
          const exerciseLabel = document.createElement('div');
          exerciseLabel.style.cssText = `
            font-size: 28px;
            font-weight: 900;
            color: #92400e;
            margin-top: 30px;
            margin-bottom: 20px;
            font-family: '"Comic Sans MS", cursive';
          `;
          exerciseLabel.textContent = point.exercise.title;
          exerciseSection.appendChild(exerciseLabel);
          
          // 练习描述
          const exerciseDesc = document.createElement('div');
          exerciseDesc.style.cssText = `
            font-size: 22px;
            color: #78350f;
            margin-bottom: 24px;
            line-height: 1.8;
            font-weight: 500;
          `;
          exerciseDesc.textContent = point.exercise.description;
          exerciseSection.appendChild(exerciseDesc);
          
          // 题目内容
          if (point.exercise.question) {
            const questionDiv = document.createElement('div');
            questionDiv.style.cssText = `
              font-size: 26px;
              color: #1f2937;
              line-height: 1.8;
              margin-bottom: 24px;
              padding: 24px;
              background: white;
              border-radius: 16px;
              font-weight: 600;
              box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            `;
            questionDiv.textContent = point.exercise.question;
            exerciseSection.appendChild(questionDiv);
          }
          
          // 选择题选项
          if (point.exercise.type === 'multiple_choice' && point.exercise.choices) {
            const choicesContainer = document.createElement('div');
            choicesContainer.style.cssText = `
              margin-bottom: 24px;
            `;
            
            const correctAnswer = point.exercise.solution; // 提取到外层
            
            point.exercise.choices.forEach((choice: any) => {
              const choiceDiv = document.createElement('div');
              const isCorrect = choice.label === correctAnswer;
              const isUserChoice = choice.label === point.userAnswer;
              
              choiceDiv.style.cssText = `
                padding: 16px 20px;
                margin-bottom: 12px;
                background: ${isCorrect ? '#d1fae5' : isUserChoice ? '#fee2e2' : 'white'};
                border: 3px solid ${isCorrect ? '#10b981' : isUserChoice ? '#f87171' : '#e5e7eb'};
                border-radius: 12px;
                font-size: 22px;
                color: #1f2937;
                font-weight: ${isCorrect || isUserChoice ? '700' : '500'};
              `;
              
              const prefix = isCorrect ? '✅ ' : isUserChoice ? '❌ ' : '';
              choiceDiv.textContent = `${prefix}${choice.label}. ${choice.content}`;
              choicesContainer.appendChild(choiceDiv);
            });
            
            exerciseSection.appendChild(choicesContainer);
          }
          
          // 用户答案（填空题或其他）
          if (point.userAnswer && point.exercise.type !== 'multiple_choice') {
            const answerDiv = document.createElement('div');
            answerDiv.style.cssText = `
              padding: 20px;
              background: #e0f2fe;
              border-radius: 12px;
              margin-bottom: 20px;
              border: 3px solid #0ea5e9;
            `;
            
            const answerLabel = document.createElement('div');
            answerLabel.style.cssText = `
              font-size: 20px;
              font-weight: 700;
              color: #0c4a6e;
              margin-bottom: 8px;
            `;
            answerLabel.textContent = '你的答案：';
            answerDiv.appendChild(answerLabel);
            
            const answerContent = document.createElement('div');
            answerContent.style.cssText = `
              font-size: 24px;
              color: #1f2937;
              font-weight: 600;
            `;
            answerContent.textContent = point.userAnswer;
            answerDiv.appendChild(answerContent);
            
            exerciseSection.appendChild(answerDiv);
          }
          
          // 正确答案
          const solutionDiv = document.createElement('div');
          solutionDiv.style.cssText = `
            padding: 20px;
            background: #d1fae5;
            border-radius: 12px;
            margin-bottom: 20px;
            border: 3px solid #10b981;
          `;
          
          const solutionLabel = document.createElement('div');
          solutionLabel.style.cssText = `
            font-size: 20px;
            font-weight: 700;
            color: #065f46;
            margin-bottom: 8px;
          `;
          solutionLabel.textContent = '✅ 正确答案：';
          solutionDiv.appendChild(solutionLabel);
          
          const solutionContent = document.createElement('div');
          solutionContent.style.cssText = `
            font-size: 24px;
            color: #1f2937;
            font-weight: 600;
          `;
          solutionContent.textContent = point.exercise.solution;
          solutionDiv.appendChild(solutionContent);
          
          exerciseSection.appendChild(solutionDiv);
          
          // 代码内容（如果是代码题）
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
              margin-bottom: 20px;
            `;
            codeBlock.textContent = point.userCode;
            exerciseSection.appendChild(codeBlock);
          }
          
          // 验证结果
          if (point.validationResult) {
            const resultDiv = document.createElement('div');
            resultDiv.style.cssText = `
              margin-top: 20px;
              padding: 24px;
              background: ${point.validationResult.passed ? '#d1fae5' : '#fee2e2'};
              border-radius: 16px;
              border: 3px solid ${point.validationResult.passed ? '#10b981' : '#f87171'};
            `;
            
            const resultText = document.createElement('div');
            resultText.style.cssText = `
              font-size: 26px;
              font-weight: 900;
              color: ${point.validationResult.passed ? '#065f46' : '#991b1b'};
              margin-bottom: 16px;
            `;
            resultText.textContent = `${point.validationResult.passed ? '✅ 回答正确！' : '❌ 回答错误'}`;
            resultDiv.appendChild(resultText);
            
            // 反馈内容
            if (point.validationResult.feedback) {
              const feedbackDiv = document.createElement('div');
              feedbackDiv.style.cssText = `
                font-size: 22px;
                color: #374151;
                line-height: 1.8;
                white-space: pre-wrap;
                font-weight: 500;
              `;
              feedbackDiv.textContent = point.validationResult.feedback.replace(/[#*]/g, ''); // 移除 Markdown 符号
              resultDiv.appendChild(feedbackDiv);
            }
            
            exerciseSection.appendChild(resultDiv);
          }
          
          card.appendChild(exerciseSection);
        }
        
        pointSection.appendChild(card);
        
        // 知识点之间的分隔
        if (index < pointsWithContent.length - 1) {
          const pointDivider = document.createElement('div');
          pointDivider.style.cssText = `
            height: 2px;
            background: linear-gradient(90deg, transparent, #e0e0e0, transparent);
            margin-top: 60px;
          `;
          pointSection.appendChild(pointDivider);
        }
        
        mainContainer.appendChild(pointSection);
      }
      
      // 底部装饰
      const footer = document.createElement('div');
      footer.style.cssText = `
        margin-top: 60px;
        text-align: center;
        font-size: 48px;
      `;
      footer.textContent = '✨📚✨';
      mainContainer.appendChild(footer);
      
      // 生成并下载长图
      console.log('📸 正在生成长图...');
      const canvas = await html2canvas(mainContainer, {
        backgroundColor: '#ffffff',
        scale: SCALE,
        width: IMAGE_WIDTH,
        height: mainContainer.scrollHeight,
        useCORS: true,
        allowTaint: true,
        logging: false,
      });
      
      const fileName = `${videoTitle || '视频笔记'}_完整笔记_${new Date().getTime()}.png`;
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
      }, 'image/png');
      
      document.body.removeChild(mainContainer);
      
      console.log('✅ 长图笔记导出完成！');
      alert(`${t('exportSuccess')}: 1 ${t('image')}`);
      
    } catch (error) {
      console.error('❌ 导出长图失败:', error);
      alert(`${t('exportFailed')}: ${error}`);
    }
  };
  
  // 生成练习题
  const generateExercise = async (index: number) => {
    const point = knowledgePoints[index];
    
    // 记录练习事件
    trackKeyActionSafely(
      'video_exercise',
      {
        knowledge_point: point.name,
        timestamp: Date.now(),
      },
      currentUser
    );
    
    // 暂停视频
    if (videoRef.current && isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
      console.log('⏸️ 视频已暂停，开始生成练习');
    }
    
    // 打开对话框并开始生成
    setShowExerciseDialog(true);
    setIsGeneratingExercise(true);
    setGeneratedExercise(null);
    setExerciseKnowledgePointIndex(index);
    // 清空上一道题的答案和状态
    setGeneratedExerciseUserAnswer('');
    setGeneratedExerciseSubmitted(false);
    setGeneratedExerciseShowHints(false);
    
    try {
      // 🔍 优先检查数据库中是否有练习数据
      if (isProcessedVideoRef.current && processedTaskDataRef.current) {
        const exercisesUrls = processedTaskDataRef.current.exercises_result_url;
        
        if (exercisesUrls) {
          console.log('🔍 检测到数据库中的练习URL，尝试加载...');
          const exercisesUrlArray = typeof exercisesUrls === 'string'
            ? (exercisesUrls.startsWith('[') ? JSON.parse(exercisesUrls) : [exercisesUrls])
            : exercisesUrls;
          const exercisesUrl = Array.isArray(exercisesUrlArray) ? exercisesUrlArray[currentPartIndex] : exercisesUrlArray;
          
          if (exercisesUrl) {
            try {
              const secureExercisesUrl = ensureHttps(exercisesUrl) as string;
              console.log('📥 加载练习数据:', secureExercisesUrl);
              const exercisesResponse = await fetch(secureExercisesUrl);
              const exercisesData = await exercisesResponse.json();
              console.log('✅ 练习数据加载成功:', exercisesData);
              
              // 查找当前知识点对应的练习
              let exerciseForKnowledgePoint: Exercise | null = null;
              
              // 支持两种格式：直接数组 或 {exercises: [...]}
              let exercisesArray = Array.isArray(exercisesData) ? exercisesData : exercisesData.exercises;
              
              if (Array.isArray(exercisesArray)) {
                console.log('🔍 开始匹配练习，当前知识点:', point.name);
                console.log('🔍 练习总数:', exercisesArray.length);
      
                // 方式1: 通过 knowledge_point 或 knowledge_point_name 字段匹配
                exerciseForKnowledgePoint = exercisesArray.find(ex => 
                  ex.knowledge_point === point.name || 
                  ex.knowledge_point_name === point.name
                );
                
                // 方式2: 通过 title 匹配（格式："知识点练习：xxx"）
                if (!exerciseForKnowledgePoint) {
                  exerciseForKnowledgePoint = exercisesArray.find(ex => {
                    if (ex.title && ex.title.includes('：')) {
                      const titleKnowledgePoint = ex.title.split('：')[1];
                      console.log('🔍 比较 title 中的知识点:', titleKnowledgePoint, 'vs', point.name);
                      return titleKnowledgePoint === point.name;
                    }
                    return false;
                  });
                }
                
                // 方式3: 通过索引匹配（作为最后的备选）
                if (!exerciseForKnowledgePoint && exercisesArray[index]) {
                  console.log('🔍 通过索引匹配，使用第', index, '个练习');
                  exerciseForKnowledgePoint = exercisesArray[index];
                }
              }
              
              if (exerciseForKnowledgePoint) {
                console.log('✅ 找到知识点对应的练习:', exerciseForKnowledgePoint);
                // 过滤掉错误类型的练习
                if ((exerciseForKnowledgePoint as any).type === 'error') {
                  console.warn('⚠️ 该练习生成时出错，将调用API重新生成');
                  console.warn('错误信息:', (exerciseForKnowledgePoint as any).error);
                } else {
                  setGeneratedExercise(exerciseForKnowledgePoint);
                  setIsGeneratingExercise(false);
                  return;
                }
              } else {
                console.warn('⚠️ 未找到当前知识点对应的练习');
                console.warn('当前知识点名称:', point.name);
                console.warn('可用的练习 titles:', exercisesArray?.map(ex => ex.title));
                console.log('📝 将调用API生成新练习');
              }
            } catch (error) {
              console.error('❌ 加载练习数据失败:', error);
              console.log('📝 将调用API生成新练习');
            }
          }
        }
      }
      
      // 如果数据库中没有练习数据，调用LLM API生成
      console.log('💪 调用API生成练习，知识点:', point.name);
      
      // 提取对应的逐字稿片段作为上下文
      const transcriptSegment = fullTranscriptRef.current
        ? extractTranscriptSegment(point.start_time, point.end_time, fullTranscriptRef.current)
        : '';
      
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
          locale: locale,
          subject: 'math', // 学科类型，默认为数学
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.exercise) {
        // 将生成的练习存储到状态中，在对话框中展示
        setGeneratedExercise(data.exercise);
        setIsGeneratingExercise(false);
        console.log('✅ Exercise generated:', data.exercise);
      } else {
        throw new Error(data.error || '练习生成失败');
      }
    } catch (error) {
      console.error('❌ Error generating exercise:', error);
      setIsGeneratingExercise(false);
      alert(`${t('generateExercise')} ${t('error')}: ${error}`);
    }
  };

  // 将生成的练习添加到知识点卡槽中
  const addExerciseToKnowledgePoint = () => {
    if (exerciseKnowledgePointIndex === null || !generatedExercise) {
      return;
    }
    
        setKnowledgePoints(prev => prev.map((p, i) => {
      if (i === exerciseKnowledgePointIndex) {
        const exercises = p.exercises || [];
            return {
              ...p,
          exercises: [...exercises, generatedExercise],
            };
          }
          return p;
        }));
        
    // 关闭对话框并重置状态
    setShowExerciseDialog(false);
    setGeneratedExercise(null);
    setExerciseKnowledgePointIndex(null);
    setIsGeneratingExercise(false);
    setGeneratedExerciseUserAnswer('');
    setGeneratedExerciseSubmitted(false);
    setGeneratedExerciseShowHints(false);
    
    console.log('✅ 练习卡片已添加到知识点卡槽');
  };

  // 提交生成对话框中的练习答案
  const submitGeneratedExerciseAnswer = () => {
    if (!generatedExercise || !generatedExerciseUserAnswer) return;
    setGeneratedExerciseSubmitted(true);
  };

  // 检查生成对话框中的答案是否正确
  const isGeneratedAnswerCorrect = (choiceLabel: string): boolean | null => {
    if (!generatedExercise || !generatedExerciseSubmitted) return null;
    if (generatedExercise.type === 'multiple_choice') {
      return choiceLabel === generatedExercise.solution;
    }
    return null;
  };

  // 保存视频笔记到数据库
  const saveVideoNote = async () => {
    // 检查用户是否登录
    if (typeof window === 'undefined') return;
    
    // 简单检查：如果没有 task_id，无法保存
    if (!processedTaskData?.task_id) {
      alert('无法保存：缺少视频任务ID。只有已处理的视频才能保存笔记。');
      return;
    }
    
    setIsSavingNote(true);
    setSaveStatus('saving');
    
    try {
      // 准备用户笔记数据
      const userNotesData = {
        knowledgePointNotes: knowledgePoints.map(kp => ({
          knowledgePointName: kp.name,
          startTime: kp.start_time,
          endTime: kp.end_time,
          qaList: kp.qaList || [],
          screenshots: kp.screenshots || [],
          exercises: kp.exercises || [],
          searchResults: kp.searchResults || [],
          customNote: kp.note, // 如果用户修改了笔记
        })),
      };
      
      const response = await fetch('/api/video-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId: processedTaskData.task_id,
          videoUrl: videoUrl,
          bvId: processedTaskData.video_info?.bv_id,
          videoTitle: processedTaskData.video_title,
          videoPlatform: 'bilibili',
          userNotesData,
          title: null, // 可以让用户输入
          description: null,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSavedNoteId(result.noteId);
        setSaveStatus('saved');
        setLastSavedAt(new Date());
        alert(`笔记${result.isNew ? '保存' : '更新'}成功！ 💾`);
      } else {
        throw new Error(result.error || '保存失败');
      }
    } catch (error) {
      console.error('保存笔记失败:', error);
      setSaveStatus('error');
      alert(`保存笔记失败：${error instanceof Error ? error.message : '未知错误'}。请确保已登录。`);
    } finally {
      setIsSavingNote(false);
    }
  };

  // 加载已保存的笔记
  const loadSavedNote = async (taskId: string) => {
    try {
      const response = await fetch(`/api/video-notes?taskId=${taskId}`);
      const data = await response.json();
      
      if (data.success && data.notes.length > 0) {
        const userNote = data.notes[0];
        setSavedNoteId(userNote.id);
        setSaveStatus('saved');
        setLastSavedAt(new Date(userNote.updatedAt));
        
        console.log('✅ 加载已保存的笔记:', userNote.id);
        
        // 合并用户笔记数据到知识点
        const userNoteData = userNote.userNotesData;
        if (userNoteData && userNoteData.knowledgePointNotes) {
          setKnowledgePoints(prev => prev.map(kp => {
            // 查找匹配的用户笔记
            const userKP = userNoteData.knowledgePointNotes.find(
              (un: any) => un.knowledgePointName === kp.name &&
                          un.startTime === kp.start_time &&
                          un.endTime === kp.end_time
            );
            
            if (userKP) {
              // 合并用户数据
              return {
                ...kp,
                qaList: userKP.qaList || kp.qaList,
                screenshots: [
                  ...(kp.screenshots || []),
                  ...(userKP.screenshots || [])
                ],
                exercises: userKP.exercises || kp.exercises,
                searchResults: userKP.searchResults || kp.searchResults,
                note: userKP.customNote || kp.note,
              };
            }
            
            return kp;
          }));
        }
      } else {
        setSaveStatus('unsaved');
      }
    } catch (error) {
      console.error('加载已保存笔记失败:', error);
    }
  };

  // 关闭练习卡片（不添加到笔记）
  const closeExerciseCard = () => {
    setCurrentExerciseCard(null);
    setExerciseUserAnswer('');
    setExerciseSubmitted(false);
    setExerciseShowHints(false);
  };

  // 提交练习答案
  const submitExerciseAnswer = () => {
    if (!currentExerciseCard || !exerciseUserAnswer) return;
    setExerciseSubmitted(true);
  };

  // 检查答案是否正确
  const isAnswerCorrect = (choiceLabel: string): boolean | null => {
    if (!currentExerciseCard || !exerciseSubmitted) return null;
    if (currentExerciseCard.type === 'multiple_choice') {
      return choiceLabel === currentExerciseCard.solution;
    }
    return null;
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
    if (!point.exercise) {
      alert('请先生成练习题');
      return;
    }
    
    // 检查是否有答案
    const hasAnswer = point.exercise.type === 'code_choice' 
      ? !!point.userCode 
      : !!point.userAnswer;
    
    if (!hasAnswer) {
      alert('请先作答');
      return;
    }
    
    console.log('🎯 验证答案:', point.name);
    console.log('📝 用户答案:', point.userAnswer || point.userCode);
    console.log('✅ 正确答案:', point.exercise.solution);
    
    // 提取 exercise 到局部变量，避免类型错误
    const exercise = point.exercise;
    const userAnswer = point.userAnswer;
    
    // 标记为正在验证
    setKnowledgePoints(prev => prev.map((p, i) => 
      i === index ? { ...p, isValidating: true } : p
    ));
    
    // 使用 setTimeout 模拟异步验证，让用户看到加载状态
    setTimeout(() => {
      try {
        let passed = false;
        let feedback = '';
        
        // 根据题型进行不同的验证
        if (exercise.type === 'multiple_choice') {
          // 选择题：直接比较答案
          passed = userAnswer?.trim().toUpperCase() === exercise.solution.trim().toUpperCase();
          
          if (passed) {
            feedback = `### ✅ 回答正确！\n\n你选择的答案 **${userAnswer}** 是正确的。\n\n**解析：**\n正确答案是 **${exercise.solution}**。${exercise.hints && exercise.hints.length > 0 ? '\n\n**知识点：**\n' + exercise.hints.join('\n\n') : ''}`;
          } else {
            feedback = `### ❌ 回答错误\n\n你选择的答案是 **${userAnswer}**，正确答案是 **${exercise.solution}**。\n\n**提示：**\n${exercise.hints && exercise.hints.length > 0 ? exercise.hints.join('\n\n') : '请再仔细思考一下这道题目。'}`;
          }
        } else if (exercise.type === 'fill_blank') {
          // 填空题：可能有多个答案，用分号分隔
          const correctAnswers = exercise.solution.split(';').map(a => a.trim().toLowerCase());
          const userAnswers = (userAnswer || '').split(';').map(a => a.trim().toLowerCase());
          
          // 检查用户答案是否与正确答案匹配
          if (correctAnswers.length === userAnswers.length) {
            passed = correctAnswers.every((correct, idx) => {
              const user = userAnswers[idx];
              // 支持近似匹配（去掉空格和标点）
              const normalizeAnswer = (ans: string) => ans.replace(/[\s\.,，。]/g, '');
              return normalizeAnswer(user) === normalizeAnswer(correct);
            });
          } else {
            passed = false;
          }
          
          if (passed) {
            feedback = `### ✅ 回答正确！\n\n你的答案是正确的。\n\n**标准答案：**\n${exercise.solution}\n\n**解析：**\n${exercise.hints && exercise.hints.length > 0 ? exercise.hints.join('\n\n') : '很好！'}`;
          } else {
            feedback = `### ❌ 回答错误\n\n**你的答案：** ${userAnswer}\n\n**正确答案：** ${exercise.solution}\n\n**提示：**\n${exercise.hints && exercise.hints.length > 0 ? exercise.hints.join('\n\n') : '请再仔细思考一下这道题目。'}`;
          }
        } else if (exercise.type === 'code_choice') {
          // 代码题：仍然需要调用后端验证（暂时标记为未实现）
          alert('代码题验证功能开发中...');
          setKnowledgePoints(prev => prev.map((p, i) => 
            i === index ? { ...p, isValidating: false } : p
          ));
          return;
        }
        
        // 更新验证结果
        setKnowledgePoints(prev => prev.map((p, i) => {
          if (i === index) {
            return {
              ...p,
              isValidating: false,
              validationResult: {
                passed,
                feedback,
              }
            };
          }
          return p;
        }));
        
        // 显示通知
        if (passed) {
          console.log('🎉 回答正确！');
        } else {
          console.log('❌ 回答错误，请查看反馈');
      }
      
    } catch (error) {
      console.error('❌ Error validating answer:', error);
        alert(`验证失败: ${error}`);
      setKnowledgePoints(prev => prev.map((p, i) => 
        i === index ? { ...p, isValidating: false } : p
      ));
    }
    }, 500); // 延迟500ms，让用户看到验证动画
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
                    <div className="relative w-full h-full group">
                    <video
                      ref={videoRef}
                      src={cdnVideoUrl}
                        className="w-full h-full bg-black"
                      controls
                        playsInline
                        webkit-playsinline="true"
                        x5-playsinline="true"
                        x5-video-player-type="h5-page"
                      crossOrigin="anonymous"
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={handleVideoEnded}
                      onTimeUpdate={handleTimeUpdate}
                        onError={(e) => {
                          console.error('播放出错:', e);
                          const error = (e.target as HTMLVideoElement).error;
                          if (error && error.code === 4) {
                            // 格式不支持
                            console.warn('视频格式不支持');
                          }
                        }}
                    >
                      您的浏览器不支持 video 标签。
                    </video>
                      <VideoCompatibilityChecker videoRef={videoRef} />
                    </div>
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
            {/* 搜索知识点按钮 - 绿色 */}
            <Button
              onClick={() => {
                // 打开搜索对话框时暂停视频
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
                setShowSearchDialog(true);
              }}
              disabled={!knowledgePoints || knowledgePoints.length === 0}
              className="flex-1 max-w-xs py-6 text-lg font-medium bg-green-50 hover:bg-green-100 text-gray-700 border-2 border-green-200 hover:border-green-300 shadow-sm transition-all disabled:bg-gray-50 disabled:text-gray-400"
              size="lg"
            >
              <Search className="w-5 h-5 mr-2 text-green-600" />
              搜索知识点
            </Button>
            
            {/* 提问按钮 - 蓝色 */}
            <Button
              onClick={() => {
                // 记录提问事件
                trackKeyActionSafely(
                  'video_ask_question',
                  {
                    knowledge_point: knowledgePoints[currentKnowledgeIndex]?.name || 'unknown',
                    timestamp: Date.now(),
                  },
                  currentUser
                );
                
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
              className="flex-1 max-w-xs py-6 text-lg font-medium bg-yellow-50 hover:bg-yellow-100 text-gray-700 border-2 border-yellow-200 hover:border-yellow-300 shadow-sm transition-all"
              size="lg"
            >
              <MessageSquare className="w-5 h-5 mr-2 text-yellow-600" />
              {t('askQuestion')}
            </Button>
            
            {/* 笔记按钮 - 紫色 */}
            {/* 截图按钮 - 紫色 */}
            <Button
              onClick={() => captureScreenshotOnly(currentKnowledgeIndex)}
              disabled={!knowledgePoints[currentKnowledgeIndex]}
              className="flex-1 max-w-xs py-6 text-lg font-medium bg-purple-50 hover:bg-purple-100 text-gray-700 border-2 border-purple-200 hover:border-purple-300 shadow-sm transition-all disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
              size="lg"
            >
              <ImageIcon className="w-5 h-5 mr-2 text-purple-600" />
              截图
            </Button>
            
            {/* 练习按钮 - 橙色 */}
            <Button
              onClick={() => generateExercise(currentKnowledgeIndex)}
              disabled={!knowledgePoints[currentKnowledgeIndex] || isGeneratingExercise}
              className="flex-1 max-w-xs py-6 text-lg font-medium bg-orange-50 hover:bg-orange-100 text-gray-700 border-2 border-orange-200 hover:border-orange-300 shadow-sm transition-all disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
              size="lg"
            >
              {isGeneratingExercise ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin text-orange-600" />
                  {t('generatingNotes')}
                </>
              ) : (
                <>
                  <CheckSquare className="w-5 h-5 mr-2 text-orange-600" />
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
                            <div className="flex gap-4">
                              {/* 左侧：笔记内容 */}
                              <div className="flex-1 min-w-0">
                                <NoteEditor 
                                  key={`${index}-${point.start_time}-${currentPartIndex}`}
                                  content={point.note || ''}
                                  onChange={(newMarkdown) => {
                                    setKnowledgePoints(prev => prev.map((p, i) => 
                                      i === index ? { ...p, note: newMarkdown } : p
                                    ));
                                  }}
                                />
                                
                                {/* 截图显示区域 - 已移除，改用右侧 VideoThumbnail 显示 */}
                              </div>
                            
                              {/* 右侧：视频缩略图 */}
                              <div className="flex-shrink-0 w-48 hidden sm:block">
                                <VideoThumbnail 
                                  videoUrl={cdnVideoUrl || ''} 
                                  time={point.start_time}
                                  // 优先使用知识点专属截图，如果没有则使用视频封面
                                  fallbackUrl={point.thumbnail || processedTaskData?.video_info?.thumbnail_cdn || processedTaskData?.video_info?.thumbnail || ''}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTimeJump(point.start_time);
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* 统一卡片集卡槽 - 包含 Q&A、截图、搜索结果、练习 */}
                        {isExpanded && (() => {
                          const qaCount = point.qaList?.length || 0;
                          const screenshotCount = point.screenshots?.length || 0;
                          const searchResultCount = point.searchResults?.length || 0;
                          const exerciseCount = point.exercises?.length || 0;
                          const totalCards = qaCount + screenshotCount + searchResultCount + exerciseCount;
                          
                          if (totalCards === 0) return null;
                          
                          return (
                            <div className="mt-4 pt-4 border-t border-green-200">
                              <div className="flex items-center gap-2 mb-3">
                                <div className="flex items-center gap-1">
                                  <MessageSquare className="w-4 h-4 text-yellow-600" />
                                  <ImageIcon className="w-4 h-4 text-blue-600" />
                                  <Search className="w-4 h-4 text-green-600" />
                                  <CheckSquare className="w-4 h-4 text-orange-600" />
                                </div>
                                <h5 className="text-xs font-bold text-gray-700">📚 笔记卡片 ({totalCards})</h5>
                              </div>
                              
                              {/* 统一卡片网格 */}
                              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                {/* Q&A 卡片 */}
                                {point.qaList?.map((qa, qaIndex) => (
                                  <div
                                    key={`qa-${qaIndex}`}
                                    className="group relative bg-gradient-to-br from-yellow-50 via-white to-green-50 rounded-lg border-2 border-yellow-200 hover:border-yellow-400 hover:shadow-lg hover:scale-105 transition-all duration-300 overflow-hidden cursor-pointer"
                                    style={{ aspectRatio: '3/4' }}
                                    onClick={() => {
                                      setCurrentQACard(qa);
                                      setCurrentKnowledgeIndex(index);
                                    }}
                                  >
                                    {/* 装饰性背景图案 */}
                                    <div className="absolute inset-0 opacity-5">
                                      <div className="absolute top-0 right-0 w-12 h-12 bg-yellow-400 rounded-full -translate-y-6 translate-x-6"></div>
                                      <div className="absolute bottom-0 left-0 w-8 h-8 bg-green-400 rounded-full translate-y-4 -translate-x-4"></div>
                                    </div>
                                    
                                    {/* 删除按钮 */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                        if (confirm('确定要删除这张问答卡片吗？')) {
                                          setKnowledgePoints(prev => prev.map((p, i) => {
                                            if (i === index) {
                                              const qaList = p.qaList || [];
                                              return {
                                                ...p,
                                                qaList: qaList.filter((_, qIdx) => qIdx !== qaIndex)
                                              };
                                            }
                                            return p;
                                          }));
                                        }
                                    }}
                                      className="absolute top-1 right-1 z-10 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                                  >
                                      <X className="w-2.5 h-2.5" />
                                  </button>
                                    
                                    {/* 卡片类型标识 */}
                                    <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-yellow-500 text-white rounded text-[9px] font-bold shadow-sm">
                                      💭
                                    </div>
                                    
                                    {/* 卡片内容 */}
                                    <div className="relative h-full p-2 pt-6 flex flex-col text-left">
                                      {/* 问题部分 */}
                                      <div className="mb-2">
                                        <div className="flex items-center gap-1 mb-1">
                                          <div className="w-3 h-3 rounded-sm bg-yellow-400 flex items-center justify-center flex-shrink-0">
                                            <span className="text-[8px] font-bold text-gray-800">Q</span>
                                          </div>
                                          <div className="text-[9px] font-bold text-yellow-700 uppercase tracking-wide">问题</div>
                                        </div>
                                        <p className="text-[10px] leading-snug text-gray-700 line-clamp-3 pl-1">
                                          {qa.question}
                                        </p>
                                      </div>
                                      
                                      {/* 分隔线 */}
                                      <div className="w-full border-t border-dashed border-gray-200 my-1"></div>
                                      
                                      {/* 答案部分 */}
                                      <div className="flex-1 overflow-hidden">
                                        <div className="flex items-center gap-1 mb-1">
                                          <div className="w-3 h-3 rounded-sm bg-green-500 flex items-center justify-center flex-shrink-0">
                                            <span className="text-[8px] font-bold text-white">A</span>
                                          </div>
                                          <div className="text-[9px] font-bold text-green-700 uppercase tracking-wide">解答</div>
                                        </div>
                                        <p className="text-[10px] leading-snug text-gray-600 line-clamp-4 pl-1">
                                          {qa.answer}
                                        </p>
                                      </div>
                                      
                                      {/* 底部查看提示 */}
                                      <div className="absolute bottom-1 left-0 right-0 flex items-center justify-center">
                                        <div className="bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full shadow-sm border border-yellow-200">
                                          <span className="text-[9px] text-yellow-600 font-medium flex items-center gap-1">
                                            <Eye className="w-2.5 h-2.5" />
                                            点击放大
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                
                                {/* 截图卡片 */}
                                {point.screenshots?.map((screenshot, screenshotIndex) => (
                                  <div
                                    key={`screenshot-${screenshotIndex}`}
                                    className="group relative bg-gradient-to-br from-blue-50 via-white to-purple-50 rounded-lg border-2 border-blue-200 hover:border-blue-400 hover:shadow-lg hover:scale-105 transition-all duration-300 overflow-hidden cursor-pointer"
                                    style={{ aspectRatio: '3/4' }}
                                    onClick={() => {
                                      setCurrentScreenshot(screenshot);
                                      setCurrentKnowledgeIndex(index);
                                    }}
                                  >
                                    {/* 装饰性背景图案 */}
                                    <div className="absolute inset-0 opacity-5">
                                      <div className="absolute top-0 right-0 w-12 h-12 bg-blue-400 rounded-full -translate-y-6 translate-x-6"></div>
                                      <div className="absolute bottom-0 left-0 w-8 h-8 bg-purple-400 rounded-full translate-y-4 -translate-x-4"></div>
                                    </div>
                                    
                                    {/* 删除按钮 */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                        if (confirm('确定要删除这张截图卡片吗？')) {
                                          setKnowledgePoints(prev => prev.map((p, i) => {
                                            if (i === index) {
                                              const screenshots = p.screenshots || [];
                                              return {
                                                ...p,
                                                screenshots: screenshots.filter((_, sIdx) => sIdx !== screenshotIndex)
                                              };
                                            }
                                            return p;
                                          }));
                                        }
                                    }}
                                      className="absolute top-1 right-1 z-10 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                                  >
                                      <X className="w-2.5 h-2.5" />
                                  </button>
                                    
                                    {/* 卡片类型标识 */}
                                    <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-blue-500 text-white rounded text-[9px] font-bold shadow-sm">
                                      📸
                                </div>
                                    
                                    {/* 截图预览 */}
                                    <img 
                                      src={screenshot} 
                                      alt={`截图 ${screenshotIndex + 1}`}
                                      className="absolute inset-0 w-full h-full object-cover"
                                    />
                                    
                                    {/* 底部查看提示 */}
                                    <div className="absolute bottom-1 left-0 right-0 flex items-center justify-center">
                                      <div className="bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full shadow-sm border border-blue-200">
                                        <span className="text-[9px] text-blue-600 font-medium flex items-center gap-1">
                                          <Eye className="w-2.5 h-2.5" />
                                          点击放大
                                        </span>
                              </div>
                                </div>
                                  </div>
                                ))}
                                
                                {/* 搜索结果卡片 */}
                                {point.searchResults?.map((result, resultIndex) => (
                                  <div
                                    key={`search-${resultIndex}`}
                                    className="group relative bg-gradient-to-br from-green-50 via-white to-emerald-50 rounded-lg border-2 border-green-200 hover:border-green-400 hover:shadow-lg hover:scale-105 transition-all duration-300 overflow-hidden cursor-pointer"
                                    style={{ aspectRatio: '3/4' }}
                                    onClick={() => {
                                      // 打开搜索对话框时暂停视频
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
                                      setCurrentSearchResult(result);
                                      setShowSearchDialog(true);
                                    }}
                                  >
                                    {/* 装饰性背景图案 */}
                                    <div className="absolute inset-0 opacity-5">
                                      <div className="absolute top-0 right-0 w-12 h-12 bg-green-400 rounded-full -translate-y-6 translate-x-6"></div>
                                      <div className="absolute bottom-0 left-0 w-8 h-8 bg-emerald-400 rounded-full translate-y-4 -translate-x-4"></div>
                                    </div>
                                    
                                    {/* 删除按钮 */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                        setKnowledgePoints(prev => prev.map((p, i) => {
                                          if (i === index) {
                                            return {
                                              ...p,
                                              searchResults: (p.searchResults || []).filter((_, rIdx) => rIdx !== resultIndex)
                                            };
                                          }
                                          return p;
                                        }));
                                  }}
                                      className="absolute top-1 right-1 z-10 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                                >
                                      <X className="w-2.5 h-2.5" />
                                </button>
                                    
                                    {/* 卡片类型标识 */}
                                    <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-green-500 text-white rounded text-[9px] font-bold shadow-sm">
                                      🔗
                              </div>
                                    
                                    {/* 缩略图或占位图 */}
                                    {result.thumbnail ? (
                                      <img 
                                        src={result.thumbnail} 
                                        alt={result.knowledgePointName}
                                        className="absolute inset-0 w-full h-full object-cover opacity-30"
                                      />
                                    ) : (
                                      <div className="absolute inset-0 flex items-center justify-center text-6xl opacity-20">
                                        🔍
                          </div>
                        )}
                        
                                    {/* 卡片内容 */}
                                    <div className="relative h-full p-2 pt-6 flex flex-col text-left">
                                      {/* 知识点名称 */}
                                      <div className="flex-1">
                                        <h4 className="text-[11px] font-bold text-gray-800 leading-tight line-clamp-3 mb-1">
                                          {result.knowledgePointName}
                                        </h4>
                                        <p className="text-[9px] text-gray-600">
                                          {result.partTitle}
                                        </p>
                                        <p className="text-[9px] text-gray-500 mt-1">
                                          ⏱️ {result.startTime}
                                        </p>
                                </div>
                                      
                                      {/* 底部查看提示 */}
                                      <div className="absolute bottom-1 left-0 right-0 flex items-center justify-center">
                                        <div className="bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full shadow-sm border border-green-200">
                                          <span className="text-[9px] text-green-600 font-medium flex items-center gap-1">
                                            <Eye className="w-2.5 h-2.5" />
                                            点击查看
                                          </span>
                                        </div>
                                      </div>
                                </div>
                              </div>
                            ))}
                            
                            {/* 练习卡片 */}
                            {point.exercises?.map((exercise, exerciseIndex) => (
                              <div
                                key={`exercise-${exerciseIndex}`}
                                className="group relative bg-gradient-to-br from-orange-50 via-white to-yellow-50 rounded-lg border-2 border-orange-200 hover:border-orange-400 hover:shadow-lg hover:scale-105 transition-all duration-300 overflow-hidden cursor-pointer"
                                style={{ aspectRatio: '3/4' }}
                                onClick={() => {
                                  setCurrentExerciseCard(exercise);
                                  setCurrentKnowledgeIndex(index);
                                  // 清空上一道题的答案和状态
                                  setExerciseUserAnswer('');
                                  setExerciseSubmitted(false);
                                  setExerciseShowHints(false);
                                }}
                              >
                                {/* 装饰性背景图案 */}
                                <div className="absolute inset-0 opacity-5">
                                  <div className="absolute top-0 right-0 w-12 h-12 bg-orange-400 rounded-full -translate-y-6 translate-x-6"></div>
                                  <div className="absolute bottom-0 left-0 w-8 h-8 bg-yellow-400 rounded-full translate-y-4 -translate-x-4"></div>
                                </div>
                                
                                {/* 删除按钮 */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm('确定要删除这张练习卡片吗？')) {
                                      setKnowledgePoints(prev => prev.map((p, i) => {
                                        if (i === index) {
                                          const exercises = p.exercises || [];
                                          return {
                                            ...p,
                                            exercises: exercises.filter((_, eIdx) => eIdx !== exerciseIndex)
                                          };
                                        }
                                        return p;
                                      }));
                                    }
                                  }}
                                  className="absolute top-1 right-1 z-10 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                                
                                {/* 卡片类型标识 */}
                                <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-orange-500 text-white rounded text-[9px] font-bold shadow-sm">
                                  💪
                                </div>
                                
                                {/* 卡片内容 */}
                                <div className="relative h-full p-2 pt-6 flex flex-col text-left">
                                  {/* 题目标题 */}
                                  <div className="mb-2">
                                    <div className="flex items-center gap-1 mb-1">
                                      <div className="w-3 h-3 rounded-sm bg-orange-400 flex items-center justify-center flex-shrink-0">
                                        <span className="text-[8px] font-bold text-white">💡</span>
                                      </div>
                                      <div className="text-[9px] font-bold text-orange-700 uppercase tracking-wide">练习</div>
                                    </div>
                                    <p className="text-[10px] leading-snug text-gray-700 line-clamp-2 pl-1 font-medium">
                                      {exercise.title}
                                    </p>
                                  </div>
                                  
                                  {/* 分隔线 */}
                                  <div className="w-full border-t border-dashed border-gray-200 my-1"></div>
                                  
                                  {/* 题目内容预览 */}
                                  <div className="flex-1 overflow-hidden">
                                    <div className="flex items-center gap-1 mb-1">
                                      <div className="text-[9px] font-bold text-gray-600 uppercase tracking-wide">题目</div>
                                    </div>
                                    <p className="text-[10px] leading-snug text-gray-600 line-clamp-4 pl-1">
                                      {exercise.question || exercise.description || '点击查看完整题目'}
                                    </p>
                                  </div>
                                  
                                  {/* 题型标签 */}
                                  <div className="mt-1 flex gap-1 flex-wrap">
                                    <span className={`px-1 py-0.5 rounded text-[8px] font-medium ${
                                      exercise.type === 'multiple_choice' ? 'bg-blue-100 text-blue-700' : 
                                      exercise.type === 'fill_blank' ? 'bg-green-100 text-green-700' :
                                      'bg-purple-100 text-purple-700'
                                    }`}>
                                      {exercise.type === 'multiple_choice' ? '选择' : 
                                       exercise.type === 'fill_blank' ? '填空' :
                                       '代码'}
                                    </span>
                                  </div>
                                  
                                  {/* 底部查看提示 */}
                                  <div className="absolute bottom-1 left-0 right-0 flex items-center justify-center">
                                    <div className="bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full shadow-sm border border-orange-200">
                                      <span className="text-[9px] text-orange-600 font-medium flex items-center gap-1">
                                        <Eye className="w-2.5 h-2.5" />
                                        点击查看
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                            </div>
                          );
                        })()}
                        
                        {/* 练习题 */}
                        {point.exercise && isExpanded && (
                          <div className="mt-4 pt-4 border-t border-green-200">
                            {/* 选择题或填空题 */}
                            {(point.exercise.type === 'multiple_choice' || point.exercise.type === 'fill_blank') && (
                              <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl p-6 border-2 border-orange-200">
                                {/* 题目信息 */}
                                <div className="mb-4">
                                  <h4 className="font-bold text-xl text-gray-900 mb-2 flex items-center gap-2">
                                    <Lightbulb className="w-6 h-6 text-orange-500" />
                                    {point.exercise.title}
                                  </h4>
                                  <p className="text-sm text-gray-600 mb-3">{point.exercise.description}</p>
                                <div className="flex gap-2 text-xs">
                                    <span className={`px-3 py-1 rounded-full font-medium ${
                                      point.exercise.type === 'multiple_choice' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                                  }`}>
                                      {point.exercise.type === 'multiple_choice' ? '选择题' : '填空题'}
                                  </span>
                                    <span className={`px-3 py-1 rounded-full font-medium ${
                                      point.exercise.difficulty === 'beginner' ? 'bg-green-100 text-green-700' :
                                      point.exercise.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-red-100 text-red-700'
                                  }`}>
                                      {point.exercise.difficulty === 'beginner' ? '简单' :
                                       point.exercise.difficulty === 'intermediate' ? '中等' :
                                       '困难'}
                                  </span>
                                </div>
                              </div>
                              
                                {/* 题目内容 */}
                                <div className="bg-white rounded-lg p-5 mb-4 shadow-sm border border-gray-200">
                                  <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed">
                                    <ReactMarkdown>{point.exercise.question || ''}</ReactMarkdown>
                                  </div>
                                </div>

                                {/* 选择题选项 */}
                                {point.exercise.type === 'multiple_choice' && point.exercise.choices && (
                                  <div className="space-y-2 mb-4">
                                    {point.exercise.choices.map((choice, idx) => (
                                      <label
                                        key={idx}
                                        className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                          point.userAnswer === choice.label
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50'
                                        }`}
                                      >
                                        <input
                                          type="radio"
                                          name={`exercise-${index}`}
                                          value={choice.label}
                                          checked={point.userAnswer === choice.label}
                                          onChange={(e) => {
                                            setKnowledgePoints(prev => prev.map((p, i) => 
                                              i === index ? { ...p, userAnswer: e.target.value } : p
                                            ));
                                          }}
                                          className="mt-1 w-4 h-4 text-blue-600"
                                        />
                                        <div className="flex-1">
                                          <span className="font-bold text-gray-700 mr-2">{choice.label}.</span>
                                          <span className="text-gray-800">{choice.content}</span>
                                        </div>
                                      </label>
                                    ))}
                                  </div>
                                )}

                                {/* 填空题输入 */}
                                {point.exercise.type === 'fill_blank' && (
                                  <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      你的答案：
                                    </label>
                                    <input
                                      type="text"
                                      value={point.userAnswer || ''}
                                      onChange={(e) => {
                                        setKnowledgePoints(prev => prev.map((p, i) => 
                                          i === index ? { ...p, userAnswer: e.target.value } : p
                                        ));
                                      }}
                                      placeholder="输入答案（多个答案用分号分隔）"
                                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-gray-800"
                                    />
                                  </div>
                                )}

                                {/* 提示 */}
                                {point.exercise.hints && point.exercise.hints.length > 0 && (
                                  <details className="mb-4">
                                    <summary className="cursor-pointer text-orange-600 hover:text-orange-700 font-medium flex items-center gap-2 p-3 bg-white rounded-lg border border-orange-200">
                                      💡 查看提示 ({point.exercise.hints.length})
                                    </summary>
                                    <div className="mt-2 bg-white rounded-lg p-4 border border-orange-100 space-y-2">
                                      {point.exercise.hints.map((hint, i) => (
                                        <div key={i} className="flex gap-2 text-sm text-gray-700">
                                          <span className="text-orange-500 font-bold">{i + 1}.</span>
                                          <span>{hint}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </details>
                                )}
                                
                                {/* 提交按钮 */}
                                <button
                                  onClick={() => validateAnswer(index)}
                                  disabled={point.isValidating || !point.userAnswer}
                                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed flex items-center justify-center font-bold text-lg shadow-lg"
                                >
                                  {point.isValidating ? (
                                    <>
                                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                      验证中...
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="w-5 h-5 mr-2" />
                                      提交答案
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
                                    <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-gray-200">
                                      <div className="flex items-center gap-3">
                                        {point.validationResult.passed ? (
                                          <>
                                            <CheckCircle className="w-8 h-8 text-green-600" />
                                            <span className="text-xl font-bold text-green-800">正确 ✓</span>
                                          </>
                                        ) : (
                                          <>
                                            <X className="w-8 h-8 text-orange-600" />
                                            <span className="text-xl font-bold text-orange-800">错误 ✗</span>
                                          </>
                                        )}
                                      </div>
                                        </div>
                                    {point.validationResult.feedback && (
                                      <div className="bg-white rounded-lg p-4 shadow-sm prose prose-sm max-w-none text-gray-800">
                                          <ReactMarkdown>{point.validationResult.feedback}</ReactMarkdown>
                                        </div>
                                    )}
                                  </div>
                                )}
                                      </div>
                                    )}
                                    
                            {/* 代码题（保留原有逻辑） */}
                            {point.exercise.type === 'code_choice' && (
                              <div className="bg-gray-900 rounded-lg overflow-hidden">
                                {/* ... 保留原有代码题UI ... */}
                                  </div>
                                )}
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
                  onClick={saveVideoNote}
                  disabled={isSavingNote || !processedTaskData}
                  className={`w-full py-3 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 ${
                    isSavingNote
                      ? 'bg-gray-400 cursor-not-allowed'
                      : saveStatus === 'saved'
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'
                      : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600'
                  }`}
                >
                  {isSavingNote ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                      保存中...
                    </>
                  ) : saveStatus === 'saved' ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      已保存 ✓
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                      保存笔记 💾
                    </>
                  )}
                </button>
                {saveStatus === 'saved' && lastSavedAt && (
                  <p className="text-xs text-gray-500 text-center mt-2">
                    上次保存: {lastSavedAt.toLocaleTimeString()}
                  </p>
                )}
                {!processedTaskData && (
                  <p className="text-xs text-orange-600 text-center mt-2">
                    ⚠️ 只有已处理的视频才能保存笔记
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* 提问输入框 - 浮动在视频中心 - 卡片样式 */}
      {askingKnowledgeIndex !== null && (() => {
        const currentKp = knowledgePoints[askingKnowledgeIndex];
        // 优先使用知识点中的 transcript_segment 字段，如果没有则从完整逐字稿中动态提取（带时间戳）
        const transcriptSegment = currentKp?.transcript_segment || 
          (currentKp?.start_time && currentKp?.end_time && fullTranscriptRef.current
            ? extractTranscriptSegmentWithTimestamp(currentKp.start_time, currentKp.end_time, fullTranscriptRef.current)
            : '');
        const hasTranscript = !!transcriptSegment;
        return (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200 p-4"
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col relative overflow-hidden"
            style={{ width: '480px', height: '640px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 装饰性背景 */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 right-0 w-40 h-40 bg-yellow-200 rounded-full opacity-10 -translate-y-20 translate-x-20"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-200 rounded-full opacity-10 translate-y-16 -translate-x-16"></div>
            </div>

            {/* 卡片头部 - 与单轮QA样式一致 */}
            <div className="flex-shrink-0 bg-gradient-to-r from-yellow-100 to-green-100 border-b-2 border-yellow-300 p-5 flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-yellow-400 flex items-center justify-center shadow-md">
                  <Sparkles className="w-5 h-5 text-gray-800" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900">✨ AI 智能解答</h3>
                  <p className="text-xs text-gray-600">{knowledgePoints[askingKnowledgeIndex]?.name}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setAskingKnowledgeIndex(null);
                  setQuestionInput('');
                  setConversationHistory([]);
                  setAttachedImages([]);
                }}
                className="text-gray-500 hover:text-gray-700 transition-colors p-1 hover:bg-white/50 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
              {/* 内容区域 */}
              <div className="flex-1 overflow-y-auto p-6 relative z-10">
              <div className="w-full h-full flex flex-col">
                {/* 对话历史显示 */}
                {conversationHistory.length > 0 && (
                  <div className="mb-4 space-y-3">
                    {conversationHistory.map((qa, idx) => (
                      <div key={idx} className="space-y-2">
                        {/* 用户问题 */}
                        <div className="flex justify-end">
                          <div className="max-w-[85%] bg-blue-500 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm">
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{qa.question}</p>
                          </div>
                        </div>
                        {/* AI回答 */}
                        <div className="flex justify-start">
                          <div className="max-w-[85%] bg-gray-100 text-gray-900 rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm">
                            <div className="text-sm leading-relaxed prose prose-sm max-w-none">
                              <ReactMarkdown {...mathMarkdownPlugins}>
                                {autoWrapLatex(qa.answer)}
                              </ReactMarkdown>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {/* 对话底部锚点，用于自动滚动 */}
                    <div ref={conversationEndRef} />
                  </div>
                )}
                
                {/* 无逐字稿且无对话历史时显示引导文案 */}
                {!hasTranscript && conversationHistory.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center mb-6">
                    <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-3">
                    <span className="text-3xl">🤔</span>
                  </div>
                  <h4 className="text-lg font-bold text-gray-800 mb-1">有什么疑问吗？</h4>
                  <p className="text-sm text-gray-500">AI 助教随时为你解答，基于视频内容回答。</p>
                </div>
                )}

                  {/* 逐字稿区域 - 追问时隐藏 */}
                  {hasTranscript && conversationHistory.length === 0 && (
                    <div className="flex-1 mb-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border-2 border-blue-200 overflow-hidden flex flex-col">
                      <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                        <FileText className="w-4 h-4 text-indigo-600" />
                        <h5 className="text-sm font-bold text-gray-800">📝 视频逐字稿</h5>
                        <span className="text-xs text-gray-500">（点击内容快速提问）</span>
                      </div>
                      <div className="flex-1 bg-white rounded-lg p-3 overflow-y-auto">
                        <div className="text-sm text-gray-700 leading-relaxed space-y-2">
                          {transcriptSegment.split('\n').filter(line => line.trim()).map((line, lineIdx) => {
                            // 解析时间戳和文本：支持 [MM:SS - MM:SS] 或 [MM:SS] 格式
                            const timePattern1 = /^\[(\d+:\d+)\s*-\s*(\d+:\d+)\]\s*(.*)$/;
                            const timePattern2 = /^\[(\d+:\d+)\]\s*(.*)$/;
                            
                            const match1 = line.match(timePattern1);
                            const match2 = line.match(timePattern2);
                            
                            let timestamp = '';
                            let text = '';
                            
                            if (match1) {
                              timestamp = `[${match1[1]} - ${match1[2]}]`;
                              text = match1[3];
                            } else if (match2) {
                              timestamp = `[${match2[1]}]`;
                              text = match2[2];
                            } else {
                              text = line; // 没有时间戳的文本
                            }
                            
                            return (
                              <div key={lineIdx} className="flex gap-2 items-start">
                                {timestamp && (
                                  <span className="flex-shrink-0 text-xs text-blue-600 font-mono bg-blue-50 px-1.5 py-0.5 rounded">
                                    {timestamp}
                                  </span>
                                )}
                                <button
                                  onClick={() => {
                                    const fullText = text.trim();
                                    // 截取最多5个字作为标签，超过5字加省略号
                                    const tagText = fullText.length > 5 
                                      ? fullText.substring(0, 5) + '...' 
                                      : fullText;
                                    // 插入【标签】并自动补全问题
                                    setQuestionInput(prev => {
                                      // 如果输入框为空，添加完整问题
                                      if (!prev.trim()) {
                                        return `【${tagText}】这句什么意思?`;
                                      }
                                      // 如果已有内容，只添加标签
                                      return prev + `【${tagText}】`;
                                    });
                                  }}
                                  className="flex-1 hover:bg-yellow-100 hover:text-yellow-900 rounded px-1 transition-colors cursor-pointer text-left"
                                  title="点击添加到提问"
                                >
                                  {text.trim()}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-gray-500 flex items-center gap-1 flex-shrink-0">
                        <Lightbulb className="w-3 h-3" />
                        <span>点击任意句子，插入【标签】到提问框</span>
                      </div>
                    </div>
                  )}
              </div>
            </div>
            
            {/* 输入区域 - 固定在按钮上方 */}
            <div className="flex-shrink-0 border-t border-gray-200 p-4 bg-white relative z-10">
              <div className="flex gap-2">
                {/* 截图按钮 */}
                <button
                  onClick={handleCaptureScreenshot}
                  disabled={isUploadingScreenshot}
                  className="flex-shrink-0 w-10 h-10 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:cursor-not-allowed rounded-lg flex items-center justify-center transition-colors"
                  title="截图"
                >
                  {isUploadingScreenshot ? (
                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-gray-600" />
                  )}
                </button>
                
                <div className="relative flex-1">
                {/* 样式化显示层（标签样式） */}
                <div 
                  className="absolute inset-0 px-4 py-3 pointer-events-none rounded-xl text-base whitespace-pre-wrap break-words overflow-hidden text-gray-900"
                  style={{ 
                    lineHeight: '1.5rem',
                    minHeight: '60px',
                    zIndex: 1
                  }}
                >
                  {questionInput.split(/(【[^】]*】)/g).map((part, idx) => {
                    // 匹配【标签】格式
                    if (/^【.*】$/.test(part)) {
                      // 检查是否是图片标签（格式：【图1】、【图2】等，可能包含占位符空格）
                      const isImageTag = /^【图\d+[　\s]*】$/.test(part);
                      
                      if (isImageTag) {
                        // 提取图片编号（去除空格）
                        const match = part.match(/【图(\d+)/);
                        const imageNumber = match ? parseInt(match[1]) : 0;
                        const imageIndex = imageNumber - 1;
                        
                        // 图片标签：绿色，可点击删除
                        return (
                          <span
                            key={idx}
                            className="inline-flex items-center bg-gradient-to-r from-green-500 to-emerald-500 text-white px-2 py-0.5 rounded-md text-xs font-medium shadow-sm mx-0.5 cursor-pointer hover:from-green-600 hover:to-emerald-600 pointer-events-auto"
                            style={{ 
                              verticalAlign: 'middle',
                              zIndex: 10
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              // 从attachedImages中移除对应索引的图片
                              if (imageIndex >= 0 && imageIndex < attachedImages.length) {
                                setAttachedImages(prev => prev.filter((_, i) => i !== imageIndex));
                                // 从输入框中移除标签并更新所有后续标签的编号
                                setQuestionInput(prev => {
                                  let newInput = prev.replace(part, '');
                                  // 更新后续图片标签的编号（匹配带空格的格式）
                                  for (let i = imageNumber + 1; i <= attachedImages.length; i++) {
                                    const oldTag = new RegExp(`【图${i}[　\\s]*】`, 'g');
                                    newInput = newInput.replace(oldTag, `【图${i-1}　　　】`);
                                  }
                                  return newInput;
                                });
                              }
                            }}
                            title="点击删除图片"
                          >
                            <ImageIcon className="w-3 h-3 mr-1" />
                            【图{imageNumber}】
                            <XCircle className="w-3 h-3 ml-1" />
                          </span>
                        );
                      } else {
                        // 普通标签：蓝色
                        return (
                          <span
                            key={idx}
                            className="inline-flex items-center bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-2 py-0.5 rounded-md text-xs font-medium shadow-sm mx-0.5"
                            style={{ 
                              verticalAlign: 'middle'
                            }}
                          >
                            {part}
                          </span>
                        );
                      }
                    }
                    return <span key={idx}>{part}</span>;
                  })}
                </div>
                
                {/* 实际输入框（文本透明） */}
                <textarea
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && questionInput.trim() && !knowledgePoints[askingKnowledgeIndex]?.isAsking) {
                    e.preventDefault();
                    handleAskQuestion(askingKnowledgeIndex);
                  }
                }}
                  placeholder="输入你的问题...（Shift+Enter换行）"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-yellow-400 focus:outline-none transition-colors text-base shadow-sm pr-12 resize-none overflow-y-auto relative"
                  style={{ 
                    lineHeight: '1.5rem',
                    minHeight: '60px',
                    zIndex: 2,
                    color: 'transparent',
                    caretColor: '#1f2937',
                    background: 'transparent'
                  }}
                  rows={2}
                autoFocus
              />
              <button
                  onClick={() => {
                    if (askingKnowledgeIndex !== null) {
                      handleAskQuestion(askingKnowledgeIndex);
                    }
                  }}
                disabled={!questionInput.trim() || knowledgePoints[askingKnowledgeIndex]?.isAsking}
                  className="absolute right-2 bottom-2 w-10 h-10 bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded-lg disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all flex items-center justify-center shadow-sm"
                  style={{ zIndex: 3 }}
              >
                {knowledgePoints[askingKnowledgeIndex]?.isAsking ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Sparkles className="w-5 h-5" />
                    )}
                  </button>
                </div>
                </div>
                
              {/* 快捷提问建议 - 仅在首次提问时显示 */}
              {conversationHistory.length === 0 && (
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <span className="text-xs text-gray-400">💡 试着问：</span>
                  {['举个例子', '解释一下原理', '总结要点'].map((hint) => (
                    <button
                      key={hint}
                      onClick={() => setQuestionInput(hint)}
                      className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs text-gray-600 transition-colors"
                    >
                      {hint}
                    </button>
                  ))}
                </div>
              )}
              </div>
            
            {/* 卡片底部按钮 - 只在有对话历史时显示 */}
            {conversationHistory.length > 0 && (
              <div className="flex-shrink-0 bg-gradient-to-r from-gray-50 to-white border-t-2 border-gray-200 p-5 relative z-10">
                <button
                  onClick={() => {
                    // 将所有对话合并成一个QA卡片
                    if (askingKnowledgeIndex !== null) {
                      console.log('📝 添加对话到笔记，知识点索引:', askingKnowledgeIndex);
                      console.log('📝 对话历史条数:', conversationHistory.length);
                      
                      // 将所有对话合并到一张卡片中，格式为Q1\n\nA1\n\n---\n\nQ2\n\nA2...
                      const mergedContent = conversationHistory.map((qa, idx) => {
                        // 格式：Q[序号]\n\n[问题]\n\nA[序号]\n\n[答案]
                        return `Q${idx + 1}\n\n${qa.question}\n\nA${idx + 1}\n\n${qa.answer}`;
                      }).join('\n\n---\n\n');
                      
                      const mergedQA: QAPair = {
                        question: mergedContent,
                        answer: '', // 答案字段留空，所有内容都在question中
                        timestamp: new Date().toISOString()
                      };
                      
                      setKnowledgePoints(prev => {
                        const updated = prev.map((p, i) => {
                          if (i === askingKnowledgeIndex) {
                            const qaList = p.qaList || [];
                            // 将合并后的QA添加到qaList（一张卡片）
                            return {
                              ...p,
                              qaList: [...qaList, mergedQA]
                            };
                          }
                          return p;
                        });
                        
                        console.log('✅ 对话已合并到一张卡片，共', conversationHistory.length, '个QA');
                        return updated;
                      });
                      
                      // 确保知识点展开，这样可以看到新添加的笔记
                      setExpandedKnowledgePoints(prev => {
                        const newSet = new Set(prev);
                        newSet.add(askingKnowledgeIndex);
                        return newSet;
                      });
                      
                      // 添加后关闭对话框
                      console.log('✅ 笔记添加完成，关闭对话框');
                      setAskingKnowledgeIndex(null);
                      setQuestionInput('');
                      setConversationHistory([]);
                      setAttachedImages([]);
                    }
                  }}
                  className="w-full px-5 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl transition-all font-bold flex items-center justify-center gap-2 shadow-lg"
                >
                  <Plus className="w-4 h-4" />
                  加入笔记 💾
                </button>
            </div>
            )}
          </div>
        </div>
        );
      })()}
      
      {/* 截图选择器弹窗 */}
      {showScreenshotSelector && screenshotImage && (
        <ScreenshotSelector
          imageUrl={screenshotImage}
          onConfirm={handleScreenshotConfirm}
          onCancel={() => {
            setShowScreenshotSelector(false);
            setScreenshotImage(null);
          }}
          isUploading={isUploadingScreenshot}
        />
      )}
      
      {/* QA回答卡片 - 浮动在视频中心 - 竖向卡片(高>宽) */}
      {currentQACard && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200 p-4"
          onClick={closeQACard}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col relative"
            style={{ width: '480px', height: '640px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 装饰性背景 */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 right-0 w-40 h-40 bg-yellow-200 rounded-full opacity-10 -translate-y-20 translate-x-20"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-green-200 rounded-full opacity-10 translate-y-16 -translate-x-16"></div>
            </div>
            
            {/* 简化的卡片头部 */}
            <div className="flex-shrink-0 bg-gradient-to-r from-yellow-100 to-green-100 border-b-2 border-yellow-300 p-5 flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-yellow-400 flex items-center justify-center shadow-md">
                  <Sparkles className="w-5 h-5 text-gray-800" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900">✨ AI 智能解答</h3>
                  <p className="text-xs text-gray-600">来自知识点分析</p>
                </div>
              </div>
              <button
                onClick={closeQACard}
                className="text-gray-500 hover:text-gray-700 transition-colors p-1 hover:bg-white/50 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* 卡片内容 - 可滚动 */}
            <div className="flex-1 overflow-y-auto p-6 relative z-10">
              {(() => {
                // 检查是否为多QA格式（包含Q1, A1等标记）
                const isMultiQA = /Q\d+/.test(currentQACard.question);
                
                if (!isMultiQA) {
                  // 原始单QA格式，直接显示
                  return (
                    <>
                      <div className="mb-4">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-400 text-white flex items-center justify-center font-bold shadow-md flex-shrink-0">
                    Q
                  </div>
                          <div className="flex-1 prose prose-base max-w-none text-gray-700 leading-relaxed [&>*:first-child]:mt-0">
                            <p className="text-gray-800 text-base leading-relaxed font-medium m-0">{currentQACard.question}</p>
                  </div>
                </div>
              </div>
              
                      {currentQACard.answer && (
                        <div className="mb-4">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 text-white flex items-center justify-center font-bold shadow-md flex-shrink-0">
                              A
                </div>
                            <div className="flex-1 prose prose-base max-w-none text-gray-700 leading-relaxed [&>*:first-child]:mt-0">
                              <ReactMarkdown>{currentQACard.answer}</ReactMarkdown>
              </div>
                          </div>
                        </div>
                      )}
                    </>
                  );
                }
                
                // 多QA格式：Q1\n\n问题\n\nA1\n\n答案\n\n---\n\nQ2...
                const content = currentQACard.question;
                const qaBlocks = content.split('\n\n---\n\n');
                
                return qaBlocks.map((block, blockIndex) => {
                  // 解析每个QA块：Q[n]\n\n问题内容\n\nA[n]\n\n答案内容
                  const lines = block.split('\n\n');
                  const items: Array<{type: 'Q' | 'A', label: string, content: string}> = [];
                  
                  for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (/^Q\d+$/.test(line)) {
                      // Q标签
                      items.push({
                        type: 'Q',
                        label: line,
                        content: lines[i + 1] || ''
                      });
                      i++; // 跳过已处理的内容行
                    } else if (/^A\d+$/.test(line)) {
                      // A标签
                      items.push({
                        type: 'A',
                        label: line,
                        content: lines[i + 1] || ''
                      });
                      i++; // 跳过已处理的内容行
                    }
                  }
                  
                  return (
                    <div key={blockIndex}>
                      {items.map((item, itemIndex) => (
                        <div key={itemIndex} className={itemIndex > 0 ? 'mt-4' : ''}>
                          <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-lg ${
                              item.type === 'Q' 
                                ? 'bg-gradient-to-br from-yellow-400 to-orange-400' 
                                : 'bg-gradient-to-br from-green-500 to-emerald-500'
                            } text-white flex items-center justify-center font-bold shadow-md flex-shrink-0`}>
                              {item.label}
                  </div>
                            <div className="flex-1 prose prose-base max-w-none text-gray-700 leading-relaxed [&>*:first-child]:mt-0">
                              <ReactMarkdown>{item.content}</ReactMarkdown>
                  </div>
                </div>
                </div>
                      ))}
                      
                      {/* 不同QA组之间的分隔线 */}
                      {blockIndex < qaBlocks.length - 1 && (
                        <div className="my-6 border-t-2 border-dashed border-gray-200"></div>
                      )}
              </div>
                  );
                });
              })()}
            </div>
            
            {/* 卡片底部按钮 */}
            <div className="flex-shrink-0 bg-gradient-to-r from-gray-50 to-white border-t-2 border-gray-200 p-5 flex gap-3 relative z-10">
              <button
                onClick={closeQACard}
                className="flex-1 px-5 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all font-medium flex items-center justify-center gap-2 shadow-sm"
              >
                <X className="w-4 h-4" />
                关闭
              </button>
              <button
                onClick={addQACardToKnowledgePoint}
                className="flex-1 px-5 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl transition-all font-bold flex items-center justify-center gap-2 shadow-lg"
              >
                <Plus className="w-4 h-4" />
                加入笔记 💾
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 截图查看卡片 - 浮动在视频中心 - 4:3 比例 */}
      {currentScreenshot && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200 p-4"
          onClick={() => setCurrentScreenshot(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col relative"
            style={{ width: '480px', height: '640px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 装饰性背景 */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 right-0 w-40 h-40 bg-blue-200 rounded-full opacity-10 -translate-y-20 translate-x-20"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-200 rounded-full opacity-10 translate-y-16 -translate-x-16"></div>
            </div>
            
            {/* 简化的卡片头部 */}
            <div className="flex-shrink-0 bg-gradient-to-r from-blue-100 to-purple-100 border-b-2 border-blue-300 p-5 flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center shadow-md">
                  <ImageIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900">📸 视频截图</h3>
                  <p className="text-xs text-gray-600">{knowledgePoints[currentKnowledgeIndex]?.name || '知识点'}</p>
                </div>
              </div>
              <button
                onClick={() => setCurrentScreenshot(null)}
                className="text-gray-500 hover:text-gray-700 transition-colors p-1 hover:bg-white/50 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* 截图内容 */}
            <div className="flex-1 overflow-hidden p-4 relative z-10 flex items-center justify-center bg-gray-50">
              <img 
                src={currentScreenshot} 
                alt="视频截图"
                className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
              />
            </div>
            
            {/* 卡片底部按钮 */}
            <div className="flex-shrink-0 bg-gradient-to-r from-gray-50 to-white border-t-2 border-gray-200 p-5 flex gap-3 relative z-10">
              <button
                onClick={() => setCurrentScreenshot(null)}
                className="flex-1 px-5 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all font-medium flex items-center justify-center gap-2 shadow-sm"
              >
                <X className="w-4 h-4" />
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 搜索知识点对话框 */}
      {/* 搜索对话框 & 结果卡片 */}
      {(showSearchDialog || currentSearchResult) && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200 p-4"
          onClick={() => {
            setShowSearchDialog(false);
            setCurrentSearchResult(null);
            setIsPlayingResultVideo(false);
            setSearchKeyword('');
          }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col relative"
            style={{ width: '480px', height: '640px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 装饰性背景 */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 right-0 w-40 h-40 bg-green-200 rounded-full opacity-10 -translate-y-20 translate-x-20"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-200 rounded-full opacity-10 translate-y-16 -translate-x-16"></div>
            </div>

            {currentSearchResult ? (
              // ------------------- 结果展示模式 -------------------
              <>
                {/* 标题栏 */}
                <div className="flex-shrink-0 bg-gradient-to-r from-green-100 to-emerald-100 border-b-2 border-green-300 p-5 flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => {
                        setCurrentSearchResult(null); // 返回搜索
                        setIsPlayingResultVideo(false);
                      }}
                      className="w-9 h-9 rounded-lg bg-white/80 flex items-center justify-center shadow-sm hover:bg-white transition-colors"
                      title="返回搜索"
                    >
                      <ArrowLeft className="w-5 h-5 text-gray-700" />
                    </button>
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">🎯 搜索结果</h3>
                      <p className="text-xs text-gray-600">{currentSearchResult.partTitle}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowSearchDialog(false);
                      setCurrentSearchResult(null);
                      setIsPlayingResultVideo(false);
                    }}
                    className="text-gray-500 hover:text-gray-700 transition-colors p-1 hover:bg-white/50 rounded-lg"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* 内容区域 */}
                <div className="flex-1 overflow-y-auto p-6 relative z-10">
                  <h4 className="font-bold text-xl text-gray-900 mb-2">
                    {currentSearchResult.knowledgePointName}
                  </h4>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                    <Clock className="w-4 h-4" />
                    <span>{currentSearchResult.startTime} - {currentSearchResult.endTime}</span>
                  </div>

                  {/* 视频/缩略图区域 */}
                  <div className="mb-4 bg-black rounded-lg overflow-hidden shadow-lg border-2 border-gray-200" style={{ aspectRatio: '16/9' }}>
                    {isPlayingResultVideo && currentSearchResult.videoUrl ? (
                      <video
                        src={`${currentSearchResult.videoUrl}#t=${timeToSeconds(currentSearchResult.startTime)},${timeToSeconds(currentSearchResult.endTime)}`}
                        className="w-full h-full"
                        controls
                        autoPlay
                        playsInline
                        webkit-playsinline="true"
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <div 
                        className="w-full h-full relative group cursor-pointer"
                        onClick={() => {
                          if (currentSearchResult.videoUrl) {
                            setIsPlayingResultVideo(true);
                          } else {
                            alert('无法播放：未找到视频链接');
                          }
                        }}
                      >
                        <img 
                          src={currentSearchResult.thumbnail || processedTaskData?.video_info?.thumbnail || ''} 
                          alt="缩略图" 
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                          <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                            <Play className="w-5 h-5 text-green-600 ml-1" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 笔记内容 */}
                  {currentSearchResult.note && (
                    <div className="mb-4">
                      <h5 className="font-bold text-sm text-gray-700 mb-2">📝 笔记内容</h5>
                      <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 leading-relaxed border border-gray-200">
                        <ReactMarkdown>{currentSearchResult.note}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>

                {/* 底部按钮 */}
                <div className="flex-shrink-0 bg-gray-50 border-t border-gray-200 p-5 flex gap-3 relative z-10">
                  <button
                    onClick={() => {
                      setShowSearchDialog(false);
                      setCurrentSearchResult(null);
                      setIsPlayingResultVideo(false);
                    }}
                    className="flex-1 px-5 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-bold shadow-sm"
                  >
                    关闭
                  </button>
                  <button
                    onClick={() => {
                      // 将搜索结果添加到当前正在播放的知识点笔记中
                      addSearchResultToKnowledgePoint();
                    }}
                    className="flex-1 px-5 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-all font-bold shadow-md flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    加入笔记
                  </button>
                </div>
                  </>
                ) : (
              // ------------------- 搜索输入模式 -------------------
              <>
                {/* 标题栏 */}
                <div className="flex-shrink-0 flex items-center justify-between p-5 border-b border-gray-200 relative z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center">
                      <Search className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-bold text-base text-gray-900">🔍 搜索知识点</h3>
                  </div>
                  <button
                    onClick={() => {
                      setShowSearchDialog(false);
                      setSearchKeyword('');
                    }}
                    className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="w-5 h-5" />
              </button>
            </div>

                {/* 搜索输入区域 */}
                <div className="flex-1 p-6 flex flex-col items-center justify-center relative z-10">
                  <div className="w-full">
                    <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <span className="text-3xl">🔍</span>
          </div>
                      <h4 className="text-lg font-bold text-gray-800 mb-1">搜索知识点</h4>
                      <p className="text-sm text-gray-500">输入关键词，快速找到相关知识点</p>
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && searchKeyword.trim() && !isSearching) {
                            searchKnowledgePoints();
                          }
                        }}
                        placeholder="输入关键词..."
                        className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:border-green-400 focus:outline-none transition-colors text-lg shadow-sm pr-12"
                        autoFocus
                      />
                      <button
                        onClick={searchKnowledgePoints}
                        disabled={!searchKeyword.trim() || isSearching}
                        className="absolute right-2 top-2 bottom-2 aspect-square bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center justify-center disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed shadow-sm"
                      >
                        {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                      </button>
                    </div>
                    
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <span className="text-xs text-gray-400">💡 试试搜索：</span>
                      {['函数', '极限', '导数'].map((hint) => (
                        <button
                          key={hint}
                          onClick={() => setSearchKeyword(hint)}
                          className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs text-gray-600 transition-colors"
                        >
                          {hint}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* 练习生成对话框 */}
      {showExerciseDialog && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200 p-4"
          onClick={() => {
            if (!isGeneratingExercise) {
              setShowExerciseDialog(false);
              setGeneratedExercise(null);
              setExerciseKnowledgePointIndex(null);
              setIsGeneratingExercise(false);
              setGeneratedExerciseUserAnswer('');
              setGeneratedExerciseSubmitted(false);
              setGeneratedExerciseShowHints(false);
            }
          }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col relative"
            style={{ width: '480px', height: '640px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 装饰性背景 */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 right-0 w-40 h-40 bg-orange-200 rounded-full opacity-10 -translate-y-20 translate-x-20"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-yellow-200 rounded-full opacity-10 translate-y-16 -translate-x-16"></div>
    </div>

            {/* 标题栏 */}
            <div className="flex-shrink-0 bg-gradient-to-r from-orange-100 to-yellow-100 border-b-2 border-orange-300 p-5 flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
                  <CheckSquare className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900">
                    {isGeneratingExercise ? '💪 正在生成练习...' : '✅ 练习生成完成'}
                  </h3>
                  {exerciseKnowledgePointIndex !== null && knowledgePoints[exerciseKnowledgePointIndex] && (
                    <p className="text-xs text-gray-600 line-clamp-1">{knowledgePoints[exerciseKnowledgePointIndex].name}</p>
                  )}
                </div>
              </div>
              {!isGeneratingExercise && (
                <button
                  onClick={() => {
                    setShowExerciseDialog(false);
                    setGeneratedExercise(null);
                    setExerciseKnowledgePointIndex(null);
                    setIsGeneratingExercise(false);
                  }}
                  className="text-gray-500 hover:text-gray-700 transition-colors p-1 hover:bg-white/50 rounded-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              )}
            </div>

            {/* 内容区域 */}
            <div className="flex-1 overflow-y-auto p-6 relative z-10">
              {isGeneratingExercise ? (
                // 加载状态
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="relative mb-6">
                    <Loader2 className="w-16 h-16 text-orange-500 animate-spin mx-auto" />
                    <Sparkles className="w-6 h-6 text-yellow-400 absolute top-0 right-1/3 animate-pulse" />
                  </div>
                  <p className="text-gray-800 text-lg font-bold">正在为您生成练习题...</p>
                  <p className="text-gray-500 text-sm mt-2">请稍候</p>
                </div>
              ) : generatedExercise ? (
                // 练习结果展示
                <div>
                  {/* 正面：题目和选项 */}
                  {!generatedExerciseShowHints && (
                    <div>
                      {/* 题目内容 - 支持LaTeX */}
                      {(generatedExercise.type === 'multiple_choice' || generatedExercise.type === 'fill_blank') && (
                        <>
                          <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200 mb-4">
                            <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed">
                              <ReactMarkdown {...mathMarkdownPlugins}>{autoWrapLatex(generatedExercise.question || '')}</ReactMarkdown>
                            </div>
                          </div>

                          {/* 选择题选项 */}
                          {generatedExercise.type === 'multiple_choice' && generatedExercise.choices && (
                            <div className="space-y-2 mb-4">
                              {generatedExercise.choices.map((choice, idx) => {
                                const isSelected = generatedExerciseUserAnswer === choice.label;
                                const isCorrect = isGeneratedAnswerCorrect(choice.label);
                                const isWrong = generatedExerciseSubmitted && isSelected && isCorrect === false;
                                
                                return (
                                  <label
                                    key={idx}
                                    className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                      isCorrect === true
                                        ? 'border-green-500 bg-green-50'
                                        : isWrong
                                        ? 'border-red-500 bg-red-50'
                                        : isSelected && !generatedExerciseSubmitted
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50'
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name="generated-exercise-answer"
                                      value={choice.label}
                                      checked={isSelected}
                                      onChange={(e) => {
                                        if (!generatedExerciseSubmitted) {
                                          setGeneratedExerciseUserAnswer(e.target.value);
                                        }
                                      }}
                                      disabled={generatedExerciseSubmitted}
                                      className="mt-1 w-4 h-4 text-blue-600"
                                    />
                                    <span className="font-bold text-gray-700">{choice.label}.</span>
                                    <div className="flex-1 prose prose-sm max-w-none text-gray-800">
                                      <ReactMarkdown {...mathMarkdownPlugins}>{autoWrapLatex(choice.content)}</ReactMarkdown>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                          
                          {/* 填空题输入框 */}
                          {generatedExercise.type === 'fill_blank' && (
                            <div className="mb-4">
                              <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  请输入答案：
                                </label>
                                <input
                                  type="text"
                                  value={generatedExerciseUserAnswer}
                                  onChange={(e) => {
                                    if (!generatedExerciseSubmitted) {
                                      setGeneratedExerciseUserAnswer(e.target.value);
                                    }
                                  }}
                                  disabled={generatedExerciseSubmitted}
                                  placeholder="在此输入答案..."
                                  className={`w-full px-4 py-3 border-2 rounded-lg text-gray-800 focus:outline-none focus:ring-2 transition-all ${
                                    generatedExerciseSubmitted
                                      ? generatedExerciseUserAnswer.trim() === generatedExercise.solution?.trim()
                                        ? 'border-green-500 bg-green-50 focus:ring-green-500'
                                        : 'border-red-500 bg-red-50 focus:ring-red-500'
                                      : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                                  }`}
                                />
                                {generatedExerciseSubmitted && (
                                  <div className="mt-3">
                                    {generatedExerciseUserAnswer.trim() === generatedExercise.solution?.trim() ? (
                                      <p className="text-green-600 font-medium flex items-center gap-2">
                                        <CheckCircle className="w-5 h-5" />
                                        回答正确！
                                      </p>
                                    ) : (
                                      <div className="space-y-2">
                                        <p className="text-red-600 font-medium flex items-center gap-2">
                                          <XCircle className="w-5 h-5" />
                                          回答错误
                                        </p>
                                        <p className="text-gray-700 text-sm">
                                          <span className="font-medium">正确答案：</span>
                                          <span className="text-green-600 font-bold">{generatedExercise.solution}</span>
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* 背面：提示 */}
                  {generatedExerciseShowHints && generatedExercise.hints && generatedExercise.hints.length > 0 && (
                    <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-lg p-6 border-2 border-orange-200">
                      <h4 className="font-bold text-lg text-gray-900 mb-4 flex items-center gap-2">
                        <Lightbulb className="w-5 h-5 text-orange-500" />
                        提示
                      </h4>
                      <div className="space-y-3">
                        {generatedExercise.hints.map((hint, i) => (
                          <div key={i} className="flex gap-3 text-sm text-gray-700 bg-white rounded-lg p-3 border border-orange-100">
                            <span className="text-orange-500 font-bold flex-shrink-0">{i + 1}.</span>
                            <div className="prose prose-sm max-w-none flex-1">
                              <ReactMarkdown {...mathMarkdownPlugins}>{autoWrapLatex(hint)}</ReactMarkdown>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 代码题预览 */}
                  {(generatedExercise.type === 'code_choice' || generatedExercise.type === 'complete') && (
                    <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                      <pre className="text-sm text-gray-100">
                        <code>{generatedExercise.starter_code || '// 代码模板'}</code>
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                // 错误状态
                <div className="flex flex-col items-center justify-center py-12">
                  <X className="w-16 h-16 text-red-500 mb-4" />
                  <p className="text-gray-800 text-lg font-bold">练习生成失败</p>
                  <p className="text-gray-500 text-sm mt-2">请稍后重试</p>
                </div>
              )}
            </div>

            {/* 底部按钮 */}
            {!isGeneratingExercise && generatedExercise && (
              <div className="flex-shrink-0 bg-gradient-to-r from-gray-50 to-white border-t-2 border-gray-200 p-5 flex gap-3 relative z-10">
                {/* 反转按钮 - 查看提示 */}
                {generatedExercise.hints && generatedExercise.hints.length > 0 && (
                  <button
                    onClick={() => setGeneratedExerciseShowHints(!generatedExerciseShowHints)}
                    className="px-4 py-3 bg-white border-2 border-orange-200 text-orange-600 rounded-xl hover:bg-orange-50 hover:border-orange-300 transition-all font-medium flex items-center justify-center gap-2 shadow-sm"
                    title={generatedExerciseShowHints ? '查看题目' : '查看提示'}
                  >
                    <RotateCcw className="w-4 h-4" />
                    {generatedExerciseShowHints ? '题目' : '提示'}
                  </button>
                )}
                
                {/* 提交按钮 - 选择题和填空题都显示 */}
                {(generatedExercise.type === 'multiple_choice' || generatedExercise.type === 'fill_blank') && !generatedExerciseSubmitted && (
                  <button
                    onClick={submitGeneratedExerciseAnswer}
                    disabled={!generatedExerciseUserAnswer}
                    className="flex-1 px-5 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white rounded-xl transition-all font-bold flex items-center justify-center gap-2 shadow-lg disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed"
                  >
                    <CheckCircle className="w-4 h-4" />
                    提交答案
                  </button>
                )}
                
                {/* 加入笔记按钮 */}
                <button
                  onClick={addExerciseToKnowledgePoint}
                  className="flex-1 px-5 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white rounded-xl transition-all font-bold flex items-center justify-center gap-2 shadow-lg"
                >
                  <Plus className="w-4 h-4" />
                  加入笔记 💾
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* 练习卡片详情对话框 */}
      {currentExerciseCard && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200 p-4"
          onClick={closeExerciseCard}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col relative"
            style={{ width: '480px', height: '640px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 装饰性背景 */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 right-0 w-40 h-40 bg-orange-200 rounded-full opacity-10 -translate-y-20 translate-x-20"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-yellow-200 rounded-full opacity-10 translate-y-16 -translate-x-16"></div>
            </div>
            
            {/* 标题栏 */}
            <div className="flex-shrink-0 bg-gradient-to-r from-orange-100 to-yellow-100 border-b-2 border-orange-300 p-5 flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-orange-500 flex items-center justify-center shadow-md">
                  <CheckSquare className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900">💪 练习题</h3>
                  <p className="text-xs text-gray-600">来自知识点分析</p>
                </div>
              </div>
              <button
                onClick={closeExerciseCard}
                className="text-gray-500 hover:text-gray-700 transition-colors p-1 hover:bg-white/50 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* 卡片内容 - 可滚动，支持反转 */}
            <div className="flex-1 overflow-y-auto p-6 relative z-10">
              {/* 正面：题目和选项 */}
              {!exerciseShowHints && (
                <div>
                  {/* 题目内容 - 支持LaTeX */}
                  {(currentExerciseCard.type === 'multiple_choice' || currentExerciseCard.type === 'fill_blank') && (
                    <>
                      <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200 mb-4">
                        <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed">
                          <ReactMarkdown {...mathMarkdownPlugins}>{autoWrapLatex(currentExerciseCard.question || '')}</ReactMarkdown>
                        </div>
                      </div>

                      {/* 选择题选项 */}
                      {currentExerciseCard.type === 'multiple_choice' && currentExerciseCard.choices && (
                        <div className="space-y-2 mb-4">
                          {currentExerciseCard.choices.map((choice, idx) => {
                            const isSelected = exerciseUserAnswer === choice.label;
                            const isCorrect = isAnswerCorrect(choice.label);
                            const isWrong = exerciseSubmitted && isSelected && isCorrect === false;
                            
                            return (
                              <label
                                key={idx}
                                className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                  isCorrect === true
                                    ? 'border-green-500 bg-green-50'
                                    : isWrong
                                    ? 'border-red-500 bg-red-50'
                                    : isSelected && !exerciseSubmitted
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="exercise-answer"
                                  value={choice.label}
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (!exerciseSubmitted) {
                                      setExerciseUserAnswer(e.target.value);
                                    }
                                  }}
                                  disabled={exerciseSubmitted}
                                  className="mt-1 w-4 h-4 text-blue-600"
                                />
                                <span className="font-bold text-gray-700">{choice.label}.</span>
                                <div className="flex-1 prose prose-sm max-w-none text-gray-800">
                                  <ReactMarkdown {...mathMarkdownPlugins}>{autoWrapLatex(choice.content)}</ReactMarkdown>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                      
                      {/* 填空题输入框 */}
                      {currentExerciseCard.type === 'fill_blank' && (
                        <div className="mb-4">
                          <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              请输入答案：
                            </label>
                            <input
                              type="text"
                              value={exerciseUserAnswer}
                              onChange={(e) => {
                                if (!exerciseSubmitted) {
                                  setExerciseUserAnswer(e.target.value);
                                }
                              }}
                              disabled={exerciseSubmitted}
                              placeholder="在此输入答案..."
                              className={`w-full px-4 py-3 border-2 rounded-lg text-gray-800 focus:outline-none focus:ring-2 transition-all ${
                                exerciseSubmitted
                                  ? exerciseUserAnswer.trim() === currentExerciseCard.solution?.trim()
                                    ? 'border-green-500 bg-green-50 focus:ring-green-500'
                                    : 'border-red-500 bg-red-50 focus:ring-red-500'
                                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                              }`}
                            />
                            {exerciseSubmitted && (
                              <div className="mt-3">
                                {exerciseUserAnswer.trim() === currentExerciseCard.solution?.trim() ? (
                                  <p className="text-green-600 font-medium flex items-center gap-2">
                                    <CheckCircle className="w-5 h-5" />
                                    回答正确！
                                  </p>
                                ) : (
                                  <div className="space-y-2">
                                    <p className="text-red-600 font-medium flex items-center gap-2">
                                      <XCircle className="w-5 h-5" />
                                      回答错误
                                    </p>
                                    <p className="text-gray-700 text-sm">
                                      <span className="font-medium">正确答案：</span>
                                      <span className="text-green-600 font-bold">{currentExerciseCard.solution}</span>
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* 背面：提示 */}
              {exerciseShowHints && currentExerciseCard.hints && currentExerciseCard.hints.length > 0 && (
                <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-lg p-6 border-2 border-orange-200">
                  <h4 className="font-bold text-lg text-gray-900 mb-4 flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-orange-500" />
                    提示
                  </h4>
                  <div className="space-y-3">
                    {currentExerciseCard.hints.map((hint, i) => (
                      <div key={i} className="flex gap-3 text-sm text-gray-700 bg-white rounded-lg p-3 border border-orange-100">
                        <span className="text-orange-500 font-bold flex-shrink-0">{i + 1}.</span>
                        <div className="prose prose-sm max-w-none flex-1">
                          <ReactMarkdown {...mathMarkdownPlugins}>{hint}</ReactMarkdown>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 代码题预览 */}
              {(currentExerciseCard.type === 'code_choice' || currentExerciseCard.type === 'complete') && !exerciseShowHints && (
                <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-gray-100">
                    <code>{currentExerciseCard.starter_code || '// 代码模板'}</code>
                  </pre>
                </div>
              )}
            </div>
            
            {/* 卡片底部按钮 */}
            <div className="flex-shrink-0 bg-gradient-to-r from-gray-50 to-white border-t-2 border-gray-200 p-5 flex gap-3 relative z-10">
              {/* 反转按钮 - 查看提示 */}
              {currentExerciseCard.hints && currentExerciseCard.hints.length > 0 && (
                <button
                  onClick={() => setExerciseShowHints(!exerciseShowHints)}
                  className="px-4 py-3 bg-white border-2 border-orange-200 text-orange-600 rounded-xl hover:bg-orange-50 hover:border-orange-300 transition-all font-medium flex items-center justify-center gap-2 shadow-sm"
                  title={exerciseShowHints ? '查看题目' : '查看提示'}
                >
                  <RotateCcw className="w-4 h-4" />
                  {exerciseShowHints ? '题目' : '提示'}
                </button>
              )}
              
              {/* 提交按钮 - 选择题和填空题都显示 */}
              {(currentExerciseCard.type === 'multiple_choice' || currentExerciseCard.type === 'fill_blank') && !exerciseSubmitted && (
                <button
                  onClick={submitExerciseAnswer}
                  disabled={!exerciseUserAnswer}
                  className="flex-1 px-5 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white rounded-xl transition-all font-bold flex items-center justify-center gap-2 shadow-lg disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="w-4 h-4" />
                  提交答案
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

