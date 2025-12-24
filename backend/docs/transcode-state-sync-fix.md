# 转码状态同步问题修复

## 问题描述

转码任务在后台日志显示已完成（`✅ 单P视频转码完成`），但前端界面仍然显示"执行中"状态，没有更新为"完成"。

## 根本原因分析

### 状态更新流程

在转码完成时，代码执行顺序如下：

```python
# 1. 修改本地 task 变量
task["transcoded_video_url"] = transcoded_url
task["steps"]["transcode"]["result"] = {"url": transcoded_url}

# 2. 调用 _update_step_status（问题所在！）
self._update_step_status(
    task_id, "transcode",
    TaskStatus.SUCCESS, 100,
    "转码完成"
)

# 3. 更新缓存
self.tasks_cache[task_id] = task

# 4. 保存到数据库
self._save_task_to_db(task)
```

### 问题关键

`_update_step_status` 内部实现：

```python
def _update_step_status(self, task_id, step, status, progress, message, result=None, error=None):
    # ⚠️ 从缓存获取任务（此时缓存中还是旧数据！）
    task = self.get_task(task_id)
    
    # 更新步骤状态
    task["steps"][step]["status"] = status
    task["steps"][step]["progress"] = progress
    # ...
    
    # 更新缓存
    self.tasks_cache[task_id] = task
    
    # ⚠️ 保存到数据库（此时 transcoded_video_url 还未被保存！）
    self._save_task_to_db(task)
```

**问题分析：**
1. 在调用 `_update_step_status` 之前，我们修改了本地 `task` 变量，添加了 `transcoded_video_url`
2. 但此时缓存 `self.tasks_cache[task_id]` 中还是**旧的** task 对象（不包含 `transcoded_video_url`）
3. `_update_step_status` 调用 `self.get_task(task_id)` 时，获取到的是**缓存中的旧对象**
4. `_update_step_status` 更新步骤状态后保存到数据库，**覆盖了** `transcoded_video_url` 的更新
5. 虽然后续又调用了 `self._save_task_to_db(task)`，但由于数据库操作的时序问题，可能导致状态不一致

### 表现症状

- 后端日志显示转码完成 ✅
- 数据库中的步骤状态可能未正确更新为 `SUCCESS`
- 前端轮询获取任务状态时，仍然看到 `RUNNING` 状态
- 前端界面一直显示"执行中"，不会自动刷新为"完成"

## 解决方案

### 修复原则

**在调用 `_update_step_status` 之前，必须先更新缓存。**

这样确保 `_update_step_status` 内部读取缓存时，能获取到最新的 task 数据（包括 `transcoded_video_url`）。

### 修复代码

#### 单P视频转码（第3536-3550行）

**修复前：**
```python
# 更新任务信息
task["transcoded_video_url"] = transcoded_url
task["steps"]["transcode"]["result"] = {"url": transcoded_url}

self._update_step_status(
    task_id, "transcode",
    TaskStatus.SUCCESS, 100,
    "转码完成"
)

# 保存任务
self.tasks_cache[task_id] = task
self._save_task_to_db(task)
```

**修复后：**
```python
# 更新任务信息
task["transcoded_video_url"] = transcoded_url
task["steps"]["transcode"]["result"] = {"url": transcoded_url}

# ✅ 先更新缓存，再更新步骤状态
self.tasks_cache[task_id] = task

self._update_step_status(
    task_id, "transcode",
    TaskStatus.SUCCESS, 100,
    "转码完成"
)
```

#### 多P视频转码（第3413-3432行）

**修复前：**
```python
# 更新任务状态
final_status = TaskStatus.SUCCESS if success_count == total_parts else TaskStatus.PARTIAL_SUCCESS

task["transcoded_video_url"] = json.dumps(transcoded_urls) if len(transcoded_urls) > 1 else (transcoded_urls[0] if transcoded_urls else None)
task["steps"]["transcode"]["result"] = {
    "parts": part_results,
    "total": total_parts,
    "success": success_count,
    "failed": total_parts - success_count
}

self._update_step_status(
    task_id, "transcode",
    final_status, 100,
    f"转码完成: {success_count}/{total_parts} 个分P成功"
)

# 保存任务
self.tasks_cache[task_id] = task
self._save_task_to_db(task)
```

