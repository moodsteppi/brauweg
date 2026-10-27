-- Anmeldung ueber fremde Anbieter (Google, Apple) in einer eigenen Tabelle.
--
-- Bis hierher hing Google als Spalte `account.google_sub` am Konto. Mit Apple
-- kaeme eine zweite Spalte dazu, mit jedem weiteren Anbieter noch eine — und
-- "welche Anmeldearten hat dieses Konto" waere eine Frage, die jede Stelle
-- selbst aus mehreren Spalten zusammensuchen muesste. Eine Zeile je Bindung
-- beantwortet sie mit einer Abfrage, und ein neuer Anbieter ist ein neuer Wert
-- in der Pruefbedingung statt einer neuen Spalte.
--
-- Der Schluessel ist (provider, subject): `subject` ist das `sub` des
-- ID-Tokens und das einzige, woran die Person beim Anbieter dauerhaft zu
-- erkennen ist. Die Mail steht nur zur Anzeige daneben — sie kann sich beim
-- Anbieter aendern, und bei Apple ist sie oft eine Weiterleitungsadresse.
--
-- Der zweite eindeutige Index (account_id, provider) verhindert zwei
-- Google-Konten an einem Brauweg-Konto: Beim Trennen waere sonst unklar,
-- welches gemeint ist, und "letzte Anmeldeart" liesse sich nicht mehr zaehlen.
--
-- Uebernommen werden alle vorhandenen Google-Bindungen nicht anonymisierter
-- Konten. Danach wird `google_sub` geleert, aber NICHT entfernt: Ein
-- zurueckgerollter Deploy liest die Spalte noch, und ohne sie fiele dort
-- jede Kontoabfrage um. Leer schadet sie nicht — der alte Code findet dann
-- niemanden ueber die Kennung und verknuepft ueber die bestaetigte Mail neu.
-- Entfernen kann sie eine spaetere Migration, wenn niemand mehr zurueck will.
--
-- Vier Befehle, dazwischen je die Drizzle-Trennzeile — der PGlite-Pruefstand
-- nimmt je Abschnitt nur einen Befehl (siehe 0016 und CLAUDE.md, Regel 3).

CREATE TABLE IF NOT EXISTS "account_identity" (
  "provider" text NOT NULL,
  "subject" text NOT NULL,
  "account_id" uuid NOT NULL,
  "email" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "account_identity_account_id_account_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "account_identity_provider_check" CHECK ("provider" IN ('google', 'apple')),
  CONSTRAINT "account_identity_pkey" PRIMARY KEY ("provider", "subject")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "account_identity_konto_anbieter_key" ON "account_identity" ("account_id", "provider");
--> statement-breakpoint
INSERT INTO "account_identity" ("provider", "subject", "account_id", "email")
  SELECT 'google', "google_sub", "id", "email"
  FROM "account"
  WHERE "google_sub" IS NOT NULL AND "anonymized_at" IS NULL
  ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE "account" SET "google_sub" = NULL WHERE "google_sub" IS NOT NULL;
