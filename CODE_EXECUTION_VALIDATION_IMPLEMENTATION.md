# 代码执行与答案验证功能实现文档

## 🎯 功能概述

实现了3个高优先级功能：
1. **练习缓存** - 避免重复生成相同的练习题
2. **代码执行** - 在Docker沙箱中安全执行代码
3. **答案验证** - 使用LLM评分并显示详细反馈

## ✅ 后端实现（已完成）

### 1. 练习缓存服务

**文件**: `backend/app/services/exercise_cache_service.py`

```python
class ExerciseCacheService:
    """练习题缓存服务"""
    
    def get_cached_exercise(video_url, knowledge_point_name, max_age_hours=168):
        """获取缓存的练习题（默认7天有效）"""
    
    def set_cached_exercise(video_url, knowledge_point_name, exercise, metadata):
        """保存练习题到缓存"""
    
    def clear_cache():
        """清除所有缓存"""
    
    def get_cache_stats():
        """获取缓存统计信息"""
```

**特性**：
- 基于视频URL和知识点名称生成唯一缓存键（MD5）
- 支持设置缓存过期时间（默认7天）
- 存储在 `cache/exercises/` 目录
- 包含索引文件 `exercise_index.json`

### 2. 代码执行服务

**文件**: `backend/app/services/code_execution_service.py`

```python
class CodeExecutionService:
    """代码执行服务"""
    
    async def execute_code(code, language, test_inputs=None):
        """在Docker容器中执行代码"""
    
    async def validate_with_test_cases(code, language, test_cases):
        """使用测试用例验证代码"""
```

**特性**：
- 使用Docker容器隔离执行（安全）
- 支持Python和JavaScript
- 资源限制：内存128MB，CPU 0.5核，超时10秒
- 禁用网络访问
- Docker不可用时，Python可回退到本地执行（警告：不安全）
- 自动运行测试用例并返回结果

**Docker镜像**：
- Python: `python:3.11-slim`
- JavaScript: `node:18-slim`

### 3. API端点

**文件**: `backend/app/api/routes/notes.py`

#### 3.1 练习生成（已集成缓存）

```
POST /notes/generate-exercise
```

**请求**：
```json
{
  "knowledge_point_name": "知识点名称",
  "transcript_segment": "逐字稿片段",
  "video_title": "视频标题",
  "video_url": "视频URL"
}
```

**响应**：
```json
{
  "success": true,
  "exercise": { ... },
  "from_cache": false
}
```

**流程**：
1. 检查缓存，如果存在且未过期，直接返回
2. 调用LLM生成新练习题
3. 保存到缓存
4. 返回结果

#### 3.2 代码执行

```
POST /notes/execute-code
```

**请求**：
```json
{
  "code": "print('Hello')",
  "language": "python",
  "test_inputs": ["input1", "input2"]
}
```

**响应**：
```json
{
  "success": true,
  "output": "Hello\n",
  "error": null,
  "exit_code": 0,
  "warning": null
}
```

#### 3.3 答案验证

```
POST /notes/validate-answer
```

**请求**：
```json
{
  "user_code": "用户代码",
  "exercise": { ... },
  "language": "python",
  "video_url": "视频URL",
  "knowledge_point_name": "知识点名称"
}
```

**响应**：
```json
{
  "success": true,
  "passed": true,
  "score": 95,
  "feedback": "代码实现正确...\n\n**✨ 优点**:\n- ...\n\n**💡 改进建议**:\n- ...",
  "test_results": {
    "all_passed": true,
    "passed_count": 3,
    "total_count": 3,
    "results": [...]
  }
}
```

**验证流程**：
1. 运行所有测试用例（如果有）
2. 调用LLM进行深度评估
3. LLM评估维度：
   - 功能正确性 (40%)
   - 代码质量 (30%)
   - 测试通过率 (20%)
   - 最佳实践 (10%)
4. 返回评分、反馈、优点、改进建议

