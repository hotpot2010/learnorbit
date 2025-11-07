# 代码执行与答案验证 - 快速测试指南

## 🚀 测试前准备

### 1. 启动后端服务

```bash
cd backend
python -m uvicorn main:app --reload
```

等待看到：
```
✅ 批量分析功能已启用
INFO:     Uvicorn running on http://127.0.0.1:8000
```

### 2. 启动前端服务

```bash
# 在项目根目录
npm run dev
```

### 3. 安装Docker（可选但推荐）

**Windows**:
```bash
# 下载Docker Desktop并安装
https://www.docker.com/products/docker-desktop
```

**验证Docker安装**:
```bash
docker --version
docker run hello-world
```

### 4. 预拉取Docker镜像（可选）

```bash
docker pull python:3.11-slim
docker pull node:18-slim
```

## 🧪 测试步骤

### 方式1：完整流程测试

1. **打开视频笔记页面**
   ```
   http://localhost:3000/zh/video-notes-prototype
   ```

2. **等待视频自动解析**（30-60秒）

3. **点击"练习"按钮**（橙色）
   - 等待5-10秒生成练习题
   - 第一次：调用LLM生成（较慢）
   - 第二次：使用缓存（<1秒）

4. **查看练习题**
   - ✅ 题目信息（标题、描述、徽章）
   - ✅ 代码编辑器（Monaco Editor）
   - ✅ 提示区域
   - ✅ 测试用例
   - ✅ 两个按钮："运行代码"（绿色）、"提交答案"（蓝色）

5. **编辑代码**
   - 在Monaco Editor中修改代码
   - 代码自动保存

6. **运行代码**
   - 点击"运行代码"按钮
   - 等待2-5秒
   - 查看执行结果（绿色输出 或 红色错误）

7. **提交答案**
   - 点击"提交答案"按钮
   - 等待7-15秒（测试用例 + LLM评估）
   - 查看验证结果：
     - 通过/未通过状态
     - 分数（0-100）
     - 反馈（优点 + 改进建议）
     - 测试用例详情（可展开）

### 方式2：后端API单独测试

#### 测试练习缓存

```bash
cd backend
python -c "
from app.services.exercise_cache_service import exercise_cache_service

# 查看缓存统计
stats = exercise_cache_service.get_cache_stats()
print('缓存统计:')
print(f'  总数: {stats[\"total_exercises\"]}')
print(f'  大小: {stats[\"total_size_mb\"]} MB')
print(f'  题型分布: {stats[\"exercise_types\"]}')
"
```

#### 测试代码执行

```bash
cd backend
python -c "
import asyncio
from app.services.code_execution_service import code_execution_service

async def test():
    # 测试Python代码
    result = await code_execution_service.execute_code(
        code='print(\"Hello World\")\nprint(1 + 2)',
        language='python'
    )
    print('执行结果:', result)

asyncio.run(test())
"
```

#### 测试答案验证API

```bash
cd backend
python -c "
import requests
import json

# 测试数据
data = {
    'user_code': '''
# 计算列表中所有数字的和
def sum_list(numbers):
    total = 0
    for num in numbers:
        total += num
    return total
''',
    'exercise': {
        'title': 'Python列表求和',
        'description': '实现一个函数计算列表中所有数字的和',
        'type': 'guided_steps',
        'difficulty': 'beginner',
        'language': 'python',
        'solution': 'def sum_list(numbers): return sum(numbers)',
        'test_cases': [
            {'input': '[1,2,3]', 'expected': '6'},
            {'input': '[10,20,30]', 'expected': '60'}
        ]
    },
    'language': 'python',
    'knowledge_point_name': 'Python列表'
}

response = requests.post(
    'http://localhost:8000/notes/validate-answer',
    json=data
)

result = response.json()
print(json.dumps(result, indent=2, ensure_ascii=False))
"
```

## ✅ 验证清单

### 前端UI验证

#### 练习按钮
- [ ] 按钮显示"练习"（橙色）
- [ ] 点击后显示"生成中..."
- [ ] 第一次生成：5-10秒
- [ ] 第二次生成：<1秒（缓存）

#### 代码编辑器
- [ ] Monaco Editor正常渲染
- [ ] 代码语法高亮
- [ ] 可以正常编辑
- [ ] 代码实时保存

#### 运行代码按钮
- [ ] 按钮显示"运行代码"（绿色）
- [ ] 点击后显示"运行中..."
- [ ] 2-5秒后显示结果
- [ ] 成功：绿色输出
- [ ] 失败：红色错误

