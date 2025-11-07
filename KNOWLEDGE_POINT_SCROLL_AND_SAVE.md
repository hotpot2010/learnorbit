# 知识点滚动优化和保存功能

## 功能概述

本次优化包含三个功能：

1. ✅ **自动滚动到顶部**：当前知识点始终显示在列表顶部
2. ✅ **自动展开当前知识点**：播放到某个知识点时，自动展开该知识点，收起其他知识点
3. ✅ **保存笔记按钮**：在知识点列表下方添加保存按钮（功能待实现）

## 功能详解

### 1. 自动滚动到顶部

#### 需求
当视频播放或用户点击知识点时，希望当前知识点始终显示在列表的顶部，方便用户查看。

#### 实现

##### 修改前
```typescript
const scrollToKnowledgePoint = (index: number) => {
  if (knowledgeListRef.current) {
    const knowledgeCard = knowledgeListRef.current.children[index] as HTMLElement;
    if (knowledgeCard) {
      knowledgeCard.scrollIntoView({
        behavior: 'smooth',
        block: 'center'  // ❌ 居中显示
      });
    }
  }
};
```

##### 修改后
```typescript
const scrollToKnowledgePoint = (index: number) => {
  if (knowledgeListRef.current) {
    const knowledgeCard = knowledgeListRef.current.children[index] as HTMLElement;
    if (knowledgeCard) {
      knowledgeCard.scrollIntoView({
        behavior: 'smooth',
        block: 'start'  // ✅ 顶部对齐
      });
    }
  }
};
```

#### `scrollIntoView` 参数说明

| 参数 | 值 | 效果 |
|------|-----|------|
| `behavior` | `'smooth'` | 平滑滚动 |
| `behavior` | `'auto'` | 立即跳转 |
| `block` | `'start'` | 元素顶部对齐容器顶部 ✅ |
| `block` | `'center'` | 元素居中显示 |
| `block` | `'end'` | 元素底部对齐容器底部 |
| `block` | `'nearest'` | 最近位置对齐 |

#### 视觉效果对比

##### 修改前（center）
```
┌─────────────────────┐
│                     │
│   知识点 1          │
│   知识点 2          │
│ ▶ 知识点 3 (当前)   │ ← 居中
│   知识点 4          │
│   知识点 5          │
│                     │
└─────────────────────┘
```

##### 修改后（start）
```
┌─────────────────────┐
│ ▶ 知识点 3 (当前)   │ ← 顶部对齐
│   知识点 4          │
│   知识点 5          │
│   知识点 6          │
│   知识点 7          │
│   知识点 8          │
│                     │
└─────────────────────┘
```

### 2. 自动展开当前知识点

#### 需求
- 当用户点击某个知识点时，自动展开该知识点，同时收起其他所有知识点
- 当视频播放到某个知识点时，也应该自动展开

#### 实现

##### 点击知识点时
```typescript
<div 
  className="flex items-center justify-between gap-3 cursor-pointer"
  onClick={() => {
    handleTimeJump(point.start_time);
    setCurrentKnowledgeIndex(index);
    
    // ✅ 自动展开当前知识点（只保留当前索引）
    setExpandedKnowledgePoints(new Set([index]));
    
    // ✅ 滚动到顶部
    scrollToKnowledgePoint(index);
  }}
>
```

**关键代码**:
```typescript
// 创建一个只包含当前索引的新 Set
setExpandedKnowledgePoints(new Set([index]));
```

这样会：
- ✅ 展开当前知识点（`index`）
- ✅ 自动收起其他所有知识点（Set中只有一个元素）

##### 视频播放时自动展开

在 `handleTimeUpdate` 中也有类似逻辑：

```typescript
const handleTimeUpdate = () => {
  if (!videoRef.current) return;
  const time = videoRef.current.currentTime;
  setCurrentTime(time);

  // 查找当前播放时间对应的知识点
  for (let i = 0; i < knowledgePoints.length; i++) {
    const point = knowledgePoints[i];
    const startSeconds = timeToSeconds(point.start_time);
    const endSeconds = timeToSeconds(point.end_time);
    
    if (time >= startSeconds && time < endSeconds) {
      if (currentKnowledgeIndex !== i) {
        setCurrentKnowledgeIndex(i);
        
        // ✅ 自动展开当前知识点
        setExpandedKnowledgePoints(new Set([i]));
        
        // ✅ 滚动到顶部
        scrollToKnowledgePoint(i);
      }
      break;
    }
  }
};
```

