ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "bro_jetons" integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chip_lock" (
	"table_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"seat" smallint NOT NULL,
	"buy_in" integer NOT NULL,
	"returned" integer,
	"settled_at" timestamp with time zone,
	CONSTRAINT "chip_lock_table_id_account_id_pk" PRIMARY KEY("table_id","account_id"),
	CONSTRAINT "chip_lock_table_id_table__id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."table_"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "chip_lock_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action
);
