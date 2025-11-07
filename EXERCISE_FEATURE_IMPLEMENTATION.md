# 练习功能实现方案

## 🎯 功能概述

为视频笔记系统添加编程练习功能，支持4种题型：
1. **fill_blank**（填空模式）- 适合初学者
2. **guided_steps**（分步引导）- 适合初中级
3. **code_choice**（代码选择）- 适合中级
4. **complete**（完整编程）- 适合中高级

## ✅ 已完成部分

### 后端API

**文件**: `backend/app/api/routes/notes.py`

#### 1. 数据模型

```python
class ExerciseGenerationRequest(BaseModel):
    """练习生成请求模型"""
    knowledge_point_name: str
    transcript_segment: str
    video_title: Optional[str] = None
    video_url: Optional[str] = None


class ExerciseGenerationResponse(BaseModel):
    """练习生成响应模型"""
    success: bool
    exercise: Optional[dict] = None
    error: Optional[str] = None
```

#### 2. API Endpoint

```python
@router.post("/generate-exercise", response_model=ExerciseGenerationResponse)
async def generate_exercise(request: ExerciseGenerationRequest):
    """为特定知识点生成编程练习题"""
    # ... 实现代码
```

#### 3. 练习题JSON格式

```json
{
  "type": "fill_blank | guided_steps | code_choice | complete",
  "title": "练习题标题",
  "description": "题目描述（50字以内）",
  "difficulty": "beginner | intermediate | advanced",
  "language": "python",
  "starter_code": "初始代码模板",
  "solution": "参考答案",
  "hints": ["提示1", "提示2", "..."],
  "test_cases": [
    {"input": "输入", "expected": "期望输出"}
  ]
}
```

#### 4. 题型特定规则

**fill_blank**（填空）:
- `starter_code`中用`"___"`标记填空位置
- `hints`说明每个空填什么
- 示例：
  ```python
  # 计算两数之和
  a = 10
  b = 20
  result = ___  # 填空：使用+运算符
  print(result)
  ```

**guided_steps**（分步引导）:
- `hints`列出3-5个步骤
- 每步说明要完成什么
- 示例hints:
  ```json
  [
    "步骤1：定义函数，接收一个列表参数",
    "步骤2：使用for循环遍历列表",
    "步骤3：使用if判断找出最大值",
    "步骤4：返回最大值"
  ]
  ```

**code_choice**（代码选择）:
- `hints`提供3-4个代码选项
- 标注正确答案
- 示例hints:
  ```json
  [
    "选项A: for i in range(len(list)): ...",
    "选项B: for item in list: ...",  
    "选项C: while i < len(list): ...",
    "正确答案：B"
  ]
  ```

**complete**（完整编程）:
- 提供基本框架
- `hints`给出思路提示
- 示例：
  ```python
  def find_max(numbers):
      # TODO: 实现查找最大值的逻辑
      pass
  ```

## 📦 前端依赖安装

### Monaco Editor

Monaco Editor是VSCode使用的代码编辑器，功能强大。

#### 安装步骤

```bash
# 进入项目根目录
cd D:\learnorbit\learnorbit

# 安装Monaco Editor React组件
npm install @monaco-editor/react

# 或使用pnpm
pnpm install @monaco-editor/react
```

#### 版本信息

- `@monaco-editor/react`: ^4.6.0
- 包含Monaco Editor核心库
- React封装，易于使用

## 🎨 前端实现计划

### 1. 类型定义

```typescript
// 练习题类型
type ExerciseType = 'fill_blank' | 'guided_steps' | 'code_choice' | 'complete';

interface Exercise {
  type: ExerciseType;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  language: string;
  starter_code: string;
  solution: string;
  hints: string[];
  test_cases: Array<{
    input: string;
    expected: string;
  }>;
}

// 扩展KnowledgePoint接口
interface KnowledgePoint {
  // ... 现有字段
  exercise?: Exercise;  // 练习题
  isGeneratingExercise?: boolean;  // 是否正在生成练习
  userCode?: string;  // 用户编写的代码
}
```

### 2. 状态管理

```typescript
const [exercisingKnowledgeIndex, setExercisingKnowledgeIndex] = useState<number | null>(null);
```

### 3. 核心函数

```typescript
// 生成练习题
const generateExercise = async (index: number) => {
  const point = knowledgePoints[index];
  
  // 暂停视频
  if (videoRef.current && isPlaying) {
    videoRef.current.pause();
    setIsPlaying(false);
  }
  
  // 标记为正在生成
  setKnowledgePoints(prev => prev.map((p, i) => 
    i === index ? { ...p, isGeneratingExercise: true } : p
  ));
  
  try {
    const transcriptSegment = extractTranscriptSegment(point.start_time, point.end_time);
    
    const response = await fetch('http://localhost:8000/notes/generate-exercise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        knowledge_point_name: point.name,
        transcript_segment: transcriptSegment,
        video_title: videoTitle,
        video_url: currentVideoUrl
      }),
    });
    
    const data = await response.json();
    
    if (data.success && data.exercise) {
      setKnowledgePoints(prev => prev.map((p, i) => {
        if (i === index) {
          return {
            ...p,
            exercise: data.exercise,
            userCode: data.exercise.starter_code,  // 初始化用户代码
            isGeneratingExercise: false
          };
        }
        return p;
      }));
    }
  } catch (error) {
    console.error('生成练习失败:', error);
  }
};
```

