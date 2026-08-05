ALTER TABLE "account" ADD COLUMN "birthday" date;
--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "has_birthday_outfit" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "birthday_reward_year" integer;
