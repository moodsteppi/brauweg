# Kartenmanufaktur: Auftragsbrett

24.10.2026 – Erweiterung auf Basis von deaf6f5. Lokal implementiert; Veröffentlichung separat.

## Spielablauf

Ab drei Pressen erscheint das Auftragsbrett. Spieleladen, Spielergilde und
(ab Standort 2) Königshof bieten kleine, mittlere und große Lieferungen.
Ein Auftrag läuft gleichzeitig, ohne Einsatz und ohne Ablaufdatum.
Jeder echte Versandverkauf nach Annahme zählt als verkaufter Kartenwert.
Taler aus Zielketten, Meisterverkäufen und Prämien zählen nicht mit.
Die normalen Verkaufserlöse bleiben erhalten; der Auftrag zahlt zusätzlich 10 %
seines geforderten Kartenwerts. Überschuss wird nicht auf Folgeaufträge gebucht.

Die Zielwerte entsprechen 2,5 / 10 / 40 Minuten normaler Produktion am Engpass
(Untergrenze 25 / 100 / 400 Taler). Meisterfähigkeiten sind dabei nicht eingerechnet.
Ohne Automatisierung muss weiter von Hand gearbeitet werden; offline gelten
weiter die bestehenden Tempo- und Zeitgrenzen. Keine garantierten Lieferzeiten.
Werte werden bei Annahme eingefroren; Upgrades beschleunigen bestehende Aufträge.

Nach 1, 3, 10, 25 und 50 abgeholten Aufträgen erscheinen Auszeichnungen.
Bei 3 / 10 / 25 / 50 gibt es einmalig 1 / 2 / 3 / 4 Siegel fürs Werkstattbuch.
Damit sind insgesamt zehn zusätzliche Siegel erreichbar, keine Hub-Münzen.
Auftrag, Fortschritt und Sammlung bleiben beim Renovieren und Ortswechsel erhalten.

## Spielstände und Veröffentlichung

Fassung 8 ergänzt `auftraege: { aktiv, erledigt }`; bestehende Fassungen werden
über die bisherigen Migrationsschritte übernommen. Es ist keine SQL-Migration nötig,
da der Stand bereits als JSON gespeichert wird. Zuerst kompatiblen Server, dann
neuen Client bzw. iOS-Build veröffentlichen. Die alten Apps senden weiter nur
Aktionen; der Server bleibt für Berechnung und Speicherung maßgeblich.

Neue Aktionen: `auftrag-annehmen` (art: laden/gilde/hof), `auftrag-abholen`.
Fortschritt wird im gemeinsamen Versandtakt gebucht, nicht im Bildschirm berechnet.
Prämie und Auszeichnung werden in derselben versionierten Speicherung gebucht.

Grafik: `packages/client/public/manufaktur/auftragsbrett.webp`, mit Imagegen erzeugt,
Blau-Gold-Pinguin-Stil; kein Text im Bild. Die zuvor bestätigte Menükarte mit
`werkstatt-hero.webp` ist ebenfalls wieder eingebunden.

## TAFEL:

Die Kartenmanufaktur hat nun ein wiederholbares Auftragsbrett ab drei Pressen.
Der gemeinsame Kern berechnet Angebote, echten Lieferfortschritt und Prämien.
Server validiert neue Aktionen und speichert Fassung 8; der Client zeigt Auswahl,
Fortschritt und dauerhafte Lieferauszeichnungen. Bestehende Wirtschaft und
Offline-Grenzen gelten weiter. Keine Veröffentlichung auf Staging oder Produktion
als Teil dieser lokalen Umsetzung.


## Zweite Ausbaurunde: Meisterschule und Chronik

Die Meisterschule ist aus dem Meister-Blatt und dem Auftragsbrett erreichbar.
Jeder abgeholte Kundenauftrag gibt einen Lehrbrief. Der freie Bestand ist
`auftraege.erledigt - zaehler.lehrbriefeVerbraucht`; auch bereits erledigte Aufträge
zählen. Ein Jungmeister wird für 3 Lehrbriefe zum Meister, ein Meister für 8
zum Obermeister. Die Fähigkeit bleibt gleich, ihre Stärke, Dauer und folgende
Pause entsprechen den bestehenden Rangtabellen. Siegel, Taler und Hub-Münzen
werden dabei nicht ausgegeben. Damit konkurriert Ausbildung nicht mit den
endlichen Siegeln für das Werkstattbuch.

Während die Fähigkeit des betroffenen Meisters wirkt, ist die Ausbildung gesperrt.
Eine laufende Pause bleibt unverändert. Der Kern sichert vor dem Rangwechsel alle
Stationsuhren und spiegelt danach die Pools zurück, damit aktive Fähigkeiten
anderer Meister weiterlaufen. Reservemeister können ebenfalls ausgebildet werden.
Identität, Zuweisung, Fähigkeit und ursprünglicher Verkaufswert bleiben erhalten.
Ausgebildete Ränge und Verbrauchszähler überstehen Renovierung und Ortswechsel.

Die neue Aktion `ausbilden` nimmt Ziel und Meister-ID an. Alle Prüfungen und
Währungsänderungen laufen serverseitig durch den gemeinsamen Kern. Keine weitere
Spielstandfassung und keine Datenbankmigration nötig; bestehende Zaehler werden
um `ausgebildet` und `lehrbriefeVerbraucht` ergänzt.

Die Werkstatt-Chronik zeigt zwölf Erinnerungen mit Fortschritt: Einstellungen,
Ausbildungen, Aufträge, Renovierungen, Buchstufen und erreichte Standorte. Sie
liest vorhandenen dauerhaften Stand, zahlt keine weiteren Belohnungen und benötigt
keinen eigenen Speicher. Einstieg aus dem Auftragsbrett.

Neue Grafik `meisterschule.webp` (Imagegen, optimiertes WebP). Die interaktive
Probe `/probe/manufaktur?fall=schule` hat ein bestehendes Team und neun freie
Lehrbriefe; Rangaufstiege und Chronik lassen sich dort ohne Anmeldung ausprobieren.

### TAFEL-Ergänzung

Gemeinsamer Kern bietet nun garantierte Meisterausbildung gegen Lehrbriefe aus
Aufträgen und eine rein abgeleitete Chronik. Server validiert `ausbilden`;
Client zeigt Vorschau und verfügbar/verbraucht, blockiert während einer aktiven
Fähigkeit und lässt bestehende Cooldowns unverändert. Keine externe Veröffentlichung.
