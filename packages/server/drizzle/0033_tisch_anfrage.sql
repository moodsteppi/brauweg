-- Beitritt mit Zusage (Emile, 13.10.2026): An einem Tisch, der nicht
-- oeffentlich ist (Clantisch, Tisch per Einladungscode), setzt sich niemand
-- mehr von selbst hin. Wer beitreten will, stellt eine Anfrage, und der
-- Gastgeber — der erste Mensch am Tisch — nimmt sie an oder lehnt sie ab.
-- Gilt fuer die Spiele mit der Kartenlobby; die Partykiste und die Spiele mit
-- eigenem Einstieg treten weiter direkt bei (tables/anfragen.ts).
--
-- Eine Zeile je offener Anfrage. Angenommen heisst: Zeile weg, Sitz besetzt;
-- abgelehnt: Zeile weg, kein Sitz. Ein Status-Feld braucht es deshalb nicht —
-- der Anfragende erkennt am Sitz, was aus seiner Anfrage wurde.
-- Beide Fremdschluessel mit CASCADE: Verfaellt der Tisch oder verschwindet
-- das Konto, ist die Anfrage gegenstandslos.
--
-- Ein Befehl, deshalb ohne Trenner.

CREATE TABLE IF NOT EXISTS "tisch_anfrage" (
  "tisch_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "erstellt" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "tisch_anfrage_tisch_id_account_id_pk" PRIMARY KEY ("tisch_id", "account_id"),
  CONSTRAINT "tisch_anfrage_tisch_id_table__id_fk"
    FOREIGN KEY ("tisch_id") REFERENCES "public"."table_"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "tisch_anfrage_account_id_account_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action
);
