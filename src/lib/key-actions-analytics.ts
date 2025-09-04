/**
 * 关键用户行为分析客户端
 * 只追踪3个核心转化行为：生成课程、开始学习、继续学习
 */

interface KeyActionEvent {
  // === 基础字段 ===
  event_name: 'generate_course' | 'start_learning' | 'continue_learning';
  timestamp: number;           // 事件发生时间戳
  session_id: string;          // 用户会话ID
  user_id: string;             // 用户ID（必填字段）
  
  // === 页面信息 ===
  page_path: string;           // 当前页面路径
  page_title: string;          // 页面标题
  locale: 'zh' | 'en';         // 语言环境
  
  // === 设备信息 ===
  device_type: 'desktop' | 'mobile' | 'tablet';
  user_agent: string;          // 浏览器信息
  
  // === 业务数据 ===
  action_data: {
    // 根据不同事件类型包含不同的业务数据
    [key: string]: any;
  };
}

class KeyActionsAnalytics {
  private sessionId: string;
  private userId: string;           // 用户ID必填
  
  constructor(userId: string) {
    this.sessionId = this.generateSessionId();
    this.userId = userId;           // 构造时必须传入用户ID
  }
  
  // 设置用户ID（用于登录后更新）
  public setUserId(userId: string) {
    this.userId = userId;
  }
  
  // 只有一个核心方法
  public trackKeyAction(
    eventName: 'generate_course' | 'start_learning' | 'continue_learning',
    actionData: Record<string, any>
  ) {
    const event: KeyActionEvent = {
      event_name: eventName,
      timestamp: Date.now(),
      session_id: this.sessionId,
      user_id: this.userId,
      page_path: typeof window !== 'undefined' ? window.location.pathname : '',
      page_title: typeof document !== 'undefined' ? document.title : '',
      locale: this.getCurrentLocale(),
      device_type: this.getDeviceType(),
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      action_data: actionData
    };
    
    this.sendEvent(event);
  }
  
  private async sendEvent(event: KeyActionEvent) {
    try {
      await fetch('/api/analytics/key-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      });
      console.log(`🎯 关键行为追踪: ${event.event_name}`, event.action_data);
    } catch (error) {
      console.error('❌ 关键行为追踪失败:', error);
    }
  }
  
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private getCurrentLocale(): 'zh' | 'en' {
    if (typeof window === 'undefined') return 'en';
    const pathname = window.location.pathname;
    if (pathname.startsWith('/zh')) return 'zh';
    return 'en';
  }
  
  private getDeviceType(): 'desktop' | 'mobile' | 'tablet' {
    if (typeof navigator === 'undefined') return 'desktop';
    
    const userAgent = navigator.userAgent;
    if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
      return 'tablet';
    }
    if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(userAgent)) {
      return 'mobile';
    }
    return 'desktop';
  }
}

// 全局实例管理
let keyActionsAnalytics: KeyActionsAnalytics | null = null;

// 初始化方法（在用户登录后调用）
export function initKeyActionsAnalytics(userId: string): KeyActionsAnalytics {
  keyActionsAnalytics = new KeyActionsAnalytics(userId);
  console.log('🎯 关键行为追踪已初始化:', userId);
  return keyActionsAnalytics;
}

// 获取实例（确保已初始化）
export function getKeyActionsAnalytics(): KeyActionsAnalytics {
  if (!keyActionsAnalytics) {
    throw new Error('KeyActionsAnalytics not initialized. Call initKeyActionsAnalytics(userId) first.');
  }
  return keyActionsAnalytics;
}

// 更新用户ID（用于登录状态变化）
export function updateUserId(userId: string) {
  if (keyActionsAnalytics) {
    keyActionsAnalytics.setUserId(userId);
    console.log('🎯 用户ID已更新:', userId);
  }
}

// 安全的打点函数（带登录检查）
export function trackKeyActionSafely(
  eventName: 'generate_course' | 'start_learning' | 'continue_learning',
  actionData: Record<string, any>,
  currentUser?: { id: string } | null
) {
  try {
    if (!currentUser?.id) {
      console.log(`🔒 用户未登录，跳过${eventName}打点`);
      return;
    }
    
    const analytics = getKeyActionsAnalytics();
    analytics.trackKeyAction(eventName, actionData);
  } catch (error) {
    console.error(`❌ ${eventName}打点失败:`, error);
    // 静默失败，不阻断用户操作
  }
}

export type { KeyActionEvent };
