/**
 * Next.js API 代理路由
 * 用于解决 CORS 问题，将前端请求代理到后端
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = 'https://learnorbit.gaotu.cn';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path, 'DELETE');
}

async function proxyRequest(
  request: NextRequest,
  pathArray: string[],
  method: string
) {
  try {
    // 构建目标 URL
    const targetPath = pathArray.join('/');
    const searchParams = request.nextUrl.searchParams.toString();
    const targetUrl = `${BACKEND_URL}/${targetPath}${searchParams ? `?${searchParams}` : ''}`;

    console.log(`[Proxy] ${method} ${targetUrl}`);

    // 准备请求头
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // 准备请求选项
    const options: RequestInit = {
      method,
      headers,
    };

    // 对于有 body 的请求，添加请求体
    if (method !== 'GET' && method !== 'DELETE') {
      const body = await request.text();
      if (body) {
        options.body = body;
      }
    }

    // 发送请求到后端
    const response = await fetch(targetUrl, options);

    // 获取响应数据
    const data = await response.text();

    // 返回响应，包含 CORS 头
    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('[Proxy Error]', error);
    return NextResponse.json(
      { error: 'Proxy request failed', details: String(error) },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }
}

// 处理 OPTIONS 预检请求
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400', // 24小时
    },
  });
}

