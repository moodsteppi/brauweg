# FELDHERR einbauen — Befund und Plan

Stand: 5. August 2026. Grundlage ist das fertige Spiel (eine HTML-Datei, rund
3.500 Zeilen, ohne Abhängigkeiten) und der Quelltext dieses Repositoriums nach
`git clone --depth 1`.

---

## Der Befund vorweg

**FELDHERR passt nicht in `GameModule`, ohne die Schnittstelle zu erweitern.**
Das ist keine Kleinigkeit an der Oberfläche, sondern betrifft ihre Grundidee:

| `GameModule` erwartet | FELDHERR |
|---|---|
| `currentActor` — ein Sitz ist am Zug | beide handeln gleichzeitig, immer |
| `legalActions` — der Client baut daraus Schaltflächen | jede Karte auf jedes freie Feld, hunderte je Bild |
| „Das Modul bleibt uhrlos" | die Partie rechnet 20-mal je Sekunde weiter, auch wenn niemand etwas tut |
| Runden, Geberrotation, `rotationSize` | eine durchgehende Partie ohne Runden |
| `PartyStanding.points` aus Kartenpunkten | Sieg oder Niederlage, sonst nichts |
| `xpBasis` = gelegte Karten | gelegte Karten gibt es, aber sie sind keine Leistung |

Der Satz „Ein neues Spiel ist ein neues Paket, kein Eingriff in Server oder
Client" gilt für **Kartenspiele mit Zugfolge**. FELDHERR ist die erste
Echtzeitgattung im Haus, und die kostet einmalig einen Eingriff in die
Plattform. Wer das übergeht und FELDHERR in die vorhandene Form presst, baut
`currentActor: () => null` und `legalActions: () => []` und hat damit ein Modul,
das der Server nicht mehr vorantreiben kann.

---

## Drei Wege

### A — Nur örtlich (kein Server, kein Online)

Das Spiel läuft ausschließlich im Browser: gegen die KI und zu zweit an einem
Gerät. Der Server erfährt am Ende nur, dass eine Partie gespielt wurde, und
bucht Erfahrung und Münzen.

* Aufwand: klein. Eine Client-Komponente, eine Kachel in der Spielauswahl, ein
  Endpunkt für die Belohnung.
