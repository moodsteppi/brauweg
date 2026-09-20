-- Gastkonten: mitspielen, ohne sich anzumelden.
--
-- Ein Gast bekommt ein ganz normales Konto — nur ohne E-Mail und ohne
-- Passwort. Beide Spalten sind dafuer schon nullbar (sie muessen es sein,
-- weil eine Kontoloeschung anonymisiert statt zu loeschen), es fehlt also nur
-- das Merkmal selbst.
--
-- Ein ZEITSTEMPEL und kein Boolean: "seit wann" kostet hier nichts extra und
-- beantwortet spaeter zwei Fragen, die ein Ja/Nein nicht beantworten kann —
-- wie alt ein Gastkonto ist (fuer ein moegliches Aufraeumen) und wann jemand
-- zum ersten Mal hereingekommen ist. Abgefragt wird es als
-- `gast_seit is not null`, also genauso einfach wie ein Boolean.
--
-- NULL heisst "kein Gast". Deshalb kein Vorgabewert: Jedes Konto von vor
-- diesem Deploy ist ein richtiges Konto, und genau das sagt die Spalte dann
-- auch.
--
-- Wer sein Gastkonto spaeter sichert (Mail und Passwort nachtraegt), behaelt
-- die Zeile samt allem, was er gespielt hat — `gast_seit` wird dabei wieder
-- auf NULL gesetzt. Das ist Absicht: Ein gesichertes Konto ist kein Gast
-- mehr, und die Rangliste soll es ab dann zaehlen.

ALTER TABLE "account"
  ADD COLUMN IF NOT EXISTS "gast_seit" timestamp with time zone;
