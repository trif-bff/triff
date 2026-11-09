ALTER TABLE "documents" ADD COLUMN "ocr_pages" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "ocr_confidence" real;