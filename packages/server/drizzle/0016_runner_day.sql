-- Pro-Subway (Endless Runner): Tageslimit fuer erspielte Hub-Muenzen.
--
-- Pro Konto und Kalendertag (Europe/Berlin) merken wir, wie viele Muenzen
-- aus dem Runner schon gutgeschrieben wurden. Ohne diese Kappe koennte
-- ein Client beliebig oft cashout aufrufen.

CREATE TABLE IF NOT EXISTS "runner_day" (
  "account_id" uuid NOT NULL,
  "day" date NOT NULL,
  "coins" integer NOT NULL DEFAULT 0,
  CONSTRAINT "runner_day_account_id_account_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "runner_day_pkey" PRIMARY KEY ("account_id", "day")
);

CREATE INDEX IF NOT EXISTS "runner_day_tag_idx" ON "runner_day" ("account_id", "day");
