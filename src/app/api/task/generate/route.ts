import {
  type TaskGenerateRequest,
  TaskGenerateResponse,
} from '@/types/learning-plan';
import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getApiRequestContext, enhanceApiRequest } from '@/lib/api-utils';

const EXTERNAL_API_URL =
  process.env.EXTERNAL_API_URL || 'http://172.30.106.167:5000';

// 重试配置
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1秒基础延迟
  maxDelay: 10000, // 最大延迟10秒
  backoffMultiplier: 2, // 指数退避倍数
};

// 判断是否应该重试的错误类型
const shouldRetry = (error: any): boolean => {
  // 网络连接错误
  if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
    return true;
  }
  
  // fetch failed 错误
  if (error.message?.includes('fetch failed')) {
    return true;
  }
  
  // HTTP 5xx 服务器错误
  if (error.status >= 500 && error.status < 600) {
    return true;
  }
  
  return false;
};

// 延迟函数
const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// 带重试的fetch函数
const fetchWithRetry = async (url: string, options: RequestInit, retryCount = 0): Promise<Response> => {
  try {
    console.log(`🔄 尝试调用外部API (第${retryCount + 1}次):`, url);
    
    const response = await fetch(url, options);
    
    // 如果是HTTP错误且应该重试
    if (!response.ok && shouldRetry({ status: response.status })) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }
    
    return response;
  } catch (error) {
    console.error(`❌ 第${retryCount + 1}次请求失败:`, error);
    
    // 检查是否应该重试
    if (retryCount < RETRY_CONFIG.maxRetries && shouldRetry(error)) {
      // 计算延迟时间（指数退避）
      const delayMs = Math.min(
        RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, retryCount),
        RETRY_CONFIG.maxDelay
      );
      
      console.log(`⏳ ${delayMs}ms后进行第${retryCount + 2}次重试...`);
      await delay(delayMs);
      
      return fetchWithRetry(url, options, retryCount + 1);
    }
    
    // 重试次数用完或不应该重试，抛出错误
    throw error;
  }
};

export async function POST(request: NextRequest) {
  try {
    const body: TaskGenerateRequest = await request.json();

    // 获取用户信息和语言设置
    const context = await getApiRequestContext(request);

    body.animation_type = '无';

    // 添加用户ID和语言字段，保留retrive_enabled参数
    const requestData = {
      ...enhanceApiRequest(body, context),
      ...(body.retrive_enabled && { retrive_enabled: body.retrive_enabled }),
    };



    console.log('📤 任务生成请求:', {
      step: body.step,
      title: body.title,
      type: body.type,
      difficulty: body.difficulty,
      retrive_enabled: body.retrive_enabled ? '已启用' : '未启用',
      userId: context.userId || 'anonymous',
      lang: context.lang,
      externalUrl: `${EXTERNAL_API_URL}/api/task/generate`,
      retryConfig: RETRY_CONFIG
    });

    // 使用带重试机制的fetch调用外部API
    const response = await fetchWithRetry(`${EXTERNAL_API_URL}/api/task/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(requestData),
    });

    console.log('📥 外部API响应状态:', response.status, response.statusText);

    const result = await response.json();
    console.log('✅ 外部API返回结果:', {
      success: result.success,
      taskType: result.task?.type,
      hasQuestions: !!result.task?.questions,
      hasTask: !!result.task?.task,
      videoCount: result.task?.videos?.length || 0,
    });

    // 直接返回外部API的响应
    return NextResponse.json(result);
  } catch (error) {
    console.error('🚨 代理API错误 (所有重试已用完):', error);

    // 返回错误响应，前端会使用fallback数据
    return NextResponse.json(
      {
        success: false,
        error: 'External API call failed after retries',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: `Failed to connect to ${EXTERNAL_API_URL}/api/task/generate after ${RETRY_CONFIG.maxRetries} retries`,
        retryAttempts: RETRY_CONFIG.maxRetries,
      },
      { status: 500 }
    );
  }
}
