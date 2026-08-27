# Mememory zu zweit, zu dritt und zu viert

Seit dem **27. August 2026** hat ein Mememory-Tisch zwei, drei oder vier
Sitze. Drei Dinge musste das kosten, und nur eines davon war absehbar:

1. **Getrennte Töpfe bei der Suche.** Wer zu viert spielen will, darf nicht
   an einem Tisch für zwei landen.
2. **Mehr Karten, ohne größeres Brett.** Vier Spalten sind auf einem Handy
   die Grenze.
3. **Das Gedächtnis der Bots muss beim Mischen weg.** Alte Plätze wären
   schlimmer als gar keine.

---

## 1 — Der Nachschubstapel

**Das Brett bleibt bei 24 Karten.** Die Kartenbreite hängt allein an der
Spaltenzahl (fünf Spalten sind auf 375 px je 63 px — das war schon einmal
verworfen, siehe `regeln.ts`), und mehr Zeilen machten die Karten flacher,
sodass vom quadratischen Motiv oben und unten mehr wegfiele.

Stattdessen bringt **jeder Spieler ab dem dritten acht Karten mit** (vier
Paare). Sie liegen zu Beginn nicht auf dem Brett, sondern auf einem Stapel:

| Spieler | Auf dem Brett | Auf dem Stapel | Paare gesamt |
| --- | --- | --- | --- |
| 2 | 24 | 0 | 12 |
| 3 | 24 | 8 | 16 |
| 4 | 24 | 16 | 20 |

**Damit dauert eine Partie für jeden gleich lang**, egal zu wie vielen
gespielt wird — zu viert holt jeder im Schnitt fünf Paare, genau wie zu
zweit sechs. Ohne den Stapel wären es zu viert drei, und die Partie wäre
vorbei, bevor sich jemand etwas merken konnte.

Der Stapel steht am Brett oben in der Mitte, zwischen den beiden oberen
Ecken (`.mm-stapel`): drei versetzte Kärtchen und die Zahl. Zu zweit steht er
gar nicht da.

---

## 2 — Nachlegen heißt mischen

**Sind acht Plätze frei, kommen acht Karten nach — und das ganze Brett wird
neu gemischt.** Die geholten Paare gehen dabei vom Brett; ihre Punkte stehen
längst in `punkte` und bleiben.

Warum erst bei acht und nicht nach jedem Paar: Sonst läge das Brett bei jedem
zweiten Zug neu, und ein Memory, in dem sich nichts merken lässt, ist keins.
So passiert es **einmal je Block** — zu dritt einmal in der Partie, zu viert
zweimal.

Warum überhaupt mischen und nicht nur die Lücken füllen: Weil sonst nur die
vier neuen Paare unbekannt wären und der Rest weiter dort läge, wo alle ihn
vermuten. Nach dem Mischen weiß niemand mehr etwas — auch der Experte nicht.

### Die Rechnung geht auf

Genommen werden **höchstens so viele Karten, wie Plätze frei sind**, und frei
werden sie in Zweierschritten, geprüft nach jeder Schaupause. Der Block von
acht ist damit genau erreicht und nie überschritten: Das Brett ist nach dem
Nachlegen wieder voll. Ein Test rechnet das nach
(`test/nachschub.test.ts`), und ein zweiter zählt jedes Motiv im ganzen
Spiel — genau zweimal, sonst ließe sich das Brett nicht räumen.

**Auf einem winzigen Brett gibt es keinen Nachschub.** Bei weniger als
sechzehn Plätzen würde nie ein ganzer Block frei, der Stapel käme nie ins
Spiel — und die Partie wäre nie zu Ende, denn fertig ist sie erst, wenn auch
der Stapel leer ist. `nachschubMenge()` gibt dort null zurück.

### Die Mischpause ist ein eigener Zustand

`Pause` hat einen dritten Wert bekommen: `mischen`. Sie ist **kein Anhängsel
des Zuges**, sondern ein eigener Schritt von 2200 ms, den die Plattform wie
jede andere Schaupause misst (`interludeMs` / `advanceInterlude`).

Der Grund ist die Bewegung: Der Client soll die Karten sichtbar
zusammenschieben, mischen und neu verteilen können. Läge das Mischen in
`beendePause`, spränge das Brett in einem einzigen Bild um.

Der Ablauf: Treffer → Trefferpause endet → acht Plätze frei → **Zustand
`mischen`** (das Brett liegt noch alt) → Pause endet → `mischeNeu` legt nach,
mischt und leert die Bot-Gedächtnisse.

---

## 3 — Die Bewegung

Zwei Hälften, beide über die Web-Animations-Schnittstelle und beide nur mit
`transform`:

1. **Zusammenschieben** (820 ms), sobald `pause === 'mischen'` ankommt: Jede
   Karte läuft aus *ihrer* Ecke zur Brettmitte und bleibt dort
   (`fill: forwards`).
