-- ============================================
-- 数据库迁移脚本：添加VOD（腾讯云点播）相关字段
-- ============================================
-- 说明：此脚本为 offline_video_tasks 表添加VOD相关字段
-- 字段说明：
--   - vod_file_id: 云点播文件ID（单P为字符串，多P为JSON数组）
--   - vod_play_url: 云点播播放URL（单P为字符串，多P为JSON数组，带签名）
--   - vod_cover_url: 云点播封面URL
-- ============================================

-- 检查字段是否已存在
SELECT COUNT(*) as vod_file_id_exists
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'offline_video_tasks' 
AND COLUMN_NAME = 'vod_file_id';

SELECT COUNT(*) as vod_play_url_exists
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'offline_video_tasks' 
AND COLUMN_NAME = 'vod_play_url';

SELECT COUNT(*) as vod_cover_url_exists
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'offline_video_tasks' 
AND COLUMN_NAME = 'vod_cover_url';

-- 如果字段不存在（上面查询返回0），执行以下 ALTER 语句

-- 1. 添加 vod_file_id 字段
-- 注意：根据实际情况调整 AFTER 子句的位置
ALTER TABLE offline_video_tasks 
ADD COLUMN vod_file_id MEDIUMTEXT NULL 
COMMENT '云点播文件ID（单P为字符串，多P为JSON数组）' 
AFTER exercises_result_url;

-- 2. 添加 vod_play_url 字段
ALTER TABLE offline_video_tasks 
ADD COLUMN vod_play_url MEDIUMTEXT NULL 
COMMENT '云点播播放URL（单P为字符串，多P为JSON数组，带签名）' 
AFTER vod_file_id;

-- 3. 添加 vod_cover_url 字段
ALTER TABLE offline_video_tasks 
ADD COLUMN vod_cover_url VARCHAR(500) NULL 
COMMENT '云点播封面URL' 
AFTER vod_play_url;

-- 验证字段已添加
SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, COLUMN_COMMENT
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'offline_video_tasks'
AND COLUMN_NAME IN ('vod_file_id', 'vod_play_url', 'vod_cover_url')
ORDER BY ORDINAL_POSITION;
