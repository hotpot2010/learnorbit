'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Play, 
  Loader2
} from 'lucide-react';
import { useLocale } from 'next-intl';
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
  processed?: boolean;
  task_id?: string;
  video_url?: string | string[];
  asr_result_url?: string | string[];
  knowledge_points_result_url?: string | string[];
  thumbnail_cdn?: string; // CDN封面URL
}

export default function VideoEntryPage() {
  const locale = useLocale();
  const { isMobile } = useMobileLayout();

  // 搜索相关状态
  const [searchQuery, setSearchQuery] = useState('');
  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState('');

  // 动态字体
  const fontFamily = isMobile && locale === 'en'
    ? 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif'
    : '"Comic Sans MS", "Marker Felt", "Kalam", cursive';

  // 处理搜索
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('请输入搜索关键词');
      return;
    }

    setIsSearching(true);
    setError('');
    setHasSearched(false);
    setVideos([]);

    try {
      console.log('🔍 搜索视频:', searchQuery);

      const isMathQuery = searchQuery.includes('数学') || searchQuery.toLowerCase().includes('math');
      
      let response;
      if (isMathQuery) {
        console.log('📚 从数据库加载数学相关视频');
        response = await fetch(`/api/processed-videos?keyword=${encodeURIComponent(searchQuery)}`);
      } else {
        console.log('🔍 从B站搜索视频');
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        response = await fetch(`${API_URL}/open-api/video-search`, {
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
      }

      if (!response.ok) {
        throw new Error(`搜索失败: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ 搜索结果:', data);
      
      if (data.success && data.videos) {
        const videosArray = Array.isArray(data.videos) ? data.videos : [];
        setVideos(videosArray);
        setHasSearched(true);
      } else {
        setError(data.message || '搜索失败');
        setVideos([]);
      }
    } catch (err: any) {
      console.error('❌ 搜索错误:', err);
      setError(err.message || '搜索失败，请重试');
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

  // 跳转到学习页面
  const handleStartLearning = (video: VideoInfo) => {
    const params = new URLSearchParams({
      videoUrl: video.url,
      });

    if (video.processed && video.task_id) {
      params.append('taskId', video.task_id);
      params.append('processed', 'true');
    }

    const targetUrl = `/${locale}/video-notes-prototype?${params.toString()}`;
    window.location.href = targetUrl;
  };

  // 格式化播放量
  const formatPlayCount = (play: number): string => {
    if (play > 10000) return `${(play / 10000).toFixed(1)}万`;
    return play.toString();
  };

  // 获取封面URL（优先使用CDN）
  const getCoverUrl = (video: VideoInfo): string => {
    const url = video.thumbnail_cdn || video.cover || '';
    console.log(`🖼️ 获取封面URL - 标题: ${video.title.substring(0, 30)}... | CDN: ${video.thumbnail_cdn || '无'} | Cover: ${video.cover || '无'} | 最终: ${url || '无'}`);
    return url;
  };

  return (
    <div 
      className="min-h-screen bg-white p-4 md:p-8"
      style={{ 
        backgroundImage: 'linear-gradient(to right, #f0f0f0 1px, transparent 1px), linear-gradient(to bottom, #f0f0f0 1px, transparent 1px)', 
        backgroundSize: '20px 20px' 
      }}
    >
      {/* 未搜索时：居中显示标题和搜索框 */}
      {!hasSearched && (
        <div className="min-h-screen flex flex-col items-center justify-center -mt-20">
          {/* 标题 */}
          <h1 
            className="text-4xl md:text-6xl font-bold text-center mb-4 transform -rotate-1"
            style={{ fontFamily }}
          >
            <span className="bg-yellow-200 px-6 py-3 rounded-lg inline-block shadow-md">
              🎬 视频学习 ✨
            </span>
                </h1>
          <p 
            className="text-lg md:text-xl text-gray-700 text-center mb-8 transform rotate-1"
            style={{ fontFamily }}
          >
            输入关键词，开始你的学习之旅 📚
          </p>

          {/* 搜索框 */}
          <div className="w-full max-w-2xl px-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="text"
                  placeholder="搜索数学、编程、英语等课程..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pl-10 h-12 text-base bg-white border-2 border-yellow-300 focus:border-blue-400 rounded-lg shadow-sm"
                  style={{ fontFamily }}
                />
              </div>
                <Button 
                onClick={handleSearch} 
                disabled={isSearching || !searchQuery.trim()}
                className="h-12 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md"
                style={{ fontFamily }}
              >
                {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : '搜索'}
                </Button>
              </div>

            {error && (
              <p className="text-red-500 text-sm mt-2 text-center" style={{ fontFamily }}>
                {error}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 已搜索时：显示搜索栏和结果列表 */}
      {hasSearched && (
        <div className="container mx-auto max-w-4xl">
          {/* 顶部搜索栏 */}
          <div className="mb-8">
            <h1 
              className="text-3xl md:text-4xl font-bold text-center mb-4 transform -rotate-1"
              style={{ fontFamily }}
            >
              <span className="bg-yellow-200 px-6 py-3 rounded-lg inline-block shadow-md">
                🎬 视频学习 ✨
              </span>
            </h1>

              <div className="flex gap-2">
                <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    type="text"
                  placeholder="搜索数学、编程、英语等课程..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={handleKeyPress}
                  className="pl-10 h-12 text-base bg-white border-2 border-yellow-300 focus:border-blue-400 rounded-lg shadow-sm"
                  style={{ fontFamily }}
                  />
                </div>
                <Button 
                  onClick={handleSearch} 
                  disabled={isSearching || !searchQuery.trim()}
                className="h-12 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md"
                style={{ fontFamily }}
                >
                {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : '搜索'}
                </Button>
            </div>

            {error && (
              <p className="text-red-500 text-sm mt-2 text-center" style={{ fontFamily }}>
                {error}
              </p>
            )}
          </div>

          {/* 搜索结果列表 */}
          {videos.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 pb-20">
              {videos.map((video, index) => (
                <div 
                  key={index}
                  className={`
                    bg-white rounded-lg shadow-sm border p-3 flex gap-4 hover:shadow-md transition-shadow group
                    ${video.processed ? 'bg-yellow-50 border-yellow-300' : 'border-gray-200'}
                  `}
                  style={{ fontFamily }}
                >
                  {/* 缩略图 */}
                  <div className="relative w-40 h-24 flex-shrink-0 bg-gray-100 rounded overflow-hidden">
                    {getCoverUrl(video) ? (
                      <img 
                        src={getCoverUrl(video)} 
                        alt={video.title} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const placeholder = e.currentTarget.nextElementSibling as HTMLElement;
                          if (placeholder) placeholder.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className="w-full h-full flex items-center justify-center text-gray-400 bg-yellow-100"
                      style={{ display: getCoverUrl(video) ? 'none' : 'flex' }}
                    >
                      <span className="text-4xl">📺</span>
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
                        <span>{formatPlayCount(video.play)}播放</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex gap-2">
                        {video.is_series && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">
                            系列课 ({video.video_amount}p)
                          </span>
                        )}
                        {video.processed && (
                          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded border border-green-200">
                            ✨已处理
                          </span>
                        )}
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded border border-yellow-300">
                          {video.target_audience}
                        </span>
                      </div>
                      
                      <Button 
                        size="sm" 
                        variant="ghost"
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 -mr-2"
                        onClick={() => handleStartLearning(video)}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        开始学习
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">😕</div>
              <p className="text-gray-500" style={{ fontFamily }}>
                未找到相关视频，试试其他关键词吧
              </p>
              </div>
          )}
        </div>
      )}
    </div>
  );
}
