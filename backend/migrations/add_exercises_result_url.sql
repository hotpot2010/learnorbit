-- ============================================
-- 数据库迁移脚本：添加 exercises_result_url 列
-- ============================================
-- 说明：此脚本为 offline_video_tasks 表添加 exercises_result_url 列
-- 用于存储练习生成结果的 URL
-- 单P视频：存储字符串
-- 多P视频：存储JSON数组
-- ============================================

USE video_analysis;

-- 检查列是否已存在
SELECT COUNT(*) as column_exists
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'video_analysis' 
AND TABLE_NAME = 'offline_video_tasks' 
AND COLUMN_NAME = 'exercises_result_url';

-- 如果列不存在，执行以下 ALTER 语句
-- （如果上面的查询返回 0，说明列不存在，需要执行下面的语句）

ALTER TABLE offline_video_tasks 
ADD COLUMN exercises_result_url MEDIUMTEXT NULL 
COMMENT '练习结果文件URL（单P为字符串，多P为JSON数组）' 
AFTER screenshots_result_url;

-- 验证列已添加
SELECT COLUMN_NAME, DATA_TYPE, COLUMN_COMMENT
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'video_analysis' 
AND TABLE_NAME = 'offline_video_tasks'
ORDER BY ORDINAL_POSITION;

