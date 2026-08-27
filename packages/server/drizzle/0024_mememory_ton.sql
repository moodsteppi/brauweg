-- Mememory: ein Ton je Motiv.
--
-- Ein Meme ist selten nur ein Bild. Bis zu acht Zehntelsekunden Ton haengen
-- deshalb an derselben Zeile wie das Bild — kein zweiter Tisch, kein zweiter
-- Lebenslauf: Wer ein Motiv herausnimmt, nimmt seinen Ton mit heraus, und
-- eine eigene Tabelle waere genau der Ort, an dem ein Ton ohne Bild
-- zurueckbliebe.
--
-- NULL heisst stumm, und das ist der Normalfall: Die 88 Grundmotive stehen
-- ohnehin in keiner Tabelle, und jedes hochgeladene Bild von vor diesem
-- Deploy hat keinen Ton. Deshalb ohne Vorgabewert und ohne NOT NULL.
--
-- Der Inhalt ist eine data-URL wie beim Bild (`audio/wav`, im Browser auf
-- Mono und 22050 Hz gerechnet). Die Grenze zieht TON_MAX_ZEICHEN in
-- packages/server/src/memes.ts; hier steht keine, weil ein CHECK ueber der
-- Laenge einer Textspalte beim Nachziehen der Grenze eine Migration
-- braeuchte.

ALTER TABLE "mememory_motiv"
  ADD COLUMN IF NOT EXISTS "ton" text;
