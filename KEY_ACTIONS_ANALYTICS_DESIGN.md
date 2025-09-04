# 🎯 关键用户行为打点设计方案

## 📋 **需求概述**

### **目标**
只上报3个关键的用户转化行为，精准追踪用户的学习路径：

1. **首页的生成课程** - 用户开始创建学习计划
2. **定制页面的开始学习** - 用户确认学习计划并开始学习
3. **课程页面的继续学习** - 用户返回继续已有的学习进度

### **⚠️ 重要约束**
- **用户ID必填**: 所有关键行为事件必须包含用户ID
- **仅限登录用户**: 只追踪已登录用户的行为，未登录用户不触发打点
- **数据完整性**: 确保每个事件都能关联到具体的用户账户

---

## 🔍 **现有按钮分析**

### **1. 首页 - 生成课程按钮**
**位置**: `src/components/learning/course-input-section.tsx`
```tsx
// 第214行
<Button onClick={handleSubmit} disabled={!input.trim() || isLoading}>
  <Send className="w-3.5 h-3.5 mr-1" />
  {t('generatePlan')}
</Button>
```
**触发时机**: 用户输入学习需求后点击"生成计划"
**关键数据**: 
- 用户输入内容
- 是否上传了文件
- 用户登录状态

### **2. 定制页面 - 开始学习按钮**  
**位置**: `src/components/learning/custom-learning-plan.tsx`
```tsx
// 第1298行
<button onClick={() => { saveCourseToDatabase(currentPlan); }}>
  Start Learning Journey! 🚀
</button>
```
**触发时机**: 用户查看完学习计划后确认开始学习
**关键数据**:
- 学习计划ID
- 计划类型（完整/部分）
- 计划步骤数量
- 生成时长

### **3. 我的课程页面 - 继续学习按钮**
**位置**: `src/app/[locale]/(marketing)/my-courses/page.tsx`
```tsx
// 第430行
<button>
  {course.status === 'completed' 
    ? 'Review Course 📚' 
    : 'Continue Learning ⚡'}
</button>
```
**触发时机**: 用户从课程列表进入具体课程学习
**关键数据**:
- 课程ID
- 课程状态（进行中/已完成）
- 学习进度
- 上次学习时间

---

## 📊 **事件设计架构**

### **事件命名规范**
```typescript
// 使用清晰的动词_名词格式
'generate_course'    // 生成课程
'start_learning'     // 开始学习  
'continue_learning'  // 继续学习
```

### **统一事件数据结构**
```typescript
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
```

---

## 🎯 **具体事件设计**

### **1. generate_course - 生成课程**

#### **触发位置**
- `src/components/learning/course-input-section.tsx` 的 `handleSubmit` 函数

#### **事件数据**
```typescript
{
  event_name: 'generate_course',
  timestamp: 1703123456789,
  session_id: 'sess_abc123',
  user_id: 'user_xyz789',           // 必须包含用户ID
  page_path: '/zh',
  page_title: 'LearnOrbit - AI学习平台',
  locale: 'zh',
  device_type: 'desktop',
  user_agent: 'Mozilla/5.0...',
  action_data: {
    input_text: '我想学习React开发',      // 用户输入内容
    input_length: 12,                     // 输入文本长度
    has_uploaded_file: true,              // 是否上传了文件
    uploaded_file_name: 'react-guide.pdf', // 上传文件名
    is_authenticated: true,               // 是否已登录
    generation_type: 'with_file'          // 生成类型: 'text_only' | 'with_file'
  }
}
```

#### **触发时机**
```typescript
// 在 handleSubmit 函数中，API调用成功后立即触发
const handleSubmit = async () => {
  try {
    // 现有的生成逻辑...
    
    // 🎯 只有登录用户才触发打点
    if (currentUser?.id) {
      const analytics = getKeyActionsAnalytics();
      analytics.trackKeyAction('generate_course', {
        input_text: input.trim(),
        input_length: input.trim().length,
        has_uploaded_file: !!uploadedFile,
        uploaded_file_name: uploadedFile?.name,
        generation_type: uploadedFile ? 'with_file' : 'text_only'
      });
    } else {
      console.log('🔒 用户未登录，跳过生成课程打点');
    }
    
  } catch (error) {
    // 错误处理...
  }
};
```

---

### **2. start_learning - 开始学习**

#### **触发位置**
- `src/components/learning/custom-learning-plan.tsx` 的开始学习按钮点击

