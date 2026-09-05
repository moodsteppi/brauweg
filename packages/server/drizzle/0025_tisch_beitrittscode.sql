-- Tische bekommen einen kurzen Beitrittscode.
--
-- Anlass ist der geplante Tisch mit Freunden: Wer sich verabredet, sagt einen
-- Code ins Telefon oder schickt einen Link. Eine Tisch-UUID taugt dafuer
-- nicht, und ein Tisch, den man nur ueber eine Liste findet, hilft beim
-- Verabreden gar nicht.
--
-- Eigene Spalte statt eines Feldes im vorhandenen `filters`-jsonb: Der Code
-- muss eindeutig sein, sonst fuehrt derselbe Code zwei Freundeskreise an
-- verschiedene Tische. Eindeutigkeit kann nur ein Index zusichern.
--
-- Nullbar und ohne Vorgabewert, weil jeder Tisch von vor diesem Deploy keinen
-- Code hat. Mehrere NULL stoeren einen Unique-Index in Postgres nicht.

ALTER TABLE "table_"
  ADD COLUMN IF NOT EXISTS "join_code" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "table_join_code_idx" ON "table_" ("join_code");
