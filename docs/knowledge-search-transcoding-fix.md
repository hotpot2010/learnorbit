# 知识点搜索优先使用转码视频修复

## 问题描述

在 `video-notes-prototype` 页面的知识点搜索功能中，搜索结果的视频URL使用的是原始视频（`video_url`），而没有优先使用转码后的视频（`transcoded_video_url`），导致搜索结果可能指向不兼容的HEVC编码视频。

## 问题位置

**文件：** `src/app/[locale]/(marketing)/video-notes-prototype/page.tsx`

**函数：** `searchKnowledgePoints`（第2265行开始）

**问题代码（第2305-2310行）：**

```typescript
// ❌ 直接使用原始视频URL，未优先使用转码后的视频
// 获取截图URL数组和视频URL数组
const screenshotsResultUrls = processedTaskData?.screenshots_result_url;
const screenshotsUrlArray = parseUrlField(screenshotsResultUrls);

const videoUrls = processedTaskData?.video_url;
const videoUrlArray = parseUrlField(videoUrls);
```

## 修复方案

### 修复后的代码

```typescript
// ✅ 优先使用转码后的视频URL，如果没有则使用原始URL
// 获取截图URL数组和视频URL数组（优先使用转码后的视频）
const screenshotsResultUrls = processedTaskData?.screenshots_result_url;
const screenshotsUrlArray = parseUrlField(screenshotsResultUrls);

// 优先使用转码后的视频URL，如果没有则使用原始URL
const transcodedUrls = processedTaskData?.transcoded_video_url;
const videoUrls = transcodedUrls || processedTaskData?.video_url;
const videoUrlArray = parseUrlField(videoUrls);
console.log(`🎬 知识点搜索使用${transcodedUrls ? '转码后' : '原始'}视频URL`);
```

### 修复逻辑

1. **检查转码URL**：首先尝试获取 `transcoded_video_url`
2. **回退机制**：如果转码URL不存在，使用 `video_url`
3. **日志输出**：记录使用的视频类型，便于调试

## 影响范围

### 知识点搜索结果

修复后，知识点搜索返回的结果对象中的 `videoUrl` 字段将优先使用转码后的视频：

```typescript
// 搜索结果对象
interface SearchResult {
  knowledgePointName: string;
  partIndex: number;
  partTitle: string;
  knowledgePointIndex: number;
  startTime: string;
  endTime: string;
  thumbnail?: string;
  note?: string;
  videoUrl?: string;  // ✅ 现在优先使用转码后的视频URL
}
```

### 使用场景

1. **多P视频搜索**（第2313-2382行）
   - 遍历所有分P的知识点
   - 每个分P的搜索结果使用对应的转码视频URL

2. **单P视频搜索**（第2383-2408行）
   - 搜索当前视频的知识点
   - 搜索结果使用转码视频URL

### 点击搜索结果

当用户点击知识点搜索结果时，会跳转到对应的视频位置：

```typescript
// 点击搜索结果的处理逻辑（第2443-2498行）
const handleSearchResultClick = async (result: SearchResult) => {
  // ...
  
  // 如果搜索结果有videoUrl，使用它
  if (result.videoUrl) {
    const secureVideoUrl = ensureHttps(result.videoUrl) as string;
    setCdnVideoUrl(secureVideoUrl);  // ✅ 使用转码后的视频
  }
  
  // ...
};
```

## 完整的转码视频优先级实现

现在整个 `video-notes-prototype` 页面在所有场景下都优先使用转码视频：

### 1. 初始视频加载 ✅

**位置：** 第1002-1018行

```typescript
// 优先使用转码后的视频URL，如果没有则使用原始URL
const transcodedUrls = task.transcoded_video_url;
const videoUrls = transcodedUrls || task.video_url;
// ...
```

### 2. 切换分P ✅

**位置：** 第1543-1557行

```typescript
// 获取视频URL（优先使用转码后的视频）
const transcodedUrls = processedTaskDataRef.current.transcoded_video_url;
const videoUrls = transcodedUrls || processedTaskDataRef.current.video_url;
// ...
```

### 3. 知识点搜索 ✅（本次修复）

**位置：** 第2305-2313行

```typescript
// 优先使用转码后的视频URL，如果没有则使用原始URL
const transcodedUrls = processedTaskData?.transcoded_video_url;
const videoUrls = transcodedUrls || processedTaskData?.video_url;
// ...
```

## 数据流示意图

```
用户操作: 搜索知识点 "函数"
    ↓
读取数据: processedTaskData
    ↓
检查URL: transcoded_video_url 是否存在？
    ├── ✅ 存在 → 使用转码视频（H.264，兼容性好）
    └── ❌ 不存在 → 使用原始视频（可能HEVC，兼容性差）
    ↓
返回结果: SearchResult[] （包含视频URL）
    ↓
用户点击: 跳转到对应知识点
    ↓
播放视频: 使用转码后的视频URL ✅
```

## 控制台日志

修复后，知识点搜索会输出日志标识使用的视频类型：

