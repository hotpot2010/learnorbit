# 转码视频URL显示修复

## 问题描述

转码视频步骤完成后，前端界面不显示结果URL，用户无法看到转码后的视频链接。

## 根本原因

前端HTML模板中有三处缺少对 `transcode` 步骤的URL处理：

1. **单P视频渲染逻辑**（第943-966行）：获取结果URL时没有处理 `transcode` 步骤
2. **previewResult 函数**（第1502-1506行）：没有解析 `transcoded_video_url`
3. **previewResult 函数**（第1509-1550行）：多P和单P的预览逻辑中都没有处理 `transcode` 步骤

**对比其他步骤：**
- ✅ `download` - 已处理
- ❌ `transcode` - 缺失（本次修复）
- ✅ `asr` - 已处理
- ✅ `knowledge_points` - 已处理
- ✅ `screenshots` - 已处理
- ✅ `exercises` - 已处理

## 修复内容

### 1. 单P视频：添加转码URL获取逻辑

**位置：** 第943-966行

**修复前：**
```javascript
// 获取结果URL（必须在canPreview之前）
let resultUrl = null;
if (step.key === 'download' && task.video_url) {
    resultUrl = typeof task.video_url === 'string' && task.video_url.startsWith('[') 
        ? JSON.parse(task.video_url)[0] 
        : task.video_url;
} else if (step.key === 'asr' && task.asr_result_url) {
    // ... 其他步骤
}
// ❌ 缺少 transcode 处理
```

**修复后：**
```javascript
// 获取结果URL（必须在canPreview之前）
let resultUrl = null;
if (step.key === 'download' && task.video_url) {
    resultUrl = typeof task.video_url === 'string' && task.video_url.startsWith('[') 
        ? JSON.parse(task.video_url)[0] 
        : task.video_url;
} else if (step.key === 'transcode' && task.transcoded_video_url) {
    // ✅ 添加转码URL处理
    resultUrl = typeof task.transcoded_video_url === 'string' && task.transcoded_video_url.startsWith('[') 
        ? JSON.parse(task.transcoded_video_url)[0] 
        : task.transcoded_video_url;
} else if (step.key === 'asr' && task.asr_result_url) {
    // ... 其他步骤
}
```

### 2. previewResult：解析转码视频URL数组

**位置：** 第1501-1506行

**修复前：**
```javascript
// 解析多P任务的URL数组
const videoUrls = parseUrls(task.video_url);
const asrResultUrls = parseUrls(task.asr_result_url);
// ... 其他URL数组
// ❌ 缺少 transcoded_video_url 解析
```

**修复后：**
```javascript
// 解析多P任务的URL数组
const videoUrls = parseUrls(task.video_url);
const transcodedVideoUrls = parseUrls(task.transcoded_video_url);  // ✅ 添加
const asrResultUrls = parseUrls(task.asr_result_url);
// ... 其他URL数组
```

### 3. previewResult：多P视频预览逻辑

**位置：** 第1509-1523行

**修复前：**
```javascript
if (partNumber && task.is_series) {
    const partIndex = partNumber - 1;
    if (step === 'download' && videoUrls[partIndex]) {
        window.open(videoUrls[partIndex], '_blank');
        return;
    } else if (step === 'asr' && asrResultUrls[partIndex]) {
        // ... 其他步骤
    }
    // ❌ 缺少 transcode 处理
}
```

**修复后：**
```javascript
if (partNumber && task.is_series) {
    const partIndex = partNumber - 1;
    if (step === 'download' && videoUrls[partIndex]) {
        window.open(videoUrls[partIndex], '_blank');
        return;
    } else if (step === 'transcode' && transcodedVideoUrls[partIndex]) {
        // ✅ 添加转码视频预览
        window.open(transcodedVideoUrls[partIndex], '_blank');
        return;
    } else if (step === 'asr' && asrResultUrls[partIndex]) {
        // ... 其他步骤
    }
}
```

### 4. previewResult：单P视频预览逻辑

**位置：** 第1525-1549行

**修复前：**
```javascript
// 单P任务或未指定partNumber
if (step === 'download' && task.video_url) {
    const url = typeof task.video_url === 'string' && task.video_url.startsWith('[') 
        ? JSON.parse(task.video_url)[0] 
        : task.video_url;
    window.open(url, '_blank');
    return;
} else if (step === 'asr' && task.asr_result_url) {
    // ... 其他步骤
}
// ❌ 缺少 transcode 处理
```

**修复后：**
```javascript
// 单P任务或未指定partNumber
if (step === 'download' && task.video_url) {
    const url = typeof task.video_url === 'string' && task.video_url.startsWith('[') 
        ? JSON.parse(task.video_url)[0] 
        : task.video_url;
    window.open(url, '_blank');
    return;
} else if (step === 'transcode' && task.transcoded_video_url) {
    // ✅ 添加转码视频预览
    const url = typeof task.transcoded_video_url === 'string' && task.transcoded_video_url.startsWith('[') 
        ? JSON.parse(task.transcoded_video_url)[0] 
        : task.transcoded_video_url;
    window.open(url, '_blank');
    return;
} else if (step === 'asr' && task.asr_result_url) {
    // ... 其他步骤
}
```

## 修复效果

### 修复前 ❌

转码步骤完成后：
- 没有显示结果URL
- 点击"预览"按钮无反应或报错
- 用户无法获取转码后的视频链接

### 修复后 ✅

转码步骤完成后：
1. **显示结果URL**
   ```
   📎 结果URL: https://file.gsxservice.com/3396778378_yyc6jrzv.mp4
   ```
   - 在步骤信息下方显示灰色背景框
   - 显示完整的CDN链接
   - 链接可点击，在新标签页打开

2. **预览按钮正常工作**
   - 点击"预览"按钮直接在新标签页打开视频
   - 支持单P和多P视频
   - 视频可以直接播放

3. **与其他步骤一致**
   - 界面风格与 download、asr 等步骤保持一致
   - 用户体验统一

## 测试验证

### 单P视频测试

1. 执行转码任务
2. 转码完成后，查看步骤详情
3. 验证点：
   - ✅ 显示 "📎 结果URL: https://..."
   - ✅ URL 可点击
   - ✅ 点击"预览"按钮可打开视频

### 多P视频测试

1. 执行多P视频转码任务
2. 切换不同分P标签
3. 验证点：
   - ✅ 每个分P都显示各自的转码URL
   - ✅ 点击不同分P的"预览"按钮，打开对应的转码视频
   - ✅ URL正确对应分P编号

## 相关文件

- `backend/templates/offline-video.html`
  - 第 943-966 行：单P视频URL获取逻辑
  - 第 1502-1506 行：URL数组解析
  - 第 1509-1523 行：多P视频预览逻辑
  - 第 1525-1549 行：单P视频预览逻辑

## 修复日期

2024-12-24

## 相关功能

- [x] 转码功能实现
- [x] 转码状态同步修复
- [x] 转码URL显示修复 ✅（本次）
- [x] 旧任务初始化逻辑
- [x] 旧任务状态修复脚本

