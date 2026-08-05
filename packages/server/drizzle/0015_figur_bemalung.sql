-- Bemalung der 3D-Figur.
--
-- Als Text und nicht als jsonb: Der Inhalt wird nie in SQL durchsucht oder
-- gefiltert, er geht nur als Ganzes rein und raus. jsonb kaufte hier eine
-- Zerlegung beim Schreiben, die niemand nutzt.
--
-- Nullable ohne Vorgabewert: null heisst "noch nie bemalt", und das ist etwas
-- anderes als ein leerer Satz Striche. Bestehende Zeilen bleiben unberuehrt.
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "figur_bemalung" text;
