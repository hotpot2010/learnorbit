# 视频笔记页面：优先使用转码视频

## 概述

在 `video-notes-prototype` 页面中实现了视频URL的智能选择逻辑，优先使用H.264转码后的视频，确保更好的浏览器兼容性和播放体验。

## 修改目的

### 问题背景
- 某些原始视频使用HEVC/H.265编码，部分浏览器不支持
- 转码视频使用H.264编码，具有更广泛的浏览器兼容性
- 需要在有转码视频时自动使用，无转码视频时回退到原始视频

### 解决方案
实现智能URL选择策略：
1. ✅ **优先使用** `transcoded_video_url`（转码后的视频）
2. 🔄 **回退使用** `video_url`（原始视频）
3. 📝 **控制台日志**：记录使用的是转码后还是原始视频

## 修改位置

### 1. 初始视频URL设置（第1002-1018行）

当首次加载视频任务时设置视频URL。

**修改前：**
```typescript
// 设置视频URL（取第一个分P）
const videoUrls = task.video_url;
if (videoUrls) {
  const videoUrlArray = typeof videoUrls === 'string' 
    ? (videoUrls.startsWith('[') ? JSON.parse(videoUrls) : [videoUrls])
    : videoUrls;
  const firstVideoUrl = Array.isArray(videoUrlArray) ? videoUrlArray[0] : videoUrlArray;
  
  // 确保使用 HTTPS
  const secureVideoUrl = ensureHttps(firstVideoUrl) as string;
  setCdnVideoUrl(secureVideoUrl);
  console.log('✅ 设置CDN视频URL:', secureVideoUrl);
}
```

**修改后：**
```typescript
// 设置视频URL（优先使用转码后的视频，取第一个分P）
// 优先使用转码后的视频URL，如果没有则使用原始URL
const transcodedUrls = task.transcoded_video_url;
const videoUrls = transcodedUrls || task.video_url;
const isTranscoded = !!transcodedUrls;

if (videoUrls) {
  const videoUrlArray = typeof videoUrls === 'string' 
    ? (videoUrls.startsWith('[') ? JSON.parse(videoUrls) : [videoUrls])
    : videoUrls;
  const firstVideoUrl = Array.isArray(videoUrlArray) ? videoUrlArray[0] : videoUrlArray;
  
  // 确保使用 HTTPS
  const secureVideoUrl = ensureHttps(firstVideoUrl) as string;
  setCdnVideoUrl(secureVideoUrl);
  console.log(`✅ 设置CDN视频URL (${isTranscoded ? '转码后' : '原始'}):`, secureVideoUrl);
}
```

### 2. 切换分P时的视频URL设置（第1543-1557行）

当用户切换多P视频的不同分P时设置对应的视频URL。

**修改前：**
```typescript
// 获取视频URL
const videoUrls = processedTaskDataRef.current.video_url;
if (videoUrls) {
  const videoUrlArray = typeof videoUrls === 'string' 
    ? (videoUrls.startsWith('[') ? JSON.parse(videoUrls) : [videoUrls])
    : videoUrls;
  const videoUrl = Array.isArray(videoUrlArray) ? videoUrlArray[partIndex] : videoUrlArray;
  if (videoUrl) {
    // 确保使用 HTTPS
    const secureVideoUrl = ensureHttps(videoUrl) as string;
    setCdnVideoUrl(secureVideoUrl);
    console.log(`✅ 设置视频URL (P${partIndex + 1}):`, secureVideoUrl);
  }
}
```

**修改后：**
```typescript
// 获取视频URL（优先使用转码后的视频）
const transcodedUrls = processedTaskDataRef.current.transcoded_video_url;
const videoUrls = transcodedUrls || processedTaskDataRef.current.video_url;
const isTranscoded = !!transcodedUrls;

if (videoUrls) {
  const videoUrlArray = typeof videoUrls === 'string' 
    ? (videoUrls.startsWith('[') ? JSON.parse(videoUrls) : [videoUrls])
    : videoUrls;
  const videoUrl = Array.isArray(videoUrlArray) ? videoUrlArray[partIndex] : videoUrlArray;
  if (videoUrl) {
    // 确保使用 HTTPS
    const secureVideoUrl = ensureHttps(videoUrl) as string;
    setCdnVideoUrl(secureVideoUrl);
    console.log(`✅ 设置视频URL (P${partIndex + 1}, ${isTranscoded ? '转码后' : '原始'}):`, secureVideoUrl);
  }
}
```

