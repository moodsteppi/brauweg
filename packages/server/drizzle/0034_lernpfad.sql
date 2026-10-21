-- Doppelkopf lernen (Emile, 17.10.2026): Lernpfad und Tagesserie, eine Zeile
-- je Konto (lernpfad.ts).
--
-- `lektionen` haelt die Kennungen der erledigten Lektionen als JSON-Liste —
-- der Pfad hat sieben, eine eigene Zeile je Lektion waere Verwaltung ohne
-- Nutzen. Die Serie steht als Zahl samt letztem Spieltag, nicht als Liste
-- aller Tage: Mehr als „gestern gespielt?" fragt die Regel nie.
-- `schutz_tag` ist der Tag, den der Wochenschutz zuletzt ueberbrueckt hat;
-- `belohnt_am` verhindert das zweite Outfit, `erinnert_tag` die zweite
-- Abend-Mitteilung am selben Tag.
--
-- Ein Befehl, deshalb ohne Trenner.

CREATE TABLE IF NOT EXISTS "lernpfad" (
  "account_id" uuid PRIMARY KEY NOT NULL,
  "lektionen" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "serie" integer DEFAULT 0 NOT NULL,
  "beste" integer DEFAULT 0 NOT NULL,
  "letzter_tag" date,
  "schutz_tag" date,
  "belohnt_am" timestamp with time zone,
  "erinnert_tag" date,
  CONSTRAINT "lernpfad_account_id_account_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action
);
