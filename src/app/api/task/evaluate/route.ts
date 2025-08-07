import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { type TaskEvaluateRequest } from '@/types/learning-plan';
import { getApiRequestContext, enhanceApiRequest } from '@/lib/api-utils';

const EXTERNAL_API_URL =
  process.env.EXTERNAL_API_URL || 'http://172.30.106.167:5000';

export async function POST(request: NextRequest) {
  try {
    const requestData: TaskEvaluateRequest = await request.json();

    // 获取用户信息和语言设置
    const context = await getApiRequestContext(request);

    // 添加用户ID和语言字段
    const enhancedRequestData = enhanceApiRequest(requestData, context);

    console.log('🔧 环境变量调试信息 (evaluate):', {
      'process.env.EXTERNAL_API_URL': process.env.EXTERNAL_API_URL,
      EXTERNAL_API_URL常量: EXTERNAL_API_URL,
      最终请求URL: `${EXTERNAL_API_URL}/api/task/evaluate`,
    });
    console.log('📤 代理转发评估请求:', {
      task_type: requestData.task_type,
      submission_length: Array.isArray(requestData.submission)
        ? requestData.submission.length
        : typeof requestData.submission,
      has_task_data: !!requestData.task_data,
      userId: context.userId || 'anonymous',
      lang: context.lang,
    });

    // 转发请求到外部API
    const response = await fetch(`${EXTERNAL_API_URL}/api/task/evaluate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(enhancedRequestData),
    });

    console.log('📥 外部API响应状态:', response.status, response.statusText);

    if (!response.ok) {
      console.error(
        '❌ 外部评估API请求失败:',
        response.status,
        response.statusText
      );
      throw new Error(
        `External API error: ${response.status} ${response.statusText}`
      );
    }

    const result = await response.json();
    console.log('✅ 外部评估API返回结果:', {
      is_correct: result.is_correct,
      has_incorrect_indices: !!result.incorrect_indices,
      has_feedback: !!result.feedback,
      error_reason: result.error_reason,
    });

    // 直接返回外部API的响应
    return NextResponse.json(result);
  } catch (error) {
    console.error('🚨 评估API代理错误:', error);

    // 返回错误响应，前端会使用fallback数据
    return NextResponse.json(
      {
        success: false,
        error: 'External evaluation API call failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: `Failed to connect to ${EXTERNAL_API_URL}/api/task/evaluate`,
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
