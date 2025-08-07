import {
  type TaskGenerateRequest,
  TaskGenerateResponse,
} from '@/types/learning-plan';
import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getApiRequestContext, enhanceApiRequest } from '@/lib/api-utils';

const EXTERNAL_API_URL =
  process.env.EXTERNAL_API_URL || 'http://172.30.106.167:5000';

export async function POST(request: NextRequest) {
  try {
    const body: TaskGenerateRequest = await request.json();

    // 获取用户信息和语言设置
    const context = await getApiRequestContext(request);

    body.animation_type = '无';

    // 添加用户ID和语言字段
    const requestData = enhanceApiRequest(body, context);

    console.log('📤 任务生成请求:', {
      step: body.step,
      title: body.title,
      type: body.type,
      difficulty: body.difficulty,
      userId: context.userId || 'anonymous',
      lang: context.lang,
      externalUrl: `${EXTERNAL_API_URL}/api/task/generate`
    });

    // 调用外部API
    const response = await fetch(`${EXTERNAL_API_URL}/api/task/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(requestData),
    });

    console.log('📥 外部API响应状态:', response.status, response.statusText);

    if (!response.ok) {
      console.error(
        '❌ 外部API请求失败:',
        response.status,
        response.statusText
      );
      throw new Error(
        `External API error: ${response.status} ${response.statusText}`
      );
    }

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
    console.error('🚨 代理API错误:', error);

    // 返回错误响应，前端会使用fallback数据
    return NextResponse.json(
      {
        success: false,
        error: 'External API call failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: `Failed to connect to ${EXTERNAL_API_URL}/api/task/generate`,
      },
      { status: 500 }
    );
  }
}
