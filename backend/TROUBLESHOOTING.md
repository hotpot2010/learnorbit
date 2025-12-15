# 故障排除指南 - 任务卡在"执行中"

## 🐛 问题：任务一直显示"执行中"

### 症状
- 任务在前端页面显示"执行中"状态
- 后端日志显示任务已完成
- 已清理数据库、缓存、重启服务，但问题仍然存在

### 可能的原因
1. **数据库状态未正确更新** - status 字段仍然是 `running`
2. **后端内存缓存** - `tasks_cache` 中缓存了旧状态
3. **前端浏览器缓存** - 浏览器缓存了旧的任务列表
4. **前端轮询已停止** - 无法获取最新状态

---

## 🔧 解决方案

### 方案A：一键修复（推荐）

**Windows:**
```bash
cd backend
fix_stuck_task.bat task_1764906207_1200
```

**Linux/Mac:**
```bash
cd backend
chmod +x fix_stuck_task.sh
./fix_stuck_task.sh task_1764906207_1200
```

### 方案B：手动修复（详细步骤）

#### 第1步：强制修复数据库状态
```bash
cd backend
python force_fix_task_status.py
```

**这个脚本会：**
- ✅ 使用原始 SQL 查询数据库（绕过所有缓存）
- ✅ 强制设置 `screenshots.status = "pending"`
- ✅ 清除 `screenshots_result_url`
- ✅ 重置进度为 0
- ✅ 验证更新是否成功

**输出示例：**
```
🔧 强制修复任务状态: task_1764906207_1200
================================================================================
📊 步骤1: 查询数据库中的原始数据...
✅ 找到任务: 视频标题

📊 当前数据库状态:
   screenshots.status: running  ← 问题所在！
   screenshots.progress: 90
   screenshots_result_url: 存在

🔧 步骤2: 强制重置 screenshots 步骤...
🔧 步骤3: 使用原始 SQL 更新数据库...

🔍 步骤4: 验证更新结果...
✅ screenshots.status: pending  ← 已修复！
✅ screenshots.progress: 0
✅ screenshots_result_url: NULL

✅ 强制修复完成!
```

#### 第2步：重启后端服务
```bash
# 停止后端服务 (Ctrl+C)
# 然后重新启动
```

**为什么需要重启？**
- 清除后端内存中的 `tasks_cache`
- 重新从数据库加载任务数据

#### 第3步：清除前端缓存并刷新

**方法1：强制刷新（推荐）**
- Windows/Linux: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

**方法2：禁用缓存**
1. 打开开发者工具 (F12)
2. 切换到 Network 标签
3. 勾选 "Disable cache"
4. 刷新页面 (F5)

**方法3：清除浏览器缓存**
1. Chrome: `chrome://settings/clearBrowserData`
2. 选择"缓存的图像和文件"
3. 点击"清除数据"

#### 第4步：验证修复

刷新页面后，检查：
- ✅ 任务状态应该显示"等待执行"
- ✅ 进度应该为 0%
- ✅ 可以点击"执行"按钮

---

## 🔍 诊断工具

### 1. 检查任务状态
```bash
cd backend
python check_task_status.py
```

**查看关键信息：**
- `screenshots.status` - 当前状态
- `screenshots.progress` - 进度
- `screenshots_result_url` - 是否有URL

### 2. 查看数据库原始数据
```bash
cd backend
python -c "
from app.database import get_db_session
from sqlalchemy import text

with get_db_session() as db:
    result = db.execute(
        text('SELECT steps FROM offline_video_tasks WHERE task_id = :id'),
        {'id': 'task_1764906207_1200'}
    )
    row = result.fetchone()
    if row:
        import json
        steps = json.loads(row[0]) if isinstance(row[0], str) else row[0]
        print('screenshots.status:', steps.get('screenshots', {}).get('status'))
"
```

---

## 📋 完整的故障排除清单

### ✅ 数据库层面
- [ ] 运行 `force_fix_task_status.py` 修复数据库
- [ ] 验证 `screenshots.status` 是否为 `pending`
- [ ] 验证 `screenshots_result_url` 是否为 `NULL`

### ✅ 后端层面
- [ ] 停止后端服务
- [ ] 确认没有其他后端进程在运行
- [ ] 重新启动后端服务
- [ ] 检查启动日志是否正常

### ✅ 前端层面
- [ ] 强制刷新页面 (Ctrl+Shift+R)
- [ ] 清除浏览器缓存
- [ ] 禁用浏览器缓存并刷新
- [ ] 尝试无痕模式 (Ctrl+Shift+N)

### ✅ 验证修复
- [ ] 任务状态显示"等待执行"
- [ ] 进度条为 0%
- [ ] 可以点击"执行"按钮
- [ ] 点击执行后能正常开始

---

## 🚨 如果问题仍然存在

### 检查是否是前端轮询问题

**打开浏览器控制台 (F12):**

1. 检查是否有错误信息
2. 检查 Network 标签，看是否有请求 `/open-api/offline-video/tasks`
3. 查看返回的数据中，`screenshots.status` 是什么

**手动触发轮询：**
在控制台运行：
```javascript
loadTasks(currentPage);
```

### 检查是否是数据库连接问题

```bash
cd backend
python -c "
from app.database import test_connection
if test_connection():
    print('✅ 数据库连接正常')
else:
    print('❌ 数据库连接失败')
"
```

### 终极方案：完全重建任务

如果以上方法都不行，可以：
1. 导出重要数据（视频URL、ASR结果、知识点结果）
2. 删除任务
3. 重新创建任务
4. 恢复已有的数据

---

## 📞 寻求帮助

如果问题无法解决，请提供以下信息：

1. **诊断脚本输出：**
   ```bash
   python check_task_status.py > task_status.txt
   ```

2. **数据库状态：**
   - `screenshots.status` 的值
   - `screenshots_result_url` 是否为空

3. **浏览器控制台：**
   - 错误信息截图
   - Network 请求和响应数据

4. **后端日志：**
   - 启动日志
   - 执行截图步骤的日志



