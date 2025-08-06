import { type NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, messages, advise } = body;

    console.log('\n=== 📤 调用流式学习计划生成API ===');
    console.log('SessionId:', id);
    console.log('消息数量:', messages?.length || 0);
    console.log('建议信息:', advise);

    if (messages && messages.length > 0) {
      console.log('最后一条消息:', messages[messages.length - 1]);
    }

    // 构造发送给外部API的数据
    const externalApiData = {
      id,
      messages,
      ...(advise && { advise }),
    };

    const externalApiUrl =
      process.env.NEXT_PUBLIC_EXTERNAL_API_URL || 'http://172.30.106.167:5001';
    const url = `${externalApiUrl}/api/learning/plan/stream_generate`;

    console.log('外部API URL:', url);
    console.log('发送数据:', JSON.stringify(externalApiData, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(externalApiData),
    });

    console.log('外部API响应状态:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('外部API错误:', errorText);
      throw new Error(`外部API错误: ${response.status} ${errorText}`);
    }

    // 返回流式响应
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('API路由错误:', error);
    return NextResponse.json(
      {
        error: '学习计划生成服务暂时不可用',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