#### **事件数据**
```typescript
{
  event_name: 'start_learning',
  timestamp: 1703123456789,
  session_id: 'sess_abc123',
  user_id: 'user_xyz789',           // 必须包含用户ID
  page_path: '/zh/custom',
  page_title: '课程定制 - LearnOrbit',
  locale: 'zh',
  device_type: 'desktop',
  user_agent: 'Mozilla/5.0...',
  action_data: {
    plan_id: 'plan_def456',              // 学习计划ID
    plan_type: 'complete',               // 计划类型: 'complete' | 'partial'
    total_steps: 8,                      // 总步骤数
    estimated_duration: '4 weeks',       // 预估学习时长
    plan_generation_time: 45000,         // 计划生成耗时(ms)
    has_custom_modifications: false,     // 是否有用户自定义修改
    course_title: 'React全栈开发入门'     // 课程标题
  }
}
```

#### **触发时机**
```typescript
// 在开始学习按钮的onClick中，保存成功后触发
onClick={() => {
  const currentPlan = learningPlan || partialPlan;
  if (currentPlan) {
    // 🎯 只有登录用户才触发打点
    if (currentUser?.id) {
      const analytics = getKeyActionsAnalytics();
      analytics.trackKeyAction('start_learning', {
        plan_id: currentPlan.id,
        plan_type: learningPlan ? 'complete' : 'partial',
        total_steps: currentPlan.steps?.length || 0,
        estimated_duration: currentPlan.estimated_duration,
        course_title: currentPlan.title,
        // ... 其他数据
      });
    } else {
      console.log('🔒 用户未登录，跳过开始学习打点');
    }
    
    saveCourseToDatabase(currentPlan);
  }
}}
```

---

### **3. continue_learning - 继续学习**

#### **触发位置**
- `src/app/[locale]/(marketing)/my-courses/page.tsx` 的继续学习按钮

#### **事件数据**
```typescript
{
  event_name: 'continue_learning',
  timestamp: 1703123456789,
  session_id: 'sess_abc123', 
  user_id: 'user_xyz789',           // 必须包含用户ID
  page_path: '/zh/my-courses',
  page_title: '我的课程 - LearnOrbit',
  locale: 'zh',
  device_type: 'desktop',
  user_agent: 'Mozilla/5.0...',
  action_data: {
    course_id: 'course_ghi789',          // 课程ID
    course_title: 'React全栈开发入门',    // 课程标题
    course_status: 'in_progress',        // 课程状态: 'in_progress' | 'completed'
    progress_percentage: 65,             // 学习进度百分比
    current_step: 5,                     // 当前步骤
    total_steps: 8,                      // 总步骤数
    last_accessed: '2023-12-15T10:30:00Z', // 上次访问时间
    days_since_last_access: 3,           // 距离上次访问天数
    button_text: 'Continue Learning ⚡'   // 按钮文本（区分继续/复习）
  }
}
```

#### **触发时机**
```typescript
// 在继续学习按钮的onClick中立即触发
<button
  onClick={() => {
    // 🎯 只有登录用户才触发打点（我的课程页面默认已登录）
    if (currentUser?.id) {
      const analytics = getKeyActionsAnalytics();
      analytics.trackKeyAction('continue_learning', {
        course_id: course.id,
        course_title: course.title,
        course_status: course.status,
        progress_percentage: course.progress || 0,
        current_step: course.currentStep || 1,
        total_steps: course.totalSteps || 0,
        last_accessed: course.lastAccessed,
        days_since_last_access: calculateDaysSince(course.lastAccessed),
        button_text: course.status === 'completed' ? 'Review Course 📚' : 'Continue Learning ⚡'
      });
    } else {
      console.log('🔒 用户未登录，跳过继续学习打点');
    }
    
    // 现有的跳转逻辑...
    router.push(`/study/${course.id}`);
  }}
>
  {course.status === 'completed' ? 'Review Course 📚' : 'Continue Learning ⚡'}
</button>
```

---

## 🔐 **用户认证集成**

### **初始化时机**
```typescript
// 在认证Provider中，用户登录后立即初始化
// src/app/[locale]/providers.tsx 或认证相关组件中

useEffect(() => {
  if (currentUser?.id) {
    // 用户登录后初始化关键行为追踪
    initKeyActionsAnalytics(currentUser.id);
    console.log('🎯 关键行为追踪已初始化:', currentUser.id);
  }
}, [currentUser?.id]);
```

### **登录状态变化处理**
```typescript
// 处理登录/登出状态变化
const handleAuthStateChange = (user: User | null) => {
  if (user?.id) {
    // 登录：初始化或更新用户ID
    if (keyActionsAnalytics) {
      updateUserId(user.id);
    } else {
      initKeyActionsAnalytics(user.id);
    }
  } else {
    // 登出：停止追踪（可选）
    console.log('🔒 用户已登出，关键行为追踪已暂停');
  }
};
```

