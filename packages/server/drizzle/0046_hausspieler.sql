-- Hausspieler (Tom, 24.11.2026): Konten, hinter denen ein Bot sitzt.
--
-- Damit Doppelkopf nie leer aussieht, haelt der Server ein paar offene Tische
-- mit Mitspielern bereit (src/hausrunden.ts). Diese Mitspieler brauchen Namen
-- und Profilbilder wie jedes Konto - deshalb sind sie Konten, an der Partie
-- aber immer Bots (table_seat.is_bot). Die Spalte haelt sie aus Suche,
-- Ranglisten und Freundeslisten heraus. Ein Hausspieler meldet sich nie an.

ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "hausspieler" boolean DEFAULT false NOT NULL;
