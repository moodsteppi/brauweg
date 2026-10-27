-- Bestleistung je Inhalt: die beste Zahl eines Kontos fuer EIN Stueck eines
-- Spiels — eine Golf-Bahn, spaeter ein Kurs oder ein Fragenpaket.
--
-- Warum eine eigene Tabelle und nicht account_game_stat: Dort haengt der
-- Primaerschluessel an (account_id, game_id), und die Zeile traegt Trophaeen.
-- Trophaeen entstehen aus der PLATZIERUNG ueber die ganze Partie und sind
-- deshalb regelunabhaengig (schema.ts, trophy_ledger). Eine Bestleistung ist
-- das Gegenteil: eine Spielzahl, die nur fuer genau diesen Inhalt etwas sagt
-- — 27 Schlaege auf Bahn "wald" sind nicht mit 27 Schlaegen auf Bahn "kueste"
-- zu vergleichen. Beides in eine Tabelle zu zwaengen hiesse, entweder den
-- Schluessel der Trophaeenrechnung aufzubrechen oder jede Bahn als eigenes
-- "Spiel" zu fuehren. Vorbild ist runner_best (0017): eine Zeile je Schluessel,
-- ueberschrieben nur von einem besseren Lauf.
--
-- `inhalt_id` ist eine freie Zeichenkette, die das Spielmodul vergibt. Der
-- Server weiss nicht, was sie bedeutet (CLAUDE.md, "Der Server kennt kein
-- einzelnes Kartenspiel") — er nimmt jede Kennung und schlaegt sie nach.
--
-- `richtung` steht AM DATENSATZ, nicht im Code: Bei Golf gewinnt die
-- kleinste Schlagzahl, beim Runner die hoechste Punktzahl. Punkte sagen
-- nichts ueber die Rangfolge (plattform-invarianten.test.ts, Falle 3), und
-- der Server darf die Antwort nicht je Spiel kennen. Also sagt das Modul sie
-- bei jeder Meldung mit, und Schreib- wie Leseweg richten sich danach.
--
-- `party_id` mit ON DELETE SET NULL: Die Bestleistung ueberlebt das Aufraeumen
-- alter Partien — der Verweis ist Herkunftsnachweis, keine Abhaengigkeit.
--
-- Zwei Befehle, dazwischen die Drizzle-Trennzeile — der PGlite-Pruefstand
-- nimmt je Abschnitt nur einen Befehl (siehe 0016 und CLAUDE.md, Regel 3).

CREATE TABLE IF NOT EXISTS "bestleistung" (
  "account_id" uuid NOT NULL,
  "game_id" text NOT NULL,
  "inhalt_id" text NOT NULL,
  "wert" integer NOT NULL,
  "richtung" text NOT NULL,
  "party_id" uuid,
  "erzielt_am" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "bestleistung_account_id_account_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "bestleistung_party_id_party_id_fk"
    FOREIGN KEY ("party_id") REFERENCES "public"."party"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "bestleistung_richtung_check" CHECK ("richtung" IN ('hoch', 'tief')),
  CONSTRAINT "bestleistung_pkey" PRIMARY KEY ("account_id", "game_id", "inhalt_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bestleistung_liste_idx" ON "bestleistung" ("game_id", "inhalt_id", "wert");
