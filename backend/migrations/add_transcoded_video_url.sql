-- 添加转码视频URL字段
-- 日期: 2024-12-24
-- 说明: 为 offline_video_tasks 表添加 transcoded_video_url 字段，用于存储转码后的视频URL

ALTER TABLE `offline_video_tasks` 
ADD COLUMN `transcoded_video_url` MEDIUMTEXT NULL COMMENT '转码后的视频URL（单P为字符串，多P为JSON数组）' 
AFTER `video_url`;

-- 验证字段是否添加成功
SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_COMMENT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'offline_video_tasks' 
AND COLUMN_NAME = 'transcoded_video_url';

