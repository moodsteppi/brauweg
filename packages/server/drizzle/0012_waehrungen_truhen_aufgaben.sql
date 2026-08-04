ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "gems" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."chest_grade" AS ENUM('holz', 'bronze', 'silber', 'gold', 'diamant');
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chest_claim" (
	"account_id" uuid NOT NULL,
	"chest_id" text NOT NULL,
	"grade" "chest_grade" NOT NULL,
	"coins" integer NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chest_claim_account_id_chest_id_pk" PRIMARY KEY("account_id","chest_id")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quest_progress" (
	"account_id" uuid NOT NULL,
	"quest_id" text NOT NULL,
	"day" date NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"claimed_at" timestamp with time zone,
	CONSTRAINT "quest_progress_account_id_quest_id_day_pk" PRIMARY KEY("account_id","quest_id","day")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account_cosmetic" (
	"account_id" uuid NOT NULL,
	"item_id" text NOT NULL,
	"acquired_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_cosmetic_account_id_item_id_pk" PRIMARY KEY("account_id","item_id")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account_avatar" (
	"account_id" uuid NOT NULL,
	"slot" text NOT NULL,
	"item_id" text NOT NULL,
	CONSTRAINT "account_avatar_account_id_slot_pk" PRIMARY KEY("account_id","slot")
);--> statement-breakpoint
ALTER TABLE "chest_claim" ADD CONSTRAINT "chest_claim_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_progress" ADD CONSTRAINT "quest_progress_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_cosmetic" ADD CONSTRAINT "account_cosmetic_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_avatar" ADD CONSTRAINT "account_avatar_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chest_claim_account_idx" ON "chest_claim" USING btree ("account_id","claimed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quest_progress_tag_idx" ON "quest_progress" USING btree ("account_id","day");
