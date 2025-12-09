-- 手动更新 task_1764906207_1200 的 thumbnail_cdn
-- 这个SQL可以直接在数据库管理工具中执行

UPDATE offline_video_tasks 
SET video_info = JSON_SET(
    video_info,
    '$.thumbnail_cdn', 'http://file.gsxservice.com/3357661089_j42hrby9.jpg'
)
WHERE task_id = 'task_1764906207_1200';

-- 验证更新
SELECT task_id, video_title, video_info 
FROM offline_video_tasks 
WHERE task_id = 'task_1764906207_1200';

