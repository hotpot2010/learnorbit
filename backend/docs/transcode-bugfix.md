# 转码功能Bug修复

## 问题描述

点击转码任务后出现错误："执行失败: 未知错误"，后端没有收到请求。

## 根本原因

对于**旧任务**（在添加转码功能之前创建的任务），它们的 `task["steps"]` 中不包含 `transcode` 步骤。

当用户点击"执行"按钮时，API会检查步骤是否存在：
```python
if step not in task["steps"]:
    raise HTTPException(status_code=400, detail=f"无效的步骤: {step}")
```

由于旧任务没有 `transcode` 步骤，这个检查会失败并抛出异常。

## 解决方案

### 1. 添加旧任务初始化逻辑

在 `backend/app/api/routes/offline_video.py` 的 `execute_step` 函数中，添加了对旧任务的 `transcode` 步骤初始化：

```python
# 如果是旧任务且访问 transcode 步骤，先初始化该步骤
if step == "transcode" and step not in task["steps"]:
    print(f"🔧 [API] 旧任务检测到，初始化 transcode 步骤...")
    task["steps"]["transcode"] = {
        "status": TaskStatus.PENDING,
        "progress": 0,
        "message": "等待执行",
        "result": None,
        "error": None,
        "retry_count": 0
    }
    if "transcoded_video_url" not in task:
        task["transcoded_video_url"] = None
    offline_video_service.tasks_cache[task_id] = task
    offline_video_service._save_task_to_db(task)
```

### 2. 添加依赖检查

确保转码步骤在执行前检查下载步骤是否完成：

```python
if step == "transcode":
    # 转码需要下载步骤完成或有部分成功
    download_status = get_actual_status("download")
    if download_status not in [TaskStatus.SUCCESS, TaskStatus.PARTIAL_SUCCESS]:
        raise HTTPException(status_code=400, detail="请先完成下载步骤")
    if not task.get("video_url"):
        raise HTTPException(status_code=400, detail="视频URL不存在，请先完成下载并上传")
```

### 3. 更新API文档

更新了API文档，将 `transcode` 添加到支持的步骤列表中。

## 前端兼容性

前端HTML模板已经有了处理旧任务缺失步骤的逻辑：

```javascript
// 如果步骤不存在（旧任务），创建一个待执行状态
const stepInfo = task.steps[step.key] || {
    status: 'pending',
    progress: 0,
    message: '等待执行',
    error: null,
    result: null
};
```

这确保了即使是旧任务，转码步骤也能正常显示为"等待执行"状态。

## 测试验证

### 新任务
- ✅ 转码步骤在创建时自动初始化
- ✅ 正常执行转码功能

### 旧任务
- ✅ 首次点击"执行"时自动初始化步骤
- ✅ 初始化后正常执行转码
- ✅ 步骤状态正确保存到数据库

## 使用说明

对于旧任务：
1. 打开任务详情页面
2. 找到"2. 转码视频"步骤（显示为"等待执行"）
3. 确保"1. 下载视频并上传"步骤已完成
4. 点击"执行"按钮
5. 系统会自动初始化步骤并开始转码

## 相关文件

- `backend/app/api/routes/offline_video.py` - API路由修复
- `backend/templates/offline-video.html` - 前端界面（已有兼容逻辑）

## 修复日期

2024-12-24

