-- Muenz-Codes (27.10.2026): Einmal-Codes, die im brotool (Tab „Spielen")
-- erzeugt und auf der Webseite eingeloest werden — src/muenzcodes.ts.
--
-- Ein Code gilt genau einmal. Eingeloest heisst: `eingeloest_von` ist gesetzt.
-- Das Einloesen setzt die Spalte mit `WHERE eingeloest_von IS NULL`, zwei
-- gleichzeitige Versuche bekommen also nie beide die Muenzen. Der Verweis aufs
-- Konto ohne Kaskade: Konten werden anonymisiert, nicht geloescht
-- (anonymizeAccount), und dass ein Code verbraucht ist, muss bleiben.

CREATE TABLE IF NOT EXISTS "muenz_code" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "muenzen" integer NOT NULL,
  "notiz" text,
  "erstellt" timestamp with time zone DEFAULT now() NOT NULL,
  "gueltig_bis" timestamp with time zone,
  "gesperrt" boolean DEFAULT false NOT NULL,
  "eingeloest_von" uuid,
  "eingeloest_am" timestamp with time zone,
  CONSTRAINT "muenz_code_muenzen_check" CHECK ("muenzen" > 0),
  CONSTRAINT "muenz_code_eingeloest_von_fk" FOREIGN KEY ("eingeloest_von") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "muenz_code_code_key" ON "muenz_code" ("code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "muenz_code_erstellt_idx" ON "muenz_code" ("erstellt");
