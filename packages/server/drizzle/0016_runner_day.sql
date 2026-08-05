-- Pro-Subway (Endless Runner): Tageslimit fuer erspielte Hub-Muenzen.
--
-- Pro Konto und Kalendertag (Europe/Berlin) merken wir, wie viele Muenzen
-- aus dem Runner schon gutgeschrieben wurden. Ohne diese Kappe koennte
-- ein Client beliebig oft cashout aufrufen.
--
-- Zwei Befehle brauchen den Drizzle-Trenner (die Pfeil-Kommentarzeile
-- zwischen den Befehlen unten): Der PGlite-Pruefstand schickt jeden
-- Abschnitt als vorbereitete Anweisung, und die nimmt nur EINEN Befehl
-- ("cannot insert multiple commands into a prepared statement"). Der
-- node-postgres-Migrator auf dem Server ist nachsichtiger — deshalb lief
-- der Deploy durch, waehrend 215 Tests rot waren. Beide Befehle sind
-- IF NOT EXISTS; dass der geaenderte Dateihash die Migration auf Staging
-- erneut anstoesst, laeuft deshalb ins Leere.
--
-- Und Vorsicht: Der Migrator splittet auf die WOERTLICHE Trenner-Zeichen-
-- kette, auch mitten in einem Kommentar. Der Trenner darf deshalb nirgends
-- zitiert werden, sonst zerschneidet er die Datei an der falschen Stelle.

CREATE TABLE IF NOT EXISTS "runner_day" (
  "account_id" uuid NOT NULL,
  "day" date NOT NULL,
  "coins" integer NOT NULL DEFAULT 0,
  CONSTRAINT "runner_day_account_id_account_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "runner_day_pkey" PRIMARY KEY ("account_id", "day")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "runner_day_tag_idx" ON "runner_day" ("account_id", "day");
