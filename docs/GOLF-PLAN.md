# Golf — Minigolf für 1–8 Spieler, live und gleichzeitig

Stand: 6. September 2026. Gebaut in einer Sitzung auf `staging`. Dieses Blatt
sagt, wie das Spiel gebaut ist und woran man sich beim Ändern stößt; die
Regeln des Spiels stehen als Kommentare im Code.

## Was es ist

Minigolf aus der Vogelperspektive. Jeder hat einen Ball in seiner Farbe, alle
schlagen gleichzeitig auf derselben Bahn, Bälle stoßen sich gegenseitig weg.
Gezielt wird, indem man auf den eigenen Ball drückt und zieht; der Ball fliegt
entgegen der Zugrichtung. Ein Match hat 2–15 Löcher (Regler in der Lobby),
gespielt wird auf 40 Bahnen in fünf Schwierigkeitsstufen mit neun Arten von
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
  ≤ Schlaglimit) laufen als Vitest über alle 40. Eine Bahn, die der Bot nicht
  schafft, wird umgebaut, nicht der Test gelockert.

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
- **Ausgabe ist Quelltext für den Katalog** (und JSON zum Weitergeben). Heute
  als Eintrag für die Sammeldateien — hinten anhängen, die Reihenfolge ist dort
  noch Teil des Determinismus —, die Beschreibung wird zum Kommentar darüber.
  Für `feature/golf-bahnen-als-daten` gibt es schon die Form „eine Datei je
  Bahn" samt Zeile für den Modulkatalog und den freien Angaben
  (`beschreibung`, `thema`, `autor`, `tags`).
- **Nicht im Betriebspaket.** `vite build` baut nur `index.html`; die
  Begründung steht in `packages/client/bahnwerkstatt.html`.
