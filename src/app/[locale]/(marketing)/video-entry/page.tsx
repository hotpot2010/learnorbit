'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Play, 
  Clock, 
  Loader2, 
  List, 
  Trash2, 
  CheckCircle, 
  X, 
  ArrowRight,
  Plus
} from 'lucide-react';
import { useLocaleRouter } from '@/i18n/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { buildApiUrl, API_ENDPOINTS } from '@/config/api';
import { useMobileLayout } from '@/hooks/use-mobile-layout';

interface VideoInfo {
  title: string;
  url: string;
  cover: string;
  duration: string;
  author: string;
  play: number;
  video_amount: number;
  is_series: boolean;
  target_audience: string;
  description: string;
}

// 待处理视频接口
interface PendingVideo extends VideoInfo {
  id: string; // 生成唯一ID
  status: 'pending' | 'processing' | 'completed' | 'failed';
  jobId?: string;
  progress?: number;
  message?: string;
  addedAt: number;
}

export default function VideoEntryPage() {
  const router = useLocaleRouter();
  const locale = useLocale();
  const t = useTranslations('LearningPlatform.videoEntry');
  const { isMobile } = useMobileLayout();

  // 搜索相关状态
  const [searchQuery, setSearchQuery] = useState('');
  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState('');

  // 待处理列表状态
  const [pendingVideos, setPendingVideos] = useState<PendingVideo[]>([]);
  const [isPendingListOpen, setIsPendingListOpen] = useState(false);

  // 初始化加载 localStorage
  useEffect(() => {
    const saved = localStorage.getItem('pendingVideos');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPendingVideos(parsed);
        
        // 恢复轮询未完成的任务
        parsed.forEach((v: PendingVideo) => {
          if (v.status === 'processing' && v.jobId) {
            startPolling(v.id, v.jobId);
          }
        });
      } catch (e) {
        console.error('加载保存的列表失败:', e);
      }
    }
  }, []);

  // 监听 pendingVideos 变化并保存
  useEffect(() => {
    localStorage.setItem('pendingVideos', JSON.stringify(pendingVideos));
  }, [pendingVideos]);

  // 处理搜索
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError(t('searchError'));
      return;
    }

    setIsSearching(true);
    setError('');
    setHasSearched(false);

    try {
      console.log('🔍 搜索视频:', searchQuery);

      const response = await fetch(buildApiUrl(API_ENDPOINTS.videoSearch), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          limit: 10,
          locale: locale,
        }),
      });

      if (!response.ok) {
        throw new Error(`${t('searchFailed')}: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ 搜索结果:', data);
      
      if (data.success && data.videos) {
        const videosArray = Array.isArray(data.videos) ? data.videos : [];
        setVideos(videosArray);
        setHasSearched(true);
      } else {
        setError(data.message || t('searchFailed'));
        setVideos([]);
      }
    } catch (err: any) {
      console.error('❌ 搜索错误:', err);
      setError(err.message || t('searchFailedRetry'));
    } finally {
      setIsSearching(false);
    }
  };

  // 处理回车键
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSearching) {
      handleSearch();
    }
  };

  // 添加到待处理列表
  const handleAddToWaitlist = async (video: VideoInfo) => {
    // 检查是否已在列表中
    if (pendingVideos.some(v => v.url === video.url)) {
      if (!isPendingListOpen) setIsPendingListOpen(true);
      return;
    }

    const newPendingVideo: PendingVideo = {
      ...video,
      id: crypto.randomUUID(),
      status: 'pending',
      addedAt: Date.now(),
      message: '准备分析...'
    };

    setPendingVideos(prev => [...prev, newPendingVideo]);
    if (!isPendingListOpen) setIsPendingListOpen(true);

    // 立即开始处理
    await processVideo(newPendingVideo);
  };

  // 处理视频分析
  const processVideo = async (video: PendingVideo) => {
    // 更新状态为处理中
    updatePendingVideoStatus(video.id, { status: 'processing', message: '正在创建任务...' });

    try {
      // 1. 创建分析任务
      const response = await fetch(buildApiUrl(API_ENDPOINTS.batchJobs), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_urls: [video.url],
          prompt: '提取视频中的知识点',
          job_name: `分析: ${video.title}`
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.job_id) {
        updatePendingVideoStatus(video.id, { 
          jobId: data.job_id, 
          message: '分析中...',
          progress: 0
        });
        
        // 开始轮询状态
        startPolling(video.id, data.job_id);
      } else {
        throw new Error(data.error || '创建任务失败');
      }
    } catch (error) {
      console.error('❌ 处理视频失败:', error);
      updatePendingVideoStatus(video.id, { 
        status: 'failed', 
        message: '任务创建失败' 
      });
    }
  };

  // 轮询任务状态
  const startPolling = (videoId: string, jobId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(buildApiUrl(`${API_ENDPOINTS.batchJobs}/${jobId}`));
        
        if (!response.ok) return;

        const data = await response.json();
        
        if (data.success) {
          const status = data.job.status;
          
          if (status === 'completed') {
            updatePendingVideoStatus(videoId, { 
              status: 'completed', 
              progress: 100,
              message: '分析完成' 
            });
            clearInterval(pollInterval);
          } else if (status === 'failed') {
            updatePendingVideoStatus(videoId, { 
              status: 'failed', 
              message: data.job.error || '分析失败' 
            });
            clearInterval(pollInterval);
          } else {
            // 更新进度
            // 这里可以根据 actual progress logic 优化
            updatePendingVideoStatus(videoId, { 
              message: `正在分析... (${status})` 
            });
          }
        }
      } catch (error) {
        console.error('轮询状态失败:', error);
      }
    }, 3000); // 每3秒轮询一次

    // 5分钟后停止轮询（防止死循环）
    setTimeout(() => clearInterval(pollInterval), 5 * 60 * 1000);
  };

  // 更新待处理视频状态
  const updatePendingVideoStatus = (id: string, updates: Partial<PendingVideo>) => {
    setPendingVideos(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
  };

  // 移除待处理视频
  const handleRemovePending = (id: string) => {
    setPendingVideos(prev => prev.filter(v => v.id !== id));
  };

  // 跳转到学习页面
  const handleStartLearning = (video: PendingVideo) => {
    if (video.status !== 'completed') return;

    const encodedUrl = encodeURIComponent(video.url);
    const targetUrl = `/${locale}/video-notes-prototype?videoUrl=${encodedUrl}`;
    window.location.href = targetUrl;
  };

  // 格式化时长
  const formatDuration = (duration: string): string => {
    if (!duration) return '00:00:00';
    let totalSeconds = 0;
    if (duration.includes(':')) {
      const parts = duration.split(':').map(p => parseInt(p));
      if (parts.length === 3) totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      else if (parts.length === 2) totalSeconds = parts[0] * 60 + parts[1];
    } else {
      totalSeconds = parseInt(duration);
    }
    if (isNaN(totalSeconds)) return duration;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row overflow-hidden">
      {/* 左侧/主要内容区域：搜索和结果 */}
      <div className="flex-1 h-screen overflow-y-auto relative">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          {/* 顶部搜索栏 */}
          <div className="sticky top-0 z-20 bg-gray-50/95 backdrop-blur py-4 -mx-4 px-4 border-b border-gray-200 mb-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center">
                  <span className="mr-2">🎬</span> {t('title')}
                </h1>
                
                {/* 移动端待处理列表切换按钮 */}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="md:hidden relative"
                  onClick={() => setIsPendingListOpen(!isPendingListOpen)}
                >
                  <List className="w-4 h-4 mr-2" />
                  列表
                  {pendingVideos.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {pendingVideos.length}
                    </span>
                  )}
                </Button>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    type="text"
                    placeholder={t('searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="pl-9"
                  />
                </div>
                <Button 
                  onClick={handleSearch} 
                  disabled={isSearching || !searchQuery.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : t('searchButton')}
                </Button>
              </div>
            </div>
          </div>

          {/* 搜索结果列表 - 紧凑模式 */}
          {hasSearched && videos.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 pb-20">
              {videos.map((video, index) => (
                <div 
                  key={index}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex gap-4 hover:shadow-md transition-shadow group"
                >
                  {/* 缩略图 */}
                  <div className="relative w-40 h-24 flex-shrink-0 bg-gray-100 rounded overflow-hidden">
                    {video.cover ? (
                      <img 
                        src={video.cover} 
                        alt={video.title} 
                        className="w-full h-full object-cover"
                        crossOrigin="anonymous"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <Play className="w-8 h-8" />
                      </div>
                    )}
                    <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 rounded">
                      {formatDuration(video.duration)}
                    </div>
                  </div>

                  {/* 信息 */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                    <div>
                      <h3 className="font-bold text-gray-800 line-clamp-2 text-base mb-1" title={video.title}>
                        {video.title}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                        <span className="bg-gray-100 px-1.5 py-0.5 rounded">{video.author}</span>
                        <span>{video.play > 10000 ? `${(video.play / 10000).toFixed(1)}万` : video.play}播放</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex gap-2">
                        {video.is_series && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200">
                            系列课 ({video.video_amount}p)
                          </span>
                        )}
                        <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">
                          {video.target_audience}
                        </span>
                      </div>
                      
                      <Button 
                        size="sm" 
                        variant="ghost"
                        className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 -mr-2"
                        onClick={() => handleAddToWaitlist(video)}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        加入列表
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : hasSearched ? (
            <div className="text-center py-12 text-gray-500">
              未找到相关视频
            </div>
          ) : (
            !isSearching && (
              <div className="text-center py-20 opacity-50">
                <Search className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>输入关键词搜索 Bilibili 视频</p>
              </div>
            )
          )}
        </div>
      </div>

      {/* 右侧/抽屉：待处理列表 */}
      <div 
        className={`
          fixed inset-y-0 right-0 z-30 w-full md:w-80 bg-white border-l border-gray-200 shadow-xl transform transition-transform duration-300 ease-in-out
          ${isPendingListOpen ? 'translate-x-0' : 'translate-x-full'}
          md:translate-x-0 md:static md:block
        `}
      >
        <div className="h-full flex flex-col">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <h2 className="font-bold text-lg flex items-center">
              <List className="w-5 h-5 mr-2" />
              学习列表
              <span className="ml-2 bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full">
                {pendingVideos.length}
              </span>
            </h2>
            {/* 移动端关闭按钮 */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden"
              onClick={() => setIsPendingListOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {pendingVideos.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">
                <div className="mb-2">📭</div>
                列表为空<br/>请从左侧添加视频
              </div>
            ) : (
              pendingVideos.map((video) => (
                <div 
                  key={video.id} 
                  className={`
                    bg-white rounded-lg border p-3 shadow-sm transition-colors
                    ${video.status === 'completed' ? 'border-green-200 bg-green-50/30' : 'border-gray-200'}
                  `}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-sm line-clamp-2 flex-1 mr-2" title={video.title}>
                      {video.title}
                    </h4>
                    <button 
                      onClick={() => handleRemovePending(video.id)}
                      className="text-gray-400 hover:text-red-500 p-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    {/* 状态指示 */}
                    <div className="flex items-center text-xs">
                      {video.status === 'processing' && (
                        <span className="text-blue-600 flex items-center">
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          {video.message || '处理中...'}
                        </span>
                      )}
                      {video.status === 'pending' && (
                        <span className="text-gray-500 flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          等待中
                        </span>
                      )}
                      {video.status === 'completed' && (
                        <span className="text-green-600 flex items-center">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          已就绪
                        </span>
                      )}
                      {video.status === 'failed' && (
                        <span className="text-red-600 flex items-center">
                          <X className="w-3 h-3 mr-1" />
                          失败
                        </span>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    {video.status === 'completed' && (
                      <Button 
                        size="sm" 
                        className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handleStartLearning(video)}
                      >
                        开始学习 <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    )}
                  </div>
                  
                  {/* 进度条（处理中） */}
                  {video.status === 'processing' && (
                    <div className="mt-2 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full animate-pulse" 
                        style={{ width: '60%' }} 
                      ></div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      {/* 移动端遮罩层 */}
      {isPendingListOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-20 md:hidden"
          onClick={() => setIsPendingListOpen(false)}
        />
      )}
    </div>
  );
}