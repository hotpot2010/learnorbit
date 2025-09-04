CREATE TABLE "analytics_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_name" varchar(100) NOT NULL,
	"timestamp" bigint NOT NULL,
	"server_timestamp" timestamp DEFAULT now() NOT NULL,
	"session_id" varchar(200) NOT NULL,
	"user_id" text,
	"locale" varchar(10) NOT NULL,
	"device_type" varchar(20) NOT NULL,
	"user_agent" varchar(1000),
	"client_ip" varchar(45),
	"page_path" varchar(500),
	"page_title" varchar(200),
	"referrer" varchar(500),
	"event_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;