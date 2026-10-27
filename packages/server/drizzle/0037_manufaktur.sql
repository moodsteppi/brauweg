-- Kartenmanufaktur (Emile, 23.10.2026): ein Idle-Spiel, eine Zeile je Konto
-- (manufaktur/dienst.ts, Spielentwurf in docs/SPEZIFIKATION-KARTENMANUFAKTUR.md).
--
-- Der ganze Stand liegt als JSON in `stand` — Pressen, Stufen, Meister,
-- Ablagen, Taler. Eine Spalte je Wert waere eine Migration je neuer Idee;
-- gelesen und geschrieben wird der Stand ohnehin immer als Ganzes, weil die
-- Rechnung (manufaktur/regeln.ts) ihn als Ganzes vorspult. `version` schuetzt
-- vor zwei Aktionen, die denselben alten Stand lesen.
--
-- Ein Befehl, deshalb ohne Trenner.

CREATE TABLE IF NOT EXISTS "manufaktur" (
  "account_id" uuid PRIMARY KEY NOT NULL,
  "stand" jsonb NOT NULL,
  "version" integer DEFAULT 0 NOT NULL,
  "aktualisiert" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "manufaktur_account_id_account_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action
);
