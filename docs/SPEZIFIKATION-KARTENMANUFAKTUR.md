# Kartenmanufaktur — Spezifikation

Stand 23.10.2026 (Emile, mit Claude). Ein Idle-Spiel wie *Idle Miner Tycoon*,
nur in Brauweg: Pinguine drucken Spielkarten. Allein gespielt, **nur in der
App**, eigene Währung, Meilensteine geben ein paar Münzen.

## Der Kreislauf

```
   Versandhalle:  Packtisch ──► Träger ──► Lieferwagen ──► Taler
        ▲
   Paternoster (fährt alle Etagen ab, hält an jeder Kiste)
        │
   ├── Etage 1  Presse (Skatblatt)    ──► Ablage-Kiste 1
   ├── Etage 2  Presse (Doppelkopf)   ──► Ablage-Kiste 2
   └── … bis Etage 8 (Goldblatt)
```

**Eine Werteinheit: Warenwert in Talern.** Pressen erzeugen Warenwert
(Karten × Kartenwert der Sorte), Paternoster und Versand *bewegen* ihn, erst
der Versand macht daraus Taler. Transportstationen haben deshalb Ladung und
Kapazität, nie „Taler je Sekunde".

Alles läuft in **Zyklen** (seit dem 23.10.2026 abends, vorher flossen Raten):

- **Presse:** Pinguin geht zur Presse, presst, trägt den Stapel zur Kiste,
  legt ab. Der Warenwert landet genau beim Ablegen in der Kiste.
- **Paternoster:** fährt bis zur tiefsten Etage, hält an jeder Kiste und lädt
  bis zur Kapazität, fährt hinauf, entlädt auf den Packtisch. Ohne Ware fährt
  er nicht.
- **Versand:** Der Träger nimmt vom Packtisch, was in den Wagen passt, der
  Wagen fährt ab, unterwegs wird verkauft, er kommt leer zurück. Ohne Ware
  fährt er nicht.

**Einkommen je Sekunde = min(Summe der Pressen, Paternoster, Versand).**
Das langsamste Glied ist der Engpass und wird an der Station gezeigt.

## Stationen arbeiten lassen

- **Ohne Meister** läuft eine Station genau **einen Zyklus je Tipp**, danach
  schläft der Pinguin.
- Ein **Meister** lässt sie ohne Pause arbeiten. Seit dem 24.10.2026 mit Tiefe
  (`packages/manufaktur-kern/src/meister.ts`):

| Rang | Wirkung | danach Pause | Ring |
| --- | --- | --- | --- |
| Jungmeister | 1 min | 5 min | Bronze |
| Meister | 3 min | 15 min | Silber |
| Obermeister | 10 min | 50 min | Gold |

  Fähigkeiten (Jung / Meister / Ober): Presse Tempo ×3/5/7 oder Rabatt
  40/70/80 %; Paternoster Bandtempo ×2/4/6, Ladung ×3/5/7 oder Rabatt;
  Versand Lauftempo ×3/5/7, Wagenladung ×3/5/8 oder Rabatt. Der Rabatt gilt
  nur für den Ausbau der eigenen Station und nur, solange er wirkt; Max rechnet
  mit ihm.

- **Einstellen:** Die ersten drei je Station sind fest (Jung/Tempo,
  Jung/Rabatt, Meister/Ladung — an der Presse Meister/Tempo), danach Zufall
  70/25/5 % mit dem Zustand `zufall` im Stand (den Anfang setzt der Server;
  Neuladen zieht denselben). Jede Einstellung kostet ×1,6 mehr.
- **Pool:** höchstens 5 je Station, genau einer zugewiesen. Tauschen kostet
  nichts; eine laufende Fähigkeit endet, jeder Meister behält seine eigene
  Pause. Verkaufen bringt die Hälfte zurück. Die Pools bleiben über den Umzug.
- „**Alle aktivieren**" löst alle bereiten Fähigkeiten aus und zeigt, wie
  viele bereit sind; sonst den kürzesten Countdown als Ring.

