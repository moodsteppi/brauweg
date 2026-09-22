# Partykiste

Ein Turnier aus neun Partyminispielen für **4 bis 12 Leute**, die im selben
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

## Die neun Minispiele

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

**Imposter seit dem 19.09.2026:** Der Imposter sieht **„IMPOSTER“ und einen
Hinweis** (grobe Kategorie, `inhalte/imposter.ts`), kein Nachbarwort mehr. Die
Runde bekommt eine **feste Redereihenfolge** (`reihenfolge`, je Runde
gemischt), die auf jedem Schirm steht. Statt zu stimmen kann jeder **„Noch
eine Runde reden"** verlangen (`nochmal`): Will das mehr als die Hälfte der
Anwesenden, fallen alle Stimmen, die Reihenfolge rückt um einen Platz, und es
wird neu geredet — höchstens dreimal (`MAX_REDERUNDEN`). Ohne Mehrheit zählt
der Tipp als Enthaltung.

## Neue Inhalte ergänzen

Die Kataloge unter `src/inhalte/` sind reine Daten: Fragen, Wortpaare, Namen,
Sprüche. Neue Einträge kommen **hinten** dazu und bekommen die nächste freie
Kennung; bestehende Kennungen ändern sich nie — sie stehen in abgelegten
Rundenprotokollen.

Stand 19.09.2026: 140 Quizfragen, 120 Imposter-Wortpaare, 140 Identitäten,
110 Sprüche für „Ich hab noch nie”, 108 für „Wer würde eher”, 80 Schätzfragen,
100 Entweder-oder-Paare, 120 Aufgaben für Wahrheit oder Pflicht (60/60).

Die Sätze zum Kiffen (n101–n110, w101–w108) liegen im normalen Vorrat, es
gibt keinen Schalter, der sie ausblendet.

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
