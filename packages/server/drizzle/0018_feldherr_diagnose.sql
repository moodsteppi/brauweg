-- Mitschnitt der Feldherr-Netzpartien (docs/FELDHERR-DIAGNOSE.md).
--
-- Feldherr wird auf dem Produktivsystem strittig und in keiner Testfassung.
-- Diese Tabelle nimmt auf, was waehrend einer echten Partie passiert:
-- Takt, Wissensgrenze, schwebende Zuege, Pruefsummen beider Seiten, jeder
-- Verbindungsabbruch, jeder Fehlercode. Eine Zeile ist eine Portion
-- Mitschnitt EINES Geraets; zusammengefuehrt wird ueber table_id.
--
-- account_id auf SET NULL, nicht CASCADE: Wer sein Konto loescht, soll die
-- Messung nicht mitnehmen - sie beschreibt eine Partie, keinen Menschen.
-- table_id auf CASCADE: Mit dem Tisch verschwindet der Anlass.
--
-- Die Zeilen verfallen ohnehin (aufraeumen() in src/diagnose.ts, 14 Tage).
--
-- Drei Befehle, dazwischen die Drizzle-Trennzeile - der PGlite-Pruefstand
-- nimmt je Abschnitt nur einen Befehl (siehe 0016 und CLAUDE.md, Regel 3).

CREATE TABLE IF NOT EXISTS "feldherr_diagnose" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid,
  "table_id" uuid,
  "seat" integer NOT NULL,
  "grund" text NOT NULL,
  "ab_index" integer NOT NULL DEFAULT 0,
  "rumpf" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "feldherr_diagnose_account_id_account_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "feldherr_diagnose_table_id_table__id_fk"
    FOREIGN KEY ("table_id") REFERENCES "public"."table_"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feldherr_diagnose_tisch_idx" ON "feldherr_diagnose" ("table_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feldherr_diagnose_zeit_idx" ON "feldherr_diagnose" ("created_at");
