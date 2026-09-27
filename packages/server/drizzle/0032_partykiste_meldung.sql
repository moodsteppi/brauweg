-- Partykiste (27.09.2026): „Passt nicht"-Meldungen zu einzelnen Inhalten.
--
-- Robin: „ja, nur auf staging wie der Bug-Knopf". Am Tisch tippt ein Tester
-- auf „Passt nicht", waehlt einen Grund, und hier landet, WELCHER Eintrag
-- gemeint war: Katalog (Dateiname unter game-partykiste/src/inhalte/) und
-- Kennung (q042, n017 ...). Die Kennungen aendern sich nie (PARTYKISTE.md),
-- also bleibt eine Meldung auch nach neuen Eintraegen richtig zugeordnet.
-- Die Aufsicht liest sie gezaehlt je Eintrag (GET /api/partykiste/meldungen).
--
-- `tisch_id` ohne Pflicht und mit SET NULL: Ein Tisch wird irgendwann
-- geloescht, die Meldung ueber den Eintrag bleibt wertvoll. `stufe` ist die
-- Inhaltsstufe, auf der der Tisch spielte — „zu zahm fuer die Stufe" sagt
-- ohne sie nichts. Der Text des Eintrags steht NICHT hier: Er steht im
-- Katalog, und eine Kopie liefe beim ersten Umschreiben auseinander.
--
-- Zwei Befehle, also mit dem Drizzle-Trenner dazwischen (CLAUDE.md, Regel 3).

CREATE TABLE IF NOT EXISTS "partykiste_meldung" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL,
  "tisch_id" uuid,
  "katalog" text NOT NULL,
  "kennung" text NOT NULL,
  "grund" text NOT NULL,
  "freitext" text,
  "stufe" smallint,
  "erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "partykiste_meldung_account_id_account_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "partykiste_meldung_tisch_id_table__id_fk"
    FOREIGN KEY ("tisch_id") REFERENCES "public"."table_"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "partykiste_meldung_eintrag_idx" ON "partykiste_meldung" ("katalog", "kennung");
