# Farbduell und Trophäenreise

Stand: 27.10.2026. Kein TestFlight-Upload; ausdrücklich erst nach Freigabe des Nutzers.

## Bildauftrag Farbduell

Quadratisches Spielicon: isometrisches, zusammenhängendes Farbfeld mit blauer
und roter Ecke, zwei kleinen Fahnen, dazwischen bunten neutralen Feldern.
Nachtblau, Gold, freundliche plastische Spielzeugoberflächen. Kein Tetris.
Keine Schrift, kein Logo, kein Wasserzeichen, kein Schachbrett als Transparenz.
Vollflächig und ohne äußeren App-Rahmen. Motiv zentral, Rand als Beschnittreserve.
Abnahme: auch klein als Duell um Farbgebiete erkennbar.

Erzeugt mit eingebauter Bildgenerierung. Original im separaten Archiv
`brauweg-art/hub/farbduell/original.png`. Auslieferung ausschließlich WebP:
`hub/spielwahl-farbduell.webp` 512 × 512 und `hub/banner-farbduell.webp`
960 × 640 (zentraler Beschnitt); Profil `szene`. Keine Originalauflösung unter public.
`bannerFuer('filler')` verbindet Spieleliste, Favoriten und Spielseite mit dem neuen Bild.

## Trophäenreise

Die sechs vorhandenen gemalten Biome werden wiederverwendet, jetzt mit je
540 px Höhe statt 118 px. Eigener innerer Scrollbereich, Kartenbreite maximal
560 px, unten Heimat und oben Sternenhafen. Goldene Spur bis zur eigenen
Position, Pinguin, aktuelle Region, Fortschrittsanzeige zur nächsten Belohnung,
Rücksprung „Zu mir“. Oberhalb 1.000 werden die serverseitigen Folgetruhen
als weitere Stationen dargestellt. Abholen verschiebt die Scrollposition nicht.

Schwellen, Truhen, Gegenstände, Checkpointmünzen und Abholstatus bleiben
serverseitig (`/api/weg`, `/api/weg/holen`). Ein synchroner Schutz verhindert
doppelte Abholanfragen. Es werden keine neuen Belohnungen versprochen.

Vorschau: `/?dev=hub&weg&iphone`, Farbduell `/?dev=hub&tab=spiele&spiel=filler&farbduell&iphone`.

## Tafel-Nachtrag

Der eingerichtete Tafelzugang antwortet bereits in dieser Sitzung mit 401.
Nachzutragen: Hub → Trophäenreise → serverseitiger Weg; Truhenöffnung →
Grundklang mit den beiden neuen MP3; Spielbanner → Farbduell statt Filler-Tetris.
