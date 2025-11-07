# 视频序列支持功能实现

## 📋 功能概述

为视频笔记页面 (`/zh/video-notes-prototype`) 添加了完整的视频序列支持，允许用户学习B站多P视频系列。

## ✨ 功能特性

### 1. 视频序列识别
- 自动检测B站视频是否为多P序列
- 提取序列标题和所有分P信息
- 返回每个分P的标题、时长、URL等元数据

### 2. UI展示
- **序列标题**：显示在视频上方的一行
- **P标签列表**：横向滚动的标签栏
  - 当前正在播放的P：渐变背景（紫色），显示P号+标题
  - 其他P：灰色背景，只显示P号
  - 加载中：显示加载动画
  - 高亮当前P（放大效果）

### 3. 分P切换
- **手动切换**：点击P标签立即切换
- **自动播放**：视频播放完自动切换到下一P
- **知识点刷新**：切换P时自动加载新的知识点

### 4. 知识点管理
- 每个P独立的知识点列表
- 切换P时自动重置展开状态
- 视频自动跳转到第一个知识点

## 🔧 技术实现

### 后端改动

#### 1. `backend/app/services/bilibili_service.py`
```python
# extract_video_info 方法增强
- 检测多P视频（entries字段）
- 返回序列信息：
  - is_series: bool
  - total_parts: int
  - series_title: str
  - parts: List[PartInfo]

# download_video 方法增强
- 提取分P元数据：
  - part_number
  - total_parts
  - series_title
```

#### 2. `backend/app/services/batch_analyzer.py`
```python
# 新增 analyze_single_part 方法
- 分析单个分P视频
- 包含缓存支持
- 返回完整的知识点分析结果

# analyze_video_with_prompt 方法修改
- 检测视频序列
- 返回所有分P的占位信息
- 前端逐个请求分P分析
```

#### 3. `backend/app/api/routes/batch_analysis.py`
```python
# 新增 POST /batch/analyze-part 端点
- 请求参数：
  - video_url: str
  - prompt: str
  - part_number: int
- 返回单个P的完整分析结果
```

### 前端改动

#### 1. 类型定义
```typescript
interface PartInfo {
  part_number: number;
  part_title: string;
  duration: number;
  url: string;
  bv_id: string;
}

interface VideoAnalysisResult {
  // 新增字段
  is_series?: boolean;
  series_title?: string;
  total_parts?: number;
  parts?: PartInfo[];
  // 原有字段...
}
```

#### 2. 状态管理
```typescript
// 新增状态
const [isSeries, setIsSeries] = useState(false);
const [seriesTitle, setSeriesTitle] = useState<string>('');
const [allParts, setAllParts] = useState<PartInfo[]>([]);
const [currentPartIndex, setCurrentPartIndex] = useState(0);
const [loadingPartIndex, setLoadingPartIndex] = useState<number | null>(null);
```

#### 3. 核心函数
```typescript
// loadPart - 加载单个分P
- 调用 /batch/analyze-part API
- 更新视频URL、知识点、逐字稿
- 重置播放状态

// handleVideoEnded - 视频结束处理
- 检测是否为序列视频
- 自动加载下一个P

// pollJobStatus - 任务状态轮询
- 检测序列视频
- 自动加载第1P
```

#### 4. UI组件
```tsx
{/* 序列标题和P标签 */}
{isSeries ? (
  <div className="space-y-3">
    {/* 序列标题 */}
    <h2>{seriesTitle}</h2>
    
    {/* P标签横向列表 */}
    <div className="flex gap-2 overflow-x-auto">
      {allParts.map((part, index) => (
        <button
          onClick={() => loadPart(part, index)}
          className={isActive ? 'active-style' : 'normal-style'}
        >
          P{part.part_number}
          {isActive && part.part_title}
        </button>
      ))}
    </div>
    
    {/* 当前P标题 */}
    <div>当前：{videoTitle}</div>
  </div>
) : (
  /* 单视频标题 */
  <h2>{videoTitle}</h2>
)}
```

## 📊 数据流

```
1. 用户访问页面
   ↓
2. 调用 POST /batch/jobs（初次解析）
   ↓
3. 后端检测：是否为序列视频？
   ├─ 是 → 返回序列信息（不分析）
   └─ 否 → 正常分析单视频
   ↓
4. 前端接收结果
   ├─ 序列 → 显示P标签列表
   │         ↓
   │      自动加载P1（POST /batch/analyze-part）
   │         ↓
   │      显示P1的知识点
   │
   └─ 单视频 → 直接显示知识点
   ↓
5. 用户操作
   ├─ 点击P标签 → 加载对应P
   ├─ 视频播放完 → 自动加载下一P
   └─ 切换P时 → 刷新知识点列表
```

## 🎯 使用示例

### 测试视频
```
https://www.bilibili.com/video/BV1Jgf6YvE8e
```

这是一个31P的Python教程系列，系统会：
1. 识别为序列视频
2. 显示"Python零基础全套教程"标题
3. 显示P1-P31的横向标签
4. 默认加载P1
5. 用户可点击任意P标签切换
6. 播放完P1后自动播放P2

## 🔄 缓存策略

- **序列识别**：首次调用缓存序列元数据
- **分P分析**：每个P独立缓存（7天）
- **知识点**：每个P的知识点独立缓存
- **笔记/Q&A/练习**：基于`video_url + knowledge_point_name`缓存

## ⚡ 性能优化

1. **延迟加载**：只在用户切换时加载对应P
2. **缓存复用**：重复访问的P直接从缓存读取
3. **并行请求**：笔记生成等可并行执行
4. **状态重置**：切换P时清理旧状态，避免内存泄漏

## 📝 注意事项

1. **后端兼容性**：单视频仍按原逻辑处理
2. **错误处理**：P加载失败不影响其他P
3. **用户体验**：加载时显示loading状态
4. **自动播放**：仅在当前P播放完成时触发

## 🚀 后续优化方向

1. **预加载**：提前加载下一P的内容
2. **进度保存**：记录用户学习到第几P
3. **播放列表**：支持自定义P的学习顺序
4. **批量操作**：一次性加载多个P的知识点
5. **智能推荐**：根据学习进度推荐相关视频

---

**实现时间**: 2025-11-07  
**文件**: `VIDEO_SERIES_SUPPORT.md`

