# Golf — Minigolf für 1–8 Spieler, live und gleichzeitig

Stand: 6. September 2026. Gebaut in einer Sitzung auf `staging`. Dieses Blatt
sagt, wie das Spiel gebaut ist und woran man sich beim Ändern stößt; die
Regeln des Spiels stehen als Kommentare im Code.

## Was es ist

Minigolf aus der Vogelperspektive. Jeder hat einen Ball in seiner Farbe, alle
schlagen gleichzeitig auf derselben Bahn, Bälle stoßen sich gegenseitig weg.
Gezielt wird, indem man auf den eigenen Ball drückt und zieht; der Ball fliegt
entgegen der Zugrichtung. Ein Match hat 2–15 Löcher (Regler in der Lobby),
gespielt wird auf 60 Bahnen in fünf Schwierigkeitsstufen mit neun Arten von
Effektflächen (Beschleuniger, Sand, Eis, Wasser, Portal, Bumper, Strudel,
Sprungfeld, Drehkreuz). Wer am Ende die wenigsten Schläge hat, gewinnt.

## Wie es gebaut ist — Gleichschritt mit Rückspulen

Golf ist nach Feldherr die zweite Echtzeitgattung im Haus und geht denselben
Weg B aus `docs/FELDHERR-PLAN.md`: **Der Server rechnet keine Physik.** Das
Modul `packages/game-golf` verwahrt Saatkorn, Bot-Sitze, die Zugliste (jeder
Schlag mit Takt, Richtung, Kraft), Ausstiege und die Ergebnismeldungen. Alle
Geräte simulieren dieselbe Partie deterministisch aus Saatkorn und Zugliste.

Der Unterschied zu Feldherr: **Niemand wartet auf den Langsamsten.** Feldherr
rechnet nur bis zur Wissensgrenze (letzter gemeldeter Gegnertakt); bei acht
Spielern am Handy hieße das, dass ein verdeckter Tab alle anderen einfriert.
Golf läuft stattdessen mit der Wanduhr, und ein Schlag, der mit einem Takt in
der Vergangenheit ankommt, wird **zurückgespult**: Sprung zum Schnappschuss vor
diesem Takt, alle Ereignisse ab dort in kanonischer Reihenfolge (Takt, Sitz,
Laufnummer) neu anwenden, bis zur Gegenwart neu rechnen. Der Zustand sind acht
Bälle, ein Schnappschuss wiegt 2,3 kB, ein Rücksprung um 200 Takte kostet
2 ms (gemessen, `golf-bench` im Sitzungs-Scratchpad). Der Motor dafür ist
`packages/client/src/minispiele/golf/gleichschritt.ts`; die Physik liegt in
`physik.ts`, die Bots in `bot.ts`, die Bahnen unter `karten/` (eine Datei je Bahn, die Folge einer Partie zieht das Modul — siehe unten).

**Determinismus in JavaScript** ist die Bedingung für alles: In der Simulation
gibt es nur `+ - * /` und `Math.sqrt` (IEEE-genau). `Math.sin`, `cos`, `atan2`,
`pow`, `hypot` können zwischen Safari und V8 in der letzten Stelle abweichen,
und jede Abweichung läuft über Kollisionen auseinander — deshalb sind
Richtungen Einheitsvektoren, die der Client auf vier Stellen rundet und
mitschickt, und Drehungen kommen aus quantisierten Tabellen (`zufall.ts`).
Zufall nur aus mulberry32 mit dem Saatkorn; Deko-Zufall (Partikel) ist
getrennt und ungeseedet.

**Bots leben in der Simulation, nicht im Server.** Jedes Gerät berechnet
Bot-Schläge deterministisch zum selben Takt; über die Leitung geht dafür
nichts. `currentActor` ist immer null, `legalActions` leer, `botAction` wird
nie aufgerufen (liefert `nichts`, das `act` unverändert zurückgibt).

