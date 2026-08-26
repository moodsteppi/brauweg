-- Mememory: die Sammlung und der Emote-Gurt.
--
-- Wer ein Motiv im Spiel einmal aufgedeckt hat, hat es gesammelt. Aus der
-- Sammlung waehlt man bis zu drei Stueck, die im Spiel als Reaktion fliegen
-- (statt der Emojis).
--
-- `kennung` ist absichtlich ohne Fremdschluessel auf mememory_motiv: Die 88
-- Grundmotive stehen dort gar nicht — sie liegen als Dateien im Client. Ein
-- Fremdschluessel wuerde also genau die Haelfte der sammelbaren Bilder
-- ausschliessen. Geprueft wird stattdessen die FORM der Kennung; ein
-- erfundener Eintrag kostet den, der ihn schickt, ein leeres Feld in der
-- eigenen Sammlung und sonst nichts.
--
-- `platz` ist der Gurt: 1, 2 oder 3, sonst NULL. Der Teilindex darunter
-- sorgt dafuer, dass ein Konto denselben Platz nicht zweimal vergibt —
-- ohne die vielen NULL-Zeilen zu behindern, die gerade nicht im Gurt sind.

CREATE TABLE IF NOT EXISTS "mememory_sammlung" (
  "account_id" uuid NOT NULL,
  "kennung" text NOT NULL,
  "platz" smallint,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "mememory_sammlung_pkey" PRIMARY KEY ("account_id", "kennung"),
  CONSTRAINT "mememory_sammlung_account_id_account_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mememory_sammlung_platz_key"
  ON "mememory_sammlung" ("account_id", "platz") WHERE "platz" IS NOT NULL;
