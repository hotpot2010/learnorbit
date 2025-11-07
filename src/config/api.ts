/**
 * API 配置
 * 根据环境自动选择正确的后端地址
 */

/**
 * 获取后端 API 基础 URL
 * 
 * 优先级：
 * 1. 环境变量 NEXT_PUBLIC_API_URL
 * 2. 默认使用线上后端：https://video-improvements.zeabur.app
 * 
 * 注意：本地开发也使用线上后端进行测试
 */
export const getApiBaseUrl = (): string => {
  // 1. 检查环境变量（可以覆盖为本地后端）
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // 2. 默认使用线上后端（本地和生产环境都使用）
  return 'https://video-improvements.zeabur.app';
};

/**
 * API 端点配置
 */
export const API_ENDPOINTS = {
  // 批量分析
  batchJobs: '/batch/jobs',
  batchAnalyzePart: '/batch/analyze-part',
  batchResults: '/batch/results',
  
  // 笔记和学习
  notesGenerate: '/notes/generate',
  notesAnswerQuestion: '/notes/answer-question',
  notesGenerateExercise: '/notes/generate-exercise',
  notesExecuteCode: '/notes/execute-code',
  notesValidateAnswer: '/notes/validate-answer',
  
  // 视频搜索
  videoSearch: '/video-search/search',
} as const;

/**
 * 构建完整的 API URL
 */
export const buildApiUrl = (endpoint: string): string => {
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}${endpoint}`;
};

/**
 * API 客户端配置
 */
export const API_CONFIG = {
  timeout: 300000, // 5分钟超时
  headers: {
    'Content-Type': 'application/json',
  },
};

// 导出基础 URL 用于显示
export const API_BASE_URL = getApiBaseUrl();

