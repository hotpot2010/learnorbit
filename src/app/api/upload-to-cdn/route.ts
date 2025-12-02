/**
 * 文件上传到 CDN 的 API 路由
 * 专门用于在 Serverless 环境下上传文件
 */

import { NextRequest, NextResponse } from 'next/server';

// 在 Serverless 函数中，NEXT_PUBLIC_ 前缀的环境变量可能不可用
// 优先使用普通环境变量，回退到 NEXT_PUBLIC_API_URL
const API_BASE_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const UPLOAD_ENDPOINT = `${API_BASE_URL}/open-api/upload`;
const CDN_BASE_URL = 'http://file.gsxservice.com';

interface UploadResponse {
  total?: number;
  ok?: number;
  fail?: number;
  files?: Array<{
    key: string;
    url: string;
    [key: string]: any;
  }>;
  code?: number;
  data?: {
    url?: string;
    path?: string;
  };
  url?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { jsonContent, filename } = await request.json();

    if (!jsonContent || !filename) {
      return NextResponse.json(
        { error: 'Missing jsonContent or filename' },
        { status: 400 }
      );
    }

    console.error(`[upload-to-cdn] 📤 API Route: 上传文件到 CDN: ${filename} (${jsonContent.length} 字符)`);
    console.error(`[upload-to-cdn] 📍 Upload endpoint: ${UPLOAD_ENDPOINT}`);
    console.error(`[upload-to-cdn] 🔧 环境变量检查:`, {
      API_URL: process.env.API_URL,
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
      API_BASE_URL,
      UPLOAD_ENDPOINT
    });

    // 使用 form-data 库创建 multipart/form-data
    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    
    const buffer = Buffer.from(jsonContent, 'utf-8');
    formData.append('file0', buffer, {
      filename: filename,
      contentType: 'application/json',
    });

    // 获取 headers（包含 boundary）
    const headers = formData.getHeaders() as Record<string, string>;
    
    // 将 form-data 转换为 Buffer（在 Serverless 环境下更可靠）
    const formDataBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      formData.on('data', (chunk: Buffer) => chunks.push(chunk));
      formData.on('end', () => resolve(Buffer.concat(chunks)));
      formData.on('error', reject);
      formData.resume();
    });

    console.error(`[upload-to-cdn] 📦 Form data size: ${formDataBuffer.length} bytes`);

    // 使用 fetch 发送请求
    // 将 Buffer 转换为 Uint8Array 以符合 fetch body 的类型要求
    console.error(`[upload-to-cdn] 🚀 开始发送请求到后端 API...`);
    
    let response: Response;
    try {
      response = await fetch(UPLOAD_ENDPOINT, {
        method: 'POST',
        headers: headers,
        body: new Uint8Array(formDataBuffer),
      });
      
      console.error(`[upload-to-cdn] 📥 收到响应:`, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });
    } catch (fetchError) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
      console.error(`[upload-to-cdn] ❌ Fetch 请求失败:`, {
        error: errorMessage,
        endpoint: UPLOAD_ENDPOINT,
        stack: fetchError instanceof Error ? fetchError.stack : undefined
      });
      throw new Error(`无法连接到后端 API (${UPLOAD_ENDPOINT}): ${errorMessage}`);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[upload-to-cdn] ❌ 上传失败 (${response.status}): ${errorText}`);
      console.error(`[upload-to-cdn] 📍 请求 URL: ${UPLOAD_ENDPOINT}`);
      return NextResponse.json(
        { 
          error: `Upload failed: ${errorText}`,
          status: response.status,
          endpoint: UPLOAD_ENDPOINT
        },
        { status: response.status }
      );
    }

    const result: UploadResponse = await response.json();
    
    // 解析响应获取 URL
    let fileUrl: string | null = null;

    // 格式1: files 数组格式
    if (result.files && Array.isArray(result.files) && result.files.length > 0) {
      const fileInfo = result.files[0];
      fileUrl = fileInfo.url || fileInfo.path || null;
    }
    // 格式2: data 对象格式
    else if (result.code === 0 && result.data) {
      fileUrl = result.data.url || result.data.path || null;
    }
    // 格式3: 直接返回 URL
    else if (result.url) {
      fileUrl = result.url;
    }

    if (!fileUrl) {
      return NextResponse.json(
        { error: `无法从响应中提取URL: ${JSON.stringify(result)}` },
        { status: 500 }
      );
    }

    // 处理相对路径
    if (!fileUrl.startsWith('http')) {
      const normalizedPath = fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`;
      fileUrl = `${CDN_BASE_URL}${normalizedPath}`;
    }

    console.error(`[upload-to-cdn] ✅ 上传成功，CDN URL: ${fileUrl}`);
    return NextResponse.json({ url: fileUrl });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error(`[upload-to-cdn] ❌ 上传失败:`, {
      error: errorMessage,
      stack: errorStack,
      endpoint: UPLOAD_ENDPOINT
    });
    
    return NextResponse.json(
      { 
        error: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
        endpoint: UPLOAD_ENDPOINT
      },
      { status: 500 }
    );
  }
}

