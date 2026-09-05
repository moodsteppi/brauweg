# Auto-Battler mit Merge-Mechanik — Konzept für ein neuntes Spiel

Vorlage ist ein ausführlicher Entwurf von Robin (04.09.2026), inspiriert vom
Genre „Auto Chess / Merge Tactics". Eigenständiges Konzept mit eigenen Namen
und Grafiken — **keine** Assets, Figuren oder Markennamen von Supercell oder
aus Clash Royale.

---

## Zuerst: was aus der Vorlage NICHT gilt

Der Entwurf empfahl einen eigenen Technik-Stapel — React, PixiJS, Colyseus,
Socket.io, ein eigenes Monorepo mit `/apps/client` und `/apps/server`. **Davon
gilt hier nichts.** Brauweg ist bereits eine Plattform mit acht Spielen, einem
Server, einer Lobby und einem Client. Ein neues Spiel ist hier ein **Paket**,
kein Projekt.

Wer den Entwurf liest, überspringt seine Abschnitte 3 (Tech-Stack) und 4
(Projektstruktur) vollständig. Alles andere — Mechanik, Datenmodelle,
Balancing, Bildschirme, Phasen — ist die Vorgabe.

Was stattdessen gilt, steht in `packages/game-api/src/index.ts`:

1. Ein Spielmodul ist eine **reine Logikbibliothek**. Kein Netzwerk, keine
   Datenbank, keine Uhr, kein Zufall außer dem übergebenen Seed. Gleicher
   Zustand plus gleiche Aktion ergibt immer dasselbe Ergebnis.
2. Sichtbarkeit entsteht **ausschließlich in `viewFor`**. Der Client bekommt
   nie den vollen Zustand und blendet nichts selbst aus.
3. Trophäen sind **nicht** Teil des Moduls. Es liefert Platzierungen, die
   Plattform rechnet die Wertung — deshalb gilt dieselbe Rangliste über alle
   Spiele.
4. Der Regelsatz enthält **niemals** Einsatz, Topf oder Preise.