2. **Austeilen** (560 ms, um 16 ms je Karte versetzt), sobald `mischung`
   gestiegen ist: aus der Mitte auf den neuen Platz.

Kein CSS: Es sind vierundzwanzig verschiedene Strecken, die kein Stylesheet
kennt. Gemessen wird einmal je Hälfte.

### Erst abbrechen, dann messen — beide Male

Das ist die Regel, an der es einen halben Nachmittag gekostet hat.

Eine Bewegung mit `fill: forwards` hält die Karten dort fest, wo sie geendet
hat. **Läuft sie nicht zu Ende, kleben sie in der Mitte** — und genau das
passiert, wenn die Uhr der Animation stehenbleibt: beim gesperrten Telefon,
im Hintergrund-Tab, und im Sitzungsbrowser, der gar nicht zeichnet
(`currentTime` blieb dort auf 0 stehen).

Die nächste Messung bekäme dann für **jede** Karte die Mitte, jede Strecke
wäre null, und das Zusammenschieben sähe aus wie bloßes Schrumpfen. Genau so
ist es aufgefallen: Die Zielbilder der Bewegung standen alle auf
`translate(-7.6e-06px, 0px)`.

Deshalb bricht **jede** der beiden Hälften zuerst alle laufenden Bewegungen
ab und misst erst danach. Und das Zusammenschieben räumt sich beim Beenden
selbst weg — sonst blieben die Karten für immer in der Mitte, wenn die neue
Lage nie ankommt (Verbindung weg).

**Nachgemessen** mit von Hand gestellter Uhr (`animation.currentTime`, weil
der Sitzungsbrowser keine laufen lässt): Am Ende des Zusammenschiebens sitzen
alle Stichproben exakt auf der Brettmitte, am Anfang auf ihren eigenen
Plätzen.

Wer `prefers-reduced-motion` gesetzt hat, bekommt beide Hälften gar nicht —
das Brett liegt einfach neu.

---

## 4 — Die Töpfe bei der Online-Suche

Der Knopf „Online Match suchen…" sucht nicht mehr selbst. Er führt auf einen
Bildschirm (`OnlineMatch.tsx`), auf dem man wählt: **einer, zwei oder drei
Gegner**. Gesucht wird ausschließlich unter Tischen mit **genau dieser**
Platzzahl — ohne den Vergleich landete, wer zu viert spielen will, am
erstbesten Zweiertisch, und der startete sofort.

Dasselbe gilt für die Auflösung des Wettrennens (zwei Leute tippen
gleichzeitig auf Suchen und machen je einen Tisch auf): Gewechselt wird nur
in den **eigenen** Topf.

Neben jeder Zeile steht, wie viele Tische dort gerade offen sind. Ohne die
Zahl wählt man zu viert und wartet, ohne je zu erfahren, dass dort niemand
ist — auf einer Plattform mit einer Handvoll Leuten der Normalfall. Ein
Strich heißt nicht „geht nicht", sondern „du machst den ersten auf".

### „Mit Bots auffüllen"

Im Wartebereich, und **nur an Tischen für drei oder vier**. Zu zweit gibt es
dafür schon „Gegen die KI spielen" im Menü; an einem Vierertisch dagegen ist
das Warten der Regelfall, und ohne diesen Knopf sähe man nur zu, wie nichts
passiert.

Er belegt jeden freien Platz über `addBot` — denselben Weg nimmt der
Wartebereich der anderen Spiele auch. Diese Bots haben **keine Stufe**: Sie
stehen nicht in `config.botStufen` und spielen deshalb den zufälligen
Plattform-Bot ohne Gedächtnis. Wer starke Gegner will, nimmt den KI-Knopf im
Menü.

---

## 5 — Was das Modul dafür bekommen hat

| Was | Wo |
| --- | --- |
| `SEAT_COUNTS = [2, 3, 4]` | `regeln.ts` |
| `vorrat`, `mischung` im Zustand | `partie.ts` |
| `Pause` mit `mischen`, `mischeNeu()`, `nachschubMenge()` | `partie.ts` |
| Reihum statt hin und her (`naechsterSitz`) | `partie.ts` |
| `vorrat`, `mischung` in der Sicht | `sicht.ts` |
| Snapshot-Version 3, verträglich zu 1 und 2 | `adapter.ts` |
| Protokollversion 4 | `adapter.ts`, `client/src/protocol.ts` |
| Tests | `test/nachschub.test.ts` (10) |

**`naechsterSitz` war vorher `gegner`** und suchte den ersten Sitz, der nicht
man selbst ist. Zu zweit ist das dasselbe; zu dritt bekäme Sitz 2 nie einen
Zug.

**Die Snapshot-Version durfte nur steigen, weil `deserialize` die alten
weiterhin annimmt** (1 und 2) und die neuen Felder ergänzt — leerer Stapel,
Mischzahl null. Beides stimmt für jede Partie, die es vorher gab: Sie sind
alle zu zweit. Ohne diese Nachsicht bräche der Deploy jede laufende Partie.
