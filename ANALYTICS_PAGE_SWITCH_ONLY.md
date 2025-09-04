# 分析系统优化：仅页面切换时上报

## 🎯 **用户需求**

根据用户要求，分析系统现在已调整为：
1. **调用API发送消息时不上报事件**
2. **只在页面切换时上报数据**  
3. **所有上报字段必须包含 page_path**

---

## 🔄 **核心改动**

### **1. 移除消息发送相关事件**
```typescript
// ❌ 移除的事件类型
- learning_plan_start      // 开始生成学习计划
- file_upload_start        // 文件上传开始
- file_upload_success      // 文件上传成功  
- file_upload_error        // 文件上传失败
- login_required_prompt    // 登录提示
- navigate_to_custom       // 跳转到定制页面
```

### **2. 只保留页面切换事件**
```typescript
// ✅ 保留的事件类型
- page_view               // 页面访问（进入页面时）
- page_switch            // 页面切换（离开页面时）
```

### **3. 简化事件监听器**
```typescript
// 移除了复杂的交互跟踪
- ❌ scroll 滚动监听
- ❌ click/keydown/touchstart 交互监听
- ❌ focus/blur 焦点监听

// 只保留页面切换相关
- ✅ visibilitychange (页面隐藏时)
- ✅ beforeunload (页面卸载时)
```

---

## 📊 **新的事件模型**

### **页面访问事件 (`page_view`)**
```json
{
  "event_name": "page_view",
  "timestamp": 1703123456789,
  "session_id": "session_1756461311...",
  "user_id": "XFTXYfkdLeLAvN5NFiObDqdNcu6VTzO0",
  "page_path": "/zh/custom",           // ✅ 必含字段
  "page_title": "课程定制 - 学习平台",
  "locale": "zh",
  "device_type": "desktop",
  "referrer": "/zh"
}
```

### **页面切换事件 (`page_switch`)**
```json
{
  "event_name": "page_switch",
  "timestamp": 1703123456999,
  "session_id": "session_1756461311...",
  "user_id": "XFTXYfkdLeLAvN5NFiObDqdNcu6VTzO0", 
  "page_path": "/zh/custom",           // ✅ 必含字段
  "page_title": "课程定制 - 学习平台",
  "time_on_page": 45,                  // 停留时间（秒）
  "locale": "zh",
  "device_type": "desktop",
  "referrer": "/zh"
}
```

---

## 🚫 **不再上报的场景**

### **API调用**
```typescript
// ❌ 这些操作不会触发事件上报
- 发送聊天消息
- 生成学习计划 
- 上传文件
- 调用task/generate
- 调用plan/stream_generate
- 登录认证相关API
```

### **用户交互**
```typescript
// ❌ 这些交互不会触发事件上报
- 点击按钮
- 滚动页面
- 键盘输入
- 鼠标移动
- 表单提交
```

---

## ✅ **触发上报的场景**

### **页面切换**
```typescript
// ✅ 这些场景会触发事件上报

1. 用户访问新页面
   → 触发 page_view 事件

2. 用户离开当前页面
   → 触发 page_switch 事件 (包含停留时间)

3. 浏览器标签页切换
   → 触发 page_switch 事件

4. 关闭浏览器/刷新页面
   → 触发 page_switch 事件
```

---

## 📈 **数据流程图**

```
用户行为流程：
1. 访问首页
   ↓
   📊 page_view: /zh
   
2. 点击生成课程 (不上报)
   ↓
   📊 (无事件)
   
3. 切换到定制页面
   ↓
   📊 page_switch: /zh (停留时间)
   📊 page_view: /zh/custom
   
4. 发送消息生成计划 (不上报)
   ↓
   📊 (无事件)
   
5. 切换到学习页面
   ↓
   📊 page_switch: /zh/custom (停留时间)
   📊 page_view: /zh/study/xxx
```

---

## 🛠️ **技术实现**

### **page_path 字段保证**
```typescript
// 所有事件都自动添加 page_path
if (!properties.page_path && typeof window !== 'undefined') {
  properties.page_path = window.location.pathname;
}
```

### **去重机制**
```typescript
// 防止同一页面重复上报
if (this.lastPagePath === currentPath && 
    currentTime - this.lastPageViewTime < 1000) {
  console.log('📊 跳过重复页面访问事件:', currentPath);
  return;
}
```

### **停留时间计算**
```typescript
// 页面切换时计算准确的停留时间
const timeOnPage = this.pageStartTime > 0 ? 
  Date.now() - this.pageStartTime : 0;
```

---

## 🧪 **测试验证**

### **预期行为**
```bash
# 访问首页
📊 page_view: {page_path: "/zh", ...}

# 停留30秒，发送消息 (无上报)
(无控制台输出)

# 切换到定制页面  
📊 page_switch: /zh (停留30秒)
📊 page_view: {page_path: "/zh/custom", ...}

# 上传文件，生成计划 (无上报)
(无控制台输出)

# 切换到学习页面
📊 page_switch: /zh/custom (停留120秒) 
📊 page_view: {page_path: "/zh/study/custom", ...}
```

### **数据库记录**
```sql
-- 查看页面访问统计
SELECT page_path, COUNT(*) as visits 
FROM analytics_events 
WHERE event_name = 'page_view' 
GROUP BY page_path;

-- 查看页面停留时间
SELECT page_path, AVG(time_on_page) as avg_time
FROM analytics_events 
WHERE event_name = 'page_switch' 
  AND time_on_page > 0
GROUP BY page_path;
```

---

## 🎯 **优势总结**

### **数据质量**
- ✅ **精准数据**: 只记录页面级别的核心行为
- ✅ **无噪音**: 消除了大量不必要的交互事件
- ✅ **一致性**: 所有事件都包含 page_path 字段

### **性能优化**  
- ✅ **减少请求**: 大幅降低分析API调用频率
- ✅ **提升性能**: 移除了复杂的事件监听器
- ✅ **节省带宽**: 只传输关键的页面数据

### **隐私友好**
- ✅ **减少跟踪**: 不监控详细的用户交互行为
- ✅ **专注核心**: 只关注页面访问路径和停留时间
- ✅ **用户友好**: 降低了隐私敏感度

现在的分析系统完全按照用户要求运行：**只在页面切换时上报数据，所有字段都包含page_path！** 🎉


