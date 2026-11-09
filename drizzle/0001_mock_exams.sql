ALTER TABLE "quiz_attempts" ADD COLUMN "late" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN "kind" text DEFAULT 'practice' NOT NULL;--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN "time_limit_sec" integer;--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "quizzes_user_kind_idx" ON "quizzes" USING btree ("user_id","kind");