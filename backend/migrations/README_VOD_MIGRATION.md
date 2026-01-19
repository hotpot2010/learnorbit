# VOD字段迁移脚本使用说明

## 脚本说明

本脚本用于为 `offline_video_tasks` 表添加腾讯云点播（VOD）相关字段。

### 添加的字段

1. **`vod_file_id`** (MEDIUMTEXT)
   - 云点播文件ID
   - 单P视频：存储字符串
   - 多P视频：存储JSON数组

2. **`vod_play_url`** (MEDIUMTEXT)
   - 云点播播放URL（带签名）
   - 单P视频：存储字符串
   - 多P视频：存储JSON数组

3. **`vod_cover_url`** (VARCHAR(500))
   - 云点播封面URL

## 使用方法

### 方法1：使用Python脚本（推荐）

```bash
# 在 backend 目录下运行
cd backend
python migrations/migrate_add_vod_fields.py
```

### 方法2：使用SQL脚本

```bash
# 连接到MySQL数据库
mysql -u your_username -p your_database < migrations/add_vod_fields.sql
```

或者在MySQL客户端中执行：

```sql
-- 先检查字段是否存在
SELECT COUNT(*) as vod_file_id_exists
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'offline_video_tasks' 
AND COLUMN_NAME = 'vod_file_id';

-- 如果返回0，执行以下语句添加字段
ALTER TABLE offline_video_tasks 
ADD COLUMN vod_file_id MEDIUMTEXT NULL 
COMMENT '云点播文件ID（单P为字符串，多P为JSON数组）' 
AFTER exercises_result_url;

ALTER TABLE offline_video_tasks 
ADD COLUMN vod_play_url MEDIUMTEXT NULL 
COMMENT '云点播播放URL（单P为字符串，多P为JSON数组，带签名）' 
AFTER vod_file_id;

ALTER TABLE offline_video_tasks 
ADD COLUMN vod_cover_url VARCHAR(500) NULL 
COMMENT '云点播封面URL' 
AFTER vod_play_url;
```

## 脚本特性

- ✅ **幂等性**：脚本会检查字段是否已存在，如果已存在则跳过，可以安全地多次运行
- ✅ **自动验证**：执行完成后会自动验证字段是否成功添加
- ✅ **错误处理**：包含完整的错误处理和日志输出
- ✅ **灵活定位**：自动检测参考字段位置，确保字段添加在正确位置

## 注意事项

1. **备份数据**：在执行迁移前，建议先备份数据库
2. **字段位置**：字段会添加在 `exercises_result_url` 之后，如果该字段不存在，会自动调整位置
3. **数据库连接**：确保 `.env` 文件中的数据库配置正确

## 验证迁移结果

执行完成后，可以通过以下SQL验证：

```sql
SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, COLUMN_COMMENT
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'offline_video_tasks'
AND COLUMN_NAME IN ('vod_file_id', 'vod_play_url', 'vod_cover_url')
ORDER BY ORDINAL_POSITION;
```

应该看到3个字段：
- `vod_file_id` (MEDIUMTEXT)
- `vod_play_url` (MEDIUMTEXT)
- `vod_cover_url` (VARCHAR(500))