Simulation (24.10.2026): erster Obermeister nach 21 min, erster
Rabatt-Kauf nach 5:33, erster Umzug 77 min. Belastungsprobe „jede zufällige
Einstellung ein Obermeister" (`sim -- --ober`): erster Umzug nur 3,5 min
früher — die langen Pausen und der Engpass der Kette deckeln die starken
Kombinationen. Gelegenheitsspieler: erster Umzug nach 1,9 Tagen (vorher 1,5;
der Sim-Spieler gibt jetzt auch Geld für weitere Meister aus).

## Werkstattbuch (dauerhaft)

Eigene Währung **Siegel** — für jede Renovierung (3 / 5 / 8 / 12 je Stufe)
und jeden Umzug (5), **nie Hub-Münzen**. Das Buch wird nie zurückgesetzt
(`packages/manufaktur-kern/src/werkstattbuch.ts`):

| Eintrag | je Stufe | Stufen | Preise (Siegel) |
| --- | --- | --- | --- |
| Längere Nachtschicht | Offline-Deckel +1 h (1 → 4 h) | 3 | 3 / 6 / 10 |
| Guter Ruf | Kartenwert +10 % | 5 | 2 / 4 / 6 / 9 / 13 |
| Erfahrene Meister | Fähigkeitsdauer +15 % | 3 | 4 / 7 / 11 |
| Kurze Pausen | Abklingzeit −10 % | 3 | 4 / 7 / 11 |
| Feilschen | Ausbau −5 % | 3 | 3 / 6 / 10 |
| Gute Bewerber | Obermeister 5 → 8 → 12 % | 2 | 6 / 12 |
| Flinke Bautrupps | Bauzeit −25 % | 2 | 4 / 8 |
| Großes Lager | Pool +2 | 1 | 8 |

Zusammen 154 Siegel = fünf voll renovierte Orte plus vier Umzüge. Die
Nachtschicht geht bewusst von 1 h aus, nicht von 2 h (siehe Offline-Verdienst).

## Zahlen

Alle Formeln stehen in `packages/manufaktur-kern/src/formeln.ts`, die
Stellschrauben gesammelt in `STELLSCHRAUBEN`. **Server und Client rechnen mit
demselben Kern** — der Server maßgeblich (Aktionen, Münzen, Nachrechnen),
der Client in jedem Bild mit, damit jede Bewegung an einem echten Zyklus hängt.

- **Kosten:** `K(L) = K0 · g^(L−1)`, g = 1,13 für Pressen, 1,12 für
  Paternoster und Versand. Kaufmengen x1, x10, x50, Max (geometrische Summe).
- **Pressen:** Leistung wächst linear mit der Stufe, Kartenwert ×6 je Etage.
  Der Zyklus wird mit jeder Stufe etwas kürzer (bis halb so lang).
- **Meilensteine** bei Stufe 10, 25, 50, 100, 150, 200, 300, 400: je ×2. Bis
  Stufe 100 bringt jeder einen sichtbaren Arbeiter mehr (höchstens 5).
- **Transport** wächst geometrisch (×1,09 je Stufe), nicht linear: Ein linear
  wachsender Paternoster war in der ersten Simulation ab Etage 3 eine Mauer.
- **Neue Etage:** 180 Taler für Presse 2, danach rund ×12 je Etage — früh
  steiler, hinten flacher (`FREISCHALT_FORM`), sonst ist die Mitte zu leicht
  und das Ende zäh.
- **Jede weitere Manufaktur** leistet ×2 und kostet ×1,8 — der Umzug lohnt
  sich, ist aber keine Abkürzung.
- Höchststufe je Station: 400.

Angezeigt werden ganze Zahlen: `1.240`, `12 Tsd.`, `3,4 Mio.`, `34 Mio.`,
`Mrd.`, `Bio.`, danach `aa`, `ab` … (`packages/client/src/manufaktur/zahlen.ts`).

## Die Simulation

