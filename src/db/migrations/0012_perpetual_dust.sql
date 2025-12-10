CREATE TABLE "user_video_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"task_id" text NOT NULL,
	"video_url" text NOT NULL,
	"bv_id" text,
	"video_title" text,
	"video_platform" text DEFAULT 'bilibili',
	"user_notes_data" jsonb NOT NULL,
	"title" text,
	"description" text,
	"is_favorite" boolean DEFAULT false,
	"total_knowledge_points" integer DEFAULT 0,
	"total_qas" integer DEFAULT 0,
	"total_exercises" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_viewed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "video_note_tag_relations" (
	"note_id" text NOT NULL,
	"tag_id" text NOT NULL,
	CONSTRAINT "video_note_tag_relations_note_id_tag_id_pk" PRIMARY KEY("note_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "video_note_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_video_notes" ADD CONSTRAINT "user_video_notes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_note_tag_relations" ADD CONSTRAINT "video_note_tag_relations_note_id_user_video_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."user_video_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_note_tag_relations" ADD CONSTRAINT "video_note_tag_relations_tag_id_video_note_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."video_note_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_note_tags" ADD CONSTRAINT "video_note_tags_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;