# 视频转码功能

## 功能概述

为 offline video 系统添加视频转码功能，将视频转码为 H.264 格式，提升浏览器兼容性。

## 数据库变更

### 新增字段

在 `offline_video_tasks` 表中添加：
- `transcoded_video_url` (MEDIUMTEXT): 转码后的视频URL
  - 单P视频：存储字符串
  - 多P视频：存储JSON数组字符串

### 迁移脚本

```bash
# 执行数据库迁移
cd backend
python migrations/migrate_add_transcoded_video_url.py
```

或手动执行SQL：
```sql
ALTER TABLE `offline_video_tasks` 
ADD COLUMN `transcoded_video_url` MEDIUMTEXT NULL 
COMMENT '转码后的视频URL（单P为字符串，多P为JSON数组）' 
AFTER `video_url`;
```

## 新增步骤

在任务步骤中添加了 `transcode` 步骤：

### 步骤顺序
1. 下载视频并上传
2. **转码视频** ← 新增
3. ASR识别
4. 生成知识点
5. 生成截图
6. 生成练习

### 步骤状态

- `pending`: 等待执行（旧任务默认状态）
- `running`: 转码中
- `success`: 转码成功
- `failed`: 转码失败
- `partial_success`: 部分分P转码成功（多P视频）

## 转码流程

### 单P视频
1. 从CDN下载原始视频
2. 使用FFmpeg转码为H.264
3. 上传转码后的视频到CDN
4. 保存转码视频URL
5. 清理临时文件

### 多P视频
1. 遍历所有分P
2. 对每个分P执行转码流程
3. 收集所有转码结果
4. 保存为JSON数组

## 转码参数

使用的FFmpeg参数：
```bash
ffmpeg \
  -i input.mp4 \
  -c:v libx264 \          # H.264视频编码器
  -preset medium \         # 编码速度（ultrafast/fast/medium/slow）
  -crf 23 \               # 质量（18-28，越小质量越好）
  -c:a aac \              # AAC音频编码器
  -b:a 128k \             # 音频比特率
  -movflags +faststart \  # 优化网页播放
  -y \                    # 覆盖输出文件
  output.mp4
```

## API使用

### 执行转码

```bash
POST /open-api/offline-video/execute

{
  "task_id": "task_1703472000_1234",
  "step": "transcode"
}
```

### 查询任务状态

```bash
GET /open-api/offline-video/tasks/{task_id}
```

响应示例：
```json
{
  "task_id": "task_xxx",
  "steps": {
    "transcode": {
      "status": "success",
      "progress": 100,
      "message": "转码完成",
      "result": {
        "url": "https://file.gsxservice.com/xxx_h264.mp4"
      }
    }
  },
  "transcoded_video_url": "https://file.gsxservice.com/xxx_h264.mp4"
}
```

## 前端界面

在任务详情页面中：
- 显示转码步骤卡片
- 显示转码进度
- 提供"执行"按钮（pending状态）
- 显示转码后的视频URL（success状态）

## 注意事项

### 依赖要求
- 需要安装FFmpeg：`apt-get install ffmpeg`（Linux）或 `brew install ffmpeg`（Mac）
- FFmpeg需在系统PATH中

### 性能考虑
- 转码是CPU密集型操作，建议配置足够的CPU资源
- 转码时间取决于视频长度和质量设置
- 使用线程池控制并发，避免资源耗尽

### 存储空间
- 转码过程会产生临时文件
- 转码完成后自动清理临时文件
- 确保有足够的临时存储空间（建议至少10GB）

### 旧任务处理
- 旧任务的转码步骤默认为`pending`状态
- 用户可以手动点击"执行"按钮进行转码
- 转码不会影响其他已完成的步骤

## 故障排查

### 转码失败
1. 检查FFmpeg是否正确安装：`ffmpeg -version`
2. 检查原视频URL是否可访问
3. 检查磁盘空间是否充足
4. 查看错误日志获取详细信息

### 上传失败
1. 检查CDN上传服务是否正常
2. 检查网络连接
3. 重试转码步骤

### 多P视频部分失败
- 系统会标记为`partial_success`
- 可以重新执行转码步骤
- 已成功的分P会被跳过

## 示例

### 新任务完整流程
```bash
# 1. 创建任务
POST /open-api/offline-video/tasks
{
  "bilibili_url": "https://www.bilibili.com/video/BVxxx"
}

# 2. 执行下载
POST /open-api/offline-video/execute
{
  "task_id": "task_xxx",
  "step": "download"
}

# 3. 执行转码
POST /open-api/offline-video/execute
{
  "task_id": "task_xxx",
  "step": "transcode"
}

# 4. 后续步骤...
```

### 旧任务补充转码
```bash
# 对已存在的任务执行转码
POST /open-api/offline-video/execute
{
  "task_id": "task_old_xxx",
  "step": "transcode"
}
```

## 版本历史

- **v1.0** (2024-12-24): 初始版本
  - 添加转码功能
  - 支持单P和多P视频
  - H.264格式转码
  - 旧任务兼容

