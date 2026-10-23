-- Browort und Clanwort (Emile, 23.10.2026): das taegliche Wortraetsel,
-- browort.ts.
--
-- `browort_runde` haelt EINE Runde je Konto und Tag (Europe/Berlin), die
-- Versuche als JSON-Liste der geratenen Woerter — sechs hoechstens, eine
-- eigene Zeile je Versuch waere Verwaltung ohne Nutzen. Die Farben stehen
-- nicht darin: Sie folgen aus Versuch und Tageswort und werden beim Lesen
-- gerechnet.
--
-- `browort_stand` haelt je Konto die Serien (Browort und Clanwort getrennt,
-- Emiles Wahl) und die Zahlen fuers Profil: gespielt, geloest, die Summe der
-- Versuche bei geloesten Woertern (der Schnitt ist Summe durch geloest) und
-- die Verteilung auf ein bis sechs Versuche.
--
-- `clanwort_tag` haelt je Clan und Tag, wer das Wort waehlt und welches; die
-- Raeterunden der Mitglieder liegen in `clanwort_runde`.
--
-- Vier Befehle, deshalb mit dem Drizzle-Trenner dazwischen (siehe 0016).

CREATE TABLE IF NOT EXISTS "browort_runde" (
  "account_id" uuid NOT NULL,
  "tag" date NOT NULL,
  "versuche" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "geloest" boolean DEFAULT false NOT NULL,
  "fertig" boolean DEFAULT false NOT NULL,
  CONSTRAINT "browort_runde_account_id_account_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "browort_runde_pkey" PRIMARY KEY ("account_id", "tag")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "browort_stand" (
  "account_id" uuid PRIMARY KEY NOT NULL,
  "serie" integer DEFAULT 0 NOT NULL,
  "beste" integer DEFAULT 0 NOT NULL,
  "letzter_tag" date,
  "schutz_tag" date,
  "erinnert_tag" date,
  "gespielt" integer DEFAULT 0 NOT NULL,
  "geloest" integer DEFAULT 0 NOT NULL,
  "versuche_summe" integer DEFAULT 0 NOT NULL,
  "verteilung" jsonb DEFAULT '[0,0,0,0,0,0]'::jsonb NOT NULL,
  "clan_serie" integer DEFAULT 0 NOT NULL,
  "clan_beste" integer DEFAULT 0 NOT NULL,
  "clan_letzter_tag" date,
  "clan_schutz_tag" date,
  CONSTRAINT "browort_stand_account_id_account_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clanwort_tag" (
  "club_id" uuid NOT NULL,
  "tag" date NOT NULL,
  "waehler_id" uuid,
  "wort" text,
  "zufall" boolean DEFAULT false NOT NULL,
  "gewaehlt_am" timestamp with time zone,
  CONSTRAINT "clanwort_tag_club_id_club_id_fk"
    FOREIGN KEY ("club_id") REFERENCES "public"."club"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "clanwort_tag_waehler_id_account_id_fk"
    FOREIGN KEY ("waehler_id") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "clanwort_tag_pkey" PRIMARY KEY ("club_id", "tag")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clanwort_runde" (
  "club_id" uuid NOT NULL,
  "tag" date NOT NULL,
  "account_id" uuid NOT NULL,
  "versuche" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "geloest" boolean DEFAULT false NOT NULL,
  "fertig" boolean DEFAULT false NOT NULL,
  CONSTRAINT "clanwort_runde_club_id_club_id_fk"
    FOREIGN KEY ("club_id") REFERENCES "public"."club"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "clanwort_runde_account_id_account_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "clanwort_runde_pkey" PRIMARY KEY ("club_id", "tag", "account_id")
);
