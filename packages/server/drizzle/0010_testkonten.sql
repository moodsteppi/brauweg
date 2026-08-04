ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "is_staff" boolean DEFAULT false NOT NULL;