#### 提交答案按钮
- [ ] 按钮显示"提交答案"（蓝色）
- [ ] 点击后显示"验证中..."
- [ ] 7-15秒后显示结果
- [ ] 通过：绿色背景 + ✓
- [ ] 未通过：红色背景 + ✗
- [ ] 显示分数
- [ ] 显示反馈（Markdown）
- [ ] 测试用例详情可展开

### 后端API验证

#### 练习缓存
- [ ] 首次生成调用LLM
- [ ] 缓存生效（查看backend日志）
- [ ] 第二次立即返回
- [ ] `from_cache: true`标记

#### 代码执行
- [ ] Docker可用时使用Docker
- [ ] Docker不可用时本地执行（警告）
- [ ] Python代码执行正常
- [ ] 超时控制生效（10秒）
- [ ] 返回正确的输出/错误

#### 答案验证
- [ ] 测试用例自动运行
- [ ] LLM评估生成反馈
- [ ] 返回评分（0-100）
- [ ] 返回优点和改进建议
- [ ] 测试结果详细显示

## 🎯 测试场景

### 场景1：填空题（fill_blank）

**测试代码**:
```python
# 原始代码（带空白）
a = 10
b = ___  # 填空
result = a + b
print(result)
```

**测试步骤**:
1. 将`___`替换为`20`
2. 点击"运行代码"
3. 查看输出：`30`
4. 点击"提交答案"
5. 查看评分和反馈

### 场景2：分步引导（guided_steps）

**测试代码**:
```python
# 计算列表最大值
def find_max(numbers):
    # 步骤1：初始化最大值为第一个元素
    max_val = numbers[0]
    
    # 步骤2：遍历列表
    for num in numbers:
        # 步骤3：比较并更新最大值
        if num > max_val:
            max_val = num
    
    # 步骤4：返回结果
    return max_val

print(find_max([3, 7, 2, 9, 1]))
```

**期望输出**: `9`

### 场景3：错误代码测试

**测试代码**:
```python
# 故意写错
def sum_list(numbers):
    total = 0
    for num in numbers
        # 缺少冒号
        total += num
    return total
```

**期望结果**:
- 运行代码：显示语法错误
- 提交答案：低分 + 错误提示

## 🐛 常见问题排查

### 问题1：Docker不可用

**错误信息**: `Docker不可用，代码执行功能将受限`

**影响**: Python可以本地执行（不安全），JavaScript无法执行

**解决**:
1. 安装Docker Desktop
2. 启动Docker服务
3. 重启后端服务

### 问题2：练习生成很慢

**原因**: 首次生成需要调用LLM

**解决**: 等待完成后，再次点击会使用缓存

**验证缓存**:
- 查看后端日志：`💾 使用缓存的练习题`
- 响应时间：<1秒

### 问题3：代码执行超时

**错误信息**: `执行超时（超过10秒）`

**原因**:
- 代码有死循环
- 计算量过大

**解决**:
- 检查代码逻辑
- 减少循环次数
- 优化算法

### 问题4：答案验证失败

**错误信息**: `验证失败: ...`

**可能原因**:
1. LLM API不可用
2. 网络问题
3. 代码执行失败

**排查**:
1. 检查后端日志
2. 先点击"运行代码"测试
3. 检查BAIJIA_API_KEY配置

### 问题5：测试用例全部失败

**原因**: 代码逻辑错误

**调试步骤**:
1. 查看测试用例详情
2. 对比"期望"和"实际"输出
3. 修改代码
4. 重新运行

## 📊 性能指标

| 操作 | 首次 | 缓存 | 说明 |
|------|------|------|------|
| 生成练习 | 5-15秒 | <1秒 | LLM生成 vs 缓存读取 |
| 运行代码 | 2-5秒 | 2-5秒 | Docker启动 + 执行 |
| 答案验证 | 7-15秒 | 7-15秒 | 测试 + LLM评估 |

## 🎓 评分标准参考

| 分数范围 | 说明 |
|----------|------|
| 90-100 | 测试全过 + 代码质量优秀 |
| 70-89 | 测试全过 + 代码质量良好 |
| 40-69 | 部分测试通过 |
| 0-39 | 测试失败 或 无法运行 |

## 🔗 相关文档

- [功能实现文档](./CODE_EXECUTION_VALIDATION_IMPLEMENTATION.md)
- [练习功能总结](./EXERCISE_FEATURE_COMPLETE.md)
- [快速测试指南](./EXERCISE_QUICK_TEST.md)

---

**🎉 开始测试吧！祝测试顺利！** 🚀

