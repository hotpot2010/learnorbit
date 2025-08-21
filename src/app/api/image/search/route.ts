import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { search_keyword, lang = 'en' } = body;

    if (!search_keyword || typeof search_keyword !== 'string') {
      return NextResponse.json(
        { error: 'search_keyword is required and must be a string' },
        { status: 400 }
      );
    }

    // 从环境变量获取外部API URL
    const EXTERNAL_API_URL = process.env.NEXT_PUBLIC_EXTERNAL_API_URL;
    if (!EXTERNAL_API_URL) {
      console.error('NEXT_PUBLIC_EXTERNAL_API_URL environment variable is not set');
      return NextResponse.json(
        { error: 'External API URL not configured' },
        { status: 500 }
      );
    }

    // 调用外部图片搜索API
    const externalApiUrl = `${EXTERNAL_API_URL}/api/image/search`;
    console.log('🔗 Calling external image search API:', externalApiUrl);
    console.log('📤 Request data:', { search_keyword, lang });

    const response = await fetch(externalApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        search_keyword,
        lang
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('External API error:', response.status, errorText);
      return NextResponse.json(
        { 
          error: 'External image search API failed',
          details: `Status: ${response.status}`,
          message: errorText
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('✅ Image search results received:', {
      hasImageRes: !!data.image_res,
      imageCount: Array.isArray(data.image_res) ? data.image_res.length : 0
    });

    // 返回搜索结果
    return NextResponse.json(data);

  } catch (error) {
    console.error('Image search API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to search images',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
