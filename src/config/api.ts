/**
 * API 配置
 * 根据环境自动选择正确的后端地址
 */

/**
 * 获取后端 API 基础 URL
 * 
 * 优先级：
 * 1. 环境变量 NEXT_PUBLIC_API_URL
 * 2. 生产环境：使用 Next.js API 代理路由（解决 CORS 问题）
 * 3. 本地开发：使用线上后端直接测试
 * 
 * 注意：生产环境使用 /api/proxy 避免 CORS 问题
 */
export const getApiBaseUrl = (): string => {
  // 1. 检查环境变量（可以覆盖）
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // 2. 生产环境检测（Vercel 或其他部署平台）
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // 如果是生产域名，使用 API 代理路由避免 CORS
    if (hostname.includes('aitutorly.ai') || hostname.includes('vercel.app')) {
      return '/api/proxy';
    }
  }
  
  // 3. 本地开发：直接使用线上后端（本地开发环境通常没有 CORS 限制）
  return 'https://learnorbit.gaotu.cn';
};

/**
 * API 端点配置
 * 所有端点统一使用 /open-api 前缀
 */
export const API_ENDPOINTS = {
  // 批量分析
  batchJobs: '/open-api/batch/jobs',
  batchAnalyzePart: '/open-api/batch/analyze-part',
  batchResults: '/open-api/batch/results',
  batchGetPlayUrl: '/open-api/batch/get-play-url',
  
  // 笔记和学习
  notesGenerate: '/open-api/notes/generate',
  notesAnswerQuestion: '/open-api/notes/answer-question',
  notesGenerateExercise: '/open-api/notes/generate-exercise',
  notesExecuteCode: '/open-api/notes/execute-code',
  notesValidateAnswer: '/open-api/notes/validate-answer',
  
  // 视频搜索
  videoSearch: '/open-api/video-search/search',
  
  // 文件上传
  fileUpload: '/open-api/upload',
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

