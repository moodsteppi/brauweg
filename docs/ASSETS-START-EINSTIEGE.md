# Startseite: Spielen und Tagesaufgaben

Auftrag: großer Trophäenpfad-Banner entfällt; der Pokal beim Guthaben öffnet den bestehenden Pfad. Abholbare Pfadbelohnungen bleiben als kleiner Zähler am Pokal sichtbar. Ein großer Spielen-Einstieg führt zur Spieleübersicht; direkt darunter ein kompakter Einstieg für Tagesaufgaben und Truhen. Laufende Partie, eigene Spiele und Lerneinstiege bleiben erreichbar.

Grafikbrief: vorhandene warme Pinguin-Spielstube, dunkles Walnussholz, Waldgrün, dezente Messingkanten. Spielen: breites Motiv mit fröhlichem Ritterpinguin, Karten, Würfeln und Schachfigur rechts; linke Hälfte ruhig und dunkel für echte Oberflächentexte. Tagesaufgaben: freigestelltes Aufgabenbrett mit Häkchen, Holzkiste und wenigen Münzen. Kein eingebrannter Text, keine Logos, kein Schachbrett als Transparenz. Eingebauter Bildgenerator, Referenz ist der vom Nutzer gelieferte Games-Screenshot.

Originale lokal unter `packages/client/art/start-einstiege`, optimierte WebP unter `packages/client/public/hub/start-einstiege`. Die Rahmen entstehen aus flexiblen CSS-Kanten mit festen Ecken und behalten ihre Stärke bei unterschiedlichen Gerätebreiten. Texte, Belohnungszähler und Buttons bleiben echte zugängliche Oberflächenelemente. Keine neuen Belohnungen, keine Server- oder Datenbankänderungen. Ausschließlich lokale Umsetzung; kein Staging- oder TestFlight-Upload.

## Überarbeitete Anordnung

Die Nutzerkorrektur ersetzt den großen Spielen-Banner durch ein Vierer-Mosaik mit zentralem rundem Play-Knopf. Tagesaufgaben, Truhen, Lernpfad und Browort liegen darum; darunter folgen laufende Partie und eigene Spiele. Social-Media-Einstiege übernehmen die auf Staging hinterlegten Profile `@broweggames`. Der Truhen-Einstieg öffnet das bestehende Heute-Blatt direkt am Truhenabschnitt; Abholen setzt die Scrollposition nicht zurück.

Zusätzliche Grafiken: `play.webp` (rundes Walnussholz-/Messingmedaillon, grünes Emaillefeld, goldenes Play-Dreieck) und `lernen.webp` (Pinguinlehrer mit Buch und Spielkarten). Beide freigestellt, ohne eingebrannte Schrift. Originale im Unterordner `wappen`, Spielszene im Unterordner `szene`. Die ursprüngliche Spielszene bleibt für den Spiele-Einstieg bei eingeschränktem Umfang verfügbar. Neue Originale bleiben bis zur Veröffentlichungsfreigabe lokal.