**Was die Bots von den Zonen wissen (Stand 22.09.2026).** Sand und Eis
rechnet `kraftFuerStrecke` Bahn für Bahn mit (seit #188), Wasser und Portale
kennen Sichtlinie und Wegfeld. Die anderen fünf Arten hielt der Bot bis zum
22.09. für Rasen. Jetzt gilt: Liegt ein **Beschleuniger, Drehkreuz, Strudel
oder Sprungfeld** am geplanten Weg, probt der Bot — er rechnet den Schlag mit
`schritt` auf einer Kopie mit nur seinem Ball bis zur Ruhe durch (drei
Kraftstufen, dann zwei Richtungsversätze; ab „experte" abwärts je fünf
gestreute Proben, der Anfänger probt nicht) und nimmt einen anderen als den
geplanten Schlag nur, wenn die Probe ihn besser bewertet. Das Drehkreuz steht
dabei in genau der Stellung dieses Takts; das ist das ganze Timing. Dazu
versperrt ein **Bumper** Sichtlinie und Wegfeld wie eine runde Wand, und im
Kreis eines Drehkreuzes kostet ein Rasterschritt 3 statt 1 (Dijkstra mit
Eimern; der Anfänger behält das alte Feld). Den Anlass und die verworfenen
Wege — eine Kraftrechnung in der Ebene (k04 1,00 → 2,75: die Suche fand die
Kante, an der der Schub den Ball ganz durchträgt), der Bumper in der Probe,
Sprungfelder als Wegfeld-Kanten — beschreibt der Kommentar an `PROBE_ARTEN`
in `bot.ts`. Gemessen mit `werkzeug/golf-botprobe.ts` (20 Saaten, Schläge,
vorher → nachher):

| Stufe     | alle 40     | Beschl. (7) | Drehkreuz (7) | Strudel (7) | Sprung (5) | Bumper (8) |
|-----------|-------------|-------------|---------------|-------------|------------|------------|
| genie     | 2,44 → 2,28 | 2,07 → 1,94 | 3,59 → 3,09   | 2,64 → 2,39 | 2,52 → 2,38 | 1,76 → 1,76 |
| experte   | 2,74 → 2,59 | 2,24 → 2,05 | 3,79 → 3,36   | 2,81 → 2,70 | 2,50 → 2,41 | 2,29 → 2,18 |
| standard  | 3,26 → 3,08 | 2,85 → 2,68 | 4,30 → 3,76   | 3,43 → 3,31 | 2,94 → 2,84 | 2,90 → 2,71 |
| anfaenger | 3,91 → 3,88 | 3,41 → 3,41 | 4,65 → 4,58   | 4,09 → 4,09 | 3,66 → 3,66 | 3,89 → 3,74 |

Einlochquote Genie 99,4 → 100 %. Die großen Sprünge: k39 (Drehkreuzgasse)
Genie 6,10 / 80 % → 2,85 / 100 %, k12 2,90 → 2,00, k08 2,30 → 1,20. Drei
Zeilen stehen in der 20-Saaten-Messung einen Lauf schlechter (k15 Standard,
k37 Experte, k32 Anfänger); über 100 bis 400 Saaten nachgemessen ist keine
davon schlechter. Kosten einer Entscheidung auf den Zonenbahnen (Desktop,
Node): Median 0,03 ms wie vorher, p90 bis 1,3 ms, p99 bis 3,3 ms statt
0,1 bis 2,8 ms — auf dem Handy mehrfach. `--vergleich` der Botprobe zeigt je
Bahn, was eine Änderung am Bot verschlechtert; das ist die Messlatte.

**Abschlag und Geister:** Alle Bälle starten auf demselben Punkt und sind
bis zu ihrem ersten Schlag Geister — sie stoßen nichts und werden nicht
gestoßen. Nach jedem Zurücksetzen (Wasser, Flug in einen Block) gilt das
wieder bis zum nächsten Schlag, weil auf der Ruhelage inzwischen ein anderer
liegen kann. Gezielt wird von überall auf dem Bildschirm: Tippen, ziehen, die
Richtung ist relativ zum Startpunkt des Fingers. Die Kraft wird in
Bildschirmpixeln mit dem Maßstab beim Antippen gemessen — nicht in
Welteinheiten des aktuellen Blicks, denn der Zoom beim Ausholen vergrößerte
sonst jeden Millimeter Zug und trieb die Kraft in einer Rückkopplung sofort auf
100 %.

**Uhrabgleich** über das Takt-Relais des Gateways (wie Feldherr, nur ohne
Prüfsummen): alle 250 ms schickt jedes Gerät seinen Takt, wer einen größeren
sieht, springt vor — nie zurück. Eigene Schläge werden mit zwei Takten Vorlauf
(100 ms) gemeldet und lokal sofort eingeplant.

**Ergebnis:** Am Ende meldet jedes menschliche Gerät die Schlagzahlen aller
Sitze mit einer Prüfsumme. Stimmen alle überein, gilt das Ergebnis; sonst die
größte Gruppe gleicher Prüfsummen, wenn sie mehr als die Hälfte stellt, sonst
ist die Partie strittig (alle Platz 1, keine Trophäen). Das Sicherheitsnetz ist
die Schaupause: Sechs Minuten ohne Schlag oder Meldung schließt der Server mit
dem ab, was vorliegt (`interludeMs`/`advanceInterlude` — die Plattform fragt
sie, weil `currentActor` null ist; `plattform-invarianten.test.ts` verlangt das
sogar).

**Ausstieg und Trödel:** Ein Ausstieg (`markLeft`, `aufgabe`) wird im Modul
an die Zuglänge geheftet (`abZug`), der Client macht daraus ein Ereignis am
Takt des letzten davor bekannten Zugs — deterministisch für alle. Ab dort ist
der Sitz fertig (Schlaglimit+1), sein Ball bleibt im laufenden Loch liegen.
Weil die Plattform Abwesende erst nach fünf Minuten abmeldet, gibt es die
Trödel-Regel: Sind alle anderen MENSCHEN fertig, hat der Letzte 25 Sekunden je
Schlag, sonst zählt das Loch als Schlaglimit+1. Bots zählen dabei nicht als
Wartende — sonst wäre die Regel am Bot-Tisch nur eine Schlaguhr für den
einzigen, der Zeit brauchen darf; dort deckelt allein das Zeitlimit des Lochs.

**Verdeckter Tab:** `requestAnimationFrame` feuert dort nicht. Die Bildschleife
in `Golf.tsx` trennt deshalb Rechnen (Takte nachholen, Ende melden, HUD) vom
Malen, und ein Zeitgeber alle 250 ms übernimmt das Rechnen, sobald 300 ms
lang kein Bild kam. Ohne ihn bliebe die Partie im Hintergrund stehen, und wer
beim Matchende gerade in einer anderen App war, meldete sein Ergebnis nie.
Gemalt wird im Verborgenen nicht, und auch die Kamera bewegt sich erst wieder
mit dem ersten Bild — getippt wird ohnehin nur, wenn man hinsieht.

## Was an der Plattform dafür geändert wurde

- `schrumpfeAufBesetzte` (Sofortstart) nimmt eine Rundenzahl entgegen (die
  Löcher werden erst in der Lobby gewählt) und lässt EINEN Besetzten zu, wenn
  das Modul laut `seatCounts` allein spielbar ist. Nachricht `startNow` hat
  dafür ein optionales `rounds`, `useTable.startNow(rounds?)` reicht es durch.
- `PLACEMENT_TROPHIES` kennt jetzt sieben und acht Sitze (Abstand 6, Nullsumme).

## Lobby-Modell

„Online spielen" tritt der offenen Gruppe bei: der erste wartende Golf-Tisch
mit freiem Platz, sonst wird einer mit acht Sitzen angelegt. Die Lobby zeigt
alle Anwesenden mit Name, Farbe und Ball; Sitz 0 wählt die Löcher und startet
mit den Anwesenden. „Gegen Bots" legt einen Tisch mit 1 + n Sitzen und
`fillWithBots` an. Die Mitspielersuche (`suche/`) nutzt Golf bewusst nicht.

**Farbwahl (seit 07.09.2026).** Ein Tipp auf den eigenen Namen schaltet die
Ballfarbe weiter — sechzehn Farben stehen bereit (`minispiele/golf/farben.ts`),
doppelt so viele wie Sitze, sonst wäre jede Wahl nur ein Tausch. Der Weg ist
plattformweit und nicht Golf-eigen: Der Client schickt `setSeatColor` mit einer
ZAHL, der Server legt sie als Wunsch je KONTO in `gameTable.filters.sitzfarben`
ab (kein Migrationsbedarf, wie die Bot-Stufe) und liefert sie als
`SeatInfo.farbe` aus. Am Konto und nicht am Sitzindex, weil
`schrumpfeAufBesetzte` beim Sofortstart umnummeriert.

**Doppelfrei wird es erst im Client.** Der Server prüft einen Wunsch bewusst
NICHT gegen die anderen Sitze: Zwei Tipps im selben Moment wären ein Wettlauf,
und der Verlierer stünde ohne Rückmeldung da. Stattdessen rechnet `farbtafel`
(rein, geprüft in `farben.test.ts`) aus allen Wünschen dieselbe Verteilung —
auf jedem Gerät gleich, weil jedes dieselben Wünsche in derselben
Sitzreihenfolge sieht. Das Menü zeigt weiterhin acht Bälle, zieht sie aber je
Aufbau zufällig aus allen sechzehn (`zieheFarben`).

**Bahnauswahl (seit 22.09.2026).** Robins Entscheidung: benannte Kurse UND
Filter nach Schwierigkeit/Thema UND freie Einzelauswahl. Die Wahl ist eine
Tisch-Eigenschaft und steht im Regelsatz — `GolfRegeln` trägt höchstens
eines von `kurs`, `filter {schwierigkeit, thema}`, `bahnen`, dazu `variante`
für die Tischliste. Die Folge zieht weiter allein das Modul
(`waehleBahnen` mit dem Regelsatz): ein Kurs spielt seine Liste, eine
Einzelauswahl ihre Reihenfolge, ein Filter die gewohnte Ziehung mit Rampe über
die passenden Stufen — reichen die Treffer nicht, wird mit ähnlich schweren
aufgefüllt, passt keine, wird aus allen gezogen. Ohne Wahl ist die Rechnung
Wort für Wort die alte. Kurse (sieben, 6–9 Bahnen) und die Themen je Bahn
(= Zonenarten) stehen in `packages/game-golf/src/kurse.ts`; der Vertrag
`vertrag/golf-kurse.test.ts` rechnet die Themen aus den Geometrien nach.
**Eine neue Bahn braucht deshalb eine dritte Zeile:** ihre Themen in
`BAHN_THEMEN`.

Weil ein Online-Tisch VOR der Wahl entsteht, darf Sitz 0 den Regelsatz eines
wartenden Tisches ersetzen (`setRules` → `setzeTischregeln`), nur bei
Modulen mit `meta.regelnInDerLobby`. Die Tischnachricht trägt den
`regelstand`; ändert er sich, holen alle den Regelsatz neu und sehen die
Wahl. Kurse und Themen bekommt der Bildschirm über `lobbyDaten` des Moduls
(`/api/games/golf/defaults` → `lobby`), statt sie abzuschreiben — nur der
Name der Wahl (`varianteFuer`) steht doppelt, weil die Lobby ihn in den
Regelsatz schreibt. Eine wartende Wahl geht vor dem Start raus
(`bereitZumStart`); die Nachrichten einer Verbindung arbeitet der Server der
Reihe nach ab. Die Sicht ist unverändert, deshalb keine neue
Protokollversion.

## Woran man sich stößt

- **`zustand()` und `vorher()` des Gleichschritts sind lebende Objekte.** Der
  Zeichner interpoliert zwischen beiden; wer eines verändert, verändert die
  Simulation und damit das Ergebnis aller anderen Geräte.
- **Die Bahnfolge zieht das Modul, nicht das Gerät (seit 22.09.2026).** Bis
  dahin zog `waehleKarten` im Client Indizes aus der Saat gegen den eigenen
  Katalog — jede neue Bahn musste hinten angehängt werden, und jede Änderung
  am Katalog war ein Protokollbruch. Jetzt zieht `waehleBahnen`
  (`packages/game-golf/src/bahnen.ts`) die Folge EINMAL in `erzeugePartie`,
  mit derselben Rampe und derselben Rechnung wie vorher (über 6.006
  Saat/Lochzahl-Paare verglichen: gleich), und die Sicht liefert sie als
  Kennungen (`bahnen`). Der Client löst sie gegen `karten/` auf; kennt er
  eine nicht, ist er zu alt und zeigt „Neue Bahnen — bitte neu laden", statt
  eine andere Partie zu rechnen. Ein Schnappschuss ohne `bahnen` (von davor)
  bekommt die Folge beim Laden nachgezogen.
- **Eine neue Bahn ist eine Datei und eine Zeile, kein Protokollbruch:**
  eine Datei `karten/kNN-name.ts` mit `export const bahn` (eingesammelt per
  `import.meta.glob`, kein Index zu pflegen) und eine Zeile Kennung +
  Schwierigkeit in `BAHNEN_KATALOG` des Moduls, an ihrer Nummer einsortiert.
  `vertrag/golf-bahnen.test.ts` wird rot, wenn eine Hälfte fehlt. Zwei Pull
  Requests mit je einer neuen Bahn berühren im Client verschiedene Dateien und
  im Modul verschiedene Zeilen. Neue Partien können die neue Bahn ziehen, die
  Folge anderer Saaten verschiebt sich dadurch — laufende Partien nicht, ihre
  Folge steht im Zustand. Erst wenn sich die Bahnwahl selbst (Rampe,
  Mischung) ändern soll, ist das eine Frage für alte Schnappschüsse.
- **Jede Physikänderung ist ein Protokollbruch** für laufende Partien: Zwei
  Geräte mit verschiedener Physik rechnen aus derselben Zugliste verschiedene
  Ergebnisse. Deshalb `GOLF_MODULE_VERSION` erhöhen, wenn sich `physik.ts`
  oder `bot.ts` ändert — oder die GEOMETRIE einer vorhandenen Bahn: Zwei
  Stände mit derselben Kennung und verschiedener Wand rechnen verschiedene
  Partien. Eine Bahn umbauen heißt deshalb besser: neue Kennung, alte Datei
  weg.
- **Bahnen prüfen, nicht anschauen:** `pruefeKarte` (Form, Abstände,
  Erreichbarkeit per Wegfeld) und `botLoestKarte` (Genie-Bot schafft sie in
  ≤ Schlaglimit) laufen als Vitest über alle. Eine Bahn, die der Bot nicht
  schafft, wird umgebaut, nicht der Test gelockert.
- **Ein Strudel schiebt nur fünf Sekunden (seit 23.09.2026, Version 7).**
  Der Drall eines Strudels ist eine Kraft quer zum Radius und leistet am
  kreisenden Ball Arbeit. Bei schwachen Strudeln (r 1,5 bis Stärke 15, r 2
  bis Stärke 20) gab es einen Kreis, auf dem sie die Reibung genau aufwog:
  Der Ball drehte dort für immer, ruhte nie, und sein Spieler durfte bis zum
  Zeitlimit nicht schlagen — live auf k08 (Auswurf), k20, k25, k28, k34,
  k38 (gefunden am 22.09.2026 beim Bau von k41–k60).
  Gemessen, nicht vermutet: r 1,5 / Stärke 12 hält d 0,85 und v 2,11 über
  500 Takte, Drall +6,57 gegen Reibung −6,57 E²/s³. Seitdem zählt jeder Ball
  `strudelTakte` (Takte in Strudeln seit er zuletzt lag); ab
  `STRUDEL_SOG_TAKTE` = 100 lenkt der Drall nur noch, das Tempo kommt aus der
  Energiebilanz im Trichter, der Ball rollt dort wie auf Rasen und sinkt zur
  Mitte. Bis zur Schwelle rechnet der Strudel wie vorher — jeder Ball, der
  nicht festhing, rollt Takt für Takt gleich, auch die Schleudern auf k41–k60
  (längster Lauf dort 88 Takte). Ein Auswurf legt den Ball am `ziel` ab, statt
  ihn weiterrollen zu lassen. `strudel.test.ts` läuft jeden Strudel des
  Katalogs bis zu 560-mal an und verlangt: höchstens 200 Takte rollend im
  Strudel, und er fängt. Wer eine Bahn baut, die dort rot wird, baut den Strudel um.
  Starke Strudel (r 1,5 / Stärke 25, r 2 / Stärke 30) werfen einen Ball
  weiterhin eher hinaus, als dass sie ihn fangen — das ist ihr Charakter,
  nicht der Fehler; `karten/k51-k60.test.ts` hält fest, dass die Strudel
  der neuen Bahnen keinen Ball kreisen lassen. Die Messwerkzeuge liegen in
  `golf-strudel-lauf/` im Prüfordner.
- **Wer Bahnen hinzufügt, verschiebt die Folge neuer Partien — aber nicht die
  alter Schnappschüsse.** Ein Schnappschuss von vor dem 22.09.2026 hat kein
  `bahnen` und bekommt die Folge beim Laden nachgezogen, und zwar gegen
  `KATALOG_BIS_K40` (bahnen.ts), den Katalog, den seine Geräte damals
  kannten. Mit dem ganzen Katalog zöge dieselbe Saat seit k41 andere Bahnen.
  Die festen Folgen in `bahnen.test.ts` rechnen deshalb gegen diese Liste.
  Die Rampe prüft derselbe Test mit dem echten Katalog: Solange jede Stufe
  mindestens drei Bahnen hat, trifft bei jeder Lochzahl bis 15 jedes Loch
  genau seine Sollstufe.

## Bahnwerkstatt (seit 22.09.2026)

Robins Entscheidung vom 22.09.2026: „viel mehr Maps" kommen aus einem Editor
fürs Team statt aus handgeschriebenen Objekten. Die Werkstatt ist eine eigene
Seite neben der App wie der Schaukasten der Partykiste — `npm run dev:client`,
dann <http://localhost:5173/bahnwerkstatt.html>. Quelle unter
`packages/client/src/werkstatt/golf/`.

- **Sie urteilt mit dem Spiel, nicht neben ihm.** Gezeichnet wird mit dem
  `Zeichner`, angespielt mit `physik.ts` und dem Zielen aus `eingabe.ts`,
  geprüft mit `pruefeKarte` und `botLoestKarte` — alles importiert, nichts
  nachgebaut. Zusätzlich meldet sie, was nur die Katalogtests verlangen
  (Genie-Bot in höchstens `par + 2`), damit eine Bahn nicht erst im Pull
  Request rot wird.
- **Jeder Handgriff erzeugt ein neues Kartenobjekt.** Segmente, Zonengruppen
  und Wegfeld hängen je Objekt im Zwischenspeicher; wer eine Bahn an Ort und
  Stelle ändert, prüft die alten Wände. Die Werkstatt leert beide Speicher vor
  jeder Prüfung (`vergissSegmente`, `vergissWegfelder`), sonst wüchsen sie mit
  jeder Mausbewegung.
- **Ausgabe ist eine Datei je Bahn** (`karten/<kennung>.ts`, `export const
  bahn`, mit `beschreibung`/`thema`/`autor`/`tags`), dazu — für eine neue
  Kennung — die Zeile für `BAHNEN_KATALOG` im Modul. JSON zum Weitergeben gibt
  es daneben, das nackte Objekt der alten Sammeldateien nur noch zum
  Vergleichen.
- **Eine vorhandene Bahn wird nicht umgebaut.** Trägt die Bahn die Kennung
  einer Katalogbahn, rollt aber anders (Maße, Limits, Loch, Wände, Zonen,
  Abschlag 0), warnt die Werkstatt, dass das laufende Partien bricht, und ist
  nicht „katalogreif". Der Knopf daneben vergibt eine neue Kennung; die alte
  Datei und ihre Katalogzeile gehören im selben Pull Request entfernt.
- **Nicht im Betriebspaket.** `vite build` baut nur `index.html`; die
  Begründung steht in `packages/client/bahnwerkstatt.html`.

## Fun-Modus (seit 23.09.2026)

Robins Entscheidung vom 22.09.2026: neben dem fairen klassischen Golf ein
Fun-Modus als eigene Regeloption (`GolfRegeln.modus: 'klassisch' | 'fun'`,
`packages/game-golf/src/modus.ts`) — mit Wind, Wetter und Roulette je Loch
(Teil 1), Power-ups (Teil 2) und Störschlägen (Teil 3). Ausdrücklich nicht:
verrückte Bälle und wandernde Wände.

- **Das Modul kennt nur den Namen.** Die Sicht trägt `modus`; welcher
  Modifikator an welchem Loch gilt, zieht jedes Gerät selbst, rein aus Saat
  und Lochindex (`modifikatorenFuerLoch` in `minispiele/golf/modifikator.ts`)
  — eine gemischte Trommel je sieben Löcher, nie zweimal derselbe
  hintereinander. Kein Zustand, damit das Replay und ein neu ladendes Gerät
  auf dasselbe kommen. Die Reihenfolge von `ROULETTE` ist Determinismus.
- **Wo ein Loch seine Modifikatoren trägt:** `Partiezustand.aktuell.mod`
  (`Lochmodifikatoren`, unveränderlich, von `kopiere` flach mitgenommen).
  Teil 2 hängt seine Felder dort an; was sich IM Loch ändert, gehört an den
  Ball und in `kopiere`.
- **Physik und Bots lesen `physikwerte(mod, karte)`**, nicht mehr die
  Konstanten. Im klassischen Modus kommt `KLASSISCHE_WERTE` selbst zurück —
  dieselben Zahlen in derselben Rechnung; `klassisch-gold.test.ts` hasht vier
  klassische Partien Takt für Takt als rohe Gleitkommabytes gegen Sollwerte,
  die vor dem Umbau gemessen wurden. Die Bots erkennen den klassischen Satz
  am Zeiger und nehmen dann den alten Weg über die Rasentabelle.
- **Die sieben Modifikatoren und ihre Fallen:** Wind (Karten-Feld
  `wind?: {rx, ry, staerke}`, schiebt nur rollende Bälle und nie stärker als
  0,95 × Rollreibung — sonst käme ein Ball nie zur Ruhe), Regen (Reibung
  × 0,5), Riesenball (Radius × 1,5), Miniball (Radius × 0,625 mit doppelt so
  vielen Unterschritten, sonst tunnelt er), Gummiwände (Abprall × 1,4, aber
  der Betrag wird gedeckelt: über 1 schaukelte sich ein Ball zwischen zwei
  nahen Wänden auf), Zeitlupe (halber Zeitschritt, Flug/Portalsperre/
  Zeitlimit doppelt), Schwerelos (Reibung × 0,25, Flug × 1,5; ein Sprungfeld
  wirft nur vorwärts und mit einem Viertel Mindesttempo — sonst 0 % auf k07
  und k38).
- **Bots:** `kraftFuerStrecke` rechnet mit den Physikwerten, im Wind hält
  `zielImWind` quer vor. Sichtlinie und Wegfeld rechnen mit dem Radius des
  Balls, aber nie kleiner als dem klassischen (`planRadius`: mit 0,2 E zielte
  der Bot auf Linien, die ihm jede Streuung verdarb). Das Wegfeld gibt es je
  Radius; für andere Radien sperrt es zusätzlich Rasterpunkte IN Wänden.
  Gemessen mit `golf-botprobe.ts --modifikator alle --kosten`.
- **Wahl:** im Menü „Gegen Bots" und in der Gruppe (`ModusWahl` in
  `FunAnsage.tsx`; online über `setRules` von Sitz 0 im selben Regelsatz wie
  die Bahnwahl, alle anderen sehen `ModusAnzeige`). Das Replay rechnet
  Fun-Löcher mit ihrem Modifikator nach (`ReplayEingabe.modus`). Eine
  Bestleistung je Bahn gibt es im Fun-Modus nicht (`zaehltFuerBestleistung`
  in bestleistung.ts fragt `modusVon`).
