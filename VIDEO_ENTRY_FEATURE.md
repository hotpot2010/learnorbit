# 视频学习入口功能

## 🎯 功能概述

创建一个全新的"视频学习入口"页面，用户可以输入想学的主题，系统自动从B站搜索相关视频，并使用AI分析每个视频的学习价值，帮助用户快速找到最适合的教学视频。

## ✨ 核心功能

### 1. 智能视频搜索

- **输入**: 学习主题关键词（如"Python基础教程"）
- **搜索**: 从B站搜索TOP 3相关视频
- **排序**: 基于时长、播放量、排名的智能重排序
- **展示**: 视频封面、标题、UP主、时长、播放量等信息

### 2. AI智能分析

对每个视频进行并行AI分析，生成：

- **📚 学习目标** (3-5个要点)
- **👥 适用人群** (一句话描述)
- **✨ 核心特点** (3-5个标签)
- **⭐ 推荐分数** (0-10分)
- **💡 推荐语** (一句话总结)

### 3. 一键学习跳转

- 点击"开始学习"按钮
- 自动跳转到视频笔记页面
- 开始学习该视频

## 📂 项目结构

```
backend/
├── app/
│   ├── services/
│   │   ├── bilibili_search_service.py   # B站视频搜索服务
│   │   └── video_analyzer_service.py    # 视频AI分析服务
│   └── api/
│       └── routes/
│           └── video_search.py           # 搜索API路由
└── main.py                                # 注册路由

frontend/
└── src/
    └── app/
        └── [locale]/
            └── (marketing)/
                └── video-entry/
                    └── page.tsx          # 视频入口页面
```

## 🔧 技术实现

### 后端实现

#### 1. B站视频搜索服务

**文件**: `backend/app/services/bilibili_search_service.py`

**核心功能**:
- 使用 `bilibili-api-python` 库搜索视频
- 提取视频信息：标题、封面、时长、播放量、UP主等
- 智能重排序算法，优先推荐高质量视频

**关键方法**:

```python
class BilibiliSearchService:
    async def search_videos(self, query: str, limit: int = 5) -> List[Dict]:
        """搜索B站视频"""
        search_result = await search.search_by_type(
            query, 
            search.SearchObjectType.VIDEO,
            search.OrderVideo.TOTALRANK
        )
        # 解析并返回视频信息
    
    async def search_videos_with_rerank(self, query: str, limit: int = 5) -> List[Dict]:
        """搜索并重排序"""
        # 基于时长、播放量、排名的综合得分
```

**重排序算法**:

```python
# 综合得分 = 时长分数 * 0.3 + 排名分数 * 0.4 + 播放量分数 * 0.3
video['score'] = duration_score * 0.3 + rank_score * 0.4 + play_score * 0.3
```

#### 2. 视频分析服务

**文件**: `backend/app/services/video_analyzer_service.py`

**核心功能**:
- 使用 Baijia LLM 分析视频
- 生成学习目标、适用人群、核心特点等
- 支持批量并行分析

**LLM Prompt**:

```python
prompt = f"""请分析以下B站视频，生成学习建议。

**视频信息：**
- 标题：{title}
- 描述：{description}
- UP主：{author}
- 时长：{duration}
- 播放量：{play}

**请提供以下分析：**
1. 学习目标（3-5个要点）
2. 适用人群（一句话）
3. 核心特点（3-5个要点）
4. 推荐分数（0-10分）
5. 一句话推荐（不超过50字）

**输出格式（JSON）：**
{{
  "learning_objectives": ["目标1", "目标2", "目标3"],
  "target_audience": "适用人群描述",
  "key_features": ["特点1", "特点2", "特点3"],
  "recommendation_score": 8,
  "analysis_summary": "一句话推荐"
}}
"""
```

**并行分析**:

```python
async def analyze_videos_batch(self, videos: List[Dict]) -> List[Dict]:
    """批量并行分析多个视频"""
    tasks = [self.analyze_video(video) for video in videos]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return results
```

#### 3. API路由

**文件**: `backend/app/api/routes/video_search.py`

**端点**: `POST /video-search/search`

**请求格式**:

```json
{
  "query": "Python基础教程",
  "limit": 3
}
```

**响应格式**:

```json
{
  "success": true,
  "videos": [
    {
      "title": "Python零基础入门教程",
      "url": "https://www.bilibili.com/video/BV1234567890",
      "cover": "https://i0.hdslb.com/bfs/archive/xxx.jpg",
      "duration": "45:30",
      "author": "编程入门小助手",
      "play": 1500000,
      "video_review": 5000,
      "favorites": 50000,
      "description": "从零开始学Python",
      "learning_objectives": [
        "掌握Python基础语法",
        "理解变量和数据类型",
        "学会使用函数和模块"
      ],
      "target_audience": "零基础编程初学者",
      "key_features": [
        "讲解通俗易懂",
        "配套练习题",
        "适合入门"
      ],
      "recommendation_score": 9,
      "analysis_summary": "适合零基础学员，讲解清晰，配套练习丰富"
    }
  ],
  "total": 3,
  "message": "找到 3 个相关视频"
}
```