**修复后：**
```python
# 更新任务状态
final_status = TaskStatus.SUCCESS if success_count == total_parts else TaskStatus.PARTIAL_SUCCESS

task["transcoded_video_url"] = json.dumps(transcoded_urls) if len(transcoded_urls) > 1 else (transcoded_urls[0] if transcoded_urls else None)
task["steps"]["transcode"]["result"] = {
    "parts": part_results,
    "total": total_parts,
    "success": success_count,
    "failed": total_parts - success_count
}

# ✅ 先更新缓存，再更新步骤状态
self.tasks_cache[task_id] = task

self._update_step_status(
    task_id, "transcode",
    final_status, 100,
    f"转码完成: {success_count}/{total_parts} 个分P成功"
)
```

## 前端轮询机制

前端有智能轮询机制来自动更新任务状态：

```javascript
function startPolling() {
    // 智能轮询：有运行中的任务时频繁刷新（2秒），否则降低频率（5秒）或停止
    function poll() {
        loadTasks(currentPage).then(() => {
            const hasRunningTasks = Array.from(document.querySelectorAll('.step')).some(step => {
                const statusEl = step.querySelector('.step-status');
                return statusEl && statusEl.textContent.includes('执行中');
            });
            
            // 如果从"有运行中"变为"没有运行中"，再轮询3次以确保获取最终状态
            if (lastHadRunningTasks && !hasRunningTasks) {
                console.log('🔄 检测到任务状态变化，继续轮询以确保获取最终状态...');
                extraPollCount = 3;
            }
            lastHadRunningTasks = hasRunningTasks;
            
            // 动态调整轮询间隔
            const delay = hasRunningTasks ? 2000 : 5000;
            refreshInterval = setTimeout(() => {
                poll();
            }, delay);
        });
    }
    
    poll();
}
```

**修复后的效果：**
- 后端正确保存转码完成状态到数据库 ✅
- 前端轮询时获取到正确的 `SUCCESS` 状态 ✅
- 前端界面自动更新为"完成"，并显示"预览"按钮 ✅

## 验证步骤

### 1. 重启后端服务

```bash
# 重启 FastAPI 后端以应用代码修复
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

### 2. 测试转码功能

1. 打开 `http://localhost:8000/offline-video`
2. 创建新任务或使用已有任务
3. 确保"1. 下载视频并上传"已完成
4. 点击"2. 转码视频"的"执行"按钮
5. 观察前端状态：
   - 初始状态：等待执行
   - 执行中：进度条显示 5%，状态为"执行中"
   - 完成后：进度条显示 100%，状态自动更新为"完成"
   - 显示"预览"按钮，可以播放转码后的视频

### 3. 验证数据库

```sql
-- 查询任务的转码步骤状态
SELECT 
    task_id,
    video_title,
    JSON_EXTRACT(steps, '$.transcode.status') as transcode_status,
    JSON_EXTRACT(steps, '$.transcode.progress') as transcode_progress,
    transcoded_video_url
FROM offline_video_tasks
WHERE task_id = 'your_task_id';
```

**期望结果：**
- `transcode_status`: `"success"`
- `transcode_progress`: `100`
- `transcoded_video_url`: 有效的 CDN URL

## 相关问题检查

虽然其他步骤（download, asr, knowledge_points, screenshots, exercises）的代码模式不同，但也检查了它们的实现：

- ✅ 其他步骤在更新 URL 时都是：修改 task → 更新缓存 → 保存数据库
- ✅ 它们在调用 `_update_step_status` 时，通常只更新进度和状态，不涉及 URL 的修改
- ✅ 没有发现类似的状态同步问题

## 修复日期

2024-12-24

## 相关文件

- `backend/app/services/offline_video_service.py`
  - 第 3536-3550 行：单P视频转码完成逻辑
  - 第 3413-3432 行：多P视频转码完成逻辑

