import { NextRequest, NextResponse } from 'next/server';
import type { KeyActionEvent } from '@/lib/key-actions-analytics';
import backendAPI from '@/lib/backend-api';

export async function POST(request: NextRequest) {
  try {
    const event: KeyActionEvent = await request.json();
    
    // 验证必填字段
    if (!event.event_name || !event.user_id || !event.session_id) {
      return NextResponse.json(
        { error: 'Missing required fields: event_name, user_id, session_id' },
        { status: 400 }
      );
    }
    
    // 验证事件名称
    const validEvents = [
      'generate_course', 
      'start_learning', 
      'continue_learning',
      'start_video_learning',
      'video_search',
      'video_ask_question',
      'video_screenshot',
      'video_exercise'
    ];
    if (!validEvents.includes(event.event_name)) {
      return NextResponse.json(
        { error: 'Invalid event_name. Must be one of: ' + validEvents.join(', ') },
        { status: 400 }
      );
    }
    
    console.log(`🎯 收到关键行为事件: ${event.event_name}`, {
      user_id: event.user_id,
      session_id: event.session_id,
      page_path: event.page_path,
      action_data: event.action_data
    });
    
    // 通过 Backend API 存储到数据库
    await backendAPI.analytics.trackKeyAction(event);
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('❌ 关键行为事件处理失败:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

