CREATE TABLE "creator_courses" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"course_id" text NOT NULL,
	"creator_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "creator_courses_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_creator" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "creator_courses" ADD CONSTRAINT "creator_courses_course_id_user_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."user_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_courses" ADD CONSTRAINT "creator_courses_creator_id_user_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "creator_courses_slug_unique" ON "creator_courses" USING btree ("slug");