'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Play, Clock, Eye, ThumbsUp, Loader2, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { buildApiUrl, API_ENDPOINTS } from '@/config/api';

interface VideoInfo {
  title: string;
  url: string;
  cover: string;
  duration: string;
  author: string;
  play: number;
  video_review: number;
  favorites: number;
  description: string;
  video_amount: number;
  is_series: boolean;
  style: string;            // 轻松/严谨
  target_audience: string;  // 新手/进阶/高级
  instructor: string;       // 名师/大V/素人
  video_focus: string;      // 教学/练习/项目/理论/综合
  learning_goals: string[]; // 求职/升学/兴趣/技能提升/考证
  recommendation_score: number;
}

export default function VideoEntryPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState('');

  // 处理搜索
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('请输入搜索关键词');
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
          limit: 3,
        }),
      });

      if (!response.ok) {
        throw new Error(`搜索失败: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ 搜索结果:', data);
      
      // 调试：检查封面URL
      if (data.videos && data.videos.length > 0) {
        console.log('📸 第一个视频封面URL:', data.videos[0].cover);
        console.log('📋 第一个视频完整数据:', data.videos[0]);
      }

      if (data.success && data.videos) {
        setVideos(data.videos);
        setHasSearched(true);
      } else {
        setError(data.message || '搜索失败');
      }
    } catch (err: any) {
      console.error('❌ 搜索错误:', err);
      setError(err.message || '搜索失败，请稍后重试');
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

  // 开始学习
  const handleStartLearning = (videoUrl: string) => {
    // 编码URL并跳转到视频笔记页面
    const encodedUrl = encodeURIComponent(videoUrl);
    router.push(`/zh/video-notes-prototype?videoUrl=${encodedUrl}`);
  };

  // 格式化播放量
  const formatPlayCount = (count: number): string => {
    if (count >= 10000) {
      return `${(count / 10000).toFixed(1)}万`;
    }
    return count.toString();
  };

  // 格式化时长为 小时:分钟:秒 格式
  const formatDuration = (duration: string): string => {
    if (!duration) return '00:00:00';
    
    let totalSeconds = 0;
    
    if (duration.includes(':')) {
      const parts = duration.split(':').map(p => parseInt(p));
      
      if (parts.length === 3) {
        // 已经是 HH:MM:SS 格式
        totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      } else if (parts.length === 2) {
        // B站返回的 MM:SS 格式（实际是 分钟:秒）
        // 例如 "2398:14" 表示 2398分钟14秒
        totalSeconds = parts[0] * 60 + parts[1];
      }
    } else {
      // 纯数字，当作秒数
      totalSeconds = parseInt(duration);
    }
    
    if (isNaN(totalSeconds)) {
      return duration;
    }
    
    // 转换为 HH:MM:SS
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className="relative min-h-screen"
      style={{
        backgroundImage: `
          linear-gradient(to right, #f0f0f0 1px, transparent 1px),
          linear-gradient(to bottom, #f0f0f0 1px, transparent 1px)
        `,
        backgroundSize: '20px 20px',
      }}
    >
      {/* 主要内容区域 */}
      <div className="transform scale-100 lg:scale-110 origin-top">
        {/* 搜索区域 */}
        <section
          className={`relative transition-all duration-500 ${
            hasSearched ? 'py-8 md:py-12 lg:py-12' : 'py-16 md:py-24 lg:py-32'
          } flex items-center justify-center`}
          style={{
            minHeight: hasSearched ? 'auto' : 'calc(100vh - 80px)'
          }}
        >
          <div className="container mx-auto px-4 relative z-10 w-full">
            <div className={`text-center space-y-6 w-full mx-auto transition-all duration-500 ${
              hasSearched ? 'max-w-3xl' : 'max-w-4xl'
            }`}>
              {/* 标题 - 搜索后变小 */}
              {!hasSearched && (
                <div className="space-y-4">
                  <h1
                    className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-800 leading-tight transform -rotate-1"
                    style={{
                      fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                    }}
                  >
                    <span className="bg-yellow-200 px-4 py-2 rounded-lg inline-block shadow-sm">
                      🎬 从视频开始学习
                    </span>
                  </h1>

                  <p
                    className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto transform rotate-0.5"
                    style={{
                      fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                    }}
                  >
                    输入想学的主题，AI 帮你找到最适合的教学视频 ✨
                  </p>
                </div>
              )}

              {/* 搜索框 */}
              <div className="pt-6">
                <div className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <Input
                      type="text"
                      placeholder="例如：Python 基础教程、前端开发入门..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={isSearching}
                      className="pl-10 pr-4 py-6 text-base border-2 border-gray-300 focus:border-indigo-500 rounded-xl shadow-md"
                    />
                  </div>
                  <Button
                    onClick={handleSearch}
                    disabled={isSearching || !searchQuery.trim()}
                    className="px-8 py-6 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200"
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        搜索中...
                      </>
                    ) : (
                      <>
                        <Search className="w-5 h-5 mr-2" />
                        搜索视频
                      </>
                    )}
                  </Button>
                </div>

                {/* 错误提示 */}
                {error && (
                  <div className="mt-4 p-3 bg-red-50 border-2 border-red-200 rounded-lg text-red-600 text-sm">
                    ⚠️ {error}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 搜索结果区域 */}
        {hasSearched && videos.length > 0 && (
          <section className="relative py-8">
            <div className="container mx-auto px-4">
              <div className="max-w-6xl mx-auto space-y-6">
                {/* 结果数量提示 */}
                <div className="text-center text-gray-600 text-sm">
                  为你找到 {videos.length} 个精选视频
                </div>

                {/* 视频卡片列表 */}
                {videos.map((video, index) => {
                  // 标题截断函数
                  const truncateTitle = (title: string, maxLength: number = 45) => {
                    return title.length > maxLength ? title.substring(0, maxLength) + '...' : title;
                  };

                  return (
                    <div
                      key={index}
                      className="bg-white rounded-xl shadow-lg border-2 border-gray-200 hover:border-indigo-400 hover:shadow-xl transition-all duration-300 overflow-hidden"
                    >
                      <div className="flex flex-col md:flex-row gap-6 p-6">
                        {/* 左侧：视频信息+封面 */}
                        <div className="flex-shrink-0 w-full md:w-80">
                          {/* 视频标题（封面上方） */}
                          <h3 className="text-lg font-bold text-gray-800 mb-3 line-clamp-2" title={video.title}>
                            {truncateTitle(video.title)}
                          </h3>

                          {/* 视频封面 */}
                          <div 
                            className="relative rounded-lg overflow-hidden shadow-md group bg-gray-200"
                            style={{ 
                              width: '100%',
                              aspectRatio: '16/9',
                              minHeight: '180px'
                            }}
                          >
                            {video.cover ? (
                              <img
                                src={video.cover}
                                alt={video.title}
                                crossOrigin="anonymous"
                                referrerPolicy="no-referrer"
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  display: 'block',
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  zIndex: 1
                                }}
                                className="group-hover:scale-105 transition-transform duration-300"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  console.error('❌ 图片加载失败:', video.cover);
                                }}
                                onLoad={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  console.log('✅ 图片加载成功:', video.cover);
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <Play className="w-12 h-12" />
                              </div>
                            )}
                            
                            {/* 播放按钮覆盖层 */}
                            <div 
                              className="absolute inset-0 transition-all duration-300 flex items-center justify-center pointer-events-none group-hover:pointer-events-auto"
                              style={{
                                zIndex: 2,
                                background: 'transparent'
                              }}
                            >
                              <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-30 transition-opacity duration-300" />
                              <Play className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 relative z-10" />
                            </div>
                            
                            {/* 系列课标识 */}
                            {video.is_series && (
                              <div className="absolute top-2 right-2 bg-purple-600 text-white text-xs px-2 py-1 rounded shadow-lg" style={{ zIndex: 3 }}>
                                系列课 ({video.video_amount}P)
                              </div>
                            )}
                          </div>

                          {/* 视频时长（封面下方） */}
                          <div className="flex items-center gap-1 mt-2 text-sm text-gray-600">
                            <Clock className="w-4 h-4" />
                            <span>{formatDuration(video.duration)}</span>
                          </div>
                        </div>

                        {/* 中间：AI 分析标签 */}
                        <div className="flex-1 flex items-center">
                          <div className="space-y-4 w-full">
                            {/* 第一行：风格 + 适用人群 */}
                            <div className="flex items-center gap-6">
                              {/* 风格 */}
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-500">风格</span>
                                <span className={`px-4 py-1.5 rounded-full text-sm font-medium shadow-sm ${
                                  video.style === '轻松' ? 'bg-pink-100 text-pink-700 border border-pink-300' :
                                  'bg-slate-100 text-slate-700 border border-slate-300'
                                }`}>
                                  {video.style}
                                </span>
                              </div>

                              {/* 适用人群 */}
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-500">适用人群</span>
                                <span className={`px-4 py-1.5 rounded-full text-sm font-medium shadow-sm ${
                                  video.target_audience === '新手' ? 'bg-green-100 text-green-700 border border-green-300' :
                                  video.target_audience === '进阶' ? 'bg-blue-100 text-blue-700 border border-blue-300' :
                                  'bg-purple-100 text-purple-700 border border-purple-300'
                                }`}>
                                  {video.target_audience}
                                </span>
                              </div>
                            </div>

                            {/* 第二行：讲师 + 视频重点 */}
                            <div className="flex items-center gap-6">
                              {/* 讲师 */}
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-500">讲师</span>
                                <span className={`px-4 py-1.5 rounded-full text-sm font-medium shadow-sm ${
                                  video.instructor === '名师' ? 'bg-amber-100 text-amber-700 border border-amber-300' :
                                  video.instructor === '大V' ? 'bg-sky-100 text-sky-700 border border-sky-300' :
                                  'bg-gray-100 text-gray-700 border border-gray-300'
                                }`}>
                                  {video.instructor}
                                </span>
                              </div>

                              {/* 视频重点 */}
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-500">视频重点</span>
                                <span className={`px-4 py-1.5 rounded-full text-sm font-medium shadow-sm ${
                                  video.video_focus === '教学' ? 'bg-orange-100 text-orange-700 border border-orange-300' :
                                  video.video_focus === '练习' ? 'bg-cyan-100 text-cyan-700 border border-cyan-300' :
                                  video.video_focus === '项目' ? 'bg-pink-100 text-pink-700 border border-pink-300' :
                                  video.video_focus === '理论' ? 'bg-indigo-100 text-indigo-700 border border-indigo-300' :
                                  'bg-gray-100 text-gray-700 border border-gray-300'
                                }`}>
                                  {video.video_focus}
                                </span>
                              </div>
                            </div>

                            {/* 第三行：学习目标 */}
                            <div className="flex items-start gap-3">
                              <span className="text-sm font-medium text-gray-500 pt-1">学习目标</span>
                              <div className="flex flex-wrap gap-2">
                                {video.learning_goals && video.learning_goals.length > 0 ? (
                                  video.learning_goals.map((goal, idx) => (
                                    <span
                                      key={idx}
                                      className="px-4 py-1.5 bg-yellow-100 text-yellow-700 border border-yellow-300 text-sm font-medium rounded-full shadow-sm"
                                    >
                                      {goal}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-sm text-gray-400">暂无</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 右侧：开始学习按钮 */}
                        <div className="flex-shrink-0 flex items-center justify-center md:w-32">
                          <Button
                            onClick={() => handleStartLearning(video.url)}
                            className="w-full md:w-auto px-6 py-8 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200 flex flex-col items-center justify-center space-y-2"
                          >
                            <Play className="w-8 h-8" />
                            <span>开始学习</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* 空状态 */}
        {hasSearched && videos.length === 0 && !isSearching && (
          <section className="relative py-16">
            <div className="container mx-auto px-4">
              <div className="text-center text-gray-500">
                <div className="text-6xl mb-4">🔍</div>
                <p className="text-xl mb-2">未找到相关视频</p>
                <p className="text-sm">尝试使用其他关键词搜索</p>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

