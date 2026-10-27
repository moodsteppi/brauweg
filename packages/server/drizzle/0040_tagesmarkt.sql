-- Persönliche Tagesangebote und einmaliger Münzbonus, Kalendertag Europe/Berlin.
CREATE TABLE IF NOT EXISTS "tagesmarkt" (
  "account_id" uuid NOT NULL REFERENCES "account"("id") ON DELETE CASCADE,
  "tag" date NOT NULL,
  "angebote" jsonb NOT NULL,
  "muenzen_geholt" boolean DEFAULT false NOT NULL,
  CONSTRAINT "tagesmarkt_pk" PRIMARY KEY ("account_id", "tag")
);