**评分标准**：
- 90-100分：测试全过 + 代码质量好
- 70-89分：测试全过 + 代码质量一般
- 40-69分：部分测试通过
- 0-39分：测试全挂或无法运行

## 📱 前端实现

### 1. 类型定义扩展

```typescript
interface KnowledgePoint {
  // ... 原有字段
  codeOutput?: string;  // 代码执行输出
  codeError?: string;  // 代码执行错误
  validationResult?: ValidationResult;  // 答案验证结果
  isRunningCode?: boolean;  // 是否正在运行代码
  isValidating?: boolean;  // 是否正在验证答案
}

interface ValidationResult {
  passed: boolean;
  score?: number;
  feedback?: string;
  test_results?: { ... };
}
```

### 2. 核心功能函数

#### 2.1 运行代码

```typescript
const runCode = async (index: number) => {
  const point = knowledgePoints[index];
  if (!point.exercise || !point.userCode) return;
  
  // 标记为正在运行
  setKnowledgePoints(prev => prev.map((p, i) => 
    i === index ? { ...p, isRunningCode: true, codeOutput: '', codeError: '' } : p
  ));
  
  try {
    const response = await fetch('http://localhost:8000/notes/execute-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: point.userCode,
        language: point.exercise.language
      }),
    });
    
    const data = await response.json();
    
    setKnowledgePoints(prev => prev.map((p, i) => {
      if (i === index) {
        return {
          ...p,
          isRunningCode: false,
          codeOutput: data.success ? data.output : '',
          codeError: data.error || null
        };
      }
      return p;
    }));
  } catch (error) {
    // 错误处理
  }
};
```

#### 2.2 验证答案

```typescript
const validateAnswer = async (index: number) => {
  const point = knowledgePoints[index];
  if (!point.exercise || !point.userCode) return;
  
  setKnowledgePoints(prev => prev.map((p, i) => 
    i === index ? { ...p, isValidating: true } : p
  ));
  
  try {
    const response = await fetch('http://localhost:8000/notes/validate-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_code: point.userCode,
        exercise: point.exercise,
        language: point.exercise.language,
        video_url: currentVideoUrl,
        knowledge_point_name: point.name
      }),
    });
    
    const data = await response.json();
    
    setKnowledgePoints(prev => prev.map((p, i) => {
      if (i === index) {
        return {
          ...p,
          isValidating: false,
          validationResult: data.success ? {
            passed: data.passed,
            score: data.score,
            feedback: data.feedback,
            test_results: data.test_results
          } : null
        };
      }
      return p;
    }));
  } catch (error) {
    // 错误处理
  }
};
```

### 3. UI组件

#### 3.1 练习编辑器底部操作按钮

```tsx
{/* 操作按钮 */}
<div className="flex gap-2">
  {/* 运行代码按钮 */}
  <button
    onClick={() => runCode(index)}
    disabled={point.isRunningCode || !point.userCode}
    className="flex-1 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-600"
  >
    {point.isRunningCode ? (
      <>
        <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />
        运行中...
      </>
    ) : (
      <>
        <Play className="inline w-4 h-4 mr-2" />
        运行代码
      </>
    )}
  </button>
  
  {/* 提交验证按钮 */}
  <button
    onClick={() => validateAnswer(index)}
    disabled={point.isValidating || !point.userCode}
    className="flex-1 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-600"
  >
    {point.isValidating ? (
      <>
        <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />
        验证中...
      </>
    ) : (
      <>
        <CheckCircle className="inline w-4 h-4 mr-2" />
        提交答案
      </>
    )}
  </button>
</div>
```

#### 3.2 代码执行输出显示

```tsx
{/* 执行输出 */}
{(point.codeOutput || point.codeError) && (
  <div className="mt-3 bg-gray-900 rounded p-3">
    <div className="text-white font-semibold mb-2">📤 执行结果:</div>
    {point.codeOutput && (
      <pre className="text-green-400 text-sm whitespace-pre-wrap">
        {point.codeOutput}
      </pre>
    )}
    {point.codeError && (
      <pre className="text-red-400 text-sm whitespace-pre-wrap">
        ❌ {point.codeError}
      </pre>
    )}
  </div>
)}
```

