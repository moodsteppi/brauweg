-- Herkunft je Werbelink (Werbetest, 19.10.2026): `?q=<kennung>`, src/herkunft.ts.
--
-- `account.herkunft` haelt die Kennung, ueber die ein Gastkonto entstanden
-- ist. Nullbar und ohne Vorgabe: Jedes Konto von vor diesem Deploy ist ohne
-- Werbelink gekommen, und genau das sagt NULL.
--
-- `herkunft_zaehler` sind nur Summen je Kennung und Kalendertag (Berlin).
-- Keine Zeile je Besuch, kein Fremdschluessel aufs Konto: gezaehlt, nicht
-- protokolliert, und ein geloeschtes Konto nimmt seine Runden nicht mit.
--
-- Drei Befehle, deshalb mit Trennern (siehe 0016).

ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "herkunft" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "herkunft_zaehler" (
  "kennung" text NOT NULL,
  "tag" date NOT NULL,
  "besuche" integer DEFAULT 0 NOT NULL,
  "gastkonten" integer DEFAULT 0 NOT NULL,
  "runden" integer DEFAULT 0 NOT NULL,
  "partien" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "herkunft_zaehler_kennung_tag_pk" PRIMARY KEY ("kennung", "tag")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "herkunft_zaehler_tag_idx" ON "herkunft_zaehler" USING btree ("tag");
