import { NextRequest, NextResponse } from 'next/server';

const EXTERNAL_API_URL = process.env.EXTERNAL_API_URL || 'http://172.30.106.167:5000';

export async function POST(request: NextRequest) {
  try {
    const requestData = await request.json();
    console.log('🔧 环境变量调试信息 (suggest_questions):', {
      'process.env.EXTERNAL_API_URL': process.env.EXTERNAL_API_URL,
      'EXTERNAL_API_URL常量': EXTERNAL_API_URL,
      '最终请求URL': `${EXTERNAL_API_URL}/api/ai/suggest_questions`
    });
    console.log('📤 代理转发问题推荐请求:', {
      task_title: requestData.task_title,
      has_task_description: !!requestData.task_description,
      has_user_submission: !!requestData.user_submission,
      has_error_reason: !!requestData.error_reason
    });

    // 转发请求到外部API
    const response = await fetch(`${EXTERNAL_API_URL}/api/ai/suggest_questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestData),
    });

    console.log('📥 外部API响应状态:', response.status, response.statusText);

    if (!response.ok) {
      console.error('❌ 外部问题推荐API请求失败:', response.status, response.statusText);
      throw new Error(`External API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ 外部问题推荐API返回结果:', {
      questions_count: result.questions?.length || 0,
      questions: result.questions
    });

    // 直接返回外部API的响应
    return NextResponse.json(result);

  } catch (error) {
    console.error('🚨 问题推荐API代理错误:', error);
    
    // 返回错误响应，前端会使用fallback数据
    return NextResponse.json(
      { 
        success: false, 
        error: 'External suggest questions API call failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: `Failed to connect to ${EXTERNAL_API_URL}/api/ai/suggest_questions`,
        // 提供默认的推荐问题作为降级方案
        questions: [
          "这个概念的核心要点是什么？",
          "能否提供一个具体的例子？",
          "这与其他相关概念有什么区别？"
        ]
      }, 
      { status: 200 } // 使用200状态码，因为我们提供了降级数据
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