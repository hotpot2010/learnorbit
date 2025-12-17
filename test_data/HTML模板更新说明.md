# HTML 模板更新说明

## 📋 更新内容

为了在前端显示独立的练习生成步骤，更新了 `backend/templates/offline-video.html` 文件。

## 🔧 具体修改

### 1. 添加练习步骤定义（第792行）

**之前**：
```javascript
const steps = [
    { key: 'download', name: '1. 下载视频并上传', description: '...' },
    { key: 'asr', name: '2. ASR识别', description: '...' },
    { key: 'knowledge_points', name: '3. 生成知识点', description: '...' },
    { key: 'screenshots', name: '4. 生成截图', description: '...' }
];
```

**之后**：
```javascript
const steps = [
    { key: 'download', name: '1. 下载视频并上传', description: '...' },
    { key: 'asr', name: '2. ASR识别', description: '...' },
    { key: 'knowledge_points', name: '3. 生成知识点', description: '...' },
    { key: 'screenshots', name: '4. 生成截图', description: '...' },
    { key: 'exercises', name: '5. 生成练习', description: '基于知识点生成练习题（数学/编程）' }  // ✅ 新增
];
```

### 2. 解析练习结果URL（第807行）

**添加**：
```javascript
const exercisesResultUrls = parseUrls(task.exercises_result_url);
```

### 3. 多P视频：获取练习URL（第834行）

**添加**：
```javascript
const exercisesUrl = exercisesResultUrls[idx] || null;
```

### 4. 多P视频：处理练习结果URL（第862行）

**添加**：
```javascript
} else if (step.key === 'exercises') {
    resultUrl = exercisesUrl;
```

### 5. 单P视频：处理练习结果URL（第941行）

**添加**：
```javascript
} else if (step.key === 'exercises' && task.exercises_result_url) {
    resultUrl = typeof task.exercises_result_url === 'string' && task.exercises_result_url.startsWith('[') 
        ? JSON.parse(task.exercises_result_url)[0] 
        : task.exercises_result_url;
```

### 6. 预览功能：多P任务处理（第1482行）

**添加**：
```javascript
const exercisesResultUrls = parseUrls(task.exercises_result_url);

// 在预览逻辑中添加
} else if (step === 'exercises' && exercisesResultUrls[partIndex]) {
    resultUrl = exercisesResultUrls[partIndex];
```

### 7. 预览功能：单P任务处理（第1519行）

**添加**：
```javascript
} else if (step === 'exercises' && task.exercises_result_url) {
    resultUrl = typeof task.exercises_result_url === 'string' && task.exercises_result_url.startsWith('[') 
        ? JSON.parse(task.exercises_result_url)[0] 
        : task.exercises_result_url;
```

### 8. JSON 格式化显示（第1556行）

**之前**：
```javascript
if (contentType.includes('json') || step === 'knowledge_points') {
```

**之后**：
```javascript
if (contentType.includes('json') || step === 'knowledge_points' || step === 'exercises' || step === 'screenshots') {
```

## 🎯 效果展示

### 页面上的显示效果

```
📦 任务卡片
├─ 1. 下载视频并上传 [✅ 成功]
├─ 2. ASR识别 [✅ 成功]
├─ 3. 生成知识点 [✅ 成功]
├─ 4. 生成截图 [✅ 成功]
└─ 5. 生成练习 [⏳ 等待执行]  ← 新增步骤
   └─ 基于知识点生成练习题（数学/编程）
   └─ [执行] 按钮
```

### 步骤卡片功能

练习步骤卡片包含以下功能：

1. **状态显示**：pending / running / success / failed / partial_success
2. **进度条**：显示执行进度（0-100%）
3. **操作按钮**：
   - **执行**：初次执行练习生成
   - **继续执行**：多P视频部分失败时，继续执行失败的分P
   - **重新执行**：重新生成所有练习
   - **预览**：查看生成的练习JSON文件
4. **结果URL**：显示CDN上的练习文件链接

## 📊 多P视频支持

对于多P视频，每个分P都会显示独立的步骤卡片：

```
📦 任务：React 教程系列（5个分P）

[P1] [P2] [P3] [P4] [P5]  ← 分P标签切换

当前显示 P1：
├─ 1. 下载视频并上传 [✅ 成功]
├─ 2. ASR识别 [✅ 成功]
├─ 3. 生成知识点 [✅ 成功]
├─ 4. 生成截图 [✅ 成功]
└─ 5. 生成练习 [⏳ 等待执行]
   └─ [执行] 按钮
```

## 🔍 预览功能

点击"预览"按钮后，会显示练习JSON文件的内容：

```json
{
  "exercises": [
    {
      "type": "multiple_choice",
      "title": "知识点练习：勾股定理",
      "description": "根据视频内容，完成以下练习题",
      "difficulty": "intermediate",
      "question": "在直角三角形中，已知两条直角边长度分别为 3 和 4，求斜边长度。",
      "choices": [
        {"label": "A", "content": "5"},
        {"label": "B", "content": "6"},
        {"label": "C", "content": "7"},
        {"label": "D", "content": "8"}
      ],
      "answer_type": "single",
      "solution": "A",
      "hints": [
        "提示1：回忆勾股定理公式",
        "提示2：将已知边长代入公式",
        "提示3：计算结果"
      ]
    }
  ],
  "count": 5
}
```

## 🚀 使用流程

1. **创建任务**：输入B站视频链接
2. **执行前置步骤**：
   - 下载视频
   - ASR识别
   - 生成知识点
3. **执行练习生成**（可选）：
   - 点击"5. 生成练习"的"执行"按钮
   - 等待执行完成（会显示进度条）
4. **预览结果**：
   - 点击"预览"按钮查看生成的练习题
   - 可以复制URL用于其他用途

## ⚡ 独立执行

练习生成步骤是独立的，可以：

- ✅ 不执行截图步骤，只执行练习生成
- ✅ 先执行截图，后执行练习
- ✅ 先执行练习，后执行截图
- ✅ 同时执行截图和练习（并行）

## 📝 注意事项

1. **依赖关系**：练习生成需要知识点步骤完成
2. **学科类型**：目前默认为数学题型（后续可扩展选择界面）
3. **多P视频**：支持继续执行和重新执行模式
4. **结果查看**：通过"预览"按钮或直接访问CDN URL

## 🔄 刷新页面

更新HTML后，需要：
1. 刷新浏览器页面（Ctrl+F5 强制刷新）
2. 清除浏览器缓存（如果页面仍然显示旧版本）
3. 检查控制台是否有JavaScript错误

## 🎉 完成标志

更新成功后，页面应该显示：
- ✅ 步骤列表中出现"5. 生成练习"
- ✅ 练习步骤卡片可以正常展开/折叠
- ✅ 执行按钮可以正常点击
- ✅ 预览功能可以查看练习JSON

