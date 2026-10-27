-- Push-Mitteilungen fuer die App (23.09.2026): Geraete und Einstellungen.
--
-- `geraet_push` haelt je Geraet das Token, das APNs (iOS) bzw. FCM (Android)
-- ausgibt. Das Token gehoert dem GERAET, nicht dem Konto: Meldet sich auf
-- demselben Telefon jemand anderes an, zieht die Zeile um (eindeutiger Index
-- auf `token`, die Registrierung ist ein Upsert). Sonst bekaeme der Vorgaenger
-- die Mitteilungen des Nachfolgers.
--
-- `sitzung_id` bindet das Token an die Anmeldung, aus der es kam. Beim
-- Abmelden verschwinden genau diese Zeilen (auth/service.ts, `logout`) —
-- auch dann, wenn die App vorher keine Gelegenheit mehr hatte, ihr Token
-- selbst abzumelden. ON DELETE SET NULL, weil Sitzungen heute nie geloescht,
-- sondern nur widerrufen werden; die Loeschung haengt am Abmelden, nicht an
-- diesem Fremdschluessel.
--
-- `aktiv` statt Loeschen, wenn APNs 410/BadDeviceToken bzw. FCM UNREGISTERED
-- meldet: Die Zeile bleibt stehen, damit eine erneute Registrierung desselben
-- Tokens (App neu installiert, Erlaubnis zurueck) sie wieder einschaltet und
-- man im Betrieb sehen kann, wie viele Geraete abgesprungen sind.
--
-- Kontoloeschung ist hier Anonymisierung, die Kontozeile bleibt also stehen
-- und ON DELETE CASCADE griffe nie. Geloescht wird deshalb ausdruecklich in
-- `anonymizeAccount` (auth/service.ts). Die Kaskade steht trotzdem da — fuer
-- den Tag, an dem ein Konto doch einmal wirklich entfernt wird.
--
-- `push_einstellung` sagt je Konto, welche Anlaesse es NICHT will (`aus`).
-- Als Ausschlussliste, damit ein neuer Anlass ohne Migration und ohne
-- Nachtrag fuer alle Konten eingeschaltet ist. Die Kennungen stehen in
-- push/anlaesse.ts und werden nie umbenannt.
--
-- Vier Befehle, dazwischen je die Drizzle-Trennzeile — der PGlite-Pruefstand
-- nimmt je Abschnitt nur einen Befehl (siehe 0016 und CLAUDE.md, Regel 3).

CREATE TABLE IF NOT EXISTS "geraet_push" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL,
  "sitzung_id" uuid,
  "plattform" text NOT NULL,
  "token" text NOT NULL,
  "erstellt" timestamp with time zone NOT NULL DEFAULT now(),
  "zuletzt_gesehen" timestamp with time zone NOT NULL DEFAULT now(),
  "aktiv" boolean NOT NULL DEFAULT true,
  CONSTRAINT "geraet_push_account_id_account_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "geraet_push_sitzung_id_session_id_fk"
    FOREIGN KEY ("sitzung_id") REFERENCES "public"."session"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "geraet_push_plattform_check" CHECK ("plattform" IN ('ios', 'android'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "geraet_push_token_key" ON "geraet_push" ("token");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "geraet_push_konto_idx" ON "geraet_push" ("account_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "push_einstellung" (
  "account_id" uuid PRIMARY KEY NOT NULL,
  "aus" text[] NOT NULL DEFAULT '{}'::text[],
  "geaendert" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "push_einstellung_account_id_account_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action
);
