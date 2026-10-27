-- Trophaeenweg (26.09.2026): abgeholte Belohnungen je Konto und Schwelle.
--
-- Der Weg zaehlt die Summe der Trophaeen ueber alle Spiele. An jeder Station
-- (100, 250, 500, 750, 1000) gibt es eine Truhe und einen festen Gegenstand,
-- an jedem anderen 100er-Checkpoint bis 1000 feste Muenzen, darueber alle 250
-- eine Silbertruhe. Was es wo gibt, steht im Code (src/trophaeenweg-katalog.ts),
-- nicht in der Datenbank; hier steht nur, was abgeholt ist.
--
-- Der Primaerschluessel (account_id, schwelle) ist die Sperre gegen das zweite
-- Abholen: Zwei gleichzeitige Anfragen legen nie zwei Zeilen an, und nur wer
-- die Zeile wirklich angelegt hat, schreibt danach gut (src/trophaeenweg.ts).
--
-- Warum nicht chest_claim: Dort ist `grade` Pflicht, ein Checkpoint hat aber
-- keine Truhe. Und eine Station gibt Truhe und Gegenstand in einem Zug; beides
-- gehoert an dieselbe Zeile, damit kein halb abgeholter Stand entstehen kann,
-- den keine Tabelle erklaert.
--
-- `grade` nutzt die vorhandene Aufzaehlung chest_grade (0012) und ist bei
-- Checkpoints leer. `coins` ist, was gutgeschrieben wurde - bei einer Truhe
-- der Wurf, der genau einmal faellt und deshalb gespeichert werden muss.
--
-- Ein einziger Befehl, der Fremdschluessel steht mit in der Tabelle - so
-- braucht die Datei keine Trennzeile (CLAUDE.md, Regel 3).

CREATE TABLE IF NOT EXISTS "weg_abholung" (
  "account_id" uuid NOT NULL,
  "schwelle" integer NOT NULL,
  "grade" "chest_grade",
  "coins" integer NOT NULL,
  "item_id" text,
  "abgeholt_am" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "weg_abholung_account_id_account_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "weg_abholung_account_id_schwelle_pk" PRIMARY KEY ("account_id", "schwelle")
);
