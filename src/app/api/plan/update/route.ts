import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/session-manager';

// 获取计划更新的 SSE 连接
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  
  if (!sessionId) {
    console.warn('❌ SSE连接缺少sessionId');
    return new NextResponse('Session ID required', { status: 400 });
  }

  console.log(`🔗 建立SSE连接: ${sessionId}`);

  const stream = new ReadableStream({
    start(controller) {
      // 注册到session管理器
      sessionManager.registerSession(sessionId, controller);
      console.log(`✅ SSE连接已注册: ${sessionId}`);
    },
    cancel() {
      // 连接断开时清理
      sessionManager.removeSession(sessionId);
      console.log(`🔌 SSE连接已断开: ${sessionId}`);
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

// 接收外部AI的回调
export async function POST(request: NextRequest) {
  try {
    console.log('\n=== 📨 接收到AI回调 ===');
    console.log('时间:', new Date().toISOString());
    
    // 从URL参数获取sessionId（优先级最高）
    const { searchParams } = new URL(request.url);
    let sessionId = searchParams.get('sessionId');
    
    // 如果URL中没有，从请求体中获取
    const requestBody = await request.json();
    if (!sessionId) {
      sessionId = requestBody.sessionId || requestBody.session_id || requestBody.id;
    }
    
    console.log('📋 回调数据解析:');
    console.log('URL中的sessionId:', searchParams.get('sessionId'));
    console.log('请求体中的sessionId:', requestBody.sessionId || requestBody.session_id || requestBody.id);
    console.log('最终使用的sessionId:', sessionId);
    
    if (!sessionId) {
      console.error('❌ 缺少sessionId参数');
      return NextResponse.json({ 
        error: 'SessionId required in URL params or request body' 
      }, { status: 400 });
    }

    // 检查session是否存在
    const sessionStatus = sessionManager.getSessionStatus(sessionId);
    if (!sessionStatus) {
      console.warn(`⚠️ Session不存在或已过期: ${sessionId}`);
      return NextResponse.json({ 
        error: 'Session not found or expired',
        sessionId 
      }, { status: 404 });
    }

    console.log(`📊 Session状态: ${sessionStatus.status}`);
    console.log(`🕒 最后活动: ${sessionStatus.lastActivity}`);

    // 解析学习计划数据
    const plan = requestBody.plan || requestBody;
    
    if (!plan) {
      console.error('❌ 缺少学习计划数据');
      sessionManager.setSessionError(sessionId, '数据格式错误：缺少学习计划');
      return NextResponse.json({ error: 'Plan data required' }, { status: 400 });
    }

    // 记录学习计划详情
    if (plan.plan && Array.isArray(plan.plan)) {
      console.log(`📚 学习计划包含 ${plan.plan.length} 个步骤:`);
      plan.plan.forEach((step: any, index: number) => {
        console.log(`  步骤 ${index + 1}: ${step.title} (${step.type})`);
      });
    }

    // 更新session数据
    const updateSuccess = sessionManager.updateSession(sessionId, plan);
    
    if (updateSuccess) {
      console.log(`✅ 学习计划已推送给用户: ${sessionId}`);
      console.log(`📊 当前活跃session数: ${sessionManager.getActiveSessionsCount()}`);
    } else {
      console.error(`❌ 更新session失败: ${sessionId}`);
    }

    console.log('=== ✅ AI回调处理完成 ===\n');
    
    return NextResponse.json({ 
      success: true, 
      sessionId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('\n❌ 处理AI回调失败:');
    console.error('错误类型:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('错误消息:', error instanceof Error ? error.message : String(error));
    
    if (error instanceof Error && error.stack) {
      console.error('错误堆栈:', error.stack);
    }
    
    console.log('=== ❌ AI回调处理失败 ===\n');
    
    return NextResponse.json({ 
      error: 'Failed to process AI callback',
      timestamp: new Date().toISOString()
    }, { status: 500 });
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