-- 简化版数据库schema修复脚本

-- 1. 添加is_creator字段到user表（如果不存在）
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "is_creator" boolean DEFAULT false NOT NULL;

-- 2. 创建creator_courses表（如果不存在）
CREATE TABLE IF NOT EXISTS "creator_courses" (
    "id" text PRIMARY KEY NOT NULL,
    "slug" text NOT NULL,
    "course_id" text NOT NULL,
    "creator_id" text NOT NULL,
    "title" text NOT NULL,
    "description" text,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- 3. 删除可能存在的重复约束和索引（如果存在）
ALTER TABLE "creator_courses" DROP CONSTRAINT IF EXISTS "creator_courses_slug_unique";
DROP INDEX IF EXISTS "creator_courses_slug_unique";

-- 4. 创建唯一索引
CREATE UNIQUE INDEX "creator_courses_slug_unique" ON "creator_courses" ("slug");

-- 5. 添加外键约束（忽略错误如果已存在）
ALTER TABLE "creator_courses"
ADD CONSTRAINT "creator_courses_course_id_user_courses_id_fk"
FOREIGN KEY ("course_id") REFERENCES "user_courses"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "creator_courses"
ADD CONSTRAINT "creator_courses_creator_id_user_id_fk"
FOREIGN KEY ("creator_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;

-- 6. 设置创作者账号
UPDATE "user" SET "is_creator" = true
WHERE "email" IN ('zhouletao20@gmail.com', 'ritafeng1234@gmail.com');

-- 7. 验证结果
SELECT
    'User table has is_creator column' as check_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user' AND column_name = 'is_creator'
    ) THEN '✅ SUCCESS' ELSE '❌ FAILED' END as status

UNION ALL

SELECT
    'creator_courses table exists' as check_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'creator_courses'
    ) THEN '✅ SUCCESS' ELSE '❌ FAILED' END as status

UNION ALL

SELECT
    'Creator accounts set' as check_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM "user"
        WHERE "email" IN ('zhouletao20@gmail.com', 'ritafeng1234@gmail.com')
        AND "is_creator" = true
    ) THEN '✅ SUCCESS' ELSE '❌ FAILED' END as status;
