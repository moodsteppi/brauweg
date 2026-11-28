-- Startseiten-Umbau (28.11.2026, docs/STARTSEITE-UMBAU-PLAN.md): Vorlieben am
-- Konto und „zuletzt gespielt".
--
-- Vorlieben als eigene Tabelle und nicht als Spalten an `account`: `account`
-- liest jeder Ladevorgang mit einer festen Spaltenliste, und zwei Listen
-- (Favoriten, Quick-Play-Auswahl) gehoeren dort nicht hinein. Eine Zeile
-- entsteht erst, wenn jemand etwas einstellt — fehlt sie, gelten keine
-- Favoriten und alle Quick-Play-Kandidaten.
--
-- `schnellspiel` darf NULL sein, und das ist etwas anderes als leer: NULL
-- heisst „alle Kandidaten", eine leere Liste weist der Server ab (Robin: im
-- Zahnrad-Blatt muss mindestens ein Spiel an bleiben).
--
-- „Zuletzt gespielt" haelt je Konto und Spiel nur den letzten Zeitpunkt. Die
-- Kennung ist frei (`text`): Neben den Tischspielen stehen hier auch Solo-
-- Spiele und Arenen, die kein Modul haben (src/zuletzt.ts).
--
-- Drei Befehle, getrennt durch den Drizzle-Trenner (siehe 0016): Der
-- PGlite-Pruefstand nimmt je Abschnitt nur einen.

CREATE TABLE IF NOT EXISTS "konto_vorliebe" (
  "account_id" uuid PRIMARY KEY NOT NULL,
  "favoriten" text[] DEFAULT '{}'::text[] NOT NULL,
  "schnellspiel" text[],
  "aktualisiert" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "konto_vorliebe_account_id_account_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zuletzt_gespielt" (
  "account_id" uuid NOT NULL,
  "spiel" text NOT NULL,
  "am" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "zuletzt_gespielt_account_id_account_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "zuletzt_gespielt_pk" PRIMARY KEY ("account_id", "spiel")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "zuletzt_gespielt_konto_am_idx" ON "zuletzt_gespielt" ("account_id", "am");