Der erste Grundsatz trifft sich glücklich mit der Vorlage: Sie verlangt
ohnehin eine deterministische Kampfsimulation („gleicher Seed = gleiches
Ergebnis"), damit der Client nur abspielt. Genau so ist die Plattform gebaut.

---

## Das Spiel

Rundenbasiert, acht Spieler in einer Lobby. Die Kämpfe laufen **automatisch**
ab; entschieden wird zwischen den Runden.

### Spielfeld

Hexagonales Raster, 4 Reihen zu 5 Spalten je Seite, versetzt (bis zum
06.09.2026 waren es 2). Die Kampfarena ist deshalb 5 × 10: beide Hälften und
zwei leere Reihen dazwischen. Eigene Hälfte zum
Platzieren, das gegnerische Brett wird für die Vorschau gespiegelt. Unterhalb
eine Reservebank mit 5–9 Plätzen.

### Einheiten und Verschmelzen

Einheiten haben **Stufe 1 bis 3** (Sterne). Drei gleiche Einheiten derselben
Stufe verschmelzen automatisch zur nächsten. Jede Einheit trägt: Typ
(Wache, Schütze, Magier, Meuchler, Beistand), Kosten 1–5 Gold, Grundwerte
(Leben, Angriff, Angriffstempo, Reichweite, Rüstung) und eine Fähigkeit, die
sich über Mana auflädt.

Zum Start reichen 15 Einheiten über drei Kostenstufen; für eine
Veröffentlichung sind 30–40 über fünf Stufen gedacht.

### Synergien

Jede Einheit trägt ein bis zwei Klassen-Marken (etwa Krieger, Elementar,
Meuchler, Wächter, Naturwesen). Je mehr Einheiten einer Marke gleichzeitig auf
dem Feld stehen, desto stärker der Bonus — Schwellen bei 2, 3 und 5 (das
Konzept nannte 2/4/6; warum daraus 2/3/5 wurde, steht unter „Gemessen:
Ausgewogenheit“, sechste Messung). Die
aktiven Boni gehören **sichtbar** in die Oberfläche.

### Wirtschaft

Gold je Runde: Grundeinkommen, Zins (1 Gold je 10 auf der Hand, höchstens 5),
Bonus bei Sieges- oder Niederlagenserie. Der Laden zeigt fünf zufällige
Einheiten; die Wahrscheinlichkeit teurer Einheiten steigt mit dem Spielerlevel.
Neu würfeln ist seit dem 05.09.2026 **kostenlos** (Robin: „wir wollen nicht
mehr, dass man fürs Rollen Geld ausgeben soll"), und **ein Kauf zieht den
ganzen Laden neu** — nicht nur den gekauften Platz (Robin: „Nicht nur der
gekaufte, dein ganzer Shop aktualisiert sich wenn du etwas kaufst, du musst
dich also immer entscheiden. Es darf dann auch weniger Optionen geben."). Zwei
Einheiten aus demselben Laden zu holen geht damit nicht mehr: Wer kauft, gibt
die übrigen Angebote auf. Der Laden ist danach wieder voll, solange der Vorrat
reicht — reicht er nicht, bleibt er kleiner. Gold gibt man nur noch für
Einheiten und Aufstiege aus; was das Nachziehen begrenzt, ist allein der
Vorrat. Das Feld `neuwuerfelnKosten` steht weiterhin im Regelsatz, damit ein
selbstgebauter Tisch den Preis wieder setzen kann. Level steigern kostet Gold
und bringt Feldplätze.

### Rundenablauf

1. **Vorbereitung** (ca. 30 s): kaufen, setzen, verschmelzen. Sie endet,
   sobald der letzte Sitz „Bereit" tippt — spätestens aber nach
   `vorbereitungMs` (75 s, seit dem 06.09.2026); danach gelten offene Sitze
   als bereit. Gemessen dauert sie im Median 15,5 s, siehe
   `docs/TAFELRUNDE-SPIELZEIT.md`.
2. **Kampf** (ca. 15–20 s): läuft automatisch, wird nur zugesehen.
   Gemessen 17,3 s — erreicht wird das über den Zeitraffer, siehe unten.
3. **Ergebnis**: Schaden am Verlierer nach verbliebenen Gegnereinheiten.
4. Bei 0 Leben scheidet ein Spieler aus. Der Letzte gewinnt.

Dazwischen alle paar Runden neutrale Monsterrunden für Bonusgold.

### Balancing — Startwerte, ausdrücklich zum Nachjustieren

| Kosten | Typen | Leben (⭐1) | Angriff (⭐1) | Kopien im Vorrat |
|---|---|---|---|---|
| 1 Gold | 8 | 550 | 40 | 30 |
| 2 Gold | 8 | 700 | 55 | 25 |
| 3 Gold | 6 | 900 | 70 | 18 |
| 4 Gold | 5 | 1100 | 90 | 12 |
| 5 Gold | 3 | 1400 | 120 | 8 |

Verschmelzen skaliert **nicht linear**: Stufe 2 etwa 1,8-fach, Stufe 3 etwa
3,2-fach — sonst lohnt es sich nicht.

Diese Startwerte sind inzwischen **gemessen** worden; geändert wurde an ihnen
nichts. Die Zahlen und die Befunde stehen unten unter „Gemessen:
Ausgewogenheit".

### Bildschirme

Spielfeld mittig mit Ziehen und Ablegen, Bank darunter, Ladenleiste unten mit
Neu-Würfeln und Level-Auf. Kopfzeile mit eigenem Leben, Gold, Runde, Uhr und
einer Übersicht der sieben Gegner. Seitlich die Synergien mit Fortschritt.

**Der Auftritt folgt der bestehenden App.** Startbildschirm, Spielauswahl,
Farben, Schriften und Abstände wie bei den acht vorhandenen Spielen — das neue
Spiel soll sich nicht wie ein Fremdkörper anfühlen. Vorlage sind die
vorhandenen Bildschirme unter `packages/client/src/screens/`.

---

## Zuschnitt für den ersten Schritt

Die Vorlage nennt fünf Phasen. Gebaut wird **zuerst Phase 1**, und zwar
vollständig lauffähig:

- Hex-Brett mit Platzieren per Ziehen und Ablegen
- Laden mit fünf zufälligen Einheiten aus mindestens 15, drei Kostenstufen
- Verschmelzen (drei gleiche → nächste Stufe)
- Gold mit Kaufen, Neu-Würfeln, Level-Auf
- Reservebank

Noch **nicht** in Phase 1: Kampfsimulation, Synergie-Boni, Mehrspieler.
Die Kampfphasen 2 bis 5 folgen als eigene Aufträge.

Auch in Phase 1 gilt der Determinismus: Der Ladeninhalt kommt aus dem Seed,
nicht aus `Math.random()`. Sonst ist die Simulation später nicht nachbaubar
und keine Probe reproduzierbar.

---

## Woran sich der Bau hält

- **Neues Paket** `packages/game-<name>`, aufgebaut wie die vorhandenen:
  `src/index.ts` (Modul), `adapter.ts`, `partie.ts`, `regeln.ts`, `sicht.ts`,
  `bot.ts`, dazu Proben unter `test/`.
- **Client**: ein Bildschirm unter `packages/client/src/screens/`, eingetragen
  in `App.tsx`, `GameSelect.tsx`, `i18n.ts` und `protocol.ts` — genau wie
  `Filler.tsx` es vormacht.
- **Alles auf Deutsch**: Bezeichner, Kommentare, Commit-Nachrichten,
  Oberflächentexte (CLAUDE.md, Regel 2).
- **Gegen `staging`**, nie direkt nach `main` (Regel 1).
- Kommentare erklären das **Warum**, nicht das Was.

---

## Gemessen: Ausgewogenheit (Stand 05.09.2026, siebte Messung — der gültige Stand)

**Warum es eine siebte gibt.** Die sechste Messung hinterließ zwei Zeilen, die
nicht in Ordnung waren. Sie sind unabhängig voneinander gefunden und am selben
Tag behoben worden:

* **Elementar stand bei ×0,25** — nicht knapp neben der Schranke (×0,5 bis ×2),
  sondern um das Doppelte darunter. Wer auf Elementar spielte, verlor.
* **Untot trat 35-mal an** und war damit gar nicht messbar; die Zeile stand
  seit drei Messungen als „zu dünn" in der Tabelle.

**Es sind zwei verschiedene Krankheiten mit derselben Wirkung**, und deshalb
stehen sie hier nebeneinander und nicht übereinander:

| | Elementar | Untot |
|---|---|---|
| Was fehlte | eine **Vorderreihe** — alle fünf Träger waren Fernkämpfer | ein **dritter Träger** — die Marke war nur über zwei Kopien derselben Einheit zu haben |
| Was man sah | 757 Antritte bei ×0,25: die Marke wurde gespielt und verlor | 35 Antritte: die Marke kam gar nicht erst zustande |
| Was nicht half | der Bonus (auf null gesetzt: 6,1 % statt 6,0 %) | der Bonus (er misst dann die Einheit, nicht die Marke) |
| Der Eingriff | das **Irrlicht** wird Wache mit Reichweite 1 | der **Schildknappe** trägt Untot mit |

Beide hatten dieselbe Vorgeschichte: Sie waren älter als ihre Sichtbarkeit.
Vorher hatte keine der beiden Marken genug Antritte, um gezählt zu werden.

### Elementar: erst die Ursache, dann die Zahlen

Drei Verdächtige, einzeln gemessen, **bevor** irgendetwas geändert wurde:

| Verdacht | Probe | Ergebnis |
|---|---|---|
| Der Bonus ist zu klein | Elementar-Bonus auf **null** gesetzt | Siegquote **6,1 %** statt 6,0 % — der Bonus bewegt nur, wie oft der Bot die Marke wählt, nicht ob sie trägt |
| Die Träger sind zu schwach | alle vier auf die **Mitte ihrer Kostenstufe** gehoben | ×0,54 bis ×0,60 — besser, aber weiter draußen |
| Die Träger passen nicht zusammen | **ein** zäher Träger für die Vorderreihe, **kein Wert geändert** | ×0,78 |

**Die dritte war es.** Alle fünf Elementar-Träger waren Fernkämpfer mit
Reichweite 3 oder 4 — kein einziger stand vorn. Ein Brett, das auf Elementar
setzte, hatte niemanden, der die Linie hält; die Magier wurden erreicht und
niedergemacht, bevor ihr Angriffsbonus etwas eintrug. Der Vergleich über alle
Marken ist fast monoton in dieser einen Zahl:

| Marke | Träger vorn (Reichweite 1) | zum Schnitt (sechste Messung) |
|---|---|---|
| Wächter | 4 von 6 | ×1,23 |
| Krieger | 2 von 5 | ×1,40 |
| Meuchler | 3 von 4 | ×1,09 |
| Naturwesen | 2 von 5 | ×1,04 |
| **Elementar** | **0 von 5** | **×0,25** |

Ein zweiter Befund fiel dabei ab und erklärt, warum die Träger auch einzeln zu
schwach waren: **Der Magier zahlte sein niedriges Tempo nie ein.** Ein Magier
bekommt laut Konzept mehr Angriff und weniger Leben als seine Stufe — er hatte
zusätzlich das niedrigste Tempo (0,6) und die niedrigste Rüstung (10) des
Katalogs. Aus 50 Angriff bei Tempo 0,6 werden 30 Schaden je Sekunde, weniger
als beim Astschützen mit 45 bei Tempo 0,8. Der Angriffsvorteil stand nur auf
dem Papier. Alle fünf Magier lagen deshalb 22 bis 34 % unter der Mitte ihrer
Kostenstufe, und Elementar ist die Marke der Magier.

### Untot: die Marke war nur über Kopien zu haben

Die Marke trugen **Knochenspäher** (2 Gold) und **Grabfürstin** (3 Gold). Die
Grabfürstin stand über 5.000 Partien zu viert aber nur 19-mal auf einem
Schlussbrett — „Untot zu zweit" hieß damit praktisch immer „zwei
Knochenspäher". Eine Marke, die nur über Kopien einer einzigen Einheit zu haben
ist, misst nicht sich selbst, sondern diese Einheit; genau das war schon bei
Drache der Befund, und dort half auch nur der zweite Träger und nicht der Bonus.

**Sechs Kandidaten für den dritten Träger wurden über je 1.500 Partien
gegengemessen**, bevor einer genommen wurde:

| Kandidat | Antritte der Marke | zum Schnitt |
|---|---|---|
| **Schildknappe** (1 Gold, Wache) | **1.801** | **×1,20** |
| Gassendieb (1 Gold, Meuchler) | 2.726 | ×1,36 |
| Steinschleuderer (1 Gold, Schütze) | 660 | ×1,57 |
| Nachtpfeil (2 Gold, Schütze) | 103 | zu dünn |
| Moosheiler (1 Gold, Beistand) | 48 | zu dünn |
| Runenpriester (2 Gold, Beistand) | 22 | zu dünn |

Der Knappe bringt als einziger beides mit: Er steht oft genug auf einem Brett,
dass die Marke überhaupt zustande kommt, und er zieht sie nicht aus der Mitte.
Dazu passt die Rolle — Knochenspäher und Grabfürstin teilen aus, keiner von
beiden hält etwas aus. „Zäh und unerbittlich" (der Untot-Bonus auf Leben und
Angriff) bekommt mit einer Wache zum ersten Mal eine Front. Das ist derselbe
Gedanke wie beim Irrlicht, nur aus dem anderen Grund: Elementar brauchte eine
Vorderreihe, damit die Marke trägt; Untot brauchte sie, damit es die Marke
überhaupt gibt.

**Die Figur zeigt weiter den lebenden Knappen im Kettenhemd.** Der Name trägt
es notdürftig — ein Knappe, der seinen Posten auch dann nicht verlassen hat,
als er gefallen war —, improvisiert wurde nichts: Grafik wird bestellt. Es
liegt als Karte auf dem Board.

### Was geändert wurde

Nur der Katalog, in beiden Fällen. **Nichts** an Startleben, Zeitraffer,
Schwellen, Synergieboni oder am Bot.

Für Elementar — die Werte sind am selben Tag nach eigener Messung
festgelegt worden:

| Einheit | vorher | jetzt |
|---|---|---|
| Irrlicht | Magier, Reichweite 3, 430 / 52 / 0,6 / R10, Elementar + Naturwesen | **Wache, Reichweite 1, 560 / 34 / 0,7 / R35, nur Elementar** |
| Funkenlehrling | 450 / 50 / 0,6 / R10 | **470 / 56 / 0,65 / R15** |
| Frostweberin | 580 / 70 / 0,6 / R10 | **600 / 80 / 0,65 / R20** |
| Sturmrufer | 760 / 92 / 0,6 / R15 | **800 / 104 / 0,65 / R20** |

**Warum ausgerechnet das Irrlicht die Vorderreihe wird:** Es ist der billigste
Elementar-Träger, und billig muss die Vorderreihe sein — sonst hält sie erst ab
Level 4. Und es ist die einzige Figur der Reihe, die kein Werkzeug in der Hand
hält (`public/tafelrunde/irrlicht.webp` ist eine Kugel), also die einzige, die
vorn nicht falsch aussieht. Ein **neuer** Träger kam nicht in Frage: Jede
Einheitenkennung braucht eine ausgelieferte `.webp`, und Grafik wird bestellt,
nicht erfunden.

Die Frostweberin bleibt Magier — eine Marke aus lauter Wachen wäre derselbe
Fehler mit umgekehrtem Vorzeichen.

Für Untot:

| Einheit | vorher | jetzt |
|---|---|---|
| Schildknappe | Marken `waechter`, Rüstung 45 | **Marken `waechter` + `untot`, Rüstung 42** |

**Die drei Punkte Rüstung gehören zur selben Änderung.** Mit der zweiten Marke
wird der Knappe öfter gekauft und lebt länger, und beides verlängert die
Kämpfe: Auf dem Stand vor der Elementar-Arbeit stiegen die an der Höchstdauer
abgeschnittenen Kämpfe allein durch die Marke von 9,5 auf 12,9 % und die
Spielzeit von 7:24 auf 7:43 — die Probe in `test/spielzeit.test.ts` fängt genau
das ab (Schranke 10 %), und sie hat es getan. Der Effekt ist nach dem
Zusammenführen nicht kleiner geworden, sondern größer: Setzt man den Knappen
heute wieder auf 45, stehen 10,6 % und 7:32 statt 5,6 % und 6:50.

Am Untot-Bonus zu drehen half dagegen kaum — rein auf Angriff gelegt
(15/25/40) blieb er bei 10,6 % und hätte der Marke ihren eigenen Charakter
genommen, sie wäre ein zweites Elementar geworden. Rüstung wirkt dagegen auf
**jeden** eingehenden Treffer und verlängert einen Kampf doppelt, weil beide
Seiten länger stehen.

### Siegquote je Marke

**Einmal gemessen, nachdem beide Änderungen zusammengeführt waren** — nicht die
Zahlen einer der beiden. 1.500 Partien zu viert, Besetzung `normal`,
`--mindest 100`, zweite Saatbasis (`ausgewogenheit-v2`) in Klammern. Schnitt
der gezählten Zeilen 27,9 % (28,4 %).

| Marke | Antritte | Quote | zum Schnitt | sechste Messung |
|---|---|---|---|---|
| Krieger | 2.623 (2.617) | 33,1 % | ×1,18 (×1,18) | **×1,40** |
| Naturwesen | 351 (339) | 30,8 % | ×1,10 (×1,17) | ×1,04 |
| Wächter | 3.320 (3.303) | 28,1 % | ×1,00 (×1,01) | ×1,23 |
| Meuchler | 1.917 (1.954) | 26,7 % | ×0,95 (×0,88) | ×1,09 |
| **Elementar** | **1.056 (1.021)** | **25,8 %** | **×0,92 (×0,87)** | **×0,25** |
| **Untot** | **982 (1.016)** | **25,7 %** | **×0,92 (×0,95)** | **zu dünn (8)** |
| Drache | 622 (609) | 25,6 % | ×0,92 (×0,94) | zu dünn (75) |

**Zum ersten Mal sind alle sieben Marken zählbar, und die Spanne ist ×0,92 bis
×1,18** (Gegenprobe ×0,87 bis ×1,18) gegen ×0,25 bis ×1,40 vorher. Damit hält
sie das engere Ziel — keine Zeile über ×1,4, keine unter ×0,7 — und nicht nur
die Schranke ×0,5 bis ×2.

Über 5.000 Partien (dieselbe Saatbasis) sieht es genauso aus: Naturwesen
×1,20, Krieger ×1,18, Wächter ×1,00, Drache ×0,93, Meuchler ×0,92, Untot
×0,90 bei 3.422 Antritten, Elementar ×0,87. Untot ist damit von 35 auf 3.422
Antritte gekommen, und seine beiden alten Träger stehen mit: Knochenspäher
535 → 1.315, Grabfürstin 19 → 40.

**Die Spielzeit ist dabei gefallen, nicht gestiegen:** 6:50 im Median (6:47 auf
der zweiten Saatbasis) gegen 7:21 vorher, einzelner Kampf 16,9 s, und **5,6 %
der Kämpfe werden von der Uhr entschieden** statt 9,4 %. Robins Vorgabe von
durchschnittlich höchstens acht Minuten hält mit Abstand.

### Was auffällt

1. **Krieger ist von selbst heruntergekommen**, von ×1,40 auf ×1,18. An ihm
   wurde nichts geändert: Er stand nur deshalb so weit oben, weil der Schnitt,
   an dem er gemessen wird, von zwei kaputten Zeilen nach unten gezogen wurde.
   Das war die Sorge bei beiden Aufträgen — sie hat sich in die Gegenrichtung
   aufgelöst.
2. **Drache ist ohne eigenen Eingriff zählbar geworden** (75 → 622 Antritte)
   und liegt bei ×0,92. Der Funkenlehrling trägt beide Marken; was Elementar
   hilft, hilft ihm mit.
3. **Naturwesen hat einen Träger abgegeben** (5 → 4, das Irrlicht) und wird
   seltener gespielt (633 → 351 Antritte). Über 1.500 Partien bleibt es
   zählbar; in der kleinen Probe in `test/ausgewogenheit.test.ts` (400 Partien)
   fällt es mit 91 Antritten unter die Schwelle. Die Probe zählt dort jetzt
   **sechs** Marken statt vier und verlangt das auch.
4. **Die höchste Schwelle steht bei Untot und Naturwesen weiter bei null.** Bei
   Untot ist die Ursache dieselbe wie vorher, nur eine Stufe später: Drei
   Träger reichen für die Schwellen 2 und 3 (13.679 bzw. 793 Antritte), fünf
   wären wieder nur über Kopien zu haben. Das ist kein neuer Befund und keine
   Frage der Schwellenhöhe.
5. **Der Beistand ist die nächste kaputte Rolle.** Im Monokultur-Turnier (drei
   Kopien einer Einheit gegen drei einer anderen, jede mit ihren eigenen
   Marken) gewinnen Moosheiler, Runenpriester und Lichtwahrerin **null** ihrer
   Kämpfe — in jeder Kostenstufe die letzte Zeile. Der Kampf kennt keine
   Rollen, nur `reichweite`; ein Beistand ist dort schlicht eine schwache
   Einheit ohne Ausgleich. Nicht angefasst, gehört zur offenen Karte über den
   Moosheiler.
6. **Die Bot-Bewertung überschätzt Schaden gegenüber Zähigkeit.** `staerke` in
   `bot.ts` multipliziert Aushalten mal Austeilen und behandelt beides als
   austauschbar. Im Monokultur-Turnier sagt diese Zahl die Rangfolge nicht
   vorher: Astschütze (×1,01 der Stufe) gewinnt 28,6 %, Irrlicht (×0,74)
   dagegen 42,9 %; Dorfwache (×1,05) gewinnt 89,3 %, Steinschleuderer (×0,98)
   nur 57,1 %. Wer stirbt, teilt nicht mehr aus — Zähigkeit ist in einem
   Gruppenkampf mehr wert als das Produkt hergibt. Das erklärt beide Eingriffe
   dieser Messung: Ein zäher Körper in der Vorderreihe (×0,78) brachte mehr,
   als die Träger auf Stärkegleichstand zu heben (×0,54) — und die Wache war
   auch für Untot der Kandidat, der die Marke in die Mitte holte.

## Überholt: die sechste Messung (Stand 05.09.2026, Schwellen 2/3/5, Elementar noch bei ×0,25)

**Warum es eine sechste gibt.** Die fünfte Messung endete mit zwei offenen
Folgerungen, und beide sind jetzt abgearbeitet — in der Reihenfolge, die dort
verlangt wurde:

1. **Der Bot spielte gar nicht auf Marken hin.** Sein einziger Markenbegriff
   war ein Aufschlag von 25 Punkten je schon vertretenem Gefährten
   (`MARKEN_GEWICHT` in `bot.ts`), gegen Einheitenstärken von 130 bis 970 —
   und linear, wo die Synergietabelle Stufen kennt. Er hat deshalb nie
   entschieden, ob eine Schwelle sich lohnt; er hat sie nur zufällig getroffen.
2. **Erst danach war entscheidbar, ob die Schwellen zu hoch stehen.** Sie
   standen zu hoch.

Dazu kam ein dritter Schritt, der aus den ersten beiden folgte und **eine
Entscheidung von Robin** war, keine Messung: Ein Bot, der auf Synergien spielt,
baut stärkere Bretter, und stärkere Bretter kämpfen länger — die Partie wuchs
von 7:27 auf 8:25 und lag damit über den acht Minuten. Zur Wahl standen, die
Marken wieder abzuschwächen oder die Partie über die Startleben zu kürzen.
Entschieden wurden **die Startleben (14 auf 12)**, weil die Marken gerade erst
repariert worden sind.

**Was geändert wurde** — Katalog, Wirtschaft, Leveln und Zeitraffer sind
unangetastet:

| Datei | Stelle | vorher | jetzt |
|---|---|---|---|
| `bot.ts` | Markengewicht beim Kauf | `MARKEN_GEWICHT = 25`, linear | **`heerStaerke`: der gerechnete Synergie-Zuwachs des ganzen Heeres** |
| `bot.ts` | welche Einheit aufgestellt wird | die stärkste Einzelne | **die, die das ganze Brett am meisten hebt** |
| `synergien.ts` | `SCHWELLEN` | 2 / 4 / 6 | **2 / 3 / 5** |
| `synergien.ts` | die Boni der beiden oberen Stufen | — | **um den Trägeranteil gekürzt (¾ bzw. ⅚)** |
| `regeln.ts` | `DEFAULT_REGELN.startLeben` | 14 | **12** |

Gemessen mit demselben Werkzeug und derselben Saatbasis wie die Messungen
davor, **5.000 Partien zu viert, Besetzung `normal`, `--mindest 100`**, dazu
eine Gegenprobe auf der zweiten Saatbasis (`gegenprobe-b`).

### Die drei Schritte, einzeln gemessen

Alle fünf Spalten über 2.000 Partien zu viert, gleiche Saatbasis, damit sie
vergleichbar sind. **A** ist der Stand der fünften Messung, **B** nur das
Markengewicht des Bots, **C** zusätzlich die Schwellen 2/3/5 mit den
unveränderten Boni, **D** dieselben Schwellen mit gekürzten Boni, **E** der
ausgelieferte Stand (zusätzlich 12 statt 14 Startleben).

| | A (vorher) | B (Bot) | C (+ 2/3/5, alte Boni) | D (Boni gekürzt) | **E (ausgeliefert)** |
|---|---|---|---|---|---|
| Startleben | 14 | 14 | 14 | 14 | **12** |
| erste Schwelle | 83,6 % | 111,6 % | 60,5 % | 80,4 % | **79,3 %** |
| mittlere Schwelle | 1,2 % | 11,2 % | 60,9 % | 42,5 % | **35,4 %** |
| höchste Schwelle | **0,0 % (0 Fälle)** | 0,0 % (6 Fälle) | 1,1 % | 0,9 % | **0,3 %** |
| Runden (Median) | 10 | 11 | 11 | 11 | **9** |
| Spielzeit (Median) | 7:27 | 8:24 | 8:55 | 8:23 | **7:24** |
| Kämpfe an der Höchstdauer | 4,4 % | 8,8 % | 16,5 % | 9,6 % | **9,5 %** |
| zur Halbzeit entschieden | 42,5 % | 35,7 % | 32,3 % | 38,0 % | **33,4 %** |

Vier Dinge stehen in dieser Tabelle, die man einzeln nicht sähe:

- **Der Bot allein (A→B) hat die mittlere Schwelle wiederbelebt** — von 1,2 %
  auf 11,2 % —, aber die höchste nicht. Sechs Fälle in 75.096 Antritten sind
  keine Schwelle, sondern ein Zufall. Damit war die Frage der fünften Messung
  beantwortet: Die Zahlen selbst stehen zu hoch.
- **Die Schwellen mit den alten Boni (C) waren zu billig.** Jeder sechste Kampf
  lief in die Höchstdauer, und die Partie wuchs auf 8:55. Ursache sind die
  Rüstungsboni: Sie verlängern jeden Kampf doppelt, weil beide Seiten länger
  stehen.
- **Die gekürzten Boni (D) nehmen das wieder zurück**, ohne die Schwelle zu
  verlieren: 42,5 % statt 60,9 % in der Mitte, 0,9 % statt 1,1 % oben, und die
  Kampfdauer liegt wieder auf dem Wert, den der Bot allein schon gekostet hat.
- **Die zwei Startleben (D→E) holen die Minute zurück, und sie kosten oben.**
  7:24 statt 8:23 ist genau der Betrag, den der Bot vorher gekostet hatte. Die
  Rechnung dafür steht in der Spalte darüber: zwei Runden weniger, und mit
  ihnen fällt die höchste Schwelle von 0,9 % auf 0,3 %. Die **Kampfdauer** ist
  dabei unberührt geblieben (9,5 % gegen 9,6 %) — die Startleben nehmen
  Runden, nicht Sekunden. Ob neun Runden reichen, steht unten in einem eigenen
  Abschnitt.

### Warum 2/3/5 und nicht 2/4/6

Der Grund ist arithmetisch. Ein Brett fasst so viele Einheiten, wie der Sitz
Level hat (`LEVEL_TABELLE` in `regeln.ts`, `feldplaetze` = `level`). Über 400
Partien zu viert verteilt sich das so:

| Level (= Felder auf dem Brett) | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| Anteil der Antritte, 14 Leben | 10,7 % | 32,1 % | 33,1 % | 21,4 % | 2,7 % | **0,04 %** |
| Anteil der Antritte, 12 Leben | 12,1 % | 36,4 % | 35,3 % | 15,2 % | 0,9 % | **0 %** |

Sechs Träger einer Marke setzen mindestens Level 6 voraus. Die Schwelle 6 war
damit nicht selten, sondern in 99,96 % aller Antritte **unmöglich** — an ihr zu
messen hieß, an einer Zahl zu messen, die es nicht geben kann. Bei neun bis elf
Runden je Partie ist das keine Frage des Spielstils mehr.

Dieselbe Tabelle erklärt auch, was die Kürzung auf 12 Startleben gekostet hat:
Sie nimmt nichts am unteren Ende weg, sondern am oberen. Ein Brett mit vier
Einheiten steht in 15,2 % statt 21,0 % der Antritte, eines mit fünf in 0,9 %
statt 2,7 % — und an der Fünf hängt die höchste Schwelle.

### Wie oft eine Schwelle überhaupt stand

165.054 Antritte. Gezählt werden (Antritt, Marke)-Paare; ein Brett hält immer
nur seine höchste Schwelle, die Spalten schließen sich also aus.

| Marke | ab 2 | ab 3 | ab 5 | Träger im Katalog |
|---|---|---|---|---|
| Krieger | 41.836 | 13.808 | 156 | 5 |
| Elementar | 2.094 | 272 | 0 | 5 |
| Meuchler | 31.308 | 9.761 | 30 | 4 |
| Wächter | 47.776 | 32.954 | 353 | 6 |
| Naturwesen | 6.144 | 1.286 | 0 | 5 |
| Untot | 76 | 1 | 0 | 2 |
| Drache | 1.021 | 40 | 0 | 2 |
| **zusammen** | **130.255 (78,9 %)** | **58.122 (35,2 %)** | **539 (0,3 %)** | |

Zweite Saatbasis: 79,1 % / 35,0 % / 0,4 % — die Zahlen hängen nicht am Wurf. Zu
acht (500 Partien) steht die höchste Schwelle in 2,0 % der Antritte, weil dort
zwölf statt neun Runden gespielt werden.

Zum Vergleich derselbe Stand mit 14 Startleben: 80,0 % / 42,4 % / 0,9 %. Die
mittlere Schwelle kostet die kürzere Partie also ein Sechstel, die höchste zwei
Drittel. **Beide leben, und das ist die Aussage, auf die es hier ankommt** — vor
dieser Arbeit stand die mittlere bei 1,2 % und die höchste bei null.

**Drei Marken erreichen die höchste Schwelle weiterhin nie**: Elementar, Untot
und Drache. Bei Untot und Drache ist die Ursache der Katalog — je zwei Träger,
die fünfte Einheit wäre nur über Kopien zu haben, und Kopien verschmelzen. Das
ist derselbe Befund, der schon als Karte auf dem Board liegt, und keine Frage
der Schwellenhöhe.

### Reichen neun Runden?

Die Frage steht seit Langem in `kampf.ts` und in `regeln.ts`, bisher als Satz
ohne Zahl: *Vor Runde 10 steht kein ausgebautes Brett, wer da ausscheidet, hat
nicht verloren, sondern nicht gespielt.* Weil die Partie jetzt neun Runden hat,
ist der Satz nachgezählt worden — 500 Partien zu viert, 1.500 Ausscheiden:

| | 14 Leben | **12 Leben** |
|---|---|---|
| Brett beim Ausscheiden, im Schnitt | 3,67 Einheiten | **3,35 Einheiten** |
| davon mit höchstens 2 Einheiten | 0 | **0** |
| Ausscheiden in Runde, im Schnitt | 8,9 | **7,8** |
| frühestes Ausscheiden überhaupt | Runde 5 | **Runde 5** |

**Der Satz trifft nicht zu.** Niemand scheidet mit einem halb leeren Brett aus;
das früheste Ausscheiden liegt in Runde 5, und bis dahin stehen drei Einheiten.
Was die Kürzung wirklich kostet, ist das obere Ende der Brettgrößen und damit
die höchste Synergieschwelle — nicht der Fall, den der Satz beschreibt.

**Wo die Grenze wirklich liegt:** bei 10 Startleben. Dort sind es acht Runden,
und die Markenspanne wird mit ×0,79–1,21 spürbar unruhiger, weil weniger
Antritte zusammenkommen (`werkzeug/spielzeit.mjs`). Zehn ist zugleich die untere
Schranke aus `pruefeRegeln`.

### Siegquote je Marke

Schnitt der gezählten Zeilen 21,7 %; die zweite Saatbasis in Klammern.

| Marke | Antritte | Quote | zum Schnitt | bei 14 Leben |
|---|---|---|---|---|
| Krieger | 10.718 | 33,9 % | **×1,56** (×1,63) | ×1,49 |
| Wächter | 12.978 | 29,4 % | ×1,36 (×1,42) | ×1,32 |
| Meuchler | 6.832 | 26,4 % | ×1,22 (×1,20) | ×1,14 |
| Naturwesen | 2.047 | 24,0 % | ×1,11 (×1,13) | ×1,29 |
| Drache | 227 | 11,9 % | ×0,55 (×0,44) | ×0,52 |
| Elementar | 658 | 4,7 % | **×0,22** (×0,17) | ×0,24 |
| Untot | 35 | 45,7 % | zu dünn | zu dünn |

### Was auffällt — zum Nachrechnen, nicht nachjustiert

1. **Die Spanne der Marken ist weiter geworden, nicht enger** — ×1,56 bis ×0,22
   gegen ×1,32 bis ×0,80 in der fünften Messung. Das ist zum größten Teil kein
   neuer Schaden, sondern ein sichtbar gewordener: Elementar und Drache standen
   vorher mit 175 bzw. 43 Antritten unter der Zählschwelle und waren schon
   damals die schwächsten Zeilen. Jetzt spielt der Bot sie — 658 bzw. 227
   Antritte —, und man sieht, wie schlecht sie sind. **Folgerung:** Der Befund
   gehört zum Katalog, nicht zu den Schwellen. Elementars Träger sind zugleich
   die schwächsten Einheiten des Spiels (Irrlicht ×0,08, Funkenlehrling ×0,23);
   solange das so ist, ist ein Angriffsbonus auf sie verschenkt.
2. **Krieger steht mit ×1,56 über der ×1,4-Kante**, die die fünfte Messung als
   obere Grenze notiert hat, und er ist mit der kürzeren Partie noch einmal
   gestiegen (×1,49 bei 14 Leben). Der Rüstungsbonus ist in diesem Kampfmodell
   der stärkste — er wirkt auf jeden eingehenden Treffer —, und seit die
   mittlere Schwelle mit drei Trägern statt vier zu haben ist, steht er in
   35 % der Antritte. Dass er bei kürzerer Partie zulegt, passt dazu: Wer nur
   neun Runden hat, kommt seltener an ein großes Brett, und ein billiger
   Frühbonus wiegt dann mehr. **Folgerung:** die erste Zeile, die man ansieht,
   wenn als Nächstes am Balancing gedreht wird. Der Bonus ist hier bewusst nur
   um den Trägeranteil gekürzt worden und nicht zusätzlich — sonst wären zwei
   Änderungen in einer Messung. Es steht als Karte auf dem Board.
3. **Die Spielzeit ist wieder da, wo sie war** — 7:23 im Median gegen 7:27 vor
   dieser Arbeit, bei 9 statt 10 Runden. Den Umweg zeigt die Schritt-Tabelle:
   Der Bot hatte die Partie auf 8:25 getrieben (stärkere Bretter kämpfen
   länger), die zwei Startleben holen das zurück. **Was NICHT zurückkam, ist
   die Kampfdauer:** 9,5 % der Kämpfe laufen in die Höchstdauer von 45 s, vor
   dieser Arbeit waren es 4,4 %. Ein solcher Kampf ist kein Unentschieden — die
   Wertung entscheidet nach Punkten (`entscheideNachZeit` in `kampf.ts`) —,
   aber jeder zehnte Kampf, der die 45 Sekunden ausreizt, ist die Stelle, an
   der man das Spiel als zäh empfindet. Die Startleben können daran nichts
   ändern: Sie nehmen Runden, nicht Sekunden. **Folgerung:** Wenn diese Zahl
   weiter steigt, ist der Rüstungsbonus das Ziel und nicht `HOECHSTDAUER_MS` —
   die Begründung steht bei der Konstante selbst.
4. **Die Partien werden seltener früh entschieden** — 42,5 % → 34,1 % standen
   spätestens zur Halbzeit fest. Das ist die Zeile, die sich am deutlichsten
   verbessert hat, und beide Änderungen ziehen hier in dieselbe Richtung: Wer
   zurückliegt, kann über eine Synergie aufholen, und eine kurze Partie gibt
   einem Vorsprung weniger Zeit, sich auszubauen.

---

## Überholt: die fünfte Messung (Stand 05.09.2026, Bot ohne Markengewicht, Schwellen 2/4/6)

> Dieser Abschnitt beschreibt den Stand VOR dem 05.09.2026 abends. Der gültige
> Stand steht darüber unter „Gemessen: Ausgewogenheit (sechste Messung)“.
> Was hier als Folgerung steht, ist inzwischen abgearbeitet — insbesondere die
> Punkte 2 und 3.

**Warum es eine fünfte gibt.** Am 05.09.2026 sind vier Zahlen geändert worden,
aber auf zwei getrennten Zweigen — und jede der beiden Messungen davor hat nur
die eigene Hälfte gesehen:

- Die **dritte Messung** stand für Zeitraffer x2 und 14 Startleben. Sie wurde
  mit dem **alten Laden** gerechnet (Würfeln kostet 2 Gold, ein gekaufter Platz
  bleibt leer).
- Die **vierte Messung** stand für das kostenlose Würfeln und den Laden, der
  sich bei jedem Kauf ganz erneuert. Sie wurde **ohne Zeitraffer und mit 20
  Leben** gerechnet.

Beide waren richtig, und beide sind seit dem Zusammenführen falsch: Auf
`staging` steht seitdem der Zustand mit **allen vier** Änderungen, und den hatte
niemand gemessen. Dieser Abschnitt ist dieser Lauf. Was hier steht, ist der
gültige Stand; die Zahlen der Messungen davor stehen unten unter
„Vorgeschichte".

**Was zusammen gemessen wurde** — sonst nichts, Zins, Serienbonus, Leveln,
Katalog und Schwellen sind unangetastet:

| Datei | Stelle | vorher | jetzt |
|---|---|---|---|
| `kampf.ts` | `STANDARD_REGLER.zeitraffer` | 1 | **2** |
| `regeln.ts` | `DEFAULT_REGELN.startLeben` | 20 | **14** |
| `regeln.ts` | `DEFAULT_REGELN.neuwuerfelnKosten` | 2 | **0** |
| `partie.ts` | Laden nach dem Kauf (`fuelleLaden`) | nur der gekaufte Platz | **der ganze Laden** |

Gemessen mit demselben Werkzeug und derselben Saatbasis wie die Messungen
davor, **5.000 Partien zu viert, Besetzung `normal`, `--mindest 100`**. Die
Vergleichsspalten heißen durchweg **dritte** (Zeitraffer, alter Laden) und
**vierte** (neuer Laden, kein Zeitraffer).

### Wie lange eine Partie dauert

| | jetzt | dritte | vierte |
|---|---|---|---|
| Runden ⌀ | 10,6 | 11,1 | 14,1 |
| Median | 10 | 11 | 14 |
| kürzeste / längste | 8 / 16 | 8 / 17 | 10 / 21 |
| an der Grenze geendet | 0,0 % | 0,0 % | 0,0 % |
| erstes Ausscheiden | Runde 7,4 | Runde 7,8 | Runde 10,1 |
| **zur Halbzeit entschieden** | **43,0 %** | 30,6 % | 47,3 % |
| Spielzeit im Median | **7:25** | 7:21 | nicht festgehalten |
| einzelner Kampf im Median | 17,3 s | 17,3 s | nicht festgehalten |
| von der Uhr entschieden | **4,3 %** | 1,8 % | nicht festgehalten |
| Antritte insgesamt | 187.730 | 196.314 | 250.329 |

Die vierte Messung hat Spielzeit und Kampfdauer zwar mitgedruckt, aber nicht
ins Dokument geschrieben; die Felder bleiben deshalb leer statt geraten.

Die Spielzeit steht hier bei 7:25, in `docs/TAFELRUNDE-SPIELZEIT.md` bei 7:34.
Das ist kein Widerspruch, sondern derselbe Stand auf zwei Stichproben: Dort
rechnet `werkzeug/spielzeit.mjs` 500 Partien auf der Saatbasis `spielzeit-v1`,
hier `werkzeug/ausgewogenheit.mjs` 5.000 auf `ausgewogenheit-v1`. Neun
Sekunden Abstand sind die Streuung zwischen zwei Stichproben und keine Wirkung
von irgendetwas.

**Die beiden Änderungen ziehen die Partie in dieselbe Richtung und die
Halbzeit-Zeile in entgegengesetzte.** Die Dauer sinkt weiter — zehn Runden
statt elf (dritte) bzw. vierzehn (vierte): Ein Brett steht schneller, wenn der
Laden nichts kostet und bei jedem Kauf frisch ist. Die Zeile „zur Halbzeit
entschieden" landet mit 43,0 % zwischen den beiden Vorgängern: Der neue Laden
treibt sie hoch (dort 47,3 %), die kürzere Partie drückt sie herunter (dort
30,6 %). Wer den Laden bei jedem Kauf neu sieht, holt einen Rückstand schwerer
auf; wer nur zehn Runden hat, kann einen Vorsprung schlechter ausbauen. Unterm
Strich steht es schlechter als nach dem Zeitraffer allein und besser als nach
der Ladenregel allein.

**Von der Uhr entschiedene Kämpfe steigen wieder**, von 1,8 % auf 4,3 %
(`werkzeug/spielzeit.mjs` misst auf seiner eigenen Saatbasis 4,6 %). Das ist
die Kehrseite des neuen Ladens: Er baut stärkere Bretter, und zwei starke
Bretter brauchen länger als zwei schwache. Die Größenordnung ist die, für die
`HOECHSTDAUER_MS` gedacht ist — ein Rettungsseil und kein Regelfall —, aber sie
ist die Zahl, die man beim nächsten Eingriff zuerst nachsieht: Bei 27,7 % (vor
dem Zeitraffer) entschied nicht mehr das Brett, sondern die Uhr.

### Andere Sitzzahlen

Der **Normalfall sind vier Sitze**: Der Bildschirm sucht ausschließlich Tische
zu viert, gemessen wird deshalb zu viert. Die übrigen Sitzzahlen sind
mitgemessen, damit ein selbstgebauter Tisch nicht ins Leere läuft — zu zweit
und zu dritt je 1.000 Partien, zu sechst und zu acht je 500.

| Sitze | Partien | Runden ⌀ | Median | Spielzeit (Median) | an der Grenze | erstes Ausscheiden | zur Halbzeit entschieden |
|---|---|---|---|---|---|---|---|
| 2 | 1.000 | 8,1 | 8 | 4:51 | 0,0 % | Runde 8,1 | 40,6 % |
| 3 | 1.000 | 9,5 | 9 | 6:18 | 0,0 % | Runde 7,7 | 44,5 % |
| **4** | **5.000** | **10,6** | **10** | **7:25** | **0,0 %** | **Runde 7,4** | **43,0 %** |
| 6 | 500 | 12,5 | 12 | 9:22 | 0,0 % | Runde 7,2 | 32,8 % |
| 8 | 500 | 13,7 | 13,5 | 10:39 | 0,0 % | Runde 7,0 | 26,0 % |

Keine einzige Partie endete an der Rundengrenze von 30, zu keiner Sitzzahl; die
längste von allen lief 19 Runden (zu acht).

„Zur Halbzeit entschieden" heißt: Der spätere Sieger lag spätestens ab der
halben Partie ununterbrochen beim meisten Leben.

### Siegquote je Marke

5.000 Partien zu viert. Gezählt wird ein Sitz, dessen **letztes** Brett die
Marke mindestens zweimal trug (erste Schwelle) — nicht der Endzustand, denn wer
ausscheidet, gibt sein Brett vollständig in den Vorrat zurück. Schnitt der
gezählten Zeilen: 32,0 %.

| Marke | Antritte | Siege | Quote | zum Schnitt | zweite Saat | dritte | vierte |
|---|---|---|---|---|---|---|---|
| Untot | 42 | 27 | 64,3 % | zu dünn | zu dünn (33) | zu dünn (32) | ×1,42 |
| Drache | 43 | 27 | 62,8 % | zu dünn | zu dünn (54) | ×1,13 | zu dünn |
| Krieger | 4.928 | 2.091 | 42,4 % | **×1,32** | ×1,37 | ×1,27 | ×1,04 |
| Naturwesen | 1.494 | 523 | 35,0 % | ×1,09 | ×1,09 | ×0,92 | ×1,09 |
| Meuchler | 10.597 | 3.177 | 30,0 % | ×0,94 | ×0,93 | ×0,77 | ×0,77 |
| Wächter | 10.612 | 2.865 | 27,0 % | ×0,84 | ×0,86 | ×1,13 | ×0,76 |
| Elementar | 175 | 45 | 25,7 % | ×0,80 | ×0,75 | ×0,78 | ×0,93 |

**Das Ziel war: keine gezählte Marke über ×1,4 und keine unter ×0,7.** Der
gemessene Bereich ist **×0,80 bis ×1,32** und bleibt damit innerhalb — enger
als nach der Ladenregel allein (×0,76–1,42, dort oben gerissen) und in etwa so
weit wie nach dem Zeitraffer allein (×0,77–1,27). Der Krieger ist mit ×1,32 die
Zeile, die man zuerst ansieht; auf der zweiten Saatbasis steht er auf ×1,37 und
damit dicht an der Kante. Geändert wurde am Katalog nichts.

Der Schnitt ist nicht 1/4: Ein Brett trägt in der Regel drei bis fünf Marken
gleichzeitig, die Quoten summieren sich deshalb nicht auf 100 %.

### Siegquote je Einheit auf dem letzten Brett

5.000 Partien zu viert, Schnitt der gezählten Zeilen 34,8 %. Gekürzt auf die
Ränder; die volle Tabelle druckt das Werkzeug.

| Einheit | Gold | Antritte | Quote | zum Schnitt |
|---|---|---|---|---|
| Sturmrufer | 3 | 129 | 55,8 % | ×1,60 |
| Drachenkind | 3 | 600 | 54,8 % | ×1,57 |
| Klingentänzerin | 3 | 2.779 | 54,5 % | ×1,56 |
| Wurzelriese | 3 | 2.217 | 53,9 % | ×1,55 |
| Bogenmeisterin | 2 | 2.028 | 48,7 % | ×1,40 |
| … | | | | |
| Dorfwache | 1 | 9.120 | 25,9 % | ×0,74 |
| Gassendieb | 1 | 17.208 | 23,3 % | ×0,67 |
| Schildknappe | 1 | 12.386 | 21,5 % | ×0,62 |
| Astschütze | 1 | 2.902 | 14,9 % | ×0,43 |
| Funkenlehrling | 1 | 315 | 9,2 % | ×0,26 |
| Irrlicht | 1 | 432 | 8,8 % | ×0,25 |

Drei Zeilen fallen unter die Zählschwelle von 100 Antritten und stehen deshalb
nicht in der Wertung: Grabfürstin (80), Moosheiler (74), Lichtwahrerin (72) —
darunter die Einheit, die in der dritten Messung noch die auffälligste Zahl der
ganzen Tabelle war (siehe Befund 6).

**Die Spitze ist reine 3-Gold-Ware, der Boden reine 1-Gold-Ware**, und der
Abstand ist größer als in jeder Messung davor: ×1,60 oben gegen ×0,25 unten.
Wer bei jedem Kauf einen frischen Laden sieht, wartet eher auf die teure Karte,
statt die billige mitzunehmen — dieselbe Bewegung, die schon in der vierten
Messung stand, jetzt zusätzlich durch die kürzere Partie verschärft.

### Wie oft eine Schwelle überhaupt stand

187.730 Antritte (je Runde ein Eintrag für jeden lebenden Sitz). Gezählt werden
(Antritt, Marke)-Paare — ein Brett kann mehrere Schwellen gleichzeitig halten.

| Marke | ab 2 | ab 4 | ab 6 | Träger im Katalog |
|---|---|---|---|---|
| Krieger | 24.954 | 220 | 0 | 5 |
| Elementar | 667 | 0 | 0 | 5 |
| Meuchler | 61.594 | 883 | 0 | 4 |
| Wächter | 62.948 | 1.095 | 0 | 6 |
| Naturwesen | 6.379 | 38 | 0 | 5 |
| Untot | 99 | 0 | 0 | 2 |
| Drache | 202 | 0 | 0 | 2 |
| **zusammen** | **156.843 (83,5 %)** | **2.236 (1,2 %)** | **0 (0,0 %)** | |

Zum Vergleich, jeweils dieselbe Zeile: dritte Messung 76,4 % / 0,6 % / 0 Fälle,
vierte Messung 102,0 % / 3,3 % / 11 Fälle.

### Wie gemessen wurde

`packages/game-tafelrunde/test/messen.ts` spielt vollständige Partien mit Bots
durch, ohne Oberfläche, alles aus dem Seed. Drei Aufrufer benutzen ihn:

- **Das Werkzeug** `packages/game-tafelrunde/werkzeug/ausgewogenheit.mjs` —
  von Hand zu starten, mit der großen Zahl. Es druckt die Tabellen dieses
  Abschnitts:

  ```
  npm run build --workspace @brauweg/game-tafelrunde
  node packages/game-tafelrunde/werkzeug/ausgewogenheit.mjs --partien 5000 --sitze 4 --mindest 100
  ```

  Schalter: `--partien`, `--sitze` (2–8), `--besetzung`
  (`normal`/`sanft`/`hart`/`gemischt`), `--saat`, `--mindest`, `--json`, dazu
  die vier Stellschrauben der Spielzeit (`--leben`, `--teiler`, `--zeitraffer`,
  `--takt`), mit denen sich ein vorgeschlagener Stand ansehen lässt, ohne ihn
  einzubauen.

- **Das Werkzeug für die Gangarten** `werkzeug/gangarten.mjs` — dieselbe
  Partieschleife, aber ein Sitz spielt `hart` und die drei anderen `normal`.
  Es beantwortet die Frage, die `ausgewogenheit.mjs` bauartbedingt offen lässt
  (dort sind alle Sitze gleich besetzt, sonst misst man die Gangarten statt
  des Katalogs):

  ```
  node packages/game-tafelrunde/werkzeug/gangarten.mjs --partien 400 --stark hart --schwach normal
  ```

  Schalter: `--stark`, `--schwach`, `--partien`, `--sitze`, `--saat` sowie
  `--leben`, `--teiler`, `--zeitraffer`, `--takt` und `--wuerfelkosten`. Die
  letzten fünf stellen einen **vorgeschlagenen** Stand nach, ohne ihn
  einzubauen — genau damit ist Befund 7 unten aufgeklärt worden.

- **Die Probe** `test/ausgewogenheit.test.ts` — 400 Partien zu viert, rund
  anderthalb Sekunden, läuft bei jedem Testlauf mit. Sie hält nur fest, was
  wirklich kaputt wäre, und ist keine Abnahme des Katalogs.

Die Grundmessung sind **5.000 Partien zu viert**, alle Sitze mit der Gangart
`normal` besetzt (sonst misst man die Gangarten und nicht den Katalog). Der
Lauf kostet rund 33 Sekunden — deshalb fünf- und nicht fünfhundert Tausend, und
deshalb überhaupt so viele: Die dünnen Marken geben sonst gar keine Aussage
her.

**Zwei Gegenproben, und nur eine bestätigt.** Eine zweite Saatbasis über
dieselben 5.000 Partien (`--saat gegenprobe-v2`) liefert dasselbe Bild —
Krieger ×1,37, Naturwesen ×1,09, Meuchler ×0,93, Wächter ×0,86, Elementar
×0,75, Untot und Drache zu dünn. Eine **gemischte Besetzung** (reihum
sanft/normal/hart, ebenfalls 5.000 Partien) liefert dagegen ein ganz anderes:
Untot ×1,93, Meuchler ×1,32, Krieger ×1,19, Wächter ×0,91, Naturwesen ×0,89,
Drache ×0,55, Elementar ×0,21. Das ist keine Gegenprobe des Katalogs, sondern
eine Aussage über die Gangarten — wer die Sitze ungleich besetzt, misst, wie
verschieden gut die Bots spielen. Der frühere Satz, die gemischte Besetzung
bestätige die Grundmessung, gilt für diesen Stand nicht mehr.

**Was diese Zahlen nicht sind:** eine Aussage über die beste Strategie.
Gemessen ist das Spiel, wie die **Bots** es spielen. Alles, was der Bot nicht
tut — gezielt auf eine Schwelle hinspielen, den Vorrat mitzählen, zwischen
zwei Runden umbauen —, fällt heraus.

### Was auffällt — zum Nachrechnen, nicht nachjustiert

Robin rechnet das Balancing selbst durch; hier steht nur, was die Zahlen sagen.

1. **Der Krieger ist mit ×1,32 die stärkste gezählte Marke** und auf der
   zweiten Saatbasis mit ×1,37 dicht an der oberen Kante von ×1,4. Er zieht
   seit dem Zeitraffer an, und zwar aus einem verstandenen Grund: Wo vorher
   jeder dritte Kampf an der Uhr entschieden wurde, gewinnt jetzt das Brett,
   das sonst auf Zeit gespielt hätte. Die Ladenregel hat daran wenig geändert
   (dritte Messung ×1,27). **Folgerung:** nichts tun, aber beim nächsten
   Eingriff diese Zeile zuerst ansehen.
2. **Drei von sieben Marken sind nicht mehr messbar.** Untot 42, Drache 43,
   Elementar 175 Antritte in 5.000 Partien — die ersten beiden fallen unter die
   Zählschwelle, die dritte steht knapp darüber. Der Weg dorthin ging über
   beide Änderungen: Untot 65 → 32 (dritte) bzw. 128 (vierte) → **42**, Drache
   394 → 204 bzw. 63 → **43**, Elementar 1.260 → 924 bzw. 156 → **175**.
   **Folgerung:** unverändert — ein dritter Träger, dann messen. Am Bonus zu
   drehen, solange die Marke nur über zwei Kopien derselben Einheit zu haben
   ist, misst nicht die Marke. Die Karten dazu liegen auf dem Board; die
   kürzere Partie hat das Problem nicht verursacht, macht es aber schlechter
   messbar.
3. **Die Schwelle 6 bleibt tot, die Schwelle 4 steht in 1,2 %.** Von 187.730
   Antritten hält kein einziger irgendeine Marke sechsfach (dritte Messung 0,
   vierte 11 Fälle). Sechs Träger brauchen mindestens Level 6, und dorthin
   kommt in zehn Runden niemand. Dazu die schon bekannte Ursache — der Bot
   spielt gar nicht auf Marken hin (`MARKEN_GEWICHT` in `bot.ts` ist 25 gegen
   Einheitenstärken von 130 bis 970). **Folgerung:** unverändert — erst dem Bot
   ein echtes Markengewicht geben und neu messen; bleibt die Sechs auch dann
   leer, sind die Schwellen zu hoch angesetzt (2/3/5 statt 2/4/6). Die Probe
   prüft die Sechs nicht mehr — sie käme in 400 Partien nicht ein einziges Mal
   vor.
4. **Fast jede zweite Partie steht zur Halbzeit fest** (43,0 %). Das ist die
   Zeile, an der die beiden Änderungen gegeneinander ziehen. Die Reihe: 100
   Leben 43,0 %, 20 Leben 36,7 %, Zeitraffer 30,6 %, Ladenregel allein 47,3 %,
   jetzt wieder 43,0 %. **Der neue Laden hat den Gewinn des Zeitraffers wieder
   aufgezehrt.** Für einen Auto-Battler ist das nicht ungewöhnlich — wer früh
   gewinnt, hat mehr Gold —, aber es ist die Stelle, an der man sieht, dass die
   beiden Änderungen nicht unabhängig sind.
5. **Der Preisgraben ist tiefer als je zuvor**: ×1,60 (Sturmrufer, 3 Gold)
   gegen ×0,25 (Irrlicht, 1 Gold). Funkenlehrling steht bei ×0,26, Astschütze
   bei ×0,43. Beim Funkenlehrling und beim Irrlicht ist die Ursache bekannt und
   unverändert — Ein-Gold-Magier mit 430 bis 450 Leben und 10 Rüstung sterben,
   bevor sie zweimal geschossen haben. Neu ist der Abstand: Der frische Laden
   bei jedem Kauf macht aus „nimm mit, was da ist" ein „warte auf das Gute".
6. **Der Moosheiler ist unter die Zählschwelle gerutscht** — 74 Antritte statt
   541 in der dritten Messung, mit 2 Siegen. Die Board-Karte zu ihm nennt 541
   Antritte bei ×0,15; diese Zahl stammt aus der Messung **ohne** die
   Ladenregel und gilt für den heutigen Stand nicht mehr. Was bleibt: Er
   gewinnt praktisch nie, und die Ursache ist dieselbe — Heilen gibt es in
   `kampf.ts` noch gar nicht, ohne Fähigkeit ist eine Beistand-Einheit nur eine
   schwache Wache. Was sich geändert hat: Der Bot stellt ihn seit dem neuen
   Laden kaum noch auf, weil er sich etwas Besseres aussuchen kann.
7. **Die Gangart `hart` schlägt `normal` wieder — und diesmal ist auch klar,
   woran es lag.** Über 400 Partien zu viert (`imFeld` in `bot.test.ts`, Sitz 0
   hart gegen drei normale) steht es **140 : 86,7** für den harten Sitz; nach
   der dritten Messung stand dieselbe Zahl bei 77 : 107,7, also umgekehrt. Auch
   die beiden anderen Sprossen sind gewandert: `hart` gegen drei sanfte
   341 : 19,7 (vorher 223 : 59), `normal` gegen drei sanfte 359 : 13,7 (vorher
   267 : 44) — der neue Laden nützt den ausbauenden Gangarten weit mehr als der
   sparsamen. Zwei unabhängig gelaufene Messungen kommen hier Ziffer für Ziffer
   auf dieselben Zahlen.

   **Die Ursache ist eingekreist** (`werkzeug/gangarten.mjs`, je 400 Partien).
   Es war weder die kurze Partie — der Zeitraffer allein bewegt die Zahl bei 20
   Leben von 110 auf 114 — noch der Würfelpreis: Mit wieder eingeschaltetem
   Preis gewinnt `hart` auf dem heutigen Stand sogar deutlicher (174 : 75,3).
   Es war die **alte Ladenregel**: Solange ein Kauf nur seinen Platz leerte,
   bekam `hart` die Feldplätze, die es sich früh erkauft, in einer elf Runden
   kurzen Partie nicht mehr voll — sein Aufstieg war Tempo ins Leere. Beleg auf
   demselben Stand: mit gezähmtem Aufstieg (`aufstiegsReserve` 3, nur bei
   vollem Brett) stand es dort 112 : 96,0 statt 77 : 107,7.

   **Gegenprobe über zwei Saatbasen** (`…-feld` und `gegenprobe-b`), je 400
   Partien, alle vier Werte in dieselbe Richtung:

   | Paarung | gebaut (14 Leben, x2) | langer Stand (20 Leben, x1) |
   |---|---|---|
   | hart : normal | 140 : 86,7 · 139 : 87,0 | 169 : 77,0 · 147 : 84,3 |

   Dazu ein Kontrolllauf: `hart` in allem auf `normal` gesetzt ergibt
   102 : 99,3 — die Messung ist unverzerrt, es gewinnt die Gangart und nicht
   der Sitz 0.

   **Folgerung:** Die Board-Karte „`hart` ist schwächer als `normal`" ist auf
   diesem Stand nicht mehr nachstellbar, und die Probe in `bot.test.ts`
   behauptet die Reihenfolge wieder — mit Saatbasis und Partienzahl im
   Kommentar, und ergänzt um eine vierte Probe, die dasselbe beim langen Stand
   prüft. Die frühere Vorsicht („an einem Tag zweimal gekippt") war richtig,
   solange niemand wusste, warum; was beide Male kippte, war der Laden.
   **Wer den Laden das nächste Mal anfasst, misst die Gangarten mit.**

   Was `hart` dabei trägt, ist die fehlende Patzerquote und nicht das Tempo:
   Kontrolllauf 102 : 99,3, nur ohne Patzer 149 : 83,7, mit den Tempo-Schrauben
   obendrauf 140 : 86,7 — die letzten beiden liegen innerhalb eines
   Standardfehlers (rund 10 Siege bei 400 Partien). Nichts verstellt, weil eine
   Änderung auf eine Zahl innerhalb der Streuung geraten wäre; als eigene Karte
   steht es auf dem Board.
8. **Kein Kandidat für einen Katalogeingriff.** Alle gezählten Marken bleiben
   innerhalb ×0,7 bis ×1,4, alle 22 Einheiten werden aufgestellt, jede Marke
   erreicht ihre erste Schwelle, keine Partie endet an der Rundengrenze oder
   ohne eindeutigen Sieger. Was auffällt, sind Befunde über den **Bot** (2, 3,
   7) und über die **Ladenregel** (4, 5, 6) — nicht über die Werte in der
   Tabelle weiter oben.

---

## Vorgeschichte: die Messungen davor

Fünf Messungen sind dieser vorausgegangen, jede nach einem Eingriff. Die ersten
vier stehen hier in Kurzform, weil ihre vollen Tabellen Zustände beschreiben,
die es nicht mehr gibt; wer sie braucht, findet sie in der Geschichte dieser
Datei. Die fünfte steht oben noch vollständig da, weil die sechste sich Zeile
für Zeile mit ihr vergleicht.

| | erste | zweite | dritte | vierte | fünfte | **sechste (gültig)** |
|---|---|---|---|---|---|---|
| Startleben | 100 | 20 | **14** | 20 | 14 | **12** |
| Zeitraffer | x1 | x1 | **x2** | x1 | x2 | **x2** |
| Neu-Würfeln | 2 Gold | 2 Gold | 2 Gold | **0** | 0 | **0** |
| Laden nach dem Kauf | nur der Platz | nur der Platz | nur der Platz | **ganz neu** | ganz neu | **ganz neu** |
| Schwellen | 2/4/6 | 2/4/6 | 2/4/6 | 2/4/6 | 2/4/6 | **2/3/5** |
| Bot spielt auf Marken | nein | nein | nein | nein | nein | **ja** |
| Runden ⌀ zu viert | 26,5 | 14,7 | 11,1 | 14,1 | 10,6 | **9,5** |
| Spielzeit ⌀ zu viert | — | — | — | — | 7:27 | **7:23** |
| an der Grenze geendet | 18,5 % | 0,0 % | 0,0 % | 0,0 % | 0,0 % | **0,0 %** |
| zur Halbzeit entschieden | 43,0 % | 36,7 % | 30,6 % | 47,3 % | 43,0 % | **34,1 %** |
| mittlere Schwelle gehalten | — | — | 0,6 % | 3,3 % | 1,2 % | **35,2 %** |
| höchste Schwelle gehalten | — | — | 0 Fälle | 11 Fälle | 0 Fälle | **0,3 %** |
| Markenspanne (gezählt) | — | ×0,79–1,15 | ×0,77–1,27 | ×0,76–1,42 | ×0,80–1,32 | **×0,22–1,56** |

**Erste Messung (100 Startleben).** Die Werte trugen die Partie nicht: Zu viert
liefen 18,5 % aller Partien in die Rundengrenze von 30, zu acht 72,6 %, ohne
dass jemand gewonnen hatte. Ein Ausscheiden brauchte rund zwanzig verlorene
Kämpfe.

**Zweite Messung (20 Startleben).** Der Lebensvorrat fiel von 100 auf 20, der
Schaden je Niederlage wird seitdem durch drei geteilt
(`SCHADEN_STUFEN_TEILER`), die Marke **Drache** bekam mit dem Funkenlehrling
einen zweiten Träger und ihr Bonus wurde halbiert, das **Drachenkind** ging von
Tempo 0,85 auf 0,75. Anlass war Robins Vorgabe („stell auf 4 Spieler um, das
reicht völlig, und reduzier auf 20 Leben — es soll ja ein kurzes Handyspiel
sein"). Seitdem endet keine Partie mehr an der Rundengrenze. Ein Nebenbefund
von damals gilt weiter: Was bei Drache half, war der zweite Träger und nicht
der Bonus — mit dem Drachen-Bonus auf null stand die Marke immer noch bei
×1,37. Gemessen wurde also gar nicht die Synergie, sondern „ein Brett, auf dem
zwei teure Einheiten stehen".

**Dritte Messung (Zeitraffer x2, 14 Startleben).** Robins Ziel war
„durchschnittlich 8 Minuten maximum"; eine Partie dauerte 13:31 im Median. Der
Zeitraffer ist die einzige Schraube, die kürzt, ohne eine Runde zu streichen:
Der einzelne Kampf fiel von 35,2 s auf 17,3 s, die an der Höchstdauer
abgeschnittenen Kämpfe von 27,7 % auf 1,8 %, die Partie auf 7:25. Welche
Stellschraube wie viel bringt, steht in **`docs/TAFELRUNDE-SPIELZEIT.md`**.

**Vierte Messung (kostenloses Würfeln, Laden zieht beim Kauf ganz neu).**
Robin: „wir wollen nicht mehr, dass man fürs Rollen Geld ausgeben soll" und
„Nicht nur der gekaufte, dein ganzer Shop aktualisiert sich wenn du etwas
kaufst, du musst dich also immer entscheiden." Gemessen wurde vor allem eines:
Die Zeile „zur Halbzeit entschieden" sprang von 36,7 % auf 47,3 %.

Zwischen der dritten und der vierten stand kurz eine Fassung auf einem
Aufgabenzweig, die die Ladenregel falsch umsetzte (kostenloses Würfeln, aber
nur der gekaufte Platz wurde nachbesetzt). Sie ist nie auf `staging` gelandet
und zählt hier nicht mit.
