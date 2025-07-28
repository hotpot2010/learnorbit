interface SessionData {
  controller: ReadableStreamDefaultController<any>;
  lastActivity: Date;
  status: 'waiting' | 'generating' | 'completed' | 'error';
  userId?: string;
}

class SessionManager {
  private sessions = new Map<string, SessionData>();
  private timeoutChecker?: NodeJS.Timeout;

  constructor() {
    this.startTimeoutChecker();
  }

  // 注册新的SSE连接
  registerSession(sessionId: string, controller: ReadableStreamDefaultController<any>, userId?: string) {
    console.log(`📝 注册Session: ${sessionId}`, userId ? `用户: ${userId}` : '');
    
    this.sessions.set(sessionId, {
      controller,
      lastActivity: new Date(),
      status: 'waiting',
      userId
    });

    // 发送连接确认
    this.sendToSession(sessionId, {
      type: 'connected',
      sessionId,
      timestamp: new Date().toISOString()
    });
  }

  // 更新session状态和数据
  updateSession(sessionId: string, data: any) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`⚠️ Session不存在: ${sessionId}`);
      return false;
    }

    console.log(`📤 更新Session: ${sessionId}`, data.type || 'plan_update');
    
    session.lastActivity = new Date();
    session.status = data.type === 'error' ? 'error' : 'completed';
    
    this.sendToSession(sessionId, {
      type: 'plan_update',
      plan: data,
      timestamp: new Date().toISOString()
    });

    return true;
  }

  // 设置session为生成状态
  setSessionGenerating(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'generating';
      session.lastActivity = new Date();
      console.log(`🔄 Session开始生成: ${sessionId}`);
    }
  }

  // 设置session错误状态
  setSessionError(sessionId: string, error: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    console.log(`❌ Session错误: ${sessionId} - ${error}`);
    
    session.status = 'error';
    session.lastActivity = new Date();
    
    this.sendToSession(sessionId, {
      type: 'error',
      message: error,
      timestamp: new Date().toISOString()
    });

    return true;
  }

  // 向特定session发送数据
  private sendToSession(sessionId: string, data: any) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      session.controller.enqueue(new TextEncoder().encode(message));
    } catch (error) {
      console.error(`❌ 发送消息失败 ${sessionId}:`, error);
      this.removeSession(sessionId);
    }
  }

  // 移除session
  removeSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        session.controller.close();
      } catch (error) {
        // 控制器可能已经关闭
      }
      this.sessions.delete(sessionId);
      console.log(`🗑️ 移除Session: ${sessionId}`);
    }
  }

  // 获取session状态
  getSessionStatus(sessionId: string) {
    const session = this.sessions.get(sessionId);
    return session ? {
      status: session.status,
      lastActivity: session.lastActivity,
      userId: session.userId
    } : null;
  }

  // 获取所有活跃session数量
  getActiveSessionsCount(): number {
    return this.sessions.size;
  }

  // 定期检查并处理超时的session
  private startTimeoutChecker() {
    this.timeoutChecker = setInterval(() => {
      const now = new Date();
      const expiredSessions: string[] = [];

      for (const [sessionId, session] of this.sessions) {
        const timeDiff = now.getTime() - session.lastActivity.getTime();
        
        // 如果超过3分钟还在生成状态，标记为超时
        if (timeDiff > 3 * 60 * 1000 && session.status === 'generating') {
          this.setSessionError(sessionId, '⏰ 生成超时，请重试');
          continue;
        }
        
        // 清理超过30分钟无活动的session
        if (timeDiff > 30 * 60 * 1000) {
          expiredSessions.push(sessionId);
        }
      }

      // 清理过期session
      expiredSessions.forEach(sessionId => {
        console.log(`🧹 清理过期Session: ${sessionId}`);
        this.removeSession(sessionId);
      });

      if (expiredSessions.length > 0) {
        console.log(`📊 活跃Session数量: ${this.getActiveSessionsCount()}`);
      }
    }, 30 * 1000); // 每30秒检查一次
  }

  // 销毁管理器
  destroy() {
    if (this.timeoutChecker) {
      clearInterval(this.timeoutChecker);
    }
    
    // 关闭所有session
    for (const sessionId of this.sessions.keys()) {
      this.removeSession(sessionId);
    }
  }
}

// 创建全局单例
export const sessionManager = new SessionManager();

// 在进程退出时清理
if (typeof process !== 'undefined') {
  process.on('SIGTERM', () => sessionManager.destroy());
  process.on('SIGINT', () => sessionManager.destroy());
} 