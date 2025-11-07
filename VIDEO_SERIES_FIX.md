# 视频序列识别修复

## 🐛 问题描述

访问 `http://localhost:3000/zh/video-notes-prototype` 页面时，没有显示分P标签，页面展示和之前单视频模式一样。

## 🔍 问题原因

默认视频URL是 `https://www.bilibili.com/video/BV1Jgf6YvE8e?p=3`，包含了`?p=3`参数，指定了第3P。

后端的 `extract_video_info` 方法在处理带有`?p=`参数的URL时，会将其当作单个视频处理，而不是视频序列。

**问题流程**：
```
1. 前端发送URL: BV1Jgf6YvE8e?p=3
2. 后端调用: extract_video_info('BV1Jgf6YvE8e?p=3')
3. yt-dlp识别: 这是序列的第3P → 当作单视频返回
4. 后端判断: is_series = False
5. 前端显示: 单视频模式（无P标签）
```

## ✅ 解决方案

### 修改1: `backend/app/services/batch_analyzer.py`

在 `analyze_video_with_prompt` 方法中，检测序列时先移除URL中的`?p=`参数：

```python
# Step 0: Extract video info to check if it's a series
print(f"📋 Extracting video info: {video_url}")

# 为了检测序列，移除URL中的?p=参数
base_url = video_url.split('?')[0] if '?' in video_url else video_url
video_info = self.bilibili_service.extract_video_info(base_url)

# 如果是视频序列，返回序列信息和所有分P的占位符
if video_info.get('is_series'):
    print(f"🎬 检测到视频序列: {video_info.get('series_title')}")
    print(f"📊 共 {video_info.get('total_parts')} 个分P")
    ...
```

### 修改2: `src/app/[locale]/(marketing)/video-notes-prototype/page.tsx`

在 `pollJobStatus` 函数中，检测URL参数并自动加载指定的P：

```typescript
// 检查URL中是否指定了分P（如?p=3）
let initialPartIndex = 0;
const urlParams = new URLSearchParams(window.location.search);
const pParam = urlParams.get('p');
if (pParam) {
  const partNum = parseInt(pParam, 10);
  if (!isNaN(partNum) && partNum >= 1 && partNum <= result.parts.length) {
    initialPartIndex = partNum - 1; // 转换为0-based索引
    console.log(`📍 URL指定加载P${partNum}`);
  }
}

setCurrentPartIndex(initialPartIndex);

// 自动加载指定的P
await loadPart(result.parts[initialPartIndex], initialPartIndex);
```

## 🎯 修复后的行为

### 场景1: 访问基础URL
```
URL: https://www.bilibili.com/video/BV1Jgf6YvE8e
结果: 
- ✅ 识别为31P视频序列
- ✅ 显示序列标题
- ✅ 显示P1-P31标签
- ✅ 自动加载P1
```

### 场景2: 访问指定P的URL
```
URL: https://www.bilibili.com/video/BV1Jgf6YvE8e?p=3
结果:
- ✅ 识别为31P视频序列
- ✅ 显示序列标题
- ✅ 显示P1-P31标签
- ✅ 自动加载P3（URL指定的P）
- ✅ P3标签高亮显示
```

### 场景3: 真正的单视频
```
URL: https://www.bilibili.com/video/BV1234567890 (假设是单视频)
结果:
- ✅ 识别为单视频
- ✅ 不显示P标签
- ✅ 正常显示视频标题
- ✅ 直接加载视频
```

## 🧪 测试步骤

### 步骤1: 重启后端
```bash
# 停止当前运行的后端
Ctrl+C

# 重新启动
python main.py
```

### 步骤2: 刷新前端
```
访问: http://localhost:3000/zh/video-notes-prototype
```

### 步骤3: 验证显示
- [ ] 看到序列标题："【全748集】目前B站最全最细的Python零基础全套教程..."
- [ ] 看到P标签横向列表：P1 P2 P3 ... P31
- [ ] P3标签高亮显示（紫色渐变背景）
- [ ] P3标签显示名称："P3 Python安装..."
- [ ] 其他P标签只显示P号（灰色背景）
- [ ] 当前显示："当前：P3 - Python安装..."

### 步骤4: 测试交互
- [ ] 点击P1标签 → 视频切换到P1
- [ ] P1标签变为高亮
- [ ] 右侧知识点更新为P1的内容
- [ ] 播放完当前P → 自动切换到下一P

## 📊 技术细节

### URL解析逻辑

```python
# 输入
video_url = "https://www.bilibili.com/video/BV1Jgf6YvE8e?p=3"

# 处理
base_url = video_url.split('?')[0]  # "https://www.bilibili.com/video/BV1Jgf6YvE8e"

# yt-dlp提取
info = yt_dlp.extract_info(base_url)

# 结果
{
  "entries": [...],  # 包含所有31P的信息
  "_type": "playlist",
  "title": "【全748集】Python零基础全套教程",
  ...
}
```

### 前端状态更新

```typescript
// 序列信息
setIsSeries(true)
setSeriesTitle("【全748集】Python零基础全套教程")
setAllParts([...])  // 31个PartInfo对象

// 当前P
setCurrentPartIndex(2)  // P3的索引（0-based）

// 加载P3
await loadPart(parts[2], 2)
  ↓
// 更新视频和知识点
setCdnVideoUrl(...)
setKnowledgePoints(...)
setVideoTitle("P3 - Python安装...")
```

## 🔄 与原有功能的兼容性

| 场景 | 修改前 | 修改后 |
|------|--------|--------|
| 单视频URL | ✅ 正常 | ✅ 正常 |
| 序列基础URL | ❌ 未测试 | ✅ 识别为序列 |
| 序列带?p=URL | ❌ 当作单视频 | ✅ 识别为序列 |
| 缓存机制 | ✅ 正常 | ✅ 正常 |
| 知识点提取 | ✅ 正常 | ✅ 正常 |

## 🚀 后续优化建议

1. **URL统一处理**：创建一个 `normalize_bilibili_url` 工具函数
2. **错误提示优化**：如果?p=参数超出范围，给出友好提示
3. **历史记录**：记住用户上次学习到的P
4. **URL同步**：切换P时更新浏览器URL

---

**修复时间**: 2025-11-07  
**测试状态**: ✅ 待测试  
**相关文件**: 
- `backend/app/services/batch_analyzer.py`
- `src/app/[locale]/(marketing)/video-notes-prototype/page.tsx`

