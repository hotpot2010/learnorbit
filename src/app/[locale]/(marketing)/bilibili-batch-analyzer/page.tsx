'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Play, 
  Plus, 
  Trash2, 
  Download, 
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Video,
  Sparkles,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { buildApiUrl, API_ENDPOINTS } from '@/config/api';

// Types
interface VideoInfo {
  bv_id: string;
  title: string;
  description: string;
  duration: number;
  uploader: string;
  upload_date: string;
  view_count: number;
  like_count: number;
  thumbnail: string;
  url: string;
}

interface KnowledgePoint {
  name: string;
  start_time: string;
  end_time: string;
}

interface JobResult {
  success: boolean;
  video_info?: VideoInfo;
  video_url?: string;  // 视频URL（用于错误显示）
  analysis?: {
    success: boolean;
    result?: {
      knowledge_points?: KnowledgePoint[];
      knowledge_point_count?: number;
      content?: string;
      transcript?: string;
    };
    text?: string;  // Gemini 方法返回的文本
  };
  error?: string;
  analyzed_at: string;
}

interface Job {
  job_id: string;
  job_name: string;
  created_at: string;
  status: 'created' | 'running' | 'completed' | 'failed';
  total_videos: number;
  completed_videos: number;
  failed_videos: number;
  progress?: number;
  results: JobResult[];
  errors: JobResult[];
  video_urls: string[];
  prompt: string;
}

interface SavedJob {
  filename: string;
  filepath: string;
  job_name: string;
  created_at: string;
  total_videos: number;
  completed_videos: number;
  failed_videos: number;
}