### 前端实现

#### 页面组件

**文件**: `src/app/[locale]/(marketing)/video-entry/page.tsx`

**核心状态**:

```tsx
const [searchQuery, setSearchQuery] = useState('');       // 搜索关键词
const [videos, setVideos] = useState<VideoInfo[]>([]);   // 视频列表
const [isSearching, setIsSearching] = useState(false);   // 搜索中
const [hasSearched, setHasSearched] = useState(false);   // 已搜索
const [error, setError] = useState('');                   // 错误信息
```

**搜索流程**:

```tsx
const handleSearch = async () => {
  // 1. 验证输入
  if (!searchQuery.trim()) {
    setError('请输入搜索关键词');
    return;
  }

  // 2. 调用后端API
  const response = await fetch('http://localhost:8000/video-search/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: searchQuery, limit: 3 }),
  });

  // 3. 处理结果
  const data = await response.json();
  if (data.success) {
    setVideos(data.videos);
    setHasSearched(true);
  }
};
```

**跳转逻辑**:

```tsx
const handleStartLearning = (videoUrl: string) => {
  // 编码URL并跳转到视频笔记页面
  const encodedUrl = encodeURIComponent(videoUrl);
  router.push(`/zh/video-notes-prototype?videoUrl=${encodedUrl}`);
};
```

#### UI设计

**1. 搜索状态（未搜索）**:

```
┌────────────────────────────────────────────┐
│                                             │
│         🎬 从视频开始学习                    │
│   输入想学的主题，AI帮你找到最适合的教学视频 │
│                                             │
│   ┌─────────────────────┐   ┌─────────┐   │
│   │  🔍 Python基础教程   │   │ 搜索视频 │   │
│   └─────────────────────┘   └─────────┘   │
│                                             │
└────────────────────────────────────────────┘
```

**2. 搜索状态（已搜索）**:

```
┌────────────────────────────────────────────┐
│  🔍 Python基础教程  [搜索视频]              │
└────────────────────────────────────────────┘

为你找到 3 个精选视频

┌────────────────────────────────────────────┐
│ ┌─────────┐  Python零基础入门教程         │
│ │ [封面图] │  UP主：编程入门小助手          │
│ │  45:30  │  ⭐ 推荐度 9/10                │
│ └─────────┘                                │
│ 👁️ 150万  👍 5万                          │
│                                  ┌────────┐│
│ 📚 学习目标                      │        ││
│  • 掌握Python基础语法            │ 开始   ││
│  • 理解变量和数据类型            │ 学习   ││
│  • 学会使用函数和模块            │        ││
│                                  │   ▶️   ││
│ 👥 适用人群                      │        ││
│  零基础编程初学者                └────────┘│
│                                             │
│ ✨ 核心特点                                │
│  [讲解通俗易懂] [配套练习题] [适合入门]   │
│                                             │
│ 💡 适合零基础学员，讲解清晰，配套练习丰富 │
└────────────────────────────────────────────┘
```

**3. 视频卡片结构**:

- **左侧（1/3）**: 视频封面 + 时长 + 统计信息
- **中间（2/3）**: 标题 + AI分析结果
- **右侧**: 开始学习按钮

**4. 颜色方案**:

- 学习目标：蓝色 (`bg-blue-50`, `border-blue-400`)
- 适用人群：绿色 (`bg-green-50`, `border-green-400`)
- 核心特点：紫色 (`bg-purple-50`, `border-purple-400`)
- 推荐语：黄色 (`bg-yellow-50`, `border-yellow-400`)

## 🎨 样式设计

### 复用首页样式

- **网格笔记本背景**：20px x 20px 浅灰色网格
- **手写字体**：`"Comic Sans MS", "Marker Felt", "Kalam", cursive`
- **卡片风格**：圆角、阴影、边框
- **过渡动画**：搜索后输入框上移到顶部

### 响应式设计

```css
/* 桌面端 */
@media (min-width: 768px) {
  - 视频卡片横向布局
  - 封面固定宽度 320px
  - 开始学习按钮垂直居中
}

/* 移动端 */
@media (max-width: 767px) {
  - 视频卡片纵向布局
  - 封面全宽
  - 开始学习按钮横向填充
}
```

## 📊 数据流

```
用户输入主题
    ↓
前端发送搜索请求
    ↓
后端搜索B站视频
    ↓
后端并行调用LLM分析
    ↓
返回分析结果
    ↓
前端展示视频卡片
    ↓
用户点击"开始学习"
    ↓
跳转到视频笔记页面
```

