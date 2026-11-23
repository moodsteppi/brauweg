-- Aktionscodes (Tom, 23.11.2026): ein Code fuer viele, je Konto einmal.
--
-- Anlass ist der Adventskalender (1.-24.12.2026): Jeden Tag zeigt ein Reel auf
-- Instagram und Facebook einen Code. Ein Einmal-Code aus muenz_code waere nach
-- dem ersten Zuschauer verbraucht. Ein Aktionscode gilt fuer beliebig viele
-- Konten, fuer jedes aber nur einmal - das sichert der Primaerschluessel von
-- aktions_code_einloesung, nicht ein Lesen-dann-Schreiben (zwei Klicks
-- gleichzeitig bekommen sonst beide die Belohnung).
--
-- Belohnung: Muenzen und/oder Kosmetik-Stuecke (IDs aus kosmetik.ts KATALOG).
-- Eingeloest wird wie bisher nur auf der Webseite (Apple 3.1.1, muenzcodes.ts).
--
-- Die 25 Codes des Kalenders legt diese Migration gleich mit an: gueltig ab dem
-- Tag des Tuerchens 00:00 Uhr Berlin, alle bis Silvester. BW-ADVT-VQ4X ist der
-- Testcode (50 Muenzen, sofort gueltig).

CREATE TABLE IF NOT EXISTS "aktions_code" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "muenzen" integer DEFAULT 0 NOT NULL,
  "items" text[] DEFAULT '{}'::text[] NOT NULL,
  "gueltig_ab" timestamp with time zone DEFAULT now() NOT NULL,
  "gueltig_bis" timestamp with time zone,
  "notiz" text,
  "gesperrt" boolean DEFAULT false NOT NULL,
  "erstellt" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "aktions_code_belohnung_check" CHECK ("muenzen" >= 0 AND ("muenzen" > 0 OR cardinality("items") > 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "aktions_code_code_key" ON "aktions_code" ("code");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "aktions_code_einloesung" (
  "code_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "eingeloest_am" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "aktions_code_einloesung_pk" PRIMARY KEY ("code_id", "account_id"),
  CONSTRAINT "aktions_code_einloesung_code_fk" FOREIGN KEY ("code_id") REFERENCES "public"."aktions_code"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "aktions_code_einloesung_account_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
INSERT INTO "aktions_code" ("code", "muenzen", "items", "gueltig_ab", "gueltig_bis", "notiz") VALUES
  ('BW-ADVT-VQ4X', 50, '{}', now(), '2026-12-31 23:59:59+01', 'Adventskalender: Testcode'),
  ('BW-ADVT-9DXM', 50, '{}', '2026-12-01 00:00:00+01', '2026-12-31 23:59:59+01', 'Adventskalender Tuer 1'),
  ('BW-ADVT-NK4Y', 0, '{hut-strohhut}', '2026-12-02 00:00:00+01', '2026-12-31 23:59:59+01', 'Adventskalender Tuer 2'),
  ('BW-ADVT-6DG6', 100, '{}', '2026-12-03 00:00:00+01', '2026-12-31 23:59:59+01', 'Adventskalender Tuer 3'),
  ('BW-ADVT-6KXD', 0, '{brille-sonnenbrille}', '2026-12-04 00:00:00+01', '2026-12-31 23:59:59+01', 'Adventskalender Tuer 4'),
  ('BW-ADVT-MR3K', 0, '{schuhe-gummistiefel}', '2026-12-05 00:00:00+01', '2026-12-31 23:59:59+01', 'Adventskalender Tuer 5'),
  ('BW-ADVT-XYTW', 150, '{}', '2026-12-06 00:00:00+01', '2026-12-31 23:59:59+01', 'Adventskalender Tuer 6'),
  ('BW-ADVT-CJ3V', 0, '{hand-kartenfaecher}', '2026-12-07 00:00:00+01', '2026-12-31 23:59:59+01', 'Adventskalender Tuer 7'),
  ('BW-ADVT-4NQD', 100, '{}', '2026-12-08 00:00:00+01', '2026-12-31 23:59:59+01', 'Adventskalender Tuer 8'),
  ('BW-ADVT-MMN3', 0, '{oberteil-weste}', '2026-12-09 00:00:00+01', '2026-12-31 23:59:59+01', 'Adventskalender Tuer 9'),
  ('BW-ADVT-VQEJ', 0, '{brille-skibrille}', '2026-12-10 00:00:00+01', '2026-12-31 23:59:59+01', 'Adventskalender Tuer 10'),
  ('BW-ADVT-RMER', 150, '{}', '2026-12-11 00:00:00+01', '2026-12-31 23:59:59+01', 'Adventskalender Tuer 11'),
  ('BW-ADVT-NKRK', 0, '{schuhe-schlittschuhe}', '2026-12-12 00:00:00+01', '2026-12-31 23:59:59+01', 'Adventskalender Tuer 12'),
  ('BW-ADVT-CHNP', 0, '{hut-zylinder}', '2026-12-13 00:00:00+01', '2026-12-31 23:59:59+01', 'Adventskalender Tuer 13'),
  ('BW-ADVT-CMY3', 200, '{}', '2026-12-14 00:00:00+01', '2026-12-31 23:59:59+01', 'Adventskalender Tuer 14'),
  ('BW-ADVT-TRXE', 0, '{hand-laterne}', '2026-12-15 00:00:00+01', '2026-12-31 23:59:59+01', 'Adventskalender Tuer 15'),
  ('BW-ADVT-TP47', 0, '{oberteil-regenjacke}', '2026-12-16 00:00:00+01', '2026-12-31 23:59:59+01', 'Adventskalender Tuer 16'),
  ('BW-ADVT-Y4RW', 200, '{}', '2026-12-17 00:00:00+01', '2026-12-31 23:59:59+01', 'Adventskalender Tuer 17'),
  ('BW-ADVT-XKR6', 0, '{aura-schneeflocken}', '2026-12-18 00:00:00+01', '2026-12-31 23:59:59+01', 'Adventskalender Tuer 18'),
  ('BW-ADVT-Y4UW', 0, '{hut-bergsteiger}', '2026-12-19 00:00:00+01', '2026-12-31 23:59:59+01', 'Adventskalender Tuer 19'),
  ('BW-ADVT-ENCT', 250, '{}', '2026-12-20 00:00:00+01', '2026-12-31 23:59:59+01', 'Adventskalender Tuer 20'),
  ('BW-ADVT-NXH9', 0, '{aura-funken}', '2026-12-21 00:00:00+01', '2026-12-31 23:59:59+01', 'Adventskalender Tuer 21'),
  ('BW-ADVT-CCUR', 0, '{hand-wanderstab}', '2026-12-22 00:00:00+01', '2026-12-31 23:59:59+01', 'Adventskalender Tuer 22'),
  ('BW-ADVT-4WRF', 300, '{}', '2026-12-23 00:00:00+01', '2026-12-31 23:59:59+01', 'Adventskalender Tuer 23'),
  ('BW-ADVT-G6YJ', 500, '{hut-krone}', '2026-12-24 00:00:00+01', '2026-12-31 23:59:59+01', 'Adventskalender Tuer 24')
ON CONFLICT ("code") DO NOTHING;