#### 展开状态管理

使用 `Set` 数据结构管理展开状态：

```typescript
const [expandedKnowledgePoints, setExpandedKnowledgePoints] = useState<Set<number>>(new Set());
```

**为什么使用 Set？**
- ✅ 自动去重
- ✅ O(1) 查询复杂度
- ✅ 简洁的 API（`has()`, `add()`, `delete()`）

**检查是否展开**:
```typescript
const isExpanded = expandedKnowledgePoints.has(index);
```

**只展开一个（当前）**:
```typescript
setExpandedKnowledgePoints(new Set([currentIndex]));
```

**切换展开/收起**（手动点击展开图标时）:
```typescript
const toggleKnowledgePoint = (index: number) => {
  setExpandedKnowledgePoints(prev => {
    const newSet = new Set(prev);
    if (newSet.has(index)) {
      newSet.delete(index);  // 收起
    } else {
      newSet.add(index);     // 展开
    }
    return newSet;
  });
};
```

### 3. 保存笔记按钮

#### 需求
在知识点列表下方添加一个"保存笔记"按钮，用于将所有笔记保存到服务器。

#### 实现

##### UI 设计
```tsx
{/* 保存笔记按钮 */}
{knowledgePoints.length > 0 && (
  <div className="mt-4 px-4">
    <button
      onClick={() => {
        // TODO: 实现保存笔记功能
        alert('保存笔记功能待实现');
      }}
      className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium rounded-lg shadow-md hover:shadow-lg hover:from-green-600 hover:to-emerald-600 transition-all duration-200 flex items-center justify-center gap-2"
    >
      <svg 
        className="w-5 h-5" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" 
        />
      </svg>
      保存笔记
    </button>
  </div>
)}
```

##### 样式特点

| 特性 | 说明 |
|------|------|
| **渐变背景** | `from-green-500 to-emerald-500` - 绿色到翠绿色渐变 |
| **阴影效果** | `shadow-md` 正常，`hover:shadow-lg` 悬停加深 |
| **过渡动画** | `transition-all duration-200` - 平滑过渡 |
| **悬停效果** | `hover:from-green-600 hover:to-emerald-600` - 变深 |
| **图标** | SVG下载图标，表示保存动作 |
| **全宽** | `w-full` - 占满容器宽度 |
| **条件渲染** | `knowledgePoints.length > 0` - 有知识点时才显示 |

##### 按钮位置

```
┌─────────────────────────────┐
│  知识点列表                 │
│  ┌─────────────────────┐    │
│  │ 知识点 1            │    │
│  └─────────────────────┘    │
│  ┌─────────────────────┐    │
│  │ 知识点 2            │    │
│  └─────────────────────┘    │
│  ┌─────────────────────┐    │
│  │ 知识点 3            │    │
│  └─────────────────────┘    │
│                             │
│  ┌─────────────────────┐    │
│  │  💾 保存笔记        │    │ ← 按钮位置
│  └─────────────────────┘    │
└─────────────────────────────┘
```

#### 未来实现建议

```typescript
const handleSaveNotes = async () => {
  try {
    // 1. 收集所有笔记数据
    const notesToSave = knowledgePoints
      .filter(point => point.note) // 只保存有笔记的知识点
      .map(point => ({
        name: point.name,
        start_time: point.start_time,
        end_time: point.end_time,
        note: point.note,
        thumbnail: point.thumbnail,
      }));

    // 2. 调用后端API保存
    const response = await fetch('http://localhost:8000/notes/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video_url: currentVideoUrl,
        video_title: videoTitle,
        notes: notesToSave,
      }),
    });

    if (!response.ok) {
      throw new Error('保存失败');
    }

    // 3. 显示成功提示
    alert('✅ 笔记保存成功！');
  } catch (error) {
    console.error('❌ 保存笔记失败:', error);
    alert('❌ 保存笔记失败，请重试');
  }
};
```

## 用户交互流程

