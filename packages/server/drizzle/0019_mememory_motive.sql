-- Mememory: hochgeladene Motive und der Vorschlagskasten.
--
-- Warum in der Datenbank und nicht als Datei unter public/: Railway baut bei
-- jedem Deploy ein frisches Abbild. Alles, was der laufende Dienst auf die
-- Platte schreibt, ist beim naechsten Push weg. Ein Bild, das ein Spieler
-- heute einreicht, muss aber auch nach dem naechsten Deploy noch da sein.
--
-- Das Bild steht als data-URL in einer Textspalte, genau wie das Profilbild
-- (account.avatar). Es ist klein (im Browser auf 320 px verkleinert, unter
-- 60 kB) und wird ueber /api/mememory/motive/<kennung> als Bytes
-- ausgeliefert.
--
-- `status` hat genau zwei Werte: 'vorschlag' (wartet auf Freigabe, nur die
-- Aufsicht sieht das Bild) und 'frei' (im Spiel). Ein dritter Wert
-- 'abgelehnt' waere ein Bilderfriedhof in der Datenbank — abgelehnt heisst
-- hier geloescht.
--
-- `pack` ist die Vorbereitung fuer eigene Packs. NULL bedeutet Grundtopf:
-- fuer alle sichtbar. Spaeter bekommt ein eigener Pack hier eine Kennung,
-- und die Motivliste einer Partie wird danach vorgefiltert — ohne dass sich
-- an Tabelle, Endpunkten oder Spielmodul etwas aendert.

CREATE TABLE IF NOT EXISTS "mememory_motiv" (
  "kennung" text PRIMARY KEY NOT NULL,
  "bild" text NOT NULL,
  "titel" text,
  "status" text NOT NULL DEFAULT 'vorschlag',
  "pack" text,
  "eingereicht_von" uuid,
  "geprueft_von" uuid,
  "geprueft_am" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "mememory_motiv_eingereicht_von_account_id_fk"
    FOREIGN KEY ("eingereicht_von") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "mememory_motiv_geprueft_von_account_id_fk"
    FOREIGN KEY ("geprueft_von") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mememory_motiv_status_idx" ON "mememory_motiv" ("status");
