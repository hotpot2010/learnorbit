import { type NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, messages } = body;

    console.log('\n=== 📤 调用课程定制API（非流式） ===');
    console.log('SessionId:', id);
    console.log('消息数量:', messages?.length || 0);

    if (messages && messages.length > 0) {
      console.log('最后一条消息:', messages[messages.length - 1]);
    }

    // 构造发送给外部API的数据
    const externalApiData = {
      id,
      messages,
    };

    const externalApiUrl =
      process.env.NEXT_PUBLIC_EXTERNAL_API_URL || 'http://172.30.106.167:5000';
    const url = `${externalApiUrl}/api/chat1/stream`;

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

    // 直接返回JSON响应，而不是流式响应
    const result = await response.json();
    console.log('外部API返回结果:', result);

    // 确保返回的格式符合要求
    const formattedResult = {
      response: result.response || '我来帮您分析学习需求并生成个性化课程计划。',
      updateSteps: result.updateSteps || [],
      reason: result.reason || '',
    };

    console.log('格式化后的结果:', formattedResult);
    return NextResponse.json(formattedResult);
  } catch (error) {
    console.error('API路由错误:', error);
    return NextResponse.json(
      {
        error: '服务暂时不可用',
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