## 🧪 测试指南

### 后端测试

1. **启动后端服务**:

```bash
cd backend
python main.py
```

2. **测试搜索API**:

```bash
curl -X POST http://localhost:8000/video-search/search \
  -H "Content-Type: application/json" \
  -d '{"query": "Python基础教程", "limit": 3}'
```

3. **测试B站搜索服务**:

```bash
cd backend
python -m app.services.bilibili_search_service
```

4. **测试视频分析服务**:

```bash
cd backend
python -m app.services.video_analyzer_service
```

### 前端测试

1. **启动前端服务**:

```bash
npm run dev
```

2. **访问页面**:

```
http://localhost:3000/zh/video-entry
```

3. **测试流程**:

- ✅ 输入搜索关键词
- ✅ 点击"搜索视频"按钮
- ✅ 等待搜索结果（约5-10秒）
- ✅ 查看视频卡片和AI分析
- ✅ 点击"开始学习"按钮
- ✅ 验证是否跳转到视频笔记页面

### 测试用例

| 测试用例 | 输入 | 预期结果 |
|---------|------|---------|
| 正常搜索 | "Python基础教程" | 返回3个视频 + AI分析 |
| 热门主题 | "前端开发" | 返回高播放量视频 |
| 专业主题 | "机器学习算法" | 返回专业内容视频 |
| 空输入 | "" | 显示错误提示 |
| 无结果 | "随机字符串xyzabc" | 显示空状态 |

## 🚀 部署说明

### 环境变量

在 `backend/.env` 中配置：

```env
# Baijia LLM API
BAIJIA_API_KEY=your_api_key_here
BAIJIA_BASE_URL=https://llm.baijia.com/v1/chat/completions
BAIJIA_MODEL=gpt-3.5-turbo

# CORS
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### 依赖安装

**后端**:

```bash
cd backend
pip install bilibili-api-python
```

已安装的依赖：
- `bilibili-api-python` (17.4.0)
- `beautifulsoup4`
- `colorama`
- `pyyaml`
- `brotli`
- `qrcode`
- `APScheduler`

**前端**: 无新增依赖

## 📝 API文档

### POST /video-search/search

**描述**: 搜索B站视频并进行AI分析

**请求体**:

```typescript
{
  query: string;    // 搜索关键词
  limit?: number;   // 返回数量，默认3，最大10
}
```

**响应**:

```typescript
{
  success: boolean;
  videos: Array<{
    // 视频基本信息
    title: string;
    url: string;
    cover: string;
    duration: string;
    author: string;
    play: number;
    video_review: number;
    favorites: number;
    description: string;
    
    // AI分析结果
    learning_objectives: string[];
    target_audience: string;
    key_features: string[];
    recommendation_score: number;
    analysis_summary: string;
  }>;
  total: number;
  message: string;
}
```

**状态码**:

- `200`: 成功
- `400`: 参数错误
- `500`: 服务器错误

## 💡 优化建议

### 已实现

- ✅ B站视频智能搜索
- ✅ 基于时长/播放量的重排序
- ✅ 并行LLM分析（提高速度）
- ✅ 响应式UI设计
- ✅ 错误处理和加载状态
- ✅ 一键跳转学习

### 未来可优化

1. **缓存机制**:
   - 缓存搜索结果（相同关键词24小时内复用）
   - 缓存LLM分析结果

2. **搜索增强**:
   - 支持筛选（时长、播放量、发布时间）
   - 支持排序（最新、最热、最相关）
   - 搜索历史记录

3. **分析增强**:
   - 提取视频目录/章节
   - 识别视频类型（教程/项目/理论）
   - 评估视频质量（评论分析）

4. **用户体验**:
   - 视频预览播放
   - 收藏/点赞功能
   - 学习进度跟踪

5. **性能优化**:
   - 懒加载视频卡片
   - 虚拟滚动（大量结果）
   - SSR/SSG优化首屏加载

## ✅ 完成状态

- ✅ 后端：bilibili-api依赖安装
- ✅ 后端：B站视频搜索服务
- ✅ 后端：视频AI分析服务
- ✅ 后端：搜索API路由
- ✅ 前端：视频入口页面
- ✅ 前端：搜索UI和结果展示
- ✅ 前端：视频卡片和跳转功能
- ✅ 无语法错误
- ✅ 无linter错误

## 🔗 相关文件

- `backend/app/services/bilibili_search_service.py`
- `backend/app/services/video_analyzer_service.py`
- `backend/app/api/routes/video_search.py`
- `backend/main.py`
- `src/app/[locale]/(marketing)/video-entry/page.tsx`

---

**状态**: ✅ 功能开发完成

**下一步**: 启动服务并测试完整流程！🚀

**访问地址**: `http://localhost:3000/zh/video-entry`

