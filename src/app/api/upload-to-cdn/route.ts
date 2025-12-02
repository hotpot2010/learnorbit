/**
 * 文件上传到 CDN 的 API 路由
 * 专门用于在 Serverless 环境下上传文件
 */

import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
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

    console.log(`📤 API Route: 上传文件到 CDN: ${filename} (${jsonContent.length} 字符)`);
    console.log(`📍 Upload endpoint: ${UPLOAD_ENDPOINT}`);

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
    
    // 确保 Content-Type 包含 boundary
    console.log(`📋 FormData headers:`, JSON.stringify(headers, null, 2));
    
    // 将 form-data 转换为 Buffer（在 Serverless 环境下更可靠）
    const formDataBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      formData.on('data', (chunk: Buffer) => chunks.push(chunk));
      formData.on('end', () => resolve(Buffer.concat(chunks)));
      formData.on('error', reject);
      formData.resume();
    });

    console.log(`📦 Form data size: ${formDataBuffer.length} bytes`);
    
    // 验证 Content-Type header
    if (!headers['content-type'] && !headers['Content-Type']) {
      console.warn(`⚠️  Warning: Content-Type header missing from formData.getHeaders()`);
    } else {
      const contentType = headers['content-type'] || headers['Content-Type'];
      console.log(`✅ Content-Type header: ${contentType}`);
    }

    // 使用 fetch 发送请求
    // 将 Buffer 转换为 Uint8Array 以符合 fetch body 的类型要求
    // 注意：确保 Content-Type header 被正确传递，不要被 fetch 自动修改
    const fetchHeaders = new Headers();
    for (const [key, value] of Object.entries(headers)) {
      fetchHeaders.set(key, value);
    }
    
    // 确保 Content-Type 被正确设置
    const contentType = headers['content-type'] || headers['Content-Type'];
    if (contentType) {
      fetchHeaders.set('Content-Type', contentType);
      console.log(`✅ 设置 Content-Type header: ${contentType}`);
    } else {
      console.warn(`⚠️  Content-Type header 缺失`);
    }
    
    console.log(`📤 发送请求到: ${UPLOAD_ENDPOINT}`);
    console.log(`📋 请求 Headers:`, Object.fromEntries(fetchHeaders.entries()));
    
    const response = await fetch(UPLOAD_ENDPOINT, {
      method: 'POST',
      headers: fetchHeaders,
      body: new Uint8Array(formDataBuffer),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`❌ 上传失败 (${response.status}): ${errorText}`);
      return NextResponse.json(
        { error: `Upload failed: ${errorText}` },
        { status: response.status }
      );
    }

    const result: UploadResponse = await response.json();
    
    // 记录完整的响应（用于调试）
    console.log(`📥 上传响应:`, JSON.stringify(result, null, 2));
    
    // 如果上传失败（ok=0 或 fail>0），记录详细信息
    if (result.ok === 0 || (result.fail && result.fail > 0)) {
      console.warn(`⚠️  上传失败: total=${result.total}, ok=${result.ok}, fail=${result.fail}`);
      console.warn(`   响应详情:`, JSON.stringify(result, null, 2));
      
      // 检查是否有错误信息字段
      const errorInfo = (result as any).errors || (result as any).message || (result as any).error || (result as any).detail;
      if (errorInfo) {
        console.warn(`   错误信息:`, errorInfo);
      }
      
      // 如果 files 数组为空，说明文件上传失败
      if (!result.files || result.files.length === 0) {
        const errorMsg = errorInfo 
          ? `文件上传失败: ${typeof errorInfo === 'string' ? errorInfo : JSON.stringify(errorInfo)}`
          : `文件上传失败: 后端返回 ok=0, fail=${result.fail}，但没有提供详细错误信息`;
        return NextResponse.json(
          { error: errorMsg },
          { status: 500 }
        );
      }
    }
    
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

    console.log(`✅ 上传成功，CDN URL: ${fileUrl}`);
    return NextResponse.json({ url: fileUrl });
  } catch (error) {
    console.error(`❌ 上传失败:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}

