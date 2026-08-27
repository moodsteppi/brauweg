-- Mememory: Zufallsgurt und gesperrte Faecher.
--
-- Zwei kleine Spalten fuer eine Sache: Wer den Schalter umlegt, bekommt in
-- JEDER Partie drei andere Memes aus seiner Sammlung. Bis auf die, die er
-- festgehalten hat.
--
-- `account.mememory_zufall` ist der Schalter. Er steht am KONTO und nicht am
-- Geraet, weil er zur Sammlung gehoert und nicht zum Kopfhoerer: Wer seine
-- Bilder rollen laesst, will das auf jedem Geraet.
--
-- `mememory_sammlung.gesperrt` gehoert zur Zeile, die gerade einen `platz`
-- hat — also zum Gurtfach. Eine eigene Tabelle waere sauberer normalisiert
-- und hier trotzdem falsch: Ein Fach OHNE Motiv gibt es nicht (der Gurt ist
-- allein die Spalte `platz`), also gibt es auch nichts, was ein Schloss
-- ohne Motiv festhalten koennte.
--
-- Beide mit Vorgabewert und NOT NULL: Ein Konto, das es vor diesem Deploy
-- schon gab, hat den Schalter aus und kein Fach gesperrt — genau der
-- Zustand, den es heute hat.

ALTER TABLE "account"
  ADD COLUMN IF NOT EXISTS "mememory_zufall" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "mememory_sammlung"
  ADD COLUMN IF NOT EXISTS "gesperrt" boolean DEFAULT false NOT NULL;
