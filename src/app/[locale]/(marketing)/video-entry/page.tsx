'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Play, 
  Loader2,
  Trash2
} from 'lucide-react';
import { useLocale } from 'next-intl';
import { useMobileLayout } from '@/hooks/use-mobile-layout';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useRouter } from 'next/navigation';

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

interface VideoNote {
  id: string;
  taskId: string;
  videoUrl: string;
  videoTitle: string | null;
  videoPlatform: string;
  title: string | null;
  description: string | null;
  totalKnowledgePoints: number;
  totalQAs: number;
  totalExercises: number;
  userNotesData: any;
  createdAt: string;
  updatedAt: string;
}

export default function VideoEntryPage() {
  const locale = useLocale();
  const { isMobile } = useMobileLayout();
  const currentUser = useCurrentUser();
  const router = useRouter();

  // 搜索相关状态
  const [searchQuery, setSearchQuery] = useState('');
  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState('');

  // 历史笔记状态
  const [userNotes, setUserNotes] = useState<VideoNote[]>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  // 生成用户隔离的缓存 key
  const getCacheKey = (baseName: string) => {
    const userId = currentUser?.id || 'guest';
    return `video-entry-${baseName}-${userId}`;
  };

  // 恢复搜索状态（从视频笔记页面返回或登录后返回）
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 使用用户隔离的 key
      const queryKey = getCacheKey('search-query');
      const resultsKey = getCacheKey('search-results');
      const hasSearchedKey = getCacheKey('has-searched');
      
      const savedQuery = sessionStorage.getItem(queryKey);
      const savedResults = sessionStorage.getItem(resultsKey);
      const savedHasSearched = sessionStorage.getItem(hasSearchedKey);
      
      if (savedQuery && savedResults && savedHasSearched === 'true') {
        console.log('🔄 恢复搜索状态:', { query: savedQuery, resultsCount: JSON.parse(savedResults).length });
        setSearchQuery(savedQuery);
        setVideos(JSON.parse(savedResults));
        setHasSearched(true);
        
        // 清除保存的状态
        sessionStorage.removeItem(queryKey);
        sessionStorage.removeItem(resultsKey);
        sessionStorage.removeItem(hasSearchedKey);
      }
    }
  }, [currentUser]);

  // 加载用户历史笔记
  useEffect(() => {
    const fetchUserNotes = async () => {
      if (!currentUser) {
        setUserNotes([]);
        return;
      }

      setIsLoadingNotes(true);
      try {
        const response = await fetch('/api/video-notes?limit=10');
        const data = await response.json();
        
        if (data.success && data.notes) {
          console.log('✅ 加载用户历史笔记:', data.notes.length);
          setUserNotes(data.notes);
        }
      } catch (error) {
        console.error('❌ 加载历史笔记失败:', error);
      } finally {
        setIsLoadingNotes(false);
      }
    };

    fetchUserNotes();
  }, [currentUser]);

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
      console.log('🔍 从数据库搜索视频:', searchQuery);

      const response = await fetch(`/api/processed-videos?keyword=${encodeURIComponent(searchQuery)}`);

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
    // 保存当前搜索状态（使用用户隔离的 key）
    if (typeof window !== 'undefined' && searchQuery && videos.length > 0) {
      const queryKey = getCacheKey('search-query');
      const resultsKey = getCacheKey('search-results');
      const hasSearchedKey = getCacheKey('has-searched');
      
      sessionStorage.setItem(queryKey, searchQuery);
      sessionStorage.setItem(resultsKey, JSON.stringify(videos));
      sessionStorage.setItem(hasSearchedKey, 'true');
      console.log('💾 保存搜索状态:', { query: searchQuery, resultsCount: videos.length, userId: currentUser?.id || 'guest' });
    }

    // 检查用户是否登录
    if (!currentUser) {
      // 跳转到登录页面，设置回调 URL
      const currentPath = window.location.pathname;
      router.push(`/${locale}/auth/login?callbackUrl=${encodeURIComponent(currentPath)}`);
      return;
    }

    // 已登录，正常跳转到学习页面
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

  // 继续学习（从历史笔记）
  const handleContinueLearning = (note: VideoNote) => {
    // 保存当前搜索状态（如果有）
    if (typeof window !== 'undefined' && searchQuery && videos.length > 0) {
      const queryKey = getCacheKey('search-query');
      const resultsKey = getCacheKey('search-results');
      const hasSearchedKey = getCacheKey('has-searched');
      
      sessionStorage.setItem(queryKey, searchQuery);
      sessionStorage.setItem(resultsKey, JSON.stringify(videos));
      sessionStorage.setItem(hasSearchedKey, 'true');
    }

    // 跳转到学习页面
    const params = new URLSearchParams({
      videoUrl: note.videoUrl,
      taskId: note.taskId,
      processed: 'true',
    });

    const targetUrl = `/${locale}/video-notes-prototype?${params.toString()}`;
    window.location.href = targetUrl;
  };

  // 删除笔记
  const handleDeleteNote = async (noteId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // 防止触发卡片点击

    if (!confirm('确定要删除这条笔记吗？此操作无法撤销。')) {
      return;
    }

    setDeletingNoteId(noteId);

    try {
      const response = await fetch(`/api/video-notes/${noteId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ 笔记删除成功:', noteId);
        // 从列表中移除已删除的笔记
        setUserNotes(prev => prev.filter(note => note.id !== noteId));
      } else {
        throw new Error(data.error || '删除失败');
      }
    } catch (error) {
      console.error('❌ 删除笔记失败:', error);
      alert(`删除失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setDeletingNoteId(null);
    }
  };

  // 格式化播放量
  const formatPlayCount = (play: number): string => {
    if (play === 0) return '--'; // 没有播放数据时显示 --
    if (play > 10000) return `${(play / 10000).toFixed(1)}万`;
    if (play > 1000) return `${(play / 1000).toFixed(1)}k`;
    return play.toString();
  };

  // 获取封面URL（优先使用CDN）
  const getCoverUrl = (video: VideoInfo): string => {
    const url = video.thumbnail_cdn || video.cover || '';
    console.log(`🖼️ 获取封面URL - 标题: ${video.title.substring(0, 30)}... | CDN: ${video.thumbnail_cdn || '无'} | Cover: ${video.cover || '无'} | 最终: ${url || '无'}`);
    return url;
  };

  // 格式化相对时间
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
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

          {/* 历史笔记 - 未搜索时显示在输入框下方 */}
          {currentUser && userNotes.length > 0 && (
            <div className="w-full max-w-2xl px-4 mt-12">
              <h2 
                className="text-2xl font-bold mb-4 flex items-center gap-2"
                style={{ fontFamily }}
              >
                <span className="bg-blue-100 px-3 py-1 rounded-lg">📚 我的学习笔记</span>
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {userNotes.slice(0, 6).map((note) => (
                  <div
                    key={note.id}
                    onClick={() => handleContinueLearning(note)}
                    className="bg-white rounded-lg shadow-sm border-2 border-gray-200 p-4 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer relative group"
                    style={{ fontFamily }}
                  >
                    {/* 删除按钮 - 悬停显示 */}
                    <button
                      onClick={(e) => handleDeleteNote(note.id, e)}
                      disabled={deletingNoteId === note.id}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed z-10"
                      title="删除笔记"
                    >
                      {deletingNoteId === note.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>

                    <h3 className="font-bold text-gray-800 line-clamp-2 text-base mb-2 pr-8">
                      {note.videoTitle || note.title || '未命名笔记'}
                    </h3>
                    
                    <div className="flex gap-2 mb-3 flex-wrap">
                      {note.totalKnowledgePoints > 0 && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                          📖 {note.totalKnowledgePoints} 知识点
                        </span>
                      )}
                      {note.totalQAs > 0 && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                          💬 {note.totalQAs} 问答
                        </span>
                      )}
                      {note.totalExercises > 0 && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                          ✏️ {note.totalExercises} 练习
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>更新于 {formatRelativeTime(note.updatedAt)}</span>
                      <span className="text-blue-600 font-medium">继续学习 →</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* 已搜索时：显示搜索栏和结果列表 */}
      {hasSearched && (
        <div className="container mx-auto">
          {/* 顶部搜索栏 - 保持与未搜索时相同宽度 */}
          <div className="max-w-2xl mx-auto mb-8 px-4">
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

          {/* 搜索结果和历史笔记的布局 */}
          <div className={`flex gap-6 ${currentUser && userNotes.length > 0 ? 'justify-center' : ''}`}>
            {/* 左侧：历史笔记 - 仅在有笔记时显示 */}
            {currentUser && userNotes.length > 0 && (
              <div className="w-80 flex-shrink-0 hidden lg:block">
                <div className="sticky top-4">
                  <h2 
                    className="text-xl font-bold mb-4 flex items-center gap-2"
                    style={{ fontFamily }}
                  >
                    <span className="bg-blue-100 px-3 py-1 rounded-lg text-base">📚 我的笔记</span>
                  </h2>
                  
                  <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
                    {userNotes.slice(0, 10).map((note) => (
                      <div
                        key={note.id}
                        onClick={() => handleContinueLearning(note)}
                        className="bg-white rounded-lg shadow-sm border-2 border-gray-200 p-3 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer relative group"
                        style={{ fontFamily }}
                      >
                        {/* 删除按钮 - 悬停显示 */}
                        <button
                          onClick={(e) => handleDeleteNote(note.id, e)}
                          disabled={deletingNoteId === note.id}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed z-10"
                          title="删除笔记"
                        >
                          {deletingNoteId === note.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                        </button>

                        <h3 className="font-bold text-gray-800 line-clamp-2 text-sm mb-2 pr-6">
                          {note.videoTitle || note.title || '未命名笔记'}
                        </h3>
                        
                        <div className="flex gap-1 mb-2 flex-wrap">
                          {note.totalKnowledgePoints > 0 && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                              📖 {note.totalKnowledgePoints}
                            </span>
                          )}
                          {note.totalQAs > 0 && (
                            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                              💬 {note.totalQAs}
                            </span>
                          )}
                          {note.totalExercises > 0 && (
                            <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
                              ✏️ {note.totalExercises}
                            </span>
                          )}
                        </div>
                        
                        <div className="text-xs text-gray-500">
                          {formatRelativeTime(note.updatedAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 搜索结果列表 - 保持与搜索框相同宽度 */}
            <div className={`w-full ${currentUser && userNotes.length > 0 ? 'max-w-2xl' : 'max-w-2xl mx-auto'} px-4`}>
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
                      <h3 className="font-bold text-gray-800 line-clamp-2 text-base mb-2" title={video.title}>
                        {video.title}
                      </h3>
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
                      </div>
                      
                      <Button 
                        size="sm" 
                        variant="ghost"
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 -mr-2"
                        onClick={() => handleStartLearning(video)}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        {currentUser ? '开始学习' : '登录学习'}
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
          </div>
        </div>
      )}
    </div>
  );
}
