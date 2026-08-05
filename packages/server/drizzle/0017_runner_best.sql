-- Pro-Subway: der beste Lauf des Tages je Konto — die Tagesrangliste.
--
-- Eine Zeile je Konto und Kalendertag (Europe/Berlin), ueberschrieben nur
-- von einem besseren Lauf. Meter und Muenzen gehoeren zum besten Lauf und
-- sind keine getrennten Maxima.
--
-- Zwei Befehle, dazwischen die Drizzle-Trennzeile — der PGlite-Pruefstand
-- nimmt je Abschnitt nur einen Befehl (siehe 0016 und CLAUDE.md, Regel 3).

CREATE TABLE IF NOT EXISTS "runner_best" (
  "account_id" uuid NOT NULL,
  "day" date NOT NULL,
  "punkte" integer NOT NULL DEFAULT 0,
  "meter" integer NOT NULL DEFAULT 0,
  "muenzen" integer NOT NULL DEFAULT 0,
  CONSTRAINT "runner_best_account_id_account_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "runner_best_pkey" PRIMARY KEY ("account_id", "day")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "runner_best_tag_idx" ON "runner_best" ("day", "punkte");
