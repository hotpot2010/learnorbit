# 任务管理脚本使用说明

## 📋 可用脚本

### 1. 检查任务状态 - `check_task_status.py`

查看指定任务的详细信息，包括截图步骤的状态。

**使用方法：**
```bash
cd backend
python check_task_status.py
```

**输出示例：**
```
🔍 检查任务: task_1764906207_1200
================================================================================
📋 任务信息:
  - 标题: 某个视频标题
  - 创建时间: 2024-01-01 10:00:00
  - 更新时间: 2024-01-01 12:00:00
  - 是否系列: 1

📊 截图相关字段:
  - screenshots_result_url: ["url1", "url2", ...]
  - URL数量: 35

🔄 步骤状态:
  screenshots:
    - status: partial_success
    - progress: 90
    - message: ⚠️ 部分分P截图生成完成
    - result:
        result_urls: 35 个URL
        part_results: 36 个分P结果
            成功: 35, 失败: 1
```

---

### 2. 重置截图步骤 - `reset_screenshots_step.py`

清除指定任务的截图相关数据，重置状态为"等待执行"。

**使用方法：**
```bash
cd backend
python reset_screenshots_step.py [task_id]
```

如果不指定 task_id，默认使用 `task_1764906207_1200`

**功能：**
1. ✅ 清除 `screenshots_result_url` 字段
2. ✅ 重置 `screenshots` 步骤状态为 `pending`
3. ✅ 清除 result、error、message
4. ✅ 重置进度为 0%
5. ✅ 更新时间戳

**执行流程：**
```
🔄 重置任务的截图步骤: task_1764906207_1200
================================================================================
✅ 找到任务: 视频标题
   是否系列: 1

📊 当前截图状态:
   - status: partial_success
   - progress: 90
   - screenshots_result_url: 35 个URL

⚠️  即将执行以下操作:
   1. 清除 screenshots_result_url 字段
   2. 重置 screenshots 步骤状态为 PENDING
   3. 清除 screenshots 步骤的 result、error、message
   4. 重置进度为 0

确认重置任务 task_1764906207_1200 的截图步骤吗? (yes/no): yes

🔄 开始重置...
   1. 清除 screenshots_result_url...
   2. 重置 screenshots 步骤状态...
   3. 保存到数据库...

✅ 重置完成!
   - screenshots_result_url: 已清除
   - screenshots 步骤状态: pending
   - 进度: 0%
   - 消息: 等待执行

💡 现在可以在前端重新执行截图步骤
```

---

## 🔧 针对 task_1764906207_1200 的操作步骤

### 问题：截图功能一直显示"执行中"

**原因分析：**
可能是前端轮询停止，或数据库状态未正确更新。

**解决步骤：**

#### 第1步：检查当前状态
```bash
cd backend
python check_task_status.py
```

查看输出中的：
- `screenshots` 步骤的 `status`（应该是什么？）
- `progress`（进度百分比）
- `result_urls`（已生成的URL数量）

#### 第2步：重置截图步骤
```bash
cd backend
python reset_screenshots_step.py
```

按提示输入 `yes` 确认重置。

#### 第3步：刷新前端页面
1. 刷新浏览器页面
2. 找到该任务
3. 查看截图步骤状态（应该变为"等待执行"）
4. 点击"继续执行"按钮

#### 第4步（可选）：使用调试模式
当前代码已启用调试模式，会先打印执行计划：
- ✅ 显示哪些分P已有结果
- ✅ 显示哪些分P需要重新执行
- ✅ 不会实际执行，只是预览

如果执行计划符合预期，需要移除调试代码中的 `return` 语句。

---

## 🐛 常见问题

### Q1: 为什么前端显示"执行中"但后端日志显示已完成？
**A:** 可能是前端轮询已停止。解决方法：
1. 刷新页面
2. 如果仍显示"执行中"，使用重置脚本清除状态
3. 重新执行

### Q2: 重置后数据会丢失吗？
**A:** 只会清除截图相关数据：
- ✅ 清除：`screenshots_result_url`、截图步骤的状态
- ❌ 不影响：视频URL、ASR结果、知识点结果

### Q3: 如何只重新执行失败的分P？
**A:** 不要使用重置脚本，直接：
1. 刷新页面
2. 点击"继续执行"按钮
3. 系统会自动跳过已成功的分P

---

## 📝 注意事项

1. ⚠️ 重置操作**不可逆**，执行前请确认
2. ⚠️ 重置会清除所有已生成的截图URL
3. ⚠️ 如果只是想重新执行失败的分P，不要使用重置脚本
4. ✅ 重置前建议先运行 `check_task_status.py` 查看状态
5. ✅ 重置后需要刷新前端页面才能看到变化