### **防御性编程**
```typescript
// 在每个打点位置添加安全检查
const trackKeyAction = (eventName: string, data: any) => {
  try {
    if (!currentUser?.id) {
      console.log(`🔒 用户未登录，跳过${eventName}打点`);
      return;
    }
    
    const analytics = getKeyActionsAnalytics();
    analytics.trackKeyAction(eventName, data);
  } catch (error) {
    console.error(`❌ ${eventName}打点失败:`, error);
    // 不阻断用户操作，静默失败
  }
};
```

---

## 🏗️ **技术实现架构**

### **1. 简化的Analytics类**
```typescript
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
    const event = {
      event_name: eventName,
      timestamp: Date.now(),
      session_id: this.sessionId,
      user_id: this.userId,
      page_path: window.location.pathname,
      page_title: document.title,
      locale: this.getCurrentLocale(),
      device_type: this.getDeviceType(),
      user_agent: navigator.userAgent,
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
}
```

### **2. 全局实例初始化**
```typescript
// src/lib/key-actions-analytics.ts
let keyActionsAnalytics: KeyActionsAnalytics | null = null;

// 初始化方法（在用户登录后调用）
export function initKeyActionsAnalytics(userId: string) {
  keyActionsAnalytics = new KeyActionsAnalytics(userId);
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
  }
}
```

### **3. 使用方式**
```typescript
import { getKeyActionsAnalytics, initKeyActionsAnalytics } from '@/lib/key-actions-analytics';

// 1. 在用户登录后初始化（比如在auth provider中）
initKeyActionsAnalytics(currentUser.id);

// 2. 在各个组件中使用
const analytics = getKeyActionsAnalytics();
analytics.trackKeyAction('generate_course', {
  input_text: 'React开发',
  has_uploaded_file: true,
  // ... 其他数据
});
```

---

## 📊 **数据库设计**

### **专门的关键行为表**
```sql
CREATE TABLE key_actions (
  id TEXT PRIMARY KEY,
  event_name VARCHAR(50) NOT NULL,
  timestamp BIGINT NOT NULL,
  server_timestamp TIMESTAMP DEFAULT NOW(),
  session_id VARCHAR(200) NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page_path VARCHAR(500) NOT NULL,
  page_title VARCHAR(200),
  locale VARCHAR(10) NOT NULL,
  device_type VARCHAR(20) NOT NULL,
  user_agent VARCHAR(1000),
  action_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 索引优化
CREATE INDEX idx_key_actions_event_name ON key_actions(event_name);
CREATE INDEX idx_key_actions_user_id ON key_actions(user_id);
CREATE INDEX idx_key_actions_timestamp ON key_actions(timestamp);
```

---

## 🎯 **数据分析价值**

### **用户转化漏斗**
```
首页访问 → 生成课程 → 开始学习 → 继续学习
   100%      →   30%    →   80%    →   60%
```

### **关键指标**
1. **生成转化率**: 访问首页的用户中有多少点击了生成课程
2. **学习转化率**: 看到计划的用户中有多少开始学习
3. **留存率**: 开始学习的用户中有多少会继续学习
4. **文件上传影响**: 上传文件的用户转化率是否更高

### **业务洞察**
- 哪种输入内容的生成成功率最高？
- 用户从生成计划到开始学习的时间间隔？
- 不同难度课程的完成率差异？
- 用户返回继续学习的时间模式？

---

## ✅ **实施优势**

### **1. 极简设计**
- ✅ 只追踪3个关键转化点
- ✅ 零噪音，数据精准有价值
- ✅ 性能影响最小
- ✅ 用户ID必填，确保数据完整性

### **2. 业务导向**
- ✅ 直接反映用户学习路径
- ✅ 便于计算转化率和留存率
- ✅ 支持A/B测试和优化决策
- ✅ 支持用户行为分析和个性化推荐

### **3. 技术简洁**
- ✅ 单一Analytics类，易于维护
- ✅ 统一的事件结构
- ✅ 专门的数据表，查询高效

### **4. 扩展灵活**
- ✅ 可以随时添加新的关键行为
- ✅ action_data字段支持任意业务数据
- ✅ 不影响现有页面访问追踪

---

## 🚀 **下一步实施计划**

1. **创建简化的Analytics类** - 专注于关键行为追踪
2. **在3个按钮位置添加追踪代码** - 精确的触发时机
3. **创建专门的API端点** - `/api/analytics/key-actions`
4. **设计数据库表结构** - 优化查询性能
5. **创建分析仪表板** - 可视化关键转化指标

这个设计确保我们只收集最有价值的用户行为数据，避免了之前复杂的页面访问追踪，专注于真正影响业务的关键转化点！🎯
