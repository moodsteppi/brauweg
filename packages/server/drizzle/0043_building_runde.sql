CREATE TABLE "building_runde" (
  "account_id" uuid NOT NULL REFERENCES "account"("id") ON DELETE CASCADE,
  "partie" text NOT NULL,
  "modus" text NOT NULL,
  "start" timestamp with time zone NOT NULL,
  "ende" timestamp with time zone,
  "tag" text,
  "ergebnis" jsonb,
  "muenzen" integer NOT NULL DEFAULT 0 CHECK ("muenzen" BETWEEN 0 AND 15),
  PRIMARY KEY ("account_id", "partie")
);
--> statement-breakpoint
CREATE INDEX "building_runde_konto_tag_idx" ON "building_runde" ("account_id", "tag");
