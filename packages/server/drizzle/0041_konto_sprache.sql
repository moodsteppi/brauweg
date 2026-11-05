-- Gewaehlte Sprache am Konto (de, en). NULL heisst „Automatisch": Der Client folgt der Geraetesprache.
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "sprache" text;
