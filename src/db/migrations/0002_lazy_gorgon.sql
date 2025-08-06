CREATE TABLE "course_chat_history" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"session_id" text NOT NULL,
	"messages" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"step_number" integer NOT NULL,
	"task_content" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_courses" ADD COLUMN "tasks_generated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "course_chat_history" ADD CONSTRAINT "course_chat_history_course_id_user_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."user_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_tasks" ADD CONSTRAINT "course_tasks_course_id_user_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."user_courses"("id") ON DELETE cascade ON UPDATE no action;