#### 3.3 答案验证结果显示

```tsx
{/* 验证结果 */}
{point.validationResult && (
  <div className={`mt-3 rounded-lg p-4 border-2 ${
    point.validationResult.passed
      ? 'bg-green-50 border-green-300'
      : 'bg-red-50 border-red-300'
  }`}>
    {/* 头部：通过/未通过 + 分数 */}
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {point.validationResult.passed ? (
          <>
            <CheckCircle className="w-6 h-6 text-green-600" />
            <span className="text-lg font-bold text-green-700">通过 ✓</span>
          </>
        ) : (
          <>
            <XCircle className="w-6 h-6 text-red-600" />
            <span className="text-lg font-bold text-red-700">未通过 ✗</span>
          </>
        )}
      </div>
      {typeof point.validationResult.score === 'number' && (
        <div className={`text-2xl font-bold ${
          point.validationResult.passed ? 'text-green-600' : 'text-red-600'
        }`}>
          {point.validationResult.score} 分
        </div>
      )}
    </div>
    
    {/* 反馈内容（Markdown） */}
    {point.validationResult.feedback && (
      <div className="prose prose-sm max-w-none">
        <ReactMarkdown>{point.validationResult.feedback}</ReactMarkdown>
      </div>
    )}
    
    {/* 测试用例结果 */}
    {point.validationResult.test_results && (
      <details className="mt-3">
        <summary className="cursor-pointer font-semibold text-gray-700">
          测试用例详情 ({point.validationResult.test_results.passed_count}/
          {point.validationResult.test_results.total_count} 通过)
        </summary>
        <div className="mt-2 space-y-2">
          {point.validationResult.test_results.results.map((test, i) => (
            <div
              key={i}
              className={`p-2 rounded ${
                test.passed ? 'bg-green-100' : 'bg-red-100'
              }`}
            >
              <div className="font-semibold">
                测试用例 {test.test_case}: {test.passed ? '✓' : '✗'}
              </div>
              <div className="text-sm">输入: {test.input}</div>
              <div className="text-sm">期望: {test.expected}</div>
              {test.actual && (
                <div className="text-sm">实际: {test.actual}</div>
              )}
              {test.error && (
                <div className="text-sm text-red-600">错误: {test.error}</div>
              )}
            </div>
          ))}
        </div>
      </details>
    )}
  </div>
)}
```

## 🔒 安全性

### Docker沙箱隔离

```bash
docker run \
  --rm \                    # 执行后删除容器
  --network none \          # 禁用网络
  --memory 128m \           # 内存限制
  --cpus 0.5 \              # CPU限制
  -v /path/to/code:/code:ro  # 只读挂载
  python:3.11-slim \
  python /code/script.py
```

**限制**：
- ✅ 无法访问网络
- ✅ 无法读写主机文件系统
- ✅ 有限的内存和CPU资源
- ✅ 10秒执行超时
- ✅ 受限的Python内置函数（本地执行时）

## 📊 缓存策略

### 练习缓存

| 缓存键 | 有效期 | 存储位置 |
|--------|--------|----------|
| `md5(video_url + knowledge_point_name)` | 7天 | `cache/exercises/exercise_*.json` |

**索引文件**: `cache/exercises/exercise_index.json`

```json
{
  "cache_key_abc123": {
    "file": "exercise_abc123.json",
    "video_url": "https://...",
    "knowledge_point_name": "Python列表",
    "exercise_type": "fill_blank",
    "timestamp": "2025-11-07T10:00:00"
  }
}
```

**缓存数据文件**:
```json
{
  "video_url": "https://...",
  "knowledge_point_name": "Python列表",
  "exercise": { ... },
  "cached_at": "2025-11-07T10:00:00",
  "metadata": {
    "video_title": "...",
    "transcript_length": 500
  }
}
```

## 🧪 测试

