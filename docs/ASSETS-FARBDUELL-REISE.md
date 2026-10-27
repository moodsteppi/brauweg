# Farbduell und Trophäenreise

Stand: 27.10.2026. Kein TestFlight-Upload; ausdrücklich erst nach Freigabe des Nutzers.

## Bildauftrag Farbduell

Aktuelle Fassung: zwei freundliche Pinguine beim Farbduell in einer warm
beleuchteten Taverne, links mit blauem Ritterhelm, rechts mit roter Kappe
und Schal. Die Figuren und das Licht folgen dem vorhandenen Doppelkopf-Banner.
Das bunte Spielfeld ist ein kleinerer Gegenstand auf dem Tisch mit sichtbarem
Rand und Luft um das Motiv; keine extreme Nahaufnahme mehr. Die Gesichter
bleiben auch beim fast quadratischen Beschnitt der Spielauswahl erkennbar.

Keine Schrift, kein Logo, kein Wasserzeichen, kein Schachbrett als Transparenz.
Keine Karten, Würfel, Tetris-Steine, Pucks, Spielsteine oder Figuren auf dem Spielfeld.
Das Spielfeld enthält ausschließlich die flachen farbigen Felder. Vollflächig ohne äußeren App-Rahmen.
Abnahme: Pinguine und Farbgebiete klein erkennbar, passend zu den anderen Spielen.

Erzeugt mit eingebauter Bildgenerierung anhand des Doppelkopf-Banners. Original
im separaten Archiv `brauweg-art/hub/farbduell/pinguine-ohne-pucks-original.png`; die
vorherigen Fassungen bleiben dort als `pinguine-original.png` und `original.png` erhalten. Auslieferung WebP:
`hub/spielwahl-farbduell.webp` 512 × 512 und `hub/banner-farbduell.webp`
960 × 640; Profil `szene`. Keine Originalauflösung unter public.
`bannerFuer('filler')` verbindet Spieleliste, Favoriten und Spielseite mit dem neuen Bild.

## Trophäenreise

Die sechs vorhandenen gemalten Biome werden wiederverwendet, jetzt mit je
540 px Höhe statt 118 px. Eigener innerer Scrollbereich, Kartenbreite maximal
560 px, unten Heimat und oben Sternenhafen. Goldene Spur bis zur eigenen
Position, Pinguin, aktuelle Region, Fortschrittsanzeige zur nächsten Belohnung,
Rücksprung „Zu mir“. Die Wegfigur verwendet dieselbe `Pinguin`-Komponente
und `me.avatar` wie der Kleiderschrank; Hut, Brille, Kleidung, Schuhe, Handstück
und Aura werden aus der getragenen Ausstattung übernommen. Oberhalb 1.000 werden die serverseitigen Folgetruhen
als weitere Stationen dargestellt. Abholen verschiebt die Scrollposition nicht.

Schwellen, Truhen, Gegenstände, Checkpointmünzen und Abholstatus bleiben
serverseitig (`/api/weg`, `/api/weg/holen`). Ein synchroner Schutz verhindert
doppelte Abholanfragen. Es werden keine neuen Belohnungen versprochen.

Vorschau: `/?dev=hub&weg&iphone`, Farbduell `/?dev=hub&tab=spiele&spiel=filler&farbduell&iphone`.

## Tafel-Nachtrag

Der eingerichtete Tafelzugang antwortet bereits in dieser Sitzung mit 401.
Nachzutragen: Hub → Trophäenreise → serverseitiger Weg; Truhenöffnung →
Grundklang mit den beiden neuen MP3; Spielbanner → Farbduell statt Filler-Tetris.

## Fortsetzung ab 1.250 Trophäen (27.10.2026)

Neuer Bildauftrag „Sterneninseln“: schwebende Inseln, zentraler Trittsteinpfad,
Holzbrücken, warme Laternen und eine kleine Sternwarte. Gemalter Stil passend
zum Sternenhafen, Nachtblau und Gold. Keine Figuren, Truhen, Schrift, Zahlen,
Wasserzeichen oder Schachbrett-Transparenz. Zentrale Freihaltezone für
Belohnungen. Eigenständige Landschaft statt leerem Verlauf oberhalb 1.000.

Original: `brauweg-art/hub/trophaeenreise/sterneninseln-original.png`.
Auslieferung: `hub/weg-sterneninseln.webp`, 960 × 960, Profil `szene`.
Wiederholung mit fester Kachelhöhe verhindert aufgeblasene Bildgrößen bei
vielen Folgetruhen. Keine neue Belohnungs- oder Regionsschwelle.

Tutorial: Die vorhandene Parteien-Lektion erläutert nun die angesagte
Hochzeit mit beiden Kreuz-Damen und zeigt die Karten. Die Klärungsfrist
kommt aus `DEFAULT_RULESET.hochzeitClarifyTricks`. Der erste fremde
Stichgewinner innerhalb der Frist spielt mit dem Ansager Re; anderenfalls
spielt dieser allein. Der spätere Merksatz verschiebt die Hochzeit nicht
mehr auf den echten Tisch.

TAFEL: Trophäenreise → Sterneninseln für Folgetruhen; Lernpfad → Parteien
mit Erklärung der Hochzeit aus den Standardregeln. Tafelzugang weiter 401.

## Belohnung bei 1.250 Trophäen

Die erste Folgestufe gibt nun eine Diamanttruhe plus 100 feste Münzen.
Beides kommt aus dem Serverkatalog; die Anzeige übernimmt den Grad und
zeigt den Bonus ausdrücklich als „Münzen extra“. Die Öffnung zeigt den
Gesamtbetrag aus gewürfeltem Truheninhalt und festem Bonus.

Die vorhandene Zeile in `weg_abholung` speichert den Gesamtbetrag. Der
Eindeutigkeitsschutz gilt für das ganze Paket, auch bei gleichzeitigen
Anfragen. Keine Migration, kein Rücksetzen bereits abgeholter Stufen und
keine nachträgliche zweite Auszahlung. Ab 1.500 bleiben die Silbertruhen.

TAFEL: Trophäenweg → 1.250 Diamanttruhe mit 100 Münzen Bonus; Auszahlen →
Truheninhalt plus feste Münzen gemeinsam und einmalig gespeichert.
