CREATE TABLE "email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to" text NOT NULL,
	"kind" text NOT NULL,
	"provider" text NOT NULL,
	"status" text NOT NULL,
	"provider_id" text,
	"error" text,
	"subject" text NOT NULL,
	"body" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "email_log_time_idx" ON "email_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "email_log_to_idx" ON "email_log" USING btree ("to");