### 1. 测试练习缓存

```bash
cd backend
python -c "
from app.services.exercise_cache_service import exercise_cache_service
stats = exercise_cache_service.get_cache_stats()
print(stats)
"
```

### 2. 测试代码执行

```bash
cd backend
python -c "
import asyncio
from app.services.code_execution_service import code_execution_service

async def test():
    result = await code_execution_service.execute_code(
        'print(\"Hello World\")',
        'python'
    )
    print(result)

asyncio.run(test())
"
```

### 3. 测试完整流程

1. 生成练习题（第一次，调用LLM）
2. 再次生成相同练习题（第二次，使用缓存）
3. 运行代码
4. 提交答案验证

## 💡 使用场景

### 场景1：学生练习流程

```
1. 学生观看视频学习知识点
2. 点击"练习"按钮生成练习题（首次：生成新题；之后：使用缓存）
3. 在Monaco Editor中编写代码
4. 点击"运行代码"查看输出
5. 调试代码直到通过测试
6. 点击"提交答案"获取评分和反馈
7. 根据反馈改进代码
```

### 场景2：教师查看学生表现

```
1. 系统记录所有提交历史
2. 显示评分趋势
3. 分析常见错误
4. 提供个性化建议
```

## 🚀 性能优化

### 缓存命中率

- 首次访问：调用LLM（5-15秒）
- 缓存命中：立即返回（<100ms）
- 节省：99%+ 响应时间

### 代码执行

- Docker启动：~1秒
- 代码运行：根据代码复杂度
- 总耗时：通常2-5秒

### LLM评估

- 测试用例验证：2-5秒
- LLM评估：5-10秒
- 总耗时：7-15秒

## 📝 配置

### 环境变量

```bash
# 已有的
BAIJIA_API_KEY=your_key
BAIJIA_BASE_URL=https://llm.baijia.com
BAIJIA_MODEL=model_name

# 可选的
CODE_EXECUTION_TIMEOUT=10  # 代码执行超时（秒）
CODE_EXECUTION_MEMORY=128m  # 内存限制
EXERCISE_CACHE_MAX_AGE=168  # 缓存有效期（小时）
```

### Docker要求

- Docker Engine 20.10+
- 网络访问（拉取镜像）
- 磁盘空间：~500MB（镜像）

### 镜像预拉取

```bash
# 提前拉取镜像加快首次执行
docker pull python:3.11-slim
docker pull node:18-slim
```

## 🐛 故障排除

### 问题1：Docker不可用

**错误**: `Docker不可用，代码执行功能将受限`

**解决**: 
1. 安装Docker Desktop (Windows/Mac) 或 Docker Engine (Linux)
2. 启动Docker服务
3. 验证：`docker --version`

### 问题2：代码执行超时

**错误**: `执行超时（超过10秒）`

**原因**:
- 代码有死循环
- 计算量过大

**解决**:
- 优化代码逻辑
- 减少计算量
- 增加超时时间（修改配置）

### 问题3：缓存未生效

**检查**:
```python
# 查看缓存统计
stats = exercise_cache_service.get_cache_stats()
print(f"缓存数量: {stats['total_exercises']}")
print(f"题型分布: {stats['exercise_types']}")
```

**原因**:
- video_url不一致
- knowledge_point_name拼写错误
- 缓存已过期（超过7天）

## 📚 相关文档

- [练习功能实现](./EXERCISE_FEATURE_COMPLETE.md)
- [练习功能方案](./EXERCISE_FEATURE_IMPLEMENTATION.md)
- [快速测试指南](./EXERCISE_QUICK_TEST.md)

## ✅ 完成状态

**后端** ✅:
- ✅ 练习缓存服务
- ✅ 代码执行服务
- ✅ 答案验证API
- ✅ 练习生成集成缓存

**前端** ⏳:
- ⏳ 运行代码功能
- ⏳ 提交答案功能
- ⏳ 验证结果显示

---

**下一步**: 完成前端UI集成，测试完整流程！ 🚀