- **Power-ups (Teil 2, seit 23.09.2026, Version 8):** Turbo (Anfangstempo
  × 1,6), Magnet (im letzten Drittel der Rollstrecke zieht das Loch im
  Umkreis von 5 E), Geisterball (durch Wände und Drehkreuze, nicht durch
  Wasser, nicht aus dem Rahmen), Schild (der nächste Stoß eines fremden
  Balls gegen den LIEGENDEN Träger prallt ab). Quelle `powerup.ts`. Je
  Fun-Loch 2–4 Felder, jede Art höchstens einmal, rein aus Saat, Loch und
  Bahn (`powerupsFuerLoch`, auf den Rasterpunkten des Wegfelds mit Abstand
  zu Wand, Loch, Abschlag und jeder Zone außer Sand und Eis). Sie hängen an
  `Lochmodifikatoren.powerups` und stehen **nicht** in `Karte.zonen` — die
  Bahnen, die Werkstatt und die Bahnprüfung kennen keine zehnte Zonenart.
  Was sich im Loch ändert, reist mit `kopiere`: `Lochstand.felderWeg`
  (Bitmaske der eingesammelten Felder), `Ball.halt` (eins zur Zeit, ein
  neues ersetzt das alte), `Ball.wirkung` (der laufende Schlag) und
  `Ball.schlagTempo`. Einsammeln ist Physik, der Server weiß nichts davon.
