-- ==========================================
-- LearnOrbit MySQL 数据库迁移脚本
-- 从 Supabase (PostgreSQL) 迁移到 MySQL
-- 日期: 2024-12-25
-- 注意: 所有表使用 learnorbit_ 前缀（避免与其他业务表冲突）
-- ==========================================

-- 设置字符集
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- ==========================================
-- 1. 用户相关表
-- ==========================================

-- 用户表
CREATE TABLE `learnorbit_user` (
  `id` VARCHAR(255) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `email_verified` BOOLEAN NOT NULL DEFAULT 0,
  `image` TEXT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `role` VARCHAR(50),
  `customer_id` VARCHAR(255),
  INDEX idx_email (`email`),
  INDEX idx_customer_id (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 会话表
CREATE TABLE `learnorbit_session` (
  `id` VARCHAR(255) PRIMARY KEY,
  `expires_at` TIMESTAMP NOT NULL,
  `token` VARCHAR(500) NOT NULL UNIQUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `ip_address` VARCHAR(100),
  `user_agent` TEXT,
  `user_id` VARCHAR(255) NOT NULL,
  INDEX idx_token (`token`),
  INDEX idx_user_id (`user_id`),
  INDEX idx_expires_at (`expires_at`),
  CONSTRAINT `learnorbit_session_user_id_fk` FOREIGN KEY (`user_id`) 
    REFERENCES `learnorbit_user`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户会话表';

-- 账户表（第三方登录）
CREATE TABLE `learnorbit_account` (
  `id` VARCHAR(255) PRIMARY KEY,
  `account_id` VARCHAR(255) NOT NULL,
  `provider_id` VARCHAR(100) NOT NULL,
  `user_id` VARCHAR(255) NOT NULL,
  `access_token` TEXT,
  `refresh_token` TEXT,
  `id_token` TEXT,
  `access_token_expires_at` TIMESTAMP NULL,
  `refresh_token_expires_at` TIMESTAMP NULL,
  `scope` TEXT,
  `password` VARCHAR(255),
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (`user_id`),
  INDEX idx_provider (`provider_id`, `account_id`),
  CONSTRAINT `learnorbit_account_user_id_fk` FOREIGN KEY (`user_id`) 
    REFERENCES `learnorbit_user`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='第三方账户关联表';

-- 验证表
CREATE TABLE `learnorbit_verification` (
  `id` VARCHAR(255) PRIMARY KEY,
  `identifier` VARCHAR(255) NOT NULL,
  `value` TEXT NOT NULL,
  `expires_at` TIMESTAMP NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_identifier (`identifier`),
  INDEX idx_expires_at (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='验证码表';

-- 支付表
CREATE TABLE `learnorbit_payment` (
  `id` VARCHAR(255) PRIMARY KEY,
  `price_id` VARCHAR(255) NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `interval` VARCHAR(50),
  `user_id` VARCHAR(255) NOT NULL,
  `customer_id` VARCHAR(255) NOT NULL,
  `subscription_id` VARCHAR(255),
  `status` VARCHAR(50) NOT NULL,
  `period_start` TIMESTAMP NULL,
  `period_end` TIMESTAMP NULL,
  `cancel_at_period_end` BOOLEAN DEFAULT 0,
  `trial_start` TIMESTAMP NULL,
  `trial_end` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (`user_id`),
  INDEX idx_customer_id (`customer_id`),
  INDEX idx_subscription_id (`subscription_id`),
  INDEX idx_status (`status`),
  CONSTRAINT `learnorbit_payment_user_id_fk` FOREIGN KEY (`user_id`) 
    REFERENCES `learnorbit_user`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='支付订阅表';

-- ==========================================
-- 2. 课程相关表
-- ==========================================

-- 用户课程表
CREATE TABLE `learnorbit_user_courses` (
  `id` VARCHAR(255) PRIMARY KEY,
  `user_id` VARCHAR(255) NOT NULL,
  `course_plan` JSON NOT NULL COMMENT '课程计划数据（包含tasks, notes, marks等）',
  `plan_url` TEXT COMMENT 'CDN URL，存储课程计划的 JSON 文件',
  `current_step` INT NOT NULL DEFAULT 0,
  `status` ENUM('in-progress', 'completed') NOT NULL DEFAULT 'in-progress',
  `tasks_generated` BOOLEAN NOT NULL DEFAULT 0 COMMENT '标记任务是否已生成',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (`user_id`),
  INDEX idx_status (`status`),
  INDEX idx_created_at (`created_at`),
  CONSTRAINT `learnorbit_user_courses_user_id_fk` FOREIGN KEY (`user_id`) 
    REFERENCES `learnorbit_user`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户课程表';

-- 创作者课程表（公开课程）
CREATE TABLE `learnorbit_creator_courses` (
  `id` VARCHAR(255) PRIMARY KEY,
  `slug` VARCHAR(200) NOT NULL UNIQUE COMMENT '简洁的URL标识符',
  `course_id` VARCHAR(255) NOT NULL,
  `creator_id` VARCHAR(255) NOT NULL,
  `title` VARCHAR(200) NOT NULL COMMENT '公开显示的标题',
  `description` TEXT DEFAULT '' COMMENT '公开显示的描述',
  `is_active` BOOLEAN NOT NULL DEFAULT 1 COMMENT '是否激活',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_slug (`slug`),
  INDEX idx_course_id (`course_id`),
  INDEX idx_creator_id (`creator_id`),
  INDEX idx_is_active (`is_active`),
  CONSTRAINT `learnorbit_creator_courses_course_id_fk` FOREIGN KEY (`course_id`) 
    REFERENCES `learnorbit_user_courses`(`id`) ON DELETE CASCADE,
  CONSTRAINT `learnorbit_creator_courses_creator_id_fk` FOREIGN KEY (`creator_id`) 
    REFERENCES `learnorbit_user`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='创作者公开课程表';

-- ==========================================
-- 3. 行为分析表
-- ==========================================

-- 关键用户行为表
CREATE TABLE `learnorbit_key_actions` (
  `id` VARCHAR(255) PRIMARY KEY,
  `event_name` VARCHAR(50) NOT NULL COMMENT '事件名称: generate_course, start_learning等',
  `timestamp` BIGINT NOT NULL COMMENT '客户端时间戳（毫秒）',
  `server_timestamp` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `session_id` VARCHAR(200) NOT NULL,
  `user_id` VARCHAR(255) NOT NULL,
  `locale` VARCHAR(10) NOT NULL,
  `device_type` VARCHAR(20) NOT NULL,
  `user_agent` VARCHAR(1000),
  `page_path` VARCHAR(500) NOT NULL,
  `page_title` VARCHAR(200),
  `action_data` JSON NOT NULL COMMENT '业务相关的行为数据',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_event_name (`event_name`),
  INDEX idx_user_id (`user_id`),
  INDEX idx_session_id (`session_id`),
  INDEX idx_timestamp (`timestamp`),
  INDEX idx_server_timestamp (`server_timestamp`),
  CONSTRAINT `learnorbit_key_actions_user_id_fk` FOREIGN KEY (`user_id`) 
    REFERENCES `learnorbit_user`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='关键用户行为追踪表';

-- ==========================================
-- 4. 视频笔记相关表
-- ==========================================

-- 用户视频笔记表
CREATE TABLE `learnorbit_user_video_notes` (
  `id` VARCHAR(255) PRIMARY KEY,
  `user_id` VARCHAR(255) NOT NULL,
  `task_id` VARCHAR(255) NOT NULL COMMENT '关联到 offline_video_tasks 的任务ID',
  `video_url` TEXT NOT NULL,
  `bv_id` VARCHAR(50),
  `video_title` TEXT,
  `video_platform` ENUM('bilibili', 'youtube', 'custom') DEFAULT 'bilibili',
  `user_notes_data` JSON NOT NULL COMMENT '用户笔记数据（知识点笔记、QA、截图等）',
  `title` TEXT COMMENT '用户自定义标题',
  `description` TEXT,
  `is_favorite` BOOLEAN DEFAULT 0,
  `total_knowledge_points` INT DEFAULT 0,
  `total_qas` INT DEFAULT 0,
  `total_exercises` INT DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_viewed_at` TIMESTAMP NULL,
  INDEX idx_user_id (`user_id`),
  INDEX idx_task_id (`task_id`),
  INDEX idx_bv_id (`bv_id`),
  INDEX idx_is_favorite (`is_favorite`),
  INDEX idx_created_at (`created_at`),
  INDEX idx_last_viewed_at (`last_viewed_at`),
  CONSTRAINT `learnorbit_user_video_notes_user_id_fk` FOREIGN KEY (`user_id`) 
    REFERENCES `learnorbit_user`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户视频笔记表';

-- 视频笔记标签表
CREATE TABLE `learnorbit_video_note_tags` (
  `id` VARCHAR(255) PRIMARY KEY,
  `user_id` VARCHAR(255) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `color` VARCHAR(20) COMMENT '标签颜色（hex）',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (`user_id`),
  INDEX idx_name (`name`),
  CONSTRAINT `learnorbit_video_note_tags_user_id_fk` FOREIGN KEY (`user_id`) 
    REFERENCES `learnorbit_user`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='视频笔记标签表';

-- 笔记-标签关联表
CREATE TABLE `learnorbit_video_note_tag_relations` (
  `note_id` VARCHAR(255) NOT NULL,
  `tag_id` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`note_id`, `tag_id`),
  INDEX idx_note_id (`note_id`),
  INDEX idx_tag_id (`tag_id`),
  CONSTRAINT `learnorbit_video_note_tag_relations_note_id_fk` FOREIGN KEY (`note_id`) 
    REFERENCES `learnorbit_user_video_notes`(`id`) ON DELETE CASCADE,
  CONSTRAINT `learnorbit_video_note_tag_relations_tag_id_fk` FOREIGN KEY (`tag_id`) 
    REFERENCES `learnorbit_video_note_tags`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='笔记标签关联表';

-- ==========================================
-- 创建完成
-- ==========================================

-- 查看所有表
SHOW TABLES;

-- 验证表结构
SELECT 
  TABLE_NAME,
  TABLE_ROWS,
  CREATE_TIME,
  TABLE_COMMENT
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME;