`npm run sim --workspace @brauweg/manufaktur-kern` spielt drei Stunden mit
einem vernünftigen Spieler (tippt dreimal je Sekunde, solange Meister fehlen,
kauft den besten Ertrag je Taler, zieht um, sobald er kann). `-- --suche`
fährt eine Rastersuche über die wichtigsten Stellschrauben.

Stand 23.10.2026:

| Ereignis | Ziel | erreicht |
| --- | --- | --- |
| erste Karte verkauft | < 15 s | 0:10 |
| erstes Upgrade | < 20 s | 0:10 |
| erster Meister | 1–2 min | 0:57 (3 s zu früh) |
| Presse 2 | 2–3 min | 3:29 (30 s zu spät) |
| Presse 3 | 6–8 min | 7:12 |
| Presse 5 | 25–35 min | 27:21 |
| alle 8 Pressen und erster Umzug | 60–90 min | 77:33 |
| längste Strecke ohne Kauf | < 3 min | 1,1 min |

Die beiden Abweichungen kommen daher, dass der Sim-Spieler vor Presse 2 alle
drei Meister kauft. Die Manufakturen 2–4 dauern 64, 57 und 51 min.

## Offline-Verdienst

Ohne Meister schlafen die Pinguine nach ihrem Zyklus ein — deshalb zählt
offline von selbst nur die **Meister-Kette**, ohne Versand-Meister gibt es
nichts. Offline läuft alles **zum halben Tempo und höchstens eine Stunde**
(`OFFLINE_TEMPO`, `OFFLINE_MS`); als weg gilt, wer länger als eine Minute
nicht gefragt hat. Der Server rechnet beim nächsten Öffnen mit derselben
Simulation nach und meldet „Willkommen zurück". Liegt das Produzierte weit
über dem Verkauften, erklärt das Blatt den Stau und führt zu den Meistern.

Simulation Gelegenheitsspieler (4 × 3 min am Tag), Stand 23.10.2026:
Presse 5 nach 0,9 Tagen, erster Umzug nach 1,5 Tagen. Vor der Halbierung
waren es 0,8 und 1,3 Tage — der Hebel für ein längeres Spiel ist nicht der
Offline-Deckel, sondern der Preis der späteren Manufakturen.

## Renovieren, Umzug und Orte (seit 24.10.2026)

`packages/manufaktur-kern/src/renovieren.ts`. Mit **allen acht Pressen**
kann man den Ort **renovieren**: Stufen, Etagen und Taler beginnen neu,
Meister-Pools, Werkstattbuch, Siegel und die Sterne bleiben. Jede Stufe
(1–4) gibt dem Ort dauerhaft **×4 / ×10 / ×25 / ×60** (Gesamtwert, für die
ganze Kette) und **3 / 5 / 8 / 12 Siegel**, keine Hub-Münzen. Preis: 0,5 /
15 / 300 / 6000 × die achte Presse dieses Orts.

- **Umziehen** in einen neuen Ort geht erst nach Stufe 1 (und mit acht
  Pressen): doppelte Leistung, Preise ×2,6, 300 Münzen fürs Hub, 5 Siegel,
  der Kartenrücken des alten Orts.
- **Wechseln**: An jeden schon erreichten Ort kann man zurück, um ihn
  weiter zu renovieren — es läuft immer nur einer, die Halle beginnt dort
  neu, seine Sterne gelten. Keine Münzen, keine Siegel.
- **Im Kartenpalast** geht es nach Stufe 4 als **Jubiläum** weiter: ×1,5 je
  Stufe, Preis ×3 je Stufe, 100 Münzen für die ersten zehn. Den Rücken des
  Palasts gibt es für die erste Renovierung dort.
- Sichtbar: Messingschild mit 0–4 Sternen oben in der Halle, Girlande ab
  Stufe 2, Lampen ab Stufe 3; beim Renovieren Konfetti und alle Pinguine
  jubeln. Alte Gildensiegel (Fassung 5) zählen als Renovierungsstufen des
  Palasts.

Simulation, 24.10.2026 (`npm run sim --workspace @brauweg/manufaktur-kern`):

