-- 给用户表添加创作者标识字段
ALTER TABLE "user" ADD COLUMN "is_creator" boolean DEFAULT false NOT NULL;

-- 创建创作者课程映射表
CREATE TABLE "creator_courses" (
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

-- 添加外键约束
ALTER TABLE "creator_courses" ADD CONSTRAINT "creator_courses_course_id_user_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "user_courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "creator_courses" ADD CONSTRAINT "creator_courses_creator_id_user_id_fk" FOREIGN KEY ("creator_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;

-- 添加唯一索引
CREATE UNIQUE INDEX "creator_courses_slug_unique" ON "creator_courses" ("slug");

-- 设置指定邮箱为创作者
UPDATE "user" SET "is_creator" = true WHERE "email" IN ('zhouletao20@gmail.com', 'ritafeng1234@gmail.com');