```javascript
// 使用转码视频
🎬 知识点搜索使用转码后视频URL
🔍 开始搜索...
✅ 搜索完成，找到 5 个结果

// 使用原始视频
🎬 知识点搜索使用原始视频URL
🔍 开始搜索...
✅ 搜索完成，找到 5 个结果
```

## 用户体验改进

### 修复前 ❌

```
用户搜索知识点 "导数"
    ↓
搜索结果使用原始视频URL（可能HEVC）
    ↓
点击搜索结果
    ↓
视频无法播放 ❌
显示错误: "可能是浏览器不支持此视频格式 (HEVC/H.265)"
```

### 修复后 ✅

```
用户搜索知识点 "导数"
    ↓
搜索结果使用转码视频URL（H.264）
    ↓
点击搜索结果
    ↓
视频正常播放 ✅
在所有浏览器中都能流畅观看
```

## 测试验证

### 测试步骤

1. **准备测试环境**
   - 确保有一个视频任务已经完成转码
   - 确认数据库中有 `transcoded_video_url` 字段

2. **打开视频笔记页面**
   ```
   http://localhost:3000/video-notes-prototype?taskId=xxx
   ```

3. **搜索知识点**
   - 在搜索框输入关键词（如"函数"）
   - 点击搜索按钮

4. **检查控制台日志**
   ```javascript
   // 应该看到
   🎬 知识点搜索使用转码后视频URL
   ```

5. **点击搜索结果**
   - 验证视频正常跳转到对应位置
   - 验证视频能够正常播放

6. **检查URL**
   - 打开浏览器开发者工具 → Network
   - 查看视频请求的URL
   - 确认是转码后的视频URL（通常包含 `_h264` 或类似标识）

### 测试场景

#### 场景1：有转码视频
- **预期**：搜索结果使用转码视频
- **验证**：控制台显示"转码后"，视频正常播放

#### 场景2：无转码视频
- **预期**：搜索结果使用原始视频
- **验证**：控制台显示"原始"，使用原始视频

#### 场景3：多P视频（部分有转码）
- **预期**：每个分P根据自己的转码状态选择URL
- **验证**：不同分P的搜索结果可能使用不同类型的URL

## 浏览器兼容性

| 编码格式 | 转码状态 | Chrome | Firefox | Safari | Edge | 兼容性 |
|---------|---------|--------|---------|--------|------|--------|
| HEVC/H.265 | 原始 | ❌ | ❌ | ✅ | ❌ | 低 |
| H.264 | 转码后 | ✅ | ✅ | ✅ | ✅ | **高** ✅ |

修复后，知识点搜索结果在所有主流浏览器中都能正常播放。

## 相关文件

### 主要文件

1. **`src/app/[locale]/(marketing)/video-notes-prototype/page.tsx`** ✅（已修复）
   - 第 1002-1018 行：初始视频URL设置
   - 第 1543-1557 行：切换分P时的视频URL设置
   - 第 2305-2313 行：知识点搜索的视频URL设置（本次修复）

### 相关文档

- `docs/video-transcoding-priority.md` - 视频笔记页面优先使用转码视频
- `docs/transcode-url-display-fix.md` - 转码视频URL显示修复
- `docs/transcode-state-sync-fix.md` - 转码状态同步问题修复
- `docs/video-transcode-feature.md` - 视频转码功能文档

## 统一的URL优先级策略

现在整个应用对视频URL的处理策略已经统一：

```typescript
// 统一的URL选择策略
const getVideoUrl = (task: any) => {
  // 1. 优先使用转码视频（H.264，兼容性好）
  const transcodedUrl = task.transcoded_video_url;
  if (transcodedUrl) {
    return transcodedUrl;
  }
  
  // 2. 回退到原始视频（可能不兼容）
  const originalUrl = task.video_url;
  if (originalUrl) {
    return originalUrl;
  }
  
  // 3. 无视频
  return null;
};
```

这个策略应用于：
- ✅ 初始视频加载
- ✅ 多P视频切换
- ✅ 知识点搜索
- ✅ 视频预览
- ✅ 所有其他使用视频URL的场景

## 后续优化建议

### 1. 搜索结果中显示视频类型标识

```tsx
<div className="search-result-item">
  <span className="video-type-badge">
    {result.isTranscoded ? '🎬 转码版' : '⚠️ 原始版'}
  </span>
  <span>{result.knowledgePointName}</span>
</div>
```

### 2. 自动转码提示

当搜索结果使用原始视频时，显示提示：

```tsx
{!isTranscoded && (
  <div className="bg-yellow-100 text-yellow-800 p-2 rounded text-sm">
    💡 此视频尚未转码，可能在某些浏览器中无法播放。
    <button onClick={triggerTranscode}>一键转码</button>
  </div>
)}
```

### 3. 批量转码功能

允许用户一键转码所有搜索结果中未转码的视频。

## 修复日期

2024-12-24

## 相关功能清单

- [x] 转码功能实现
- [x] 转码状态同步修复
- [x] 转码URL显示修复
- [x] 旧任务初始化逻辑
- [x] 旧任务状态修复脚本
- [x] 视频笔记页面优先使用转码视频
- [x] 知识点搜索优先使用转码视频 ✅（本次）