### 场景1: 用户点击知识点

```
用户点击知识点 3
    ↓
1. 视频跳转到知识点3的开始时间
    ↓
2. 当前索引更新为 3
    ↓
3. 展开知识点3，收起其他所有知识点
    ↓
4. 列表滚动，知识点3显示在顶部
```

### 场景2: 视频自动播放

```
视频播放到知识点4的时间区间
    ↓
1. 检测到进入新知识点
    ↓
2. 当前索引更新为 4
    ↓
3. 展开知识点4，收起其他所有知识点
    ↓
4. 列表自动滚动，知识点4显示在顶部
    ↓
5. 知识点4高亮显示（绿色背景）
```

### 场景3: 用户手动点击展开/收起图标

```
用户点击知识点2的展开/收起图标
    ↓
1. 不影响当前播放状态
    ↓
2. 切换知识点2的展开/收起状态
    ↓
3. 不滚动（保持当前视图位置）
```

### 场景4: 保存笔记

```
用户点击"保存笔记"按钮
    ↓
1. 收集所有有笔记的知识点
    ↓
2. 调用后端API保存
    ↓
3. 显示成功/失败提示
    ↓
4. （未来）更新保存状态图标
```

## 代码结构

### 状态管理
```typescript
// 当前知识点索引
const [currentKnowledgeIndex, setCurrentKnowledgeIndex] = useState<number>(-1);

// 展开的知识点集合
const [expandedKnowledgePoints, setExpandedKnowledgePoints] = useState<Set<number>>(new Set());

// 引用知识点列表容器
const knowledgeListRef = useRef<HTMLDivElement>(null);
```

### 关键函数

| 函数 | 功能 | 调用时机 |
|------|------|----------|
| `scrollToKnowledgePoint(index)` | 滚动到指定知识点（顶部对齐） | 播放进度更新、点击知识点 |
| `handleTimeJump(timeString)` | 跳转到指定时间 | 点击知识点 |
| `handleTimeUpdate()` | 监听视频播放进度，更新当前知识点 | 视频播放时持续触发 |
| `toggleKnowledgePoint(index)` | 切换单个知识点的展开/收起 | 点击展开/收起图标 |

### 事件流

```
视频播放
  ↓
handleTimeUpdate
  ↓
检测知识点变化
  ↓
┌──────────────────┐
│ 更新当前索引     │
│ 展开当前知识点   │ → setExpandedKnowledgePoints(new Set([i]))
│ 滚动到顶部       │ → scrollToKnowledgePoint(i)
└──────────────────┘
  ↓
UI更新
  ↓
当前知识点高亮、展开、在顶部显示
```

## 技术细节

### 滚动性能优化

使用 `scrollIntoView` 的原因：
- ✅ 浏览器原生API，性能优秀
- ✅ 支持平滑动画
- ✅ 自动处理边界情况
- ✅ 无需手动计算滚动距离

### 状态更新优化

```typescript
// ❌ 不好的做法：每次都重新创建对象
setExpandedKnowledgePoints({ ...prev, [index]: true });

// ✅ 好的做法：使用Set
setExpandedKnowledgePoints(new Set([index]));
```

**Set 的优势**:
- 自动去重
- 更简洁的API
- 更好的语义化
- 更高的性能（O(1) vs O(n)）

### 避免不必要的滚动

```typescript
if (currentKnowledgeIndex !== i) {
  // 只有当知识点真正改变时才滚动
  setCurrentKnowledgeIndex(i);
  setExpandedKnowledgePoints(new Set([i]));
  scrollToKnowledgePoint(i);
}
```

这样避免了：
- ❌ 频繁的DOM操作
- ❌ 不必要的滚动动画
- ❌ 用户体验不佳

## 样式调整

### 知识点卡片样式

```tsx
<div className={`rounded-lg p-4 border-2 transition-all duration-200 ${
  isActive
    ? 'bg-green-100 border-green-500 shadow-lg'
    : 'bg-white border-green-200 hover:border-green-400 hover:shadow-md'
}`}>
```

