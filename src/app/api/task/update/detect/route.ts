import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { task_data, user_message, lang, chat_id } = body;

    console.log('🔍 Task Update Detect API 调用');
    console.log('Chat ID:', chat_id);
    console.log('User Message:', user_message);
    console.log('Language:', lang);
    console.log('Task Data Keys:', Object.keys(task_data || {}));

    // 转发请求到外部API
    const externalAPIUrl = process.env.NEXT_PUBLIC_EXTERNAL_API_URL || 'https://study-platform.zeabur.app';
    const response = await fetch(`${externalAPIUrl}/api/task/update/detect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task_data,
        user_message,
        lang,
        chat_id
      }),
    });

    if (!response.ok) {
      console.error('外部 Detect API 调用失败:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'External API call failed' }, 
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log('✅ Detect API 响应:', result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Detect API 路由错误:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
