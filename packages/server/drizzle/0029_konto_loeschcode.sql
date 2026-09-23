-- Kontoloeschung fuer Konten ohne Passwort (23.09.2026).
--
-- Apple verlangt, dass sich jedes Konto in der App loeschen laesst
-- (Richtlinie 5.1.1(v)). Die Loeschung fragte bisher das Passwort ab — ein
-- Konto, das nur ueber Google oder Apple hereinkam, hat keins und konnte
-- sich damit gar nicht loeschen. Es bekommt stattdessen einen Code per Mail;
-- der liegt wie Bestaetigungslink und Passwort-Reset gehasht in auth_token,
-- mit eigenem Zweck, damit ein Loeschcode nie ein Passwort zuruecksetzt.
ALTER TYPE "public"."auth_token_purpose" ADD VALUE IF NOT EXISTS 'account_delete';