### 4. UI组件结构

```tsx
{/* 练习按钮 */}
<Button
  onClick={() => generateExercise(currentKnowledgeIndex)}
  disabled={!knowledgePoints[currentKnowledgeIndex] || knowledgePoints[currentKnowledgeIndex]?.isGeneratingExercise}
>
  <Code className="w-5 h-5 mr-2" />
  {knowledgePoints[currentKnowledgeIndex]?.isGeneratingExercise ? '生成中...' : '练习'}
</Button>

{/* 知识点卡片中的练习区域 */}
{point.exercise && isExpanded && (
  <div className="mt-4 pt-4 border-t border-green-200">
    <ExerciseEditor 
      exercise={point.exercise}
      userCode={point.userCode}
      onCodeChange={(code) => updateUserCode(index, code)}
    />
  </div>
)}
```

### 5. Monaco Editor组件

```tsx
import Editor from '@monaco-editor/react';

function ExerciseEditor({ exercise, userCode, onCodeChange }: {
  exercise: Exercise;
  userCode?: string;
  onCodeChange: (code: string) => void;
}) {
  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden">
      {/* 题目信息 */}
      <div className="bg-gray-800 p-4 text-white">
        <h4 className="font-bold text-lg mb-2">{exercise.title}</h4>
        <p className="text-sm text-gray-300 mb-2">{exercise.description}</p>
        <div className="flex gap-2 text-xs">
          <span className="px-2 py-1 bg-blue-600 rounded">
            {exercise.type}
          </span>
          <span className="px-2 py-1 bg-green-600 rounded">
            {exercise.difficulty}
          </span>
          <span className="px-2 py-1 bg-purple-600 rounded">
            {exercise.language}
          </span>
        </div>
      </div>
      
      {/* 代码编辑器 */}
      <Editor
        height="300px"
        language={exercise.language}
        value={userCode || exercise.starter_code}
        onChange={(value) => onCodeChange(value || '')}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 4,
        }}
      />
      
      {/* 提示和测试用例 */}
      <div className="bg-gray-800 p-4 text-white">
        {/* 提示 */}
        {exercise.hints && exercise.hints.length > 0 && (
          <details className="mb-3">
            <summary className="cursor-pointer text-yellow-400 hover:text-yellow-300">
              💡 查看提示 ({exercise.hints.length})
            </summary>
            <ul className="mt-2 space-y-1 text-sm">
              {exercise.hints.map((hint, i) => (
                <li key={i} className="text-gray-300">• {hint}</li>
              ))}
            </ul>
          </details>
        )}
        
        {/* 测试用例 */}
        {exercise.test_cases && exercise.test_cases.length > 0 && (
          <details>
            <summary className="cursor-pointer text-blue-400 hover:text-blue-300">
              🧪 测试用例 ({exercise.test_cases.length})
            </summary>
            <div className="mt-2 space-y-2 text-sm">
              {exercise.test_cases.map((test, i) => (
                <div key={i} className="bg-gray-700 p-2 rounded">
                  <div className="text-gray-400">输入: {test.input}</div>
                  <div className="text-gray-400">期望: {test.expected}</div>
                </div>
              ))}
            </div>
          </details>
        )}
        
        {/* 提交按钮（暂未实现） */}
        <button 
          disabled
          className="mt-3 w-full py-2 bg-gray-600 text-gray-400 rounded cursor-not-allowed"
        >
          提交答案（功能开发中）
        </button>
      </div>
    </div>
  );
}
```

## 🎨 UI设计规范

### 练习按钮样式

```css
bg-orange-500        /* 橙色背景 */
hover:bg-orange-600  /* 悬停时变深 */
disabled:bg-orange-500/50  /* 禁用时半透明 */
```

### 编辑器样式

```css
/* 容器 */
.bg-gray-900.rounded-lg.overflow-hidden

/* 标题栏 */
.bg-gray-800.p-4.text-white

/* 编辑器区域 */
height: 300px
theme: vs-dark

/* 底部提示区 */
.bg-gray-800.p-4.text-white
```

### 题型徽章颜色

| 题型 | 颜色 | 说明 |
|------|------|------|
| fill_blank | blue-600 | 蓝色 - 填空题 |
| guided_steps | green-600 | 绿色 - 分步引导 |
| code_choice | purple-600 | 紫色 - 代码选择 |
| complete | red-600 | 红色 - 完整编程 |

### 难度徽章颜色

| 难度 | 颜色 |
|------|------|
| beginner | green-600 |
| intermediate | yellow-600 |
| advanced | red-600 |

