-- Flying Bro (Projekt #18, 06.11.2026): Fortschritt, Spielwaehrung und
-- Tageskappe — src/flyingbro.ts, Spielentwurf in docs/SPEZIFIKATION-FLYINGBRO.md.
--
-- Nur hinzufuegend: drei neue Tabellen, keine bestehende Spalte wird
-- angefasst. Die Flugmeilen stehen bewusst NICHT in `account` neben Muenzen
-- und Edelsteinen: Sie bleiben im Spiel wie die Taler der Kartenmanufaktur
-- und werden nie getauscht. Eine Spalte dort saehe aus wie ein viertes
-- Hub-Guthaben und laege einen Umtausch nahe.
--
-- flyingbro_stand: eine Zeile je Konto — Meilen, Vorrat der Hilfsmittel,
--   gekaufte Zierde, die ueber die Tageskappe hinaus offenen Hub-Muenzen und
--   der laufende Levelstart (Zeitstempel fuer die Plausibilitaet, bezahlte
--   Hilfsmittel). Vorrat und Zierde als JSON, weil ein neuer Artikel sonst
--   eine Migration waere (Preise stehen im Katalog von flyingbro-kern).
-- flyingbro_level: bestes Ergebnis je Konto und Level. Nur geschaffte Level
--   haben eine Zeile; Sterne und Bestpunkte sinken nie.
-- flyingbro_tag: was heute schon kam, je Konto und Kalendertag (Berlin) —
--   Hub-Muenzen gegen die Tageskappe, Wiederholungen gegen die Meilenkappe.
--   Dasselbe Muster wie runner_day (0016).
--
-- Drei Befehle, deshalb mit Trenner (siehe 0016).

CREATE TABLE IF NOT EXISTS "flyingbro_stand" (
  "account_id" uuid PRIMARY KEY NOT NULL,
  "meilen" integer DEFAULT 0 NOT NULL,
  "vorrat" jsonb NOT NULL,
  "zierde" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "muenzen_offen" integer DEFAULT 0 NOT NULL,
  "start" jsonb,
  "aktualisiert" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "flyingbro_stand_account_id_account_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "flyingbro_stand_meilen_check" CHECK ("meilen" >= 0),
  CONSTRAINT "flyingbro_stand_offen_check" CHECK ("muenzen_offen" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "flyingbro_level" (
  "account_id" uuid NOT NULL,
  "level_id" text NOT NULL,
  "sterne" smallint NOT NULL,
  "bestpunkte" integer NOT NULL,
  "erstmals_am" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "flyingbro_level_account_id_account_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "flyingbro_level_pk" PRIMARY KEY ("account_id", "level_id"),
  CONSTRAINT "flyingbro_level_sterne_check" CHECK ("sterne" BETWEEN 1 AND 3)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "flyingbro_tag" (
  "account_id" uuid NOT NULL,
  "tag" date NOT NULL,
  "muenzen" integer DEFAULT 0 NOT NULL,
  "wiederholungen" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "flyingbro_tag_account_id_account_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "flyingbro_tag_pk" PRIMARY KEY ("account_id", "tag")
);
