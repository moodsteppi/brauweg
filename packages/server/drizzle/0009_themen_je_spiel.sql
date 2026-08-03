CREATE TABLE "account_game_theme" (
	"account_id" uuid NOT NULL,
	"game_id" text NOT NULL,
	"card_deck" text DEFAULT 'text' NOT NULL,
	"table_scene" text DEFAULT 'stube' NOT NULL,
	CONSTRAINT "account_game_theme_account_id_game_id_pk" PRIMARY KEY("account_id","game_id")
);
--> statement-breakpoint
ALTER TABLE "account_game_theme" ADD CONSTRAINT "account_game_theme_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "account_game_theme" ("account_id", "game_id", "card_deck", "table_scene")
SELECT "id", 'doppelkopf', "card_deck", "table_scene" FROM "account"
ON CONFLICT DO NOTHING;