## 🔄 交互流程

```
1. 用户点击"练习"按钮
   ↓
2. 视频自动暂停 ⏸️
   ↓
3. 显示"生成中..."加载状态
   ↓
4. 调用后端API生成练习题
   ↓
5. 解析返回的JSON数据
   ↓
6. 在知识点卡片中插入代码编辑器
   ↓
7. 显示题目、代码、提示、测试用例
   ↓
8. 用户可以编辑代码
   ↓
9. 点击"提交答案"（暂未实现）
```

## 📝 实现步骤

### Step 1: 安装依赖 ✅（需要用户执行）

```bash
npm install @monaco-editor/react
```

### Step 2: 修改前端类型定义

```typescript
// 添加Exercise接口
// 扩展KnowledgePoint接口
```

### Step 3: 添加状态和函数

```typescript
// generateExercise
// updateUserCode
```

### Step 4: 修改"练习"按钮

```tsx
// 从disabled改为enabled
// 添加onClick事件
// 添加加载状态
```

### Step 5: 创建ExerciseEditor组件

```tsx
// 使用Monaco Editor
// 显示题目信息
// 显示提示和测试用例
```

### Step 6: 在知识点卡片中渲染练习

```tsx
// 在笔记和Q&A之后
// 只在展开时显示
```

## 🧪 测试场景

### 1. 基本功能测试

```
1. 点击"练习"按钮
   ✅ 视频自动暂停
   ✅ 显示"生成中..."
   ✅ 代码编辑器出现

2. 查看练习题
   ✅ 显示题目标题和描述
   ✅ 显示题型和难度徽章
   ✅ 代码编辑器加载初始代码

3. 编辑代码
   ✅ 可以正常输入
   ✅ 语法高亮正常
   ✅ 自动缩进正常

4. 查看提示
   ✅ 点击"查看提示"展开
   ✅ 显示所有提示项

5. 查看测试用例
   ✅ 点击"测试用例"展开
   ✅ 显示输入和期望输出
```

### 2. 不同题型测试

**fill_blank**:
- ✅ starter_code中有`___`占位符
- ✅ hints说明每个空填什么

**guided_steps**:
- ✅ hints列出清晰的步骤
- ✅ starter_code提供基本框架

**code_choice**:
- ✅ hints提供多个选项
- ✅ 标注正确答案

**complete**:
- ✅ starter_code提供函数签名
- ✅ hints给出思路提示

### 3. 边界情况测试

- ❌ 视频未加载时点击"练习"
- ❌ 练习生成失败的错误处理
- ❌ JSON解析失败的错误处理
- ❌ 网络错误处理

## 💡 优化建议

### 1. 练习缓存

类似笔记缓存，避免重复生成：

```python
# backend/app/services/exercise_cache_service.py
class ExerciseCacheService:
    def get_cached_exercise(self, video_url: str, knowledge_point: str):
        # ... 实现
    
    def set_cached_exercise(self, video_url: str, knowledge_point: str, exercise: dict):
        # ... 实现
```

### 2. 代码运行功能

添加在线代码执行（需要安全沙箱）：

```typescript
const runCode = async (code: string) => {
  const response = await fetch('/api/execute', {
    method: 'POST',
    body: JSON.stringify({ code, language: 'python' })
  });
  const result = await response.json();
  setOutput(result.output);
};
```

### 3. 答案验证

前端简单验证 + 后端详细检查：

```typescript
const submitAnswer = async () => {
  const response = await fetch('/api/validate', {
    method: 'POST',
    body: JSON.stringify({
      exercise_id,
      user_code,
      test_cases
    })
  });
  const result = await response.json();
  setValidationResult(result);
};
```

### 4. 进度跟踪

记录用户完成的练习：

```typescript
interface ExerciseProgress {
  knowledge_point: string;
  completed: boolean;
  attempts: number;
  last_code: string;
  completed_at?: string;
}
```

### 5. 更多语言支持

目前主要Python，可扩展到：
- JavaScript/TypeScript
- Java
- C++
- Go

## 🎯 当前状态

### 已完成 ✅

1. 后端API endpoint (`/notes/generate-exercise`)
2. 练习生成prompt（支持4种题型）
3. JSON数据格式定义
4. 实现文档

### 待完成 ⏳

1. 安装`@monaco-editor/react`依赖
2. 前端类型定义
3. 状态管理和核心函数
4. Monaco Editor组件
5. UI集成
6. 测试

## 📚 参考资料

- [Monaco Editor官方文档](https://microsoft.github.io/monaco-editor/)
- [@monaco-editor/react文档](https://github.com/suren-atoyan/monaco-react)
- [Python代码示例](https://docs.python.org/3/tutorial/)

---

**🎉 后端API已完成！现在需要：**
1. 安装Monaco Editor：`npm install @monaco-editor/react`
2. 实现前端组件（约200-300行代码）
3. 集成到知识点卡片中