export default function BilibiliBatchAnalyzerPage() {
  // 默认 Prompt
  const DEFAULT_PROMPT = `请分析这个视频的内容，生成一个详细的摘要和时间轴。

要求：
1. 提取视频的核心主题和关键知识点
2. 按照时间顺序生成详细的时间轴（格式：MM:SS - 内容描述）
3. 为每个重要部分添加简短的总结
4. 标注重点和难点
5. 用 Markdown 格式输出

输出格式：
# 视频摘要
（整体概述）

## 详细时间轴
- 00:00 - 开场介绍
- 00:30 - 第一个知识点
...

## 重点总结
（核心要点列表）`;

  // State
  const [videoUrls, setVideoUrls] = useState<string[]>(['']);
  const [customPrompt, setCustomPrompt] = useState<string>(DEFAULT_PROMPT);
  const [jobName, setJobName] = useState<string>('');
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [selectedJobResults, setSelectedJobResults] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [expandedResults, setExpandedResults] = useState<Set<number>>(new Set());

  // Fetch saved jobs on mount
  useEffect(() => {
    fetchSavedJobs();
  }, []);

  // Poll job status
  useEffect(() => {
    if (currentJob && currentJob.status === 'running') {
      const interval = setInterval(() => {
        fetchJobStatus(currentJob.job_id);
      }, 5000);  // 改为5秒轮询一次，减少请求频率
      return () => clearInterval(interval);
    }
  }, [currentJob]);

  const fetchSavedJobs = async () => {
    try {
      const response = await fetch(buildApiUrl(API_ENDPOINTS.batchJobs));
      const data = await response.json();
      if (data.success) {
        setSavedJobs(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch saved jobs:', error);
    }
  };

  const fetchJobStatus = async (jobId: string) => {
    try {
      const response = await fetch(buildApiUrl(`${API_ENDPOINTS.batchJobs}/${jobId}`));
      const data = await response.json();
      
      if (data.success) {
        setCurrentJob(data.data);
        
        // If job completed, refresh saved jobs list
        if (data.data.status === 'completed' || data.data.status === 'failed') {
          fetchSavedJobs();
        }
      } else {
        // 任务不存在或失败，停止轮询
        console.warn('Job not found or failed:', data);
        setCurrentJob(prev => prev ? {
          ...prev,
          status: 'failed',
          errors: [{
            video_url: '',
            success: false,
            error: data.data?.message || 'Job not found',
            analyzed_at: new Date().toISOString()
          }]
        } : null);
      }
    } catch (error) {
      console.error('Failed to fetch job status:', error);
      // 网络错误时也停止轮询
      setCurrentJob(prev => prev ? {
        ...prev,
        status: 'failed',
        errors: [{
          video_url: '',
          success: false,
          error: 'Failed to fetch job status',
          analyzed_at: new Date().toISOString()
        }]
      } : null);
    }
  };

  const fetchJobResults = async (filename: string) => {
    try {
      const response = await fetch(buildApiUrl(`${API_ENDPOINTS.batchResults}/${filename}`));
      const data = await response.json();
      if (data.success) {
        setSelectedJobResults(data.data);
        setActiveTab('history');
      }
    } catch (error) {
      console.error('Failed to fetch job results:', error);
    }
  };

  const handleAddUrl = () => {
    setVideoUrls([...videoUrls, '']);
  };

  const handleRemoveUrl = (index: number) => {
    setVideoUrls(videoUrls.filter((_, i) => i !== index));
  };

  const handleUrlChange = (index: number, value: string) => {
    const newUrls = [...videoUrls];
    newUrls[index] = value;
    setVideoUrls(newUrls);
  };

  const handleStartJob = async () => {
    const validUrls = videoUrls.filter(url => url.trim() !== '');
    
    if (validUrls.length === 0) {
      alert('请至少添加一个视频URL');
      return;
    }
    
    if (!customPrompt.trim()) {
      alert('请选择或输入Prompt');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(buildApiUrl(API_ENDPOINTS.batchJobs), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_urls: validUrls,
          prompt: customPrompt,
          job_name: jobName || undefined,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        // Start polling for job status
        setCurrentJob({
          job_id: data.job_id,
          job_name: jobName || 'Untitled Job',
          created_at: new Date().toISOString(),
          status: 'running',
          total_videos: validUrls.length,
          completed_videos: 0,
          failed_videos: 0,
          results: [],
          errors: [],
          video_urls: validUrls,
          prompt: customPrompt,
        });
      } else {
        alert('创建任务失败: ' + data.detail);
      }
    } catch (error) {
      console.error('Failed to start job:', error);
      alert('创建任务失败');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleResultExpansion = (index: number) => {
    const newExpanded = new Set(expandedResults);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedResults(newExpanded);
  };

  const downloadResults = (job: Job) => {
    const dataStr = JSON.stringify(job, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${job.job_name.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2 transform -rotate-1" style={{ fontFamily: '"Comic Sans MS", "Marker Felt", cursive' }}>
            🎬 B站视频批量解析工具
          </h1>
          <p className="text-gray-600">使用 Gemini AI 批量分析 Bilibili 视频内容</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <Button
            onClick={() => setActiveTab('create')}
            variant={activeTab === 'create' ? 'default' : 'outline'}
            className="flex-1"
          >
            <Plus className="w-4 h-4 mr-2" />
            创建新任务
          </Button>
          <Button
            onClick={() => {
              setActiveTab('history');
              fetchSavedJobs();
            }}
            variant={activeTab === 'history' ? 'default' : 'outline'}
            className="flex-1"
          >
            <FileText className="w-4 h-4 mr-2" />
            历史记录
          </Button>
        </div>

        {/* Create Tab */}
        {activeTab === 'create' && (
          <div className="space-y-6">
            {/* Job Name */}
            <Card className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-200">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <Sparkles className="w-5 h-5 mr-2 text-purple-500" />
                任务名称
              </h2>
              <input
                type="text"
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                placeholder="例如：Python 基础教程批量解析"
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
              />
            </Card>

            {/* Video URLs */}
            <Card className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800 flex items-center">
                  <Video className="w-5 h-5 mr-2 text-purple-500" />
                  视频列表
                </h2>
                <Button onClick={handleAddUrl} size="sm" variant="outline">
                  <Plus className="w-4 h-4 mr-1" />
                  添加视频
                </Button>
              </div>
              <div className="space-y-3">
                {videoUrls.map((url, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => handleUrlChange(index, e.target.value)}
                      placeholder="输入 B站视频URL 或 BV号 (例如: BV1xx411xxx)"
                      className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                    />
                    {videoUrls.length > 1 && (
                      <Button
                        onClick={() => handleRemoveUrl(index)}
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* Analysis Prompt */}
            <Card className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800 flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-purple-500" />
                  分析配置
                </h2>
                <Button
                  onClick={() => setCustomPrompt(DEFAULT_PROMPT)}
                  size="sm"
                  variant="ghost"
                  className="text-sm text-purple-600 hover:text-purple-700"
                >
                  重置为默认
                </Button>
              </div>
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">默认配置：生成视频摘要和时间轴</p>
                    <p className="text-blue-600">AI 会自动提取视频核心内容，并按时间顺序整理关键点</p>
                  </div>
                </div>
              </div>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="输入自定义的分析提示词..."
                rows={12}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none font-mono text-sm resize-none"
              />
              <div className="text-xs text-gray-500 mt-2">
                💡 提示：您可以自定义分析要求，例如：只提取时间轴、生成测试题、总结关键知识点等
              </div>
            </Card>

            {/* Start Button */}
            <Button
              onClick={handleStartJob}
              disabled={isLoading || (currentJob?.status === 'running')}
              className="w-full py-6 text-lg font-bold"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  创建中...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  开始批量解析
                </>
              )}
            </Button>

            {/* Current Job Progress */}
            {currentJob && (
              <>
                <Card className="bg-white rounded-xl shadow-lg p-6 border-2 border-purple-300">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center">
                      <Clock className="w-5 h-5 mr-2 text-purple-500 animate-spin" />
                      当前任务进度
                    </h2>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      currentJob.status === 'completed' ? 'bg-green-100 text-green-700' :
                      currentJob.status === 'running' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {currentJob.status === 'completed' ? '✅ 已完成' :
                       currentJob.status === 'running' ? '🏃 进行中' :
                       '⏳ 等待中'}
                    </span>
                  </div>
                  
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>{currentJob.job_name}</span>
                      <span>{currentJob.completed_videos} / {currentJob.total_videos}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <div
                        className="bg-gradient-to-r from-purple-500 to-pink-500 h-4 rounded-full transition-all duration-300"
                        style={{ width: `${(currentJob.completed_videos / currentJob.total_videos) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-green-600">{currentJob.completed_videos}</div>
                      <div className="text-sm text-gray-600">成功</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-red-600">{currentJob.failed_videos}</div>
                      <div className="text-sm text-gray-600">失败</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-600">{currentJob.total_videos - currentJob.completed_videos - currentJob.failed_videos}</div>
                      <div className="text-sm text-gray-600">待处理</div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-4 flex gap-2">
                    {currentJob.status === 'running' && (
                      <Button
                        onClick={() => setCurrentJob(prev => prev ? {...prev, status: 'completed'} : null)}
                        className="flex-1"
                        variant="outline"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        停止轮询
                      </Button>
                    )}
                    {(currentJob.status === 'completed' || currentJob.status === 'failed') && (
                      <Button
                        onClick={() => downloadResults(currentJob)}
                        className="flex-1"
                        variant="outline"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        下载结果
                      </Button>
                    )}
                    <Button
                      onClick={() => setCurrentJob(null)}
                      variant="ghost"
                      size="sm"
                    >
                      清除
                    </Button>
                  </div>
                </Card>

                {/* Knowledge Points Display */}
                {currentJob.results.length > 0 && (() => {
                  // 合并所有视频的知识点
                  const allKnowledgePoints: Array<KnowledgePoint & { videoTitle?: string }> = [];
                  currentJob.results.forEach((result) => {
                    // 数据结构：result.analysis.result.knowledge_points
                    const knowledgePoints = result.analysis?.result?.knowledge_points || [];
                    knowledgePoints.forEach(point => {
                      allKnowledgePoints.push({
                        ...point,
                        videoTitle: result.video_info?.title
                      });
                    });
                  });

                  if (allKnowledgePoints.length === 0) return null;

                  return (
                    <Card className="bg-white rounded-xl shadow-lg p-6 border-2 border-green-300 mt-6">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center">
                          <Sparkles className="w-5 h-5 mr-2 text-green-500" />
                          提取的知识点
                        </h2>
                        <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                          共 {allKnowledgePoints.length} 个知识点
                        </div>
                      </div>

                      <div className="space-y-2 max-h-[500px] overflow-y-auto">
                        {allKnowledgePoints.map((point, index) => (
                          <div
                            key={index}
                            className="flex items-start gap-3 p-3 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200 hover:shadow-md transition-all"
                          >
                            <div className="flex-shrink-0 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-800 mb-1">
                                {point.name}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Clock className="w-3 h-3" />
                                <span className="font-mono">
                                  {point.start_time} - {point.end_time}
                                </span>
                                {point.videoTitle && currentJob.total_videos > 1 && (
                                  <>
                                    <span className="text-gray-400">|</span>
                                    <Video className="w-3 h-3" />
                                    <span className="truncate">{point.videoTitle}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* 导出知识点按钮 */}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <Button
                          onClick={() => {
                            const dataStr = JSON.stringify(allKnowledgePoints, null, 2);
                            const dataBlob = new Blob([dataStr], { type: 'application/json' });
                            const url = URL.createObjectURL(dataBlob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `knowledge_points_${new Date().toISOString().split('T')[0]}.json`;
                            link.click();
                            URL.revokeObjectURL(url);
                          }}
                          variant="outline"
                          size="sm"
                          className="w-full"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          导出知识点列表
                        </Button>
                      </div>
                    </Card>
                  );
                })()}
              </>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            {!selectedJobResults ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-800">历史任务</h2>
                  <Button onClick={fetchSavedJobs} size="sm" variant="outline">
                    <RefreshCw className="w-4 h-4 mr-1" />
                    刷新
                  </Button>
                </div>
                
                {savedJobs.length === 0 ? (
                  <Card className="bg-white rounded-xl shadow-lg p-12 border-2 border-gray-200 text-center">
                    <div className="text-6xl mb-4">📂</div>
                    <h3 className="text-xl font-bold text-gray-700 mb-2">还没有历史记录</h3>
                    <p className="text-gray-500">创建第一个批量解析任务吧！</p>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {savedJobs.map((job) => (
                      <Card
                        key={job.filename}
                        className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-200 hover:border-purple-400 hover:shadow-lg transition-all cursor-pointer"
                        onClick={() => fetchJobResults(job.filename)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-800 mb-2">{job.job_name}</h3>
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <span>📅 {new Date(job.created_at).toLocaleString('zh-CN')}</span>
                              <span>📊 {job.total_videos} 个视频</span>
                              <span className="text-green-600">✅ {job.completed_videos}</span>
                              <span className="text-red-600">❌ {job.failed_videos}</span>
                            </div>
                          </div>
                          <Button size="sm" variant="ghost">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Job Results View */}
                <Button
                  onClick={() => setSelectedJobResults(null)}
                  variant="outline"
                  className="mb-4"
                >
                  ← 返回列表
                </Button>

                <Card className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-200 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-gray-800">{selectedJobResults.job_name}</h2>
                    <Button onClick={() => downloadResults(selectedJobResults)} variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      下载
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-3xl font-bold text-green-600">{selectedJobResults.completed_videos}</div>
                      <div className="text-sm text-gray-600">成功解析</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-red-600">{selectedJobResults.failed_videos}</div>
                      <div className="text-sm text-gray-600">解析失败</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-gray-600">{selectedJobResults.total_videos}</div>
                      <div className="text-sm text-gray-600">总计</div>
                    </div>
                  </div>
                </Card>

                {/* Results List */}
                <div className="space-y-4">
                  {selectedJobResults.results.map((result, index) => {
                    const isExpanded = expandedResults.has(index);
                    
                    return (
                      <Card key={index} className="bg-white rounded-xl shadow-md border-2 border-gray-200">
                        <div
                          className="p-6 cursor-pointer hover:bg-gray-50"
                          onClick={() => toggleResultExpansion(index)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                                <h3 className="text-lg font-bold text-gray-800">{result.video_info?.title}</h3>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-gray-600">
                                <span>🆔 {result.video_info?.bv_id}</span>
                                <span>👤 {result.video_info?.uploader}</span>
                                <span>⏱️ {Math.floor((result.video_info?.duration || 0) / 60)} 分钟</span>
                              </div>
                            </div>
                            <div className="text-gray-400">
                              {isExpanded ? <ChevronUp /> : <ChevronDown />}
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t-2 border-gray-200 p-6 bg-gray-50">
                            <h4 className="font-bold text-gray-800 mb-3">📊 分析结果</h4>
                            <div className="prose prose-sm max-w-none bg-white rounded-lg p-4 border border-gray-200">
                              <ReactMarkdown>
                                {typeof result.analysis?.text === 'string' 
                                  ? result.analysis.text 
                                  : JSON.stringify(result.analysis, null, 2)}
                              </ReactMarkdown>
                            </div>
                          </div>
                        )}
                      </Card>
                    );
                  })}

                  {/* Errors */}
                  {selectedJobResults.errors.length > 0 && (
                    <div className="mt-8">
                      <h3 className="text-xl font-bold text-red-600 mb-4">❌ 失败记录</h3>
                      {selectedJobResults.errors.map((error, index) => (
                        <Card key={index} className="bg-red-50 rounded-xl shadow-md p-6 border-2 border-red-200 mb-3">
                          <div className="flex items-start gap-3">
                            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-1" />
                            <div>
                              <div className="font-bold text-red-800">{error.video_url}</div>
                              <div className="text-sm text-red-600 mt-1">{error.error}</div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


