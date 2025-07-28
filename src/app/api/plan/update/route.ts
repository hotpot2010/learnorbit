import { NextRequest, NextResponse } from 'next/server';
import { LearningPlan } from '@/types/learning-plan';

// 存储活跃的 SSE 连接
const activeConnections = new Map<string, ReadableStreamDefaultController>();

// 获取计划更新的 SSE 连接
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  
  if (!sessionId) {
    return new NextResponse('Session ID required', { status: 400 });
  }

  const stream = new ReadableStream({
    start(controller) {
      activeConnections.set(sessionId, controller);
      
      // 发送连接确认
      controller.enqueue(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
    },
    cancel() {
      activeConnections.delete(sessionId);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// 接收计划更新
export async function POST(request: NextRequest) {
  try {
    console.log('\n=== 📨 接收到回调请求 ===');
    console.log('时间:', new Date().toISOString());
    console.log('请求头:', Object.fromEntries(request.headers.entries()));
    
    const requestBody = await request.json();
    // console.log('\n📋 完整请求体:');
    // console.log(JSON.stringify(requestBody, null, 2));
    
    // 支持多种可能的sessionId字段名
    let sessionId = requestBody.sessionId || requestBody.session_id || requestBody.id;
    const plan = requestBody.plan;
    
    console.log('\n🔍 解析后的数据:');
    console.log('原始SessionId字段:', {
      sessionId: requestBody.sessionId,
      session_id: requestBody.session_id, 
      id: requestBody.id
    });
    console.log('最终使用的SessionId:', sessionId);
    console.log('学习计划步骤数量:', plan?.plan?.length || 0);
    
    if (plan?.plan) {
      console.log('\n📚 学习计划详情:');
      plan.plan.forEach((step: any, index: number) => {
        console.log(`步骤 ${index + 1}:`, {
          step: step.step,
          title: step.title,
          status: step.status,
          videoCount: step.videos?.length || 0,
          animationType: step.animation_type
        });
      });
    }
    
    if (!sessionId || !plan) {
      console.log('❌ 缺少必要参数 - SessionId:', !!sessionId, 'Plan:', !!plan);
      return NextResponse.json({ error: 'Session ID and plan required' }, { status: 400 });
    }

    // 向对应的 SSE 连接发送计划更新
    const controller = activeConnections.get(sessionId);
    console.log('\n🔗 SSE 连接状态:');
    console.log('活跃连接数:', activeConnections.size);
    console.log('目标SessionId连接存在:', !!controller);
    console.log('所有活跃SessionId:', Array.from(activeConnections.keys()));
    
    if (controller) {
      try {
        const updateMessage = { type: 'plan_update', plan };
        controller.enqueue(`data: ${JSON.stringify(updateMessage)}\n\n`);
        console.log('✅ 已发送计划更新到前端:', sessionId);
        console.log('发送的消息类型:', updateMessage.type);
      } catch (error) {
        console.error('❌ 发送计划更新失败:', error);
        activeConnections.delete(sessionId);
      }
    } else {
      console.warn('⚠️ 未找到活跃的 SSE 连接:', sessionId);
      console.log('可能原因: 1) 前端未建立连接 2) 连接已断开 3) SessionId不匹配');
    }

    console.log('=== ✅ 回调处理完成 ===\n');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('\n❌ 处理计划更新失败:');
    console.error('错误类型:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('错误消息:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('错误堆栈:', error.stack);
    }
    console.log('=== ❌ 回调处理失败 ===\n');
    return NextResponse.json({ error: 'Failed to process plan update' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
} 