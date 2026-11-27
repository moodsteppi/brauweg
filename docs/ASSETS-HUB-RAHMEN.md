# Flexible Holzrahmen für den Hub

Erzeugt mit dem integrierten Imagegen-Werkzeug. Original: `packages/client/art/hub-rahmen/holz-gold.png` (lokal, ignoriert). Auslieferung: `packages/client/public/hub/rahmen/holz-gold.webp`, ca. 94 kB, konvertiert mit dem Szene-Profil von `bildwerkzeug/wandeln.mjs`.

## Aufbau und Abnahme

Quadratische transparente Textur. Nur Holzrand, goldene Innenkante und goldene Eckbeschläge. Mitte und Außenraum durchsichtig; kein eingebrannter Text, kein Schachbrett, keine Motive. CSS `border-image` schneidet bei 13 %: vier feste Ecken, vier flexible Kanten, keine gefüllte Mitte. Ecken 19 px für Karten, 15 px für Social-Kacheln, 9 px für Navigationssymbole. Keine geräteabhängigen Bildkopien. Dekoration fängt keine Zeigerereignisse ab; Fokus und ausgewähltes Design bleiben sichtbar.

Gilt für Spielekarten, quadratische Startkacheln, Social-Links, Sammlung, Shop und breite Spielbanner. Der Trophäenpfad bleibt unverändert. Bei der Sichtprüfung kleine Mobilbreite und große Kachelbreite vergleichen; Text und Klickflächen dürfen nicht verdeckt werden.

## Erzeugungsprompt

Create one production UI frame texture, square 1024x1024, orthographic perfectly front facing. Transparent background AND transparent empty interior. A rounded square walnut wood frame with thin antique golden inner bevel, small simple gold corner caps with one rivet each. Match refined cozy fantasy tavern game interface, forest-green and gold palette, wood warm brown. Frame outer bounds exactly touch canvas bounds on middle of each edge; rounded outer corners radius 70px; total edge thickness 24px along straight edges. Corner decorations remain entirely inside 96x96px corner zones. Four straight edges perfectly uniform thickness, smoothly tiling woodgrain. No icons, no text, no scenery, no shadow outside frame, no interior fill, no checkerboard. This is a nine-slice border texture: all ornament only in four corners, central long edge regions plain wood and thin gold line. A single frame only, not a presentation sheet.
