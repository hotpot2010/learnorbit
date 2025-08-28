import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // 获取外部API的URL
    const externalApiUrl = process.env.EXTERNAL_API_URL;
    if (!externalApiUrl) {
      return NextResponse.json(
        { error: 'External API URL not configured' },
        { status: 500 }
      );
    }

    // 直接转发FormData到外部API
    const formData = await request.formData();
    
    // 调用外部API
    const response = await fetch(`${externalApiUrl}/api/documents/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('External API error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Upload failed' },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Document upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
