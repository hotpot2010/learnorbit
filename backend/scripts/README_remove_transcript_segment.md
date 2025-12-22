# 删除 transcript_segment 字段脚本使用说明

## 功能说明

这个脚本用于删除数据库中所有知识点JSON文件中的 `transcript_segment` 字段。

## 使用方法

### 1. 运行脚本

```bash
cd backend
python scripts/remove_transcript_segment.py
```

### 2. 脚本执行流程

1. **读取数据库**：从 `offline_video_tasks` 表读取所有任务
2. **下载JSON文件**：根据 `knowledge_points_result_url` 下载知识点JSON文件
3. **删除字段**：删除每个知识点中的 `transcript_segment` 字段
4. **重新上传**：将更新后的JSON文件上传到CDN
5. **更新数据库**：更新数据库中的URL（如果URL变化）

### 3. 注意事项

- 脚本会为每个任务创建独立的数据库会话，确保每个任务的处理是独立的
- 如果某个任务处理失败，不会影响其他任务
- 脚本会跳过没有 `transcript_segment` 字段的文件，避免不必要的上传
- 支持单P和多P视频（多P视频可能有多个知识点文件）

### 4. 输出信息

脚本会输出详细的处理信息：
- 每个任务的处理状态
- 删除的字段数量
- 最终统计信息（总任务数、已处理、已更新、失败）

## 代码修改

除了运行脚本删除现有数据外，还需要确保以后不再生成 `transcript_segment` 字段：

### 已修改的文件

1. **backend/app/services/knowledge_point_extractor.py**
   - 移除了 `_add_transcript_segments` 方法的调用
   - 移除了相关的日志输出

### 影响说明

- 前端代码已经有fallback逻辑，会从完整逐字稿中动态提取片段
- API接口仍然接受 `transcript_segment` 参数（用于实时生成场景）
- 只是不再在知识点JSON文件中存储这个字段，以节省存储空间