| | aktiver Spieler | Gelegenheit (4 × 3 min/Tag) |
| --- | --- | --- |
| erste Renovierung | 1,3 h | — |
| erster Umzug | 1,5 h | 3,3 Tage |
| Manufaktur 3 / 4 / 5 | 3,4 / 5,8 / 9,1 h | Palast nach 12,9 Tagen |
| alles renoviert | 28,9 h | 16,5 Tage |
| Siegel | 5 je Stunde | 1,9 je Tag |

Vorschlag neue Zielzeiten (die alten „erster Umzug 60–90 min" passen nicht
mehr, weil davor renoviert wird): erste Renovierung 60–90 min, erster Umzug
75–100 min. Die längste Strecke ohne Kauf bleibt bis „alles renoviert" unter
3 min; danach, im endlosen Jubiläum, wächst sie auf rund 8 min — gewollt
weich, kein Ende.

## Baustellen vor Etage 5 und 8 (seit 24.10.2026)

`packages/manufaktur-kern/src/baustelle.ts`. Vor Etage 5 und 8 liegt Schutt:
erst Bauarbeiten (¼ des Etagenpreises), dann **10 min bzw. 30 min** warten —
auch offline. Kein Sofort-Fertigstellen; kürzer nur mit „Flinke Bautrupps"
(−25 % je Stufe). Beginnen darf man **zwei Etagen vorher**: Ab der Etage
davor zu bauen, liess den aktiven Spieler vor Etage 8 eine halbe Stunde
warten (erster Umzug 119 statt 99 min). Geräumt wird **einmal je Ort** —
Renovieren setzt die Etagen zurück, aber nicht den Schutt. Sichtbar: Schutt
mit Gerüst, Countdown-Schild, zwei Bauarbeiter mit Helm; fertig bricht die
Wand mit Staub und Brocken weg.

Simulation: aktiv Presse 5 nach 35:41 (0,7 min über dem Fenster), erster
Umzug 99:43; Gelegenheitsspieler kaum betroffen (Presse 5 nach 1,5 statt 1,3
Tagen) — die Wartezeit fällt in die Offline-Phasen.

**Münzen fürs Hub (Meilensteine, eigene Währung bleibt getrennt):**

| Meilenstein | Münzen |
| --- | --- |
| erste Million Taler (je Manufaktur) | 50 |
| neue Manufaktur eröffnet | 300 |
| Jubiläum (die ersten zehn) | 100 |

Weitere Münzen gibt es nicht — wer wartet, erzeugt Taler, keine Münzen
(Wirtschaftsmodell, CLAUDE.md: „Edelsteine kaufen alles, Münzen nicht").

## Server und Bildschirm

- Tabelle `manufaktur` (eine Zeile je Konto, Stand als JSON mit `fassung`,
  Zeitpunkt des letzten Nachrechnens). Migration 0037. Ältere Fassungen
  übernimmt `migriere` beim Lesen — Spielstände werden nie verworfen.
- `GET /api/manufaktur` rechnet bis jetzt nach und liefert `{ stand, zeit,
  offline, muenzen }` — den ganzen Stand, nicht abgeleitete Raten.
- `POST /api/manufaktur/aktion` mit `arbeiten` (Tipp), `ausbauen` (mit
  `menge`), `meister`, `faehigkeit`, `boost`, `freischalten`, `umziehen`. Der
  Server rechnet erst bis jetzt nach, dann wendet er die Aktion an.
- Der Bildschirm (`client/src/manufaktur/steuerung.ts`) rechnet denselben
  Kern bis „jetzt" weiter, wendet eine Aktion sofort an (Vorhersage), schickt
  sie der Reihe nach und gleicht jede Antwort ab. Nachfragen alle 30 s und
  beim Zurückkommen in die App.
- Gerechnet wird in festen Takten von 50 ms. Gleicher Stand plus gleiche Zeit
  ergibt auf Server und Client dasselbe, egal in wie vielen Schritten.

## Bilder

Erst gezeichnet (Formen und Farben), dann gemalt: Die Bestellung für
ChatGPT steht in `docs/ASSETS-KARTENMANUFAKTUR.md`.
