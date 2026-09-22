# Partykiste

Ein Turnier aus zwölf Partyminispielen für **4 bis 12 Leute**, die im selben
Raum sitzen. Geredet wird am Tisch, der Bildschirm nimmt nur die Entscheidung
entgegen — deshalb braucht die Kiste, anders als Werwolf, keinen freien Text
zwischen den Sitzen und ist heute schon spielbar.

- Paket: `packages/game-partykiste`
- Bildschirm: `packages/client/src/screens/Partykiste.tsx`
- Ansichten: `packages/client/src/minispiele/partykiste/`
- Schaukasten (Entwicklung): `npm run dev:client` →
  <http://localhost:5173/schaukasten.html>

## Warum ein Modul und nicht sechs

Sechs Spiele wären sechs Einträge in der Spielauswahl, sechs Wartezimmer und
sechs Ranglisten. Auf einer Party heißt das sechsmal „Tisch suchen“, während
alle danebenstehen. Die Kiste ist deshalb **ein** Spiel: Man setzt sich
einmal hin, spielt 3 bis 15 Runden, und am Ende steht eine Tabelle.

Die Minispiele kommen reihum in der Reihenfolge, die im Regelsatz steht
(`minispiele`). Bewusst berechnet und nicht gewürfelt — „dreimal Quiz
hintereinander“ ist auf einer Party kein Zufall, sondern ein Fehler.

## Die zwölf Minispiele