- **Die Halte-Mechanik** (`EINSATZ` je Art): `'schlag'` wirkt mit dem
  nächsten eigenen Schlag von selbst (`wendeSchlagAn` macht aus `halt` die
  `wirkung`), `'passiv'` wartet auf einen Auslöser (Schild), `'ausloesen'`
  ist der Anschluss für Teil 3: Störschläge, die ein Spieler STATT eines
  Schlags auslöst — neue Art hinten an `POWERUPS`, eigenes Ereignis in
  physik.ts, Schild über `verbraucheSchild`.
- **Fallen der Power-ups:** Der Turbo-Ball rechnet in halben Unterschritten
  (`turboWerte`), sonst tunnelt er mit 0,45 E je Schritt durch Wände. Der
  Magnet macht den Ball nicht `getrieben` — hinter einer Wand bliebe er sonst
  nie liegen. Ein Geisterball, der IN einer Wand ausrollt, geht den Weg zur
  Stelle vor dem Schlag zurück, bis er frei liegt. Bots planen mit dem, was
  sie halten (Turbo: Kraft mit 1,6-facher Höchstkraft und weiterem Blick
  entlang der Kette; Geist: gerade aufs verbaute Loch, wenn nur Wände
  dazwischen liegen) und nehmen ein Feld mit, das nah an ihrem Weg liegt
  (`umwegUeberFeld`). Gemessen mit `werkzeug/golf-powerupprobe.ts`.
