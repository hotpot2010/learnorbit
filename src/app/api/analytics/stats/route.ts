import { NextRequest, NextResponse } from 'next/server';
import backendAPI from '@/lib/backend-api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const excludeUserIds = searchParams.get('excludeUserIds') || undefined;

    // 通过 Backend API 获取统计数据
    const result = await backendAPI.analytics.getStats(startDate, endDate, excludeUserIds);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ 统计查询失败:', error);
    return NextResponse.json(
      { success: false, error: '统计查询失败' },
      { status: 500 }
    );
  }
}