* Kosten: kein Online-Spiel, keine Rangliste, keine Trophäen.
* Risiko: Der Belohnungsendpunkt ist eine Behauptung des Clients. Ohne
  Deckelung („höchstens so viel je Tag") ist er eine Münzquelle.

### B — Lockstep über den vorhandenen Tisch **(Empfehlung)**

Der Server bleibt Schiedsrichter für Tisch, Sitze, Start, Ende und Belohnung.
Die Partie selbst rechnen **beide Geräte gleichzeitig aus** — aus demselben
Saatkorn und derselben Aktionsliste. Über die Leitung gehen nur Aktionen
(„Spieler 2 legt Schwert auf 7/3 bei Takt 412"), keine Zustände.

* Voraussetzung ist bitgenaue Gleichheit beider Läufe. **Die ist hergestellt**
  — siehe unten.
* Aufwand: mittel. Neue Nachrichtenart im Protokoll, eine Tischart ohne
  Rundenzahl, Takt- und Nachzügler-Behandlung.
* Kosten: Der Server kennt den Spielstand nicht mit. Für die Rangliste muss er
  dem gemeldeten Ausgang glauben — oder die Aktionsliste am Ende selbst
  nachrechnen (dieselbe Logik, einmal auf dem Server, ohne Zeichnen).
* Warum trotzdem empfohlen: Es ist der einzige Weg, der Online möglich macht,
  ohne dass der Server 20-mal je Sekunde je Tisch rechnet.

### C — Server rechnet mit

`game-api` bekommt eine zweite Gattung mit `tick(dt)`, die Partie-Laufzeit eine
Schleife je Tisch, `viewFor` liefert den Zustand als Momentaufnahme.

* Aufwand: groß. Gateway, Party-Runtime, Protokoll und Client sind betroffen.
* Kosten: Rechenlast auf dem Server, ein zweites Zustandsmodell im Protokoll.
* Gewinn: echte Server-Autorität, Betrug bauartbedingt ausgeschlossen.
* Das ist der richtige Weg, wenn FELDHERR ein Wettbewerbsspiel mit Rangliste
  werden soll. Als erster Schritt ist er zu teuer.

**Vorschlag: A jetzt, B als nächster Schritt, C erst, wenn Ranglisten am
Echtzeitspiel wirklich gewollt sind.**

---

## Was bereits fertig ist

**Das Spiel rechnet deterministisch.** Alle 45 Aufrufe von `Math.random()` sind
durch einen Seed-Zufall (mulberry32) ersetzt; `saat(wert)` setzt den
Anfangswert. Nachgewiesen: Zwei Läufe mit demselben Saatkorn ergeben nach 90
simulierten Sekunden dasselbe Gelände, dieselbe KI-Taktik, denselben Sieger und
Zeichen für Zeichen dieselbe Objektliste; ein anderes Saatkorn ergibt eine
andere Partie.

Ohne diesen Schritt ist Weg B unmöglich, und er ist unabhängig davon richtig:
Eine Partie lässt sich damit aus Saatkorn und Aktionsliste jederzeit
nachspielen — für Wiederholungen, für Fehlersuche und für eine spätere
Nachprüfung auf dem Server.

---

## Was für Weg A zu tun ist

1. **Paket `packages/game-feldherr`** mit dem Spielkern als ES-Modul. Der
   heutige Code hängt an `document.getElementById` für Leiste und Overlays;
   diese Teile werden zu React, der Rest bleibt Canvas und wandert unverändert
   in `kern.js`. Schnittstelle: `starteFeldherr(canvas, {modus, saat, aufEnde})`.
2. **Client-Bildschirm `screens/FeldherrTisch.tsx`** mit dem Menü der
   Plattform: „Gegen die KI", „Zu zweit an einem Gerät", darunter „Online
   spielen".
3. **Kachel in `GameSelect.tsx`.** `GameId` in `game-api` um `'feldherr'`
   erweitern; als eigene Gattung führen, nicht in `PREVIEW`, sonst verspricht
   die Lobby einen Kartentisch.
4. **Belohnung.** Ein Endpunkt `POST /minigames/feldherr/ende` mit Ausgang und
   Dauer. Buchung über `waehrung.ts`, Erfahrung über `level.ts`. **Mit
   Tagesdeckel** — ohne ihn ist jede geschlossene Runde Geld.
5. **Tagesaufgaben.** Die vorhandenen sechs sind kartenspielnah
   (`karten-legen`). Entweder eine siebte Aufgabe „ein Gefecht gewinnen" oder
   `partie-spielen` auch für Minispiele zählen lassen — das ist eine
   Produktentscheidung, keine technische.

## Was für Weg B dazukommt

6. **Tischart ohne Runden.** `rounds` ist heute Pflicht und wird gegen
   `rotationSize` geprüft. Für Echtzeitspiele braucht es einen Zweig, der das
   überspringt, statt `rounds: 1` zu erfinden.
7. **Protokoll.** Eine additive Nachricht `takt` mit `{tisch, takt, aktionen[]}`
   in beide Richtungen. Regel 1 des Protokolls („nur additive Änderungen")
   bleibt gewahrt.
8. **Gleichlauf.** Beide Geräte rechnen feste Takte von 50 ms. Aktionen werden
   für den übernächsten Takt eingeplant, damit die Laufzeit sie sicher
   erreicht. Wer zurückfällt, holt auf, indem er mehrere Takte ohne Zeichnen
   rechnet.
9. **Abgleichprobe.** Alle 40 Takte schickt jedes Gerät eine Prüfsumme des
   Zustands. Weichen sie ab, gewinnt der Tisch-Eigner und der andere lädt neu.
   Ohne diese Probe merkt man einen Auseinanderlauf erst am unterschiedlichen
   Sieger.
10. **Tisch erstellen und beitreten** im Stil der Lobby: „Tisch erstellen"
    öffnet einen offenen Tisch mit zwei Plätzen, „Beitreten" listet die
    offenen Tische. Der Freundesweg besteht schon — `social/service.ts` hat
    Freundschaften, die Lobby zeigt sie; für FELDHERR genügt derselbe Filter.

---

## Offene Fragen (gebündelt, wie Regel 6 verlangt)

1. **Welcher Weg?** A jetzt und B als nächstes, oder gleich B?
2. **Rangliste und Trophäen für ein Echtzeitspiel — ja oder nein?** Davon
   hängt ab, ob C je gebraucht wird. Bei Nein bleibt FELDHERR ein Minispiel mit
   Münzen und Erfahrung, und der Server muss nie mitrechnen.
3. **Wieviel darf eine Partie einbringen?** Vorschlag: 3 Münzen je Sieg,
   1 je Niederlage, höchstens 20 am Tag; Erfahrung nach Partiedauer statt nach
   gelegten Karten.
4. **Eigene Tagesaufgabe oder vorhandene mitzählen?**
5. **Bilder:** Die Spielauswahl arbeitet mit gemalten Kacheln. Für FELDHERR
   liegt bisher nur eine SVG-Zeichnung im Stil der Vorschau-Spiele nahe —
   soll eine Bestellung `docs/ASSETS-FELDHERR.md` geschrieben werden?
6. **Wohin mit dem Kern?** Eigenes Paket `game-feldherr` (sauber, aber die
   `GameModule`-Form passt nicht) oder `packages/client/src/minispiele/`
   (ehrlicher, solange der Server nicht mitrechnet)?

---

## Wovor gewarnt sei

* **Nicht in `PREVIEW` eintragen.** Dort stehen Kartenspiele ohne Modul; ein
  Eintrag dort führt die Lobby vor, die Sitze und Rundenzahlen anbieten will.
* **Nicht `rounds: 1` erfinden**, um an der Tischprüfung vorbeizukommen. Das
  hält bis zur ersten Auswertung, die über Runden mittelt.
* **Den Belohnungsendpunkt nicht ohne Deckel bauen.** Ein Minispiel, das der
  Client meldet, ist eine Geldquelle, sobald jemand die Anfrage nachbaut.
* **Die Prüfsumme aus Weg B nicht weglassen.** Ein Auseinanderlaufen ohne
  Probe zeigt sich erst am Ende, und dann hat jeder einen anderen Sieger
  gesehen.
