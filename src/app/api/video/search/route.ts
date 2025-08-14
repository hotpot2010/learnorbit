import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { search_keyword, lang } = body || {};

    if (!search_keyword || typeof search_keyword !== 'string') {
      return NextResponse.json({ error: 'search_keyword is required' }, { status: 400 });
    }

    const externalBase =
      process.env.EXTERNAL_API_URL ||
      process.env.NEXT_PUBLIC_EXTERNAL_API_URL ||
      'https://study-platform.zeabur.app';

    const url = `${externalBase.replace(/\/$/, '')}/api/video/search`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ search_keyword, lang }),
      // server-side fetch; no CORS issues
      cache: 'no-store',
    });

    const text = await resp.text();
    let json: any;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      // 非 JSON 响应，直接转发文本
      return new NextResponse(text, { status: resp.status });
    }

    return NextResponse.json(json, { status: resp.status });
  } catch (err: any) {
    return NextResponse.json({ error: 'Video search proxy failed', detail: String(err?.message || err) }, { status: 500 });
  }
} 
 
 
 