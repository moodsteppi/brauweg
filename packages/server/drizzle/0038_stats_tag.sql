-- Tagesstatistik ohne Einwilligung (Tracking Stufe 0, 26.10.2026): src/statistik.ts.
--
-- `stats_tag` haelt nur Summen je Kalendertag (Berlin), Metrik und hoechstens
-- drei Dimensionen. Die Dimensionen kommen aus Konstanten des Codes (Spiel-
-- kennung, Tischart, Ausgang), nie aus Nutzereingaben. Keine Konto-Kennung,
-- keine Adresse, kein Tischcode: gezaehlt, nicht protokolliert — dasselbe
-- Muster wie `herkunft_zaehler` (0035). Leere Zeichenkette statt NULL, weil
-- eine NULL-Spalte im Primaerschluessel nicht geht und `on conflict` sonst
-- keinen Treffer faende.
--
-- `account.zuletzt_aktiv` ist nur das Datum, keine Historie: Es dient allein
-- dazu, ein Konto je Tag einmal in `aktive_konten` zu zaehlen.
--
-- Zwei Befehle, deshalb mit Trenner (siehe 0016).

CREATE TABLE IF NOT EXISTS "stats_tag" (
  "datum" date NOT NULL,
  "metrik" text NOT NULL,
  "spiel" text DEFAULT '' NOT NULL,
  "modus" text DEFAULT '' NOT NULL,
  "ergebnis" text DEFAULT '' NOT NULL,
  "wert" bigint DEFAULT 0 NOT NULL,
  CONSTRAINT "stats_tag_pk" PRIMARY KEY ("datum", "metrik", "spiel", "modus", "ergebnis")
);
--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "zuletzt_aktiv" date;