| 状态 | 背景 | 边框 | 阴影 |
|------|------|------|------|
| **激活** | `bg-green-100` 浅绿 | `border-green-500` 深绿 | `shadow-lg` 大阴影 |
| **正常** | `bg-white` 白色 | `border-green-200` 淡绿 | 无 |
| **悬停** | `bg-white` | `border-green-400` 中绿 | `shadow-md` 中阴影 |

### 保存按钮渐变

```css
bg-gradient-to-r from-green-500 to-emerald-500
```

渐变方向：从左到右（`to-r`）
- 起点颜色：`from-green-500` (#10B981)
- 终点颜色：`to-emerald-500` (#10B981)

悬停状态：
```css
hover:from-green-600 hover:to-emerald-600
```

## 测试检查清单

### 功能测试
- [ ] 点击知识点，视频跳转到对应时间 ✅
- [ ] 点击知识点，该知识点展开，其他收起 ✅
- [ ] 点击知识点，列表滚动到顶部 ✅
- [ ] 视频播放，自动高亮当前知识点 ✅
- [ ] 视频播放，自动展开当前知识点 ✅
- [ ] 视频播放，列表自动滚动到顶部 ✅
- [ ] 手动点击展开/收起图标，正常切换 ✅
- [ ] 保存笔记按钮显示在列表底部 ✅
- [ ] 点击保存按钮，显示提示信息 ✅

### 边界情况测试
- [ ] 第一个知识点 - 滚动行为正常
- [ ] 最后一个知识点 - 滚动行为正常
- [ ] 快速点击多个知识点 - 不出现卡顿
- [ ] 视频快进/快退 - 知识点正确更新
- [ ] 没有知识点时 - 保存按钮不显示

### 性能测试
- [ ] 100+ 知识点 - 滚动流畅
- [ ] 快速播放 - 无性能问题
- [ ] 内存占用正常

## 未来优化建议

### 1. 虚拟滚动
如果知识点数量很大（1000+），可以考虑使用虚拟滚动：

```bash
npm install react-window
```

```tsx
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={knowledgePoints.length}
  itemSize={100}
>
  {({ index, style }) => (
    <div style={style}>
      {/* 知识点卡片 */}
    </div>
  )}
</FixedSizeList>
```

### 2. 防抖滚动
避免频繁触发滚动：

```typescript
import { debounce } from 'lodash';

const debouncedScroll = debounce(scrollToKnowledgePoint, 100);
```

### 3. 保存状态持久化
将笔记保存到 localStorage：

```typescript
useEffect(() => {
  const saved = localStorage.getItem(`notes-${currentVideoUrl}`);
  if (saved) {
    setKnowledgePoints(JSON.parse(saved));
  }
}, [currentVideoUrl]);

useEffect(() => {
  localStorage.setItem(`notes-${currentVideoUrl}`, JSON.stringify(knowledgePoints));
}, [knowledgePoints]);
```

### 4. 自动保存
定期自动保存，避免用户忘记保存：

```typescript
useEffect(() => {
  const autoSaveInterval = setInterval(() => {
    if (knowledgePoints.some(p => p.note)) {
      handleSaveNotes();
    }
  }, 60000); // 每分钟自动保存一次

  return () => clearInterval(autoSaveInterval);
}, [knowledgePoints]);
```

## 总结

### 本次修改

| 功能 | 状态 | 说明 |
|------|------|------|
| **滚动到顶部** | ✅ 已完成 | 修改 `scrollIntoView` 的 `block` 参数为 `'start'` |
| **自动展开当前** | ✅ 已完成 | 使用 `Set([index])` 只展开当前知识点 |
| **保存笔记按钮** | ✅ UI完成 | 按钮已添加，功能待实现 |

### 修改的文件
- ✅ `src/app/[locale]/(marketing)/video-notes-prototype/page.tsx`
  - 修改 `scrollToKnowledgePoint` 函数
  - 修改点击知识点的事件处理
  - 添加保存笔记按钮UI

### 代码行数
- 新增代码：约 30 行
- 修改代码：约 10 行

### 用户体验提升
- ✅ 当前知识点始终在视线范围内（顶部）
- ✅ 只展开一个知识点，界面更简洁
- ✅ 自动滚动，无需手动查找
- ✅ 保存按钮醒目，操作便捷

🎉 **现在刷新页面，体验优化后的知识点滚动和展开效果！**

