import { NextRequest } from 'next/server';

const EXTERNAL_API_URL = process.env.EXTERNAL_API_URL || 'http://172.30.106.167:5000';

export async function POST(request: NextRequest) {
  try {
    const requestData = await request.json();
    console.log('🔧 环境变量调试信息 (chat1):', {
      'process.env.EXTERNAL_API_URL': process.env.EXTERNAL_API_URL,
      'EXTERNAL_API_URL常量': EXTERNAL_API_URL,
      '最终请求URL': `${EXTERNAL_API_URL}/api/chat1/stream`
    });
    console.log('代理转发 /api/chat1/stream 请求:', requestData);

    // 转发请求到外部API
    const response = await fetch(`${EXTERNAL_API_URL}/api/chat1/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });

    console.log('外部API响应状态:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // 返回流式响应
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('API代理错误:', error);
    return new Response(
      JSON.stringify({ error: '服务暂时不可用' }), 
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
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