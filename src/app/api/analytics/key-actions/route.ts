import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { keyActions } from '@/db/schema';
import type { KeyActionEvent } from '@/lib/key-actions-analytics';

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
    const validEvents = ['generate_course', 'start_learning', 'continue_learning'];
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
    
    // 存储到数据库
    await storeKeyActionToDatabase(event);
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('❌ 关键行为事件处理失败:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function storeKeyActionToDatabase(event: KeyActionEvent) {
  try {
    const db = await getDb();
    
    const eventData = {
      id: `key_action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      eventName: event.event_name,
      timestamp: event.timestamp,
      sessionId: event.session_id,
      userId: event.user_id,
      locale: event.locale,
      deviceType: event.device_type,
      userAgent: event.user_agent,
      pagePath: event.page_path,
      pageTitle: event.page_title,
      actionData: event.action_data,
    };
    
    await db.insert(keyActions).values(eventData);
    
    console.log(`✅ 关键行为事件已入库: ${event.event_name}`, {
      id: eventData.id,
      user_id: event.user_id,
      event_name: event.event_name,
      page_path: event.page_path,
      action_data: event.action_data,
      timestamp: new Date(event.timestamp).toISOString()
    });
    
  } catch (error) {
    console.error('❌ 数据库存储失败:', error);
    throw error;
  }
}
