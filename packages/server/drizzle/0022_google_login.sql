ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "google_sub" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "account_google_sub_key" ON "account" ("google_sub");