## 工作原理

### URL选择逻辑

```typescript
const transcodedUrls = task.transcoded_video_url;
const videoUrls = transcodedUrls || task.video_url;
const isTranscoded = !!transcodedUrls;
```

1. **检查转码URL**：首先尝试获取 `transcoded_video_url`
2. **回退机制**：如果转码URL不存在（`null`, `undefined`, 或空字符串），使用 `video_url`
3. **标记类型**：使用 `isTranscoded` 标记当前使用的视频类型

### 支持的数据格式

代码同时支持单P视频和多P视频的两种数据格式：

#### 单P视频
```json
{
  "video_url": "https://cdn.example.com/video.mp4",
  "transcoded_video_url": "https://cdn.example.com/video_h264.mp4"
}
```

#### 多P视频（JSON数组字符串）
```json
{
  "video_url": "[\"https://cdn.example.com/video_p1.mp4\", \"https://cdn.example.com/video_p2.mp4\"]",
  "transcoded_video_url": "[\"https://cdn.example.com/video_p1_h264.mp4\", \"https://cdn.example.com/video_p2_h264.mp4\"]"
}
```

#### 多P视频（数组）
```json
{
  "video_url": ["https://cdn.example.com/video_p1.mp4", "https://cdn.example.com/video_p2.mp4"],
  "transcoded_video_url": ["https://cdn.example.com/video_p1_h264.mp4", "https://cdn.example.com/video_p2_h264.mp4"]
}
```

### URL解析流程

```typescript
const videoUrlArray = typeof videoUrls === 'string' 
  ? (videoUrls.startsWith('[') ? JSON.parse(videoUrls) : [videoUrls])
  : videoUrls;
const videoUrl = Array.isArray(videoUrlArray) ? videoUrlArray[partIndex] : videoUrlArray;
```

1. **检查数据类型**：判断是字符串还是数组
2. **JSON解析**：如果是JSON数组字符串（以`[`开头），进行解析
3. **数组包装**：如果是单个URL字符串，包装成数组
4. **索引访问**：使用 `partIndex` 获取对应分P的URL

## 控制台日志

### 日志格式

```javascript
// 单P视频或首个分P
console.log('✅ 设置CDN视频URL (转码后): https://cdn.example.com/video_h264.mp4');
console.log('✅ 设置CDN视频URL (原始): https://cdn.example.com/video.mp4');

// 多P视频切换
console.log('✅ 设置视频URL (P2, 转码后): https://cdn.example.com/video_p2_h264.mp4');
console.log('✅ 设置视频URL (P3, 原始): https://cdn.example.com/video_p3.mp4');
```

### 日志用途

- 📊 **调试**：方便开发者确认使用的视频来源
- 🔍 **问题排查**：快速定位视频播放问题（是否转码、URL是否正确）
- 📈 **数据统计**：了解转码视频的使用率

## 用户体验提升

### 浏览器兼容性

| 编码格式 | Chrome | Firefox | Safari | Edge | 兼容性 |
|---------|--------|---------|--------|------|--------|
| HEVC/H.265 | ❌ | ❌ | ✅ | ❌ | 低 |
| H.264 | ✅ | ✅ | ✅ | ✅ | 高 |

### 播放效果对比

**使用原始视频（可能HEVC编码）：**
- ❌ 部分浏览器无法播放
- ⚠️ 显示"可能是浏览器不支持此视频格式 (HEVC/H.265)"错误
- 😞 用户体验差

**使用转码视频（H.264编码）：**
- ✅ 所有主流浏览器支持
- ✅ 流畅播放
- 😊 用户体验好

### 渐进式增强

```
转码视频已完成 → 使用转码视频 ✅ 最佳体验
                ↓
转码视频未完成 → 使用原始视频 🔄 保底体验
                ↓
原始视频也没有 → 显示错误提示 ⚠️ 友好提示
```

## 数据库字段

### 相关字段

```sql
-- offline_video_tasks 表
CREATE TABLE offline_video_tasks (
  -- ... 其他字段 ...
  
  video_url MEDIUMTEXT NULL COMMENT '原始视频URL（单P为字符串，多P为JSON数组）',
  transcoded_video_url MEDIUMTEXT NULL COMMENT '转码后的视频URL（单P为字符串，多P为JSON数组）',
  
  -- ... 其他字段 ...
);
```

### 字段说明

- **`video_url`**: 原始视频URL，可能是HEVC或其他编码
  - 单P视频：`'https://cdn.example.com/video.mp4'`
  - 多P视频：`'["https://cdn.example.com/video_p1.mp4", "..."]'`

- **`transcoded_video_url`**: H.264转码后的视频URL
  - 单P视频：`'https://cdn.example.com/video_h264.mp4'`
  - 多P视频：`'["https://cdn.example.com/video_p1_h264.mp4", "..."]'`

## 后续优化建议

### 1. 转码进度提示

可以考虑在转码进行中时显示提示：

```tsx
{!transcodedUrls && isTranscoding && (
  <div className="bg-yellow-100 text-yellow-800 p-2 rounded text-sm">
    🔄 视频正在转码中，当前使用原始视频。转码完成后将自动使用兼容性更好的版本。
  </div>
)}
```

### 2. 自动重试机制

如果原始视频播放失败，尝试触发转码：

```typescript
const handleVideoError = async () => {
  if (!transcodedUrls && videoUrls) {
    console.log('📹 原始视频播放失败，尝试触发转码...');
    await triggerTranscodeJob(taskId);
  }
};
```

### 3. 用户设置

允许用户在设置中选择偏好：

```tsx
// 用户设置
const videoPreference = {
  preferTranscoded: true,  // 优先使用转码视频
  autoTranscode: true,     // 播放失败时自动转码
};
```

## 测试验证

### 测试场景

1. **场景1：有转码视频**
   - 预期：使用转码视频
   - 验证：检查控制台日志显示"转码后"

2. **场景2：无转码视频**
   - 预期：使用原始视频
   - 验证：检查控制台日志显示"原始"

3. **场景3：多P视频切换**
   - 预期：每个分P正确使用对应URL
   - 验证：切换分P时控制台日志显示正确的分P编号和视频类型

4. **场景4：混合状态**
   - 某些分P有转码，某些没有
   - 预期：自动选择每个分P的最佳URL
   - 验证：检查每个分P的日志输出

### 测试步骤

```bash
# 1. 启动开发服务器
npm run dev

# 2. 打开视频笔记页面
# 访问 http://localhost:3000/[locale]/video-notes-prototype?taskId=xxx

# 3. 打开浏览器控制台
# F12 或 Cmd+Option+I

# 4. 查看日志输出
# 应该看到 "✅ 设置CDN视频URL (转码后)" 或 "✅ 设置CDN视频URL (原始)"

# 5. 切换分P（如果是多P视频）
# 观察每个分P的日志输出
```

## 相关文件

- `src/app/[locale]/(marketing)/video-notes-prototype/page.tsx`
  - 第 1002-1018 行：初始视频URL设置
  - 第 1543-1557 行：切换分P时的视频URL设置

- `backend/app/models/offline_video.py`
  - `OfflineVideoTask` 模型：包含 `video_url` 和 `transcoded_video_url` 字段

- `backend/app/services/offline_video_service.py`
  - 第 3520-3550 行：单P视频转码逻辑
  - 第 3413-3432 行：多P视频转码逻辑

## 修改日期

2024-12-24

## 相关功能

- [x] 转码功能实现
- [x] 转码状态同步修复
- [x] 转码URL显示修复
- [x] 旧任务初始化逻辑
- [x] 旧任务状态修复脚本
- [x] 视频笔记页面优先使用转码视频 ✅（本次）