| Minispiel | Ablauf | Punkte | Schlücke |
| --- | --- | --- | --- |
| **Imposter** | Alle sehen dasselbe Wort, einer ein ähnliches. Reihum ein Satz, dann Abstimmung. | Ehrliche mit richtiger Stimme +2; Imposter, der durchkommt, +4 | Enttarnter Imposter 3; kommt er durch, trinkt jeder Ehrliche 1 |
| **Allgemeinwissen** | Eine Frage, vier Antworten, alle tippen gleichzeitig. | richtig +2 | falsch 1 |
| **Wer bin ich** | Jeder sieht alle Namen außer dem eigenen. Reihum fragt einer die Runde aus. | erraten +3 | erraten → alle anderen 1; aufgegeben → selbst 2 |
| **Ich hab noch nie** | Zwei Knöpfe: „Hab ich“ oder „Noch nie“. | sauber geblieben +1 | gestanden 1 |
| **Wer würde eher** | Alle stimmen gleichzeitig für einen Mitspieler. | keine Stimme bekommen +1 | je Stimme 1 |
| **Bus fahren** | Reihum drei Tipps: Rot/Schwarz, höher/tiefer, innen/außen. Gleichstand zählt gegen den Fahrer. | je richtiger Tipp +1 | erster Fehlgriff 1, dann ist der Nächste dran |
| **Schätzen** | Eine Zahlenfrage, alle tippen eine Zahl. Wer nicht tippt, gilt als unendlich weit weg. | am nächsten dran +3 | am weitesten weg 2 |
| **Entweder – oder** | A oder B, alle gleichzeitig. | Mehrheit +1 | Minderheit 1; Gleichstand: alle 1 |
| **Wahrheit oder Pflicht** | Reihum: wählen, Aufgabe erscheint für alle, dann „Gemacht" oder „Gekniffen". | gemacht +2 | gekniffen 2 |
| **Kategorien-Battle** | Reihum im Kreis laut etwas aus der Kategorie nennen, bis einer stockt. Stocken meldet man selbst; Doppeln oder Zögern benennt die Mehrheit per Einspruch. | nicht verloren +1 (leergespielt: alle) | Verlierer 2 |
| **Mehrheitsraten** | Eine Frage, A oder B: jeder antwortet für sich **und** tippt, was die Mehrheit antwortet. | Mehrheit getroffen +2 | daneben 1; Gleichstand: alle 1 |
| **Regel-Karte** | Eine Regel („keine Vornamen") gilt bis zum Ende der übernächsten Runde — während der anderen Minispiele. Verstoß per Selbstmeldung oder Mehrheit. | ohne Verstoß durch die Geltung +1 | je Verstoß 1 |

## Tischoptionen

Der Regelsatz (`PartykisteRegeln` in `src/regeln.ts`), geprüft von
`validateConfig` in `src/adapter.ts` — die Prüfung meldet Unsinn als
`ConfigProblem` und wirft nie:

| Feld | Werte | Vorgabe | Wirkung |
| --- | --- | --- | --- |
| `minispiele` | Liste aus `MINISPIELE`, mindestens eins | alle zwölf | Reihenfolge im Turnier |
| `trinkmodus` | an/aus | an | nur die Anzeige der Gläser |
| `schluckFaktor` | 1–3 | 1 | Schlücke mal Faktor |
| `inhaltsHaerte` | 1 harmlos, 2 pikant, 3 derb | 1 | Obergrenze der Textschärfe |
| `paket` | `null` oder ein Paket aus `PAKETE` | `null` | Zielgruppe der Inhalte |

Der **Härtegrad** (`schluckFaktor`, 1 bis 3) nimmt alle Schlücke einer Runde
mal. Punkte bleiben unberührt: Die Rangliste darf nicht davon abhängen, wie
hart der Abend eingestellt ist.

Der **Trinkmodus** (`trinkmodus`) ändert den Ablauf nicht. Ein zweiter Ablauf
für „ohne Alkohol“ wäre ein zweites Regelwerk, das nie jemand testet. Gezählt
wird in beiden Modi; ausgeschaltet heißt der Zähler **Strafpunkte** statt
Schlücke, und die Ansagen reden nicht vom Trinken (`ansageFuer` im Client).
Ein 🍺 gibt es seit dem 22.09.2026 nirgends mehr, und **kein Inhaltstext
befiehlt das Trinken** — der Schluck kommt aus der Wertung, nicht aus dem
Text (`test/inhalte.test.ts` hält das über alle Kataloge fest).

**Einstellen** lassen sich Runden, Härte und Trinkmodus im Menü, für beide
Wege: Der Tischöffner stellt ein, auch online (`config` beim Anlegen). Wer
„Online spielen“ drückt und eine offene Runde findet, sieht deren Regelsatz
**vor** dem Beitritt und kann stattdessen eine eigene aufmachen. Der Regelsatz
(`trinkmodus`, `schluckFaktor`, `minispiele`) fährt in jeder Sicht mit und
steht als Regelzeile im Spielkopf; im Wartesaal kommt er von
`/tables/:id/rules`. Solange das Turnier läuft, hält der Bildschirm eine
Wake-Lock-Sperre, und reihum vibriert das Handy, wenn man dran ist
(`useTischwache`).

**Inhaltsstufe** (`inhaltsHaerte`, seit dem 22.09.2026, Entscheidung P1):
wie scharf die Texte sein dürfen — eine Obergrenze, ein derber Tisch bekommt
auch harmlose Sprüche. Sie heißt absichtlich **nicht** „Härte“: Der Regler
`schluckFaktor` steht im Bildschirm schon als „Härte“, und zwei Regler mit
demselben Namen — einer für Gläser, einer für Texte — stellt niemand richtig
ein. Im Bildschirm heißt die Stufe „harmlos / pikant / derb“.

**„Derb“ nur ohne Gast.** Ein Gastkonto entsteht mit einem Klick, ohne Mail
und ohne Altersangabe. Sitzt ein Gast am Tisch, kappt `erzeugePartie` die
Stufe auf „pikant“ (`INHALTS_HAERTE_GAST_MAX`). Das geschieht beim Start und
nicht in `validateConfig`, weil der Regelsatz beim Anlegen eingefroren wird
und der Gast sich oft erst danach setzt. Woher das Modul es weiß:
`CreatePartyOptions.gastSeats` (neu in game-api), gefüllt in
`packages/server/src/runtime/party.ts` mit derselben `gastSeit`-Abfrage wie
`countsForRanking`. Fehlt das Feld, nimmt das Modul die strenge Seite (kein
„derb“). Die eingestellte Stufe steht dann in `partie.inhaltsHaerteGewollt`,
damit der Bildschirm es sagen kann; `partie.regeln.inhaltsHaerte` ist immer
die wirksame. Zu laufenden Tischen setzt sich niemand mehr dazu
(`joinTable` verlangt `waiting`), die Kappung beim Start deckt also den
ganzen Abend.

**Offene Lücke:** „Verifiziert“ heißt hier nur „kein Gast“. Ein normales
Konto hat Mail und Passwort, aber die Mail ist nicht bestätigt, und eine
**Altersangabe gibt es nirgends** in der Datenbank. Wer „derb nur ab 18“
ernst meint, braucht ein Feld am Konto — das ist eine Plattformfrage, keine
der Kiste.

**Themenpaket** (`paket`, Entscheidung P3): eine Zielgruppe, kein Motto.
Pakete: `wg-abend`, `jga`, `weihnachten`, `studenten`, `arbeit`. Am
22.09.2026 trägt noch kein Inhalt ein Paket — ein Paket-Tisch spielt also
Allgemeingut, und jede Runde hält das fest (siehe unten).

**Auswahl im Menü** (seit dem 22.09.2026, `minispiele/partykiste/Auswahl.tsx`,
Logik in `wahl.ts`): Minispiele (mehrere, mindestens drei, in eigener
Reihenfolge — so kommen die Runden dran), Inhaltsstufe „harmlos / pikant /
derb“ unter der Überschrift **„Inhalte“** (nicht „Härte“, siehe oben),
Themenpaket („alles“ = `paket: null`) und — erst, wenn `defaultConfig()`
ein Feld `modus` hat — der Modus. Gemerkt in `localStorage`, gilt für
Bot- und Online-Tische. Der Regelsatz entsteht als **Vorgabe des Moduls**
(`useSpielVorgabe('partykiste')`), darauf Trinkmodus und Schluckfaktor,
darauf die Auswahl (`regelsatzAus`); was niemand gewählt hat, kommt aus
der Vorgabe. Die Minispielliste der Kacheln ist deshalb `MINISPIELE` des
Moduls, keine Abschrift — ein neues Minispiel steht ohne Änderung im Menü.
Wer alle in Modulreihenfolge wählt, dem wird nichts gemerkt, damit ein
neues Minispiel später von selbst dazukommt. Für einen Gast (`me.gast`) ist
„derb“ gesperrt („nur mit Konto“); die Kappung beim Start bleibt trotzdem
die eigentliche Sperre. Paketnamen, Modusnamen und „gleichzeitig/reihum“
sind Spiegelbilder, die `vertrag/partykiste-auswahl.test.ts` gegen
`PAKETE`, `istReihum` und `validateConfig` hält. `inhaltsHaerte` und
`paket` dürfen im Regelsatz weiterhin fehlen — ältere Tische kennen sie
nicht. In der Regelzeile stehen beide noch nicht: Die Sicht trägt sie nicht.

### Wie die Inhalte ausgewählt werden

Jede Ziehung geht durch **einen** Filter, `waehlbareInhalte` in
`src/inhalte/filter.ts`. Er lässt die Katalogreihenfolge stehen (gemischt
wird erst danach, mit dem Saatkorn — sonst zöge dieselbe Saat andere Fragen,
sobald irgendwo ein Eintrag ein Paket bekommt) und gibt stufenweise nach,
wenn weniger als `MINDESTMENGE` (10) Inhalte passen:

1. `paket` — nur Inhalte des Pakets
2. `paketUndAllgemein` — dazu Inhalte ohne Paket, aber nichts aus fremden Paketen
3. `ohnePaket` — Paket egal
4. `ohneMinSitze` — auch die Sitzgrenze fällt
5. `vollerKatalog` — letzter Halt; kommt nicht vor, solange jeder Katalog
   genug harmlose Einträge hat (ein Test hält das fest)

**Die Härte wird nie gelockert.** Gab die Auswahl nach, steht das in der
Runde als `inhaltsRueckfall` (`{ gewollt, genutzt, passend }`), sonst `null`.
Die Sicht reicht es noch nicht weiter — das ist Sache der Bildschirmarbeit.

**Wiederholungsschutz** (Entscheidung P8: große Kataloge, kein Gedächtnis
über Abende): Jeder Katalog wird je Partie **einmal** gemischt
(`rundenSaat(saat, 0, zweck)`), und die n-te Runde seiner Art nimmt die
n-te Stelle. Bis zum 22.09.2026 hielten sich zwei Spiele nicht daran: „Wer
bin ich“ mischte je Runde neu (derselbe Name konnte zweimal kommen), und bei
„Wahrheit oder Pflicht“ zog jeder Sitz einen eigenen Zufallsindex (zwei Sitze
konnten dieselbe Aufgabe bekommen). Jetzt nimmt „Wer bin ich“ je Runde die
nächsten `sitze` Namen, und bei W/P hat jeder Sitz in jeder Art einen festen
Platz im Stapel (`wievielte * sitze + sitz`). Ein Platz verfällt, wenn der
Sitz die andere Art wählt — dafür hängt die Stelle nicht an fremden Wahlen.
Wiederholt wird erst, wenn ein Stapel aufgebraucht ist (zu zwölft: nach elf
Runden „Wer bin ich“ bzw. fünf Runden W/P, alle derselben Art).

## Wertung

Gewertet wird das **ganze Turnier**: `standings` liefert die aufaddierten
Punkte, die Plattform rechnet daraus Trophäen (mehr Punkte = besserer Platz).
Die Schlücke stehen daneben und zählen **nicht** mit.

Die reinen Trinkrunden („Ich hab noch nie“, „Wer würde eher“) geben bewusst
nur einen Punkt. Bei „Ich hab noch nie“ kann man lügen und den Punkt
mitnehmen — deshalb darf er das Turnier nicht entscheiden.

## Was die Plattform dafür lernen musste

Die Partykiste ist das erste Spiel mit **mehr als acht Sitzen**. Daran hingen
drei Stellen außerhalb des Pakets:

- `packages/server/src/http/app.ts` — die Sitzgrenze beim Tisch-Anlegen stand
  auf 8, weil es kein Spiel mit mehr gab. Jetzt 12. Die eigentliche Prüfung
  macht ohnehin `validateConfig` des Moduls.
- `packages/server/src/trophies.ts` — `PLACEMENT_TROPHIES` kannte 2 bis 8
  Sitze und **wirft** ohne Eintrag. Jetzt bis 12, Abstand 6, Nullsumme und
  ganzzahlige Mittelwerte bei Gleichstand wie gehabt.
- Die Mitschnitt-Kennung in `diagnoseSchema` ließ Sitz 0 bis 7 zu.

## Besonderheiten für die nächste Änderung

**Sichtbarkeit ist das Spiel.** Das fremde Imposter-Wort und der eigene Name
aus „Wer bin ich“ werden nicht ausgeblendet, sondern gar nicht erst
verschickt (`src/sicht.ts`). Der Test `das Imposter-Wort steht in keiner
fremden Sicht` prüft das am JSON der Sicht, nicht an einzelnen Feldern — wer
ein Feld ergänzt, das das Wort mitführt, bricht ihn.

**Zwei Bauarten von Minispiel.** Vier laufen gleichzeitig (jeder Sitz handelt
einmal, `currentActor` nennt trotzdem den nächsten Offenen — der Kniff von
Eiland und Tafelrunde), zwei reihum. Alles, was von selbst weitergeht, steht
in `weiter()`; eine zweite Stelle, die den Ablauf schiebt, gibt es nicht.

**Der Bot kennt die Quizfragen.** Er schlägt sie über den Fragetext im
eigenen Katalog nach — das ist kein Blick in den Zustand, sondern
Allgemeinwissen aus dem Buchregal. Wie oft er das Gewusste auch antwortet,
hängt an der eingestellten Spielstärke; ein Anfänger-Bot weiß es und tippt
trotzdem daneben.

**Die Ergebnisphase wartet auf jeden Menschen — es gibt keine Uhr.** Bis zum
19.09.2026 war sie eine Schaupause von zwölf Sekunden; zu zwölft war die
vorbei, bevor die Hälfte gelesen hatte. Jetzt nennt `currentActor` den
nächsten Menschen, der noch nicht „Weiter“ getippt hat; Bots zählen als fertig.
Sicherheitsnetz ist die Zugzeit der Plattform, die das Modul auf **fünf
Minuten** hebt (`meta.zugzeitMs`, neu in game-api, nur verlängernd, gedeckelt
bei zehn) — danach tippt der Bot für den, der weg ist. Dieselben fünf Minuten
gelten für jeden Zug: Bei Imposter redet erst die Runde, dann wird gestimmt.

**Die drei ohne Uhr** (seit dem 22.09.2026, Robins Entscheidung „5+ neue
Minispiele"; Regeln in `src/ohne-uhr.ts`, Ansichten in
`minispiele/partykiste/RundenOhneUhr.tsx`, Inhalte in
`inhalte/kategorien.ts`, `mehrheit.ts`, `regelkarten.ts`):

- **Kategorien-Battle läuft reihum, aber im Kreis.** Es ist nicht
  `istReihum` (dort endet die Runde, wenn jeder einmal dran war), sondern hat
  in `amZug`/`weiter` einen eigenen Zweig. Die Runde endet durch „Gestockt",
  durch eine Mehrheit von Einsprüchen (gegen den, der dran ist, oder den, der
  eben genannt hat) oder nach `KATEGORIEN_RUNDEN_UM_DEN_TISCH` (4) Runden um
  den Tisch — dann ist die Kategorie leergespielt, alle bekommen den Punkt.
  Wer anfängt, wird aus der Saat gezogen.
- **Mehrheitsraten hat zwei Eingaben in einer Aktion** (`mehrheitstipp`:
  `eigene` und `tipp`). Mit nur einem Tipp wäre es Entweder-oder: Wer die
  Mehrheit tippt, bestimmt sie zugleich. Die Bots tippen auf die häufigere
  Antwort der **Bots** — sie können deren Antwort ausrechnen, weil sie nur an
  Sitz und Runde hängt (`eigeneMehrheitsAntwort` in `bot.ts`), nicht an
  einem Blick in den Zustand.
- **Regel-Karte ist der einzige Strukturbruch der Kiste:** `PartykistePartie.regelKarte`
  lebt über das Rundenende hinaus (bis dahin lebte alles Rundenwissen in
  `runde`). Begründung an `AktiveRegel`. Abgerechnet wird trotzdem nur in
  `werteAus` der gerade laufenden Runde (`regelAbrechnen`): Verstöße werden
  Schlücke dieser Runde, die letzte Runde der Regel gibt den Punkt für die
  weiße Weste. Protokoll und Turnierstand bleiben so deckungsgleich (Test).
  In einer Abrechnung, nach der keine mehr kommt, ist Melden gesperrt
  (`meldenMoeglich`) — sonst verschwände der Verstoß still. Eine neue Karte
  löst die alte ab.
- **Mehrheit heißt: anwesende Menschen außer dem Beschuldigten.** Bots
  hören nicht mit; zählten sie, bekäme ein Mensch unter Bots nie eine
  Mehrheit. Die nötige Zahl steht in der Sicht (`noetig`), der Bildschirm
  zählt nur ab.
- **`einspruch` und `verstoss` stehen nicht in `legalActions`**: Beide
  darf jeder Sitz jederzeit, nicht nur der am Zug — wie das Tippen in den
  gleichzeitigen Spielen. `verstoss` wird in `verarbeite` vor allen
  Phasenprüfungen behandelt, weil er in jeder Runde gilt.
- Seit diesen dreien ist `protocolVersion` 2 (Client
  `PARTYKISTE_MODULE_VERSION`): Ein alter Client kennt die neuen Runden nicht.

**Imposter seit dem 19.09.2026:** Der Imposter sieht **„IMPOSTER“ und einen
Hinweis** (grobe Kategorie, `inhalte/imposter.ts`), kein Nachbarwort mehr. Die
Runde bekommt eine **feste Redereihenfolge** (`reihenfolge`, je Runde
gemischt), die auf jedem Schirm steht. Statt zu stimmen kann jeder **„Noch
eine Runde reden"** verlangen (`nochmal`): Will das mehr als die Hälfte der
Anwesenden, fallen alle Stimmen, die Reihenfolge rückt um einen Platz, und es
wird neu geredet — höchstens dreimal (`MAX_REDERUNDEN`). Ohne Mehrheit zählt
der Tipp als Enthaltung.

## Neue Inhalte ergänzen

Die Kataloge sind reine Daten: Fragen, Wortpaare, Namen, Sprüche. Seit dem
22.09.2026 (Entscheidung P4, Datenbank später) steht jeder als **JSON-Datei**
unter `src/inhalte/daten/<katalog>.json`; die gleichnamige `.ts` daneben lädt
und prüft sie nur. Neue Einträge kommen **hinten** dazu und bekommen die
nächste freie Kennung; bestehende Kennungen ändern sich nie — sie stehen in
abgelegten Rundenprotokollen, und die Ziehung hängt an der Reihenfolge.

Jede Datei hat einen Kopf (`katalog`, `grenze`, `pflege`, `inhalt`) und
darunter `eintraege`, ein Eintrag je Zeile. **`grenze` ist Pflicht** und sagt,
was kein Eintrag darf: Stufe 3 („derb“) heißt pikant-erwachsen — nie
herabwürdigend, nie über reale benannte Personen, nie über Minderjährige, nie
Gewalt; kein Text fordert zum Trinken auf.

**Das Schema** (`src/inhalte/schema.ts`, eigener Prüfer, kein zod — das Paket
hat keine Laufzeitabhängigkeit außer game-api) läuft an drei Stellen: beim
Import jedes Katalogs (wirft), im Build (`werkzeug/inhalte-pruefen.mjs` nach
`tsc`, nennt alle Fehler auf einmal und bricht ab) und im Test
(`test/inhalte-json.test.ts`). Es verlangt über die Form hinaus:

- Kennungen **lückenlos in Katalogreihenfolge** (`q001`, `q002`, …) — wer
  umsortiert, löscht oder eine Nummer auslässt, fällt im Build auf.
- **Keine Dubletten**, normalisiert (Groß/klein, Satzzeichen, Leerraum egal;
  bei Entweder-oder auch das vertauschte Paar, bei Wahrheit/Pflicht über
  beide Arten).
- **Keine unbekannten Felder** — so sieht ein Tippfehler im Feldnamen aus.
- Beim Imposter darf der Hinweis das Wort nicht wörtlich enthalten.

**Der Altbestand** — die 918 Einträge vom 22.09.2026 — liegt als die
ursprünglichen TS-Dateien unter `test/altbestand/`, und ein Test vergleicht
jeden davon Feld für Feld mit seiner Stelle im JSON. Wer einen alten Eintrag
bewusst korrigiert, korrigiert ihn dort mit. Neue Einträge (alles jenseits
des Altbestands) brauchen `haerte` und mindestens ein `paket`, Quiz und
Schätzen auch `stufe`; ein Test hält die Mischung grob bei 60 % harmlos,
30 % pikant, 10 % derb.

Stand 19.09.2026: 140 Quizfragen, 120 Imposter-Wortpaare, 140 Identitäten,
110 Sprüche für „Ich hab noch nie”, 108 für „Wer würde eher”, 80 Schätzfragen,
100 Entweder-oder-Paare, 120 Aufgaben für Wahrheit oder Pflicht (60/60).
Dazu seit dem 22.09.2026: 82 Kategorien (k001–k082), 72 Mehrheitsfragen
(m001–m072), 49 Regel-Karten (r001–r049) — jeder Eintrag **mit** `haerte`
und mindestens einem `paket`, alle drei Stufen belegt, je Paket mindestens
zehn harmlose (`test/ohne-uhr.test.ts`). Regel-Karten sind Befehle an alle
und tragen deshalb wie Wahrheit oder Pflicht gar kein Trinkwort.

**Metadaten** (seit dem 22.09.2026, `src/inhalte/typen.ts`) — alle optional,
ein Eintrag ohne Feld gilt als harmlos, allgemein, ab vier Sitzen:

| Feld | Werte | fehlt = |
| --- | --- | --- |
| `haerte` | 1 harmlos, 2 pikant, 3 derb | 1 |
| `paket` | Liste aus `PAKETE` (`wg-abend`, `jga`, `weihnachten`, `studenten`, `arbeit`) | Allgemeingut, spielt in jedem Paket mit |
| `minSitze` | Zahl | immer |
| `stufe` | 1–3, nur Quiz und Schätzen | ohne Angabe (filtert noch nichts) |

```json
{ "id": "n111", "haerte": 2, "paket": ["wg-abend", "studenten"], "text": "Ich hab noch nie …" }
```

- **Im Zweifel die höhere Härte.** Ein harmloser Tisch darf nie einen
  pikanten Spruch sehen; umgekehrt fehlt nur ein Spruch.
- **Ein neues Paket** kommt hinten an `PAKETE` dazu, nie umbenennen — die
  Kennung steht in abgelegten Regelsätzen. Ein Paket braucht je Katalog, in
  dem es gespielt werden soll, mindestens `MINDESTMENGE` (10) Einträge,
  sonst mischt der Filter Allgemeingut dazu.
- **Jeder Katalog muss mindestens zwölf harmlose Einträge behalten** (so
  viele Sitze hat ein voller Tisch, und die Härte lockert der Filter nie).
  Der Test `jeder Katalog traegt die strengste Einstellung` prüft das.
- `minSitze` nur, wenn der Text wirklich eine große Runde braucht („Wer von
  euch acht …“).

Die Sätze zum Kiffen (n101–n110, w101–w108, zusammen 18) sind seit dem
22.09.2026 **pikant** (`haerte: 2`) und damit an einem Tisch mit der Vorgabe
„harmlos“ nicht mehr dabei. Sonst trägt kein Eintrag eine Härte.

## Ein weiteres Minispiel einbauen

1. `MinispielId` in `src/regeln.ts` erweitern, Kennung in `MINISPIELE`.
2. Rundentyp in `src/partie.ts` ergänzen (`Runde`-Union, `baueRunde`,
   `werteAus`) und, falls es reihum läuft, in `istReihum`.
3. Sicht in `src/sicht.ts` — und dabei zuerst entscheiden, was **nicht**
   mitfährt.
4. Bot in `src/bot.ts`, Ansicht in
   `packages/client/src/minispiele/partykiste/Runden.tsx`, Spiegelbild der
   Sicht in dessen `sicht.ts`.
5. Punkte und Schlücke in `PUNKTE`/`SCHLUECKE` eintragen — sie stehen
   absichtlich an einer Stelle, damit man das Turnier dort austariert.

Der Vertrag (`packages/client/src/vertrag/partykiste.test.ts`) bricht den
Client-Bau, wenn Sicht und Beschreibung auseinanderlaufen. Der Schaukasten
bekommt einen neuen Eintrag, sonst sieht den neuen Zustand nie jemand.
