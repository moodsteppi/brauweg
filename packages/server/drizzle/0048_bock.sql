-- BroweG-Bock (Robin, 28.11.2026; docs/STARTSEITE-UMBAU-PLAN.md, Abschnitt 6):
-- drei bis fuenf Spieler spielen nacheinander mehrere kurze Stationen,
-- jede Station ist ein echter Tisch, am Ende gewinnt einer ueber alle.
--
-- Zwei Tabellen, weil die Serie und ihre Tische verschieden lange leben:
-- `bock` haelt Sitze, Plan und Punkte der ganzen Serie, `bock_station` je
-- Station den Tisch und die Platzierung. Ueber `bock_station.table_id` findet
-- der Dienst beim Partie-Ende zurueck zu seinem Bock (src/bock/dienst.ts).
--
-- Sitze, Plan, Punkte und Ergebnis liegen in jsonb: Es sind drei bis fuenf
-- Eintraege, die immer zusammen gelesen und geschrieben werden — eine
-- eigene Sitz-Tabelle braechte nur Abfragen, keine Sicherheit.
--
-- Der Code ist nullbar (Bocks aus der Suche haben keinen); mehrere NULL
-- stoeren den Unique-Index in Postgres nicht.

CREATE TABLE "bock" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text,
  "gastgeber_id" uuid REFERENCES "account"("id") ON DELETE SET NULL,
  "art" text NOT NULL CHECK ("art" IN ('suche', 'freunde')),
  "zustand" text NOT NULL DEFAULT 'wartet' CHECK ("zustand" IN ('wartet', 'laeuft', 'fertig')),
  "sitze" jsonb NOT NULL,
  "plan" jsonb NOT NULL,
  "station" integer NOT NULL DEFAULT 0,
  "punkte" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "ergebnis" jsonb,
  "weiter_ab" timestamp with time zone,
  "erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
  "aktualisiert_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "bock_code_idx" ON "bock" ("code");
--> statement-breakpoint
CREATE INDEX "bock_zustand_idx" ON "bock" ("zustand", "aktualisiert_am");
--> statement-breakpoint
CREATE TABLE "bock_station" (
  "bock_id" uuid NOT NULL REFERENCES "bock"("id") ON DELETE CASCADE,
  "nr" integer NOT NULL,
  "game_id" text NOT NULL,
  "table_id" uuid REFERENCES "table_"("id") ON DELETE SET NULL,
  "sitzplaetze" jsonb NOT NULL,
  "platzierung" jsonb,
  "erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("bock_id", "nr")
);
--> statement-breakpoint
CREATE INDEX "bock_station_tisch_idx" ON "bock_station" ("table_id");
