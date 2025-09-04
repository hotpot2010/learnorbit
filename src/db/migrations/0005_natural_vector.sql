CREATE TABLE IF NOT EXISTS "key_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"event_name" varchar(50) NOT NULL,
	"timestamp" bigint NOT NULL,
	"server_timestamp" timestamp DEFAULT now() NOT NULL,
	"session_id" varchar(200) NOT NULL,
	"user_id" text NOT NULL,
	"locale" varchar(10) NOT NULL,
	"device_type" varchar(20) NOT NULL,
	"user_agent" varchar(1000),
	"page_path" varchar(500) NOT NULL,
	"page_title" varchar(200),
	"action_data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "key_actions" ADD CONSTRAINT "key_actions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
