# Partykiste

Ein Turnier aus fünfzehn Partyminispielen für **4 bis 12 Leute**, die im selben
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

Die Minispiele kommen **gemischt ohne Wiederholung** (seit dem 27.09.2026,
Robin; vorher reihum in der Reihenfolge des Regelsatzes): Jedes Spiel aus
`minispiele` kommt einmal in zufälliger Folge dran, bevor eines wiederkommt,
und nie dasselbe zweimal direkt hintereinander — auch nicht über die Naht zur
nächsten Mischung. Gewürfelt wird nur mit der Saat der Partie
(`minispielFolge` in `partie.ts`), also ist die Folge nach einer
Wiederaufnahme dieselbe. „Dreimal Quiz hintereinander“ bleibt ein Fehler.

## Die fünfzehn Minispiele

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
| **Bombe** | Reihum laut etwas aus einer Kategorie nennen und weitergeben. Sie geht nach einer verdeckten Zeit (8–25 s, aus der Saat) hoch — die Uhr läuft auf dem Server. | nicht gehalten +1 | wer sie hält 2 |
| **10 Sekunden** | Einer nennt drei Dinge („Nenne drei: Automarken") in zehn Sekunden auf der Uhr des Servers, danach urteilen die anderen Menschen. Gleichstand geht an den Sprecher. | geschafft +2 | nicht geschafft 2 |
| **Königsbecher** | Reihum zwei Karten je Kopf aus dem 52er-Blatt, jede Karte ist eine Regel (2 du wählst, 3 du selbst, 7 Hand hoch, Bube neue Regel-Karte, König füllt den Becher …). | ohne Schluck +1, Neun +1 | je Treffer 1, letzter König den Becher |

## Tischoptionen

Der Regelsatz (`PartykisteRegeln` in `src/regeln.ts`), geprüft von
`validateConfig` in `src/adapter.ts` — die Prüfung meldet Unsinn als
`ConfigProblem` und wirft nie:

| Feld | Werte | Vorgabe | Wirkung |
| --- | --- | --- | --- |
| `minispiele` | Liste aus `MINISPIELE`, mindestens eins | alle fünfzehn | was gemischt wird (Reihenfolge egal) |
| `trinkmodus` | an/aus | an | nur die Anzeige der Gläser |
| `schluckFaktor` | 1–3 | 1 | Schlücke mal Faktor |
| `inhaltsHaerte` | 1 harmlos, 2 pikant, 3 derb | 1 | Textschärfe — wie gemeint, sagt `inhaltsMischung` |
| `inhaltsMischung` | `genau`, `gemischt` | `genau` (fehlt = alte Obergrenze) | genau diese Stufe oder alle bis zu ihr, je Stufe gleich oft |
| `paket` | `null` oder ein Paket aus `PAKETE` | `null` | Zielgruppe der Inhalte |
| `modus` | `turnier`, `eskalation`, `themenabend`, `team` | `turnier` (fehlt = Turnier) | Spielmodus, siehe unten |

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
wie scharf die Texte sind. Sie heißt absichtlich **nicht** „Härte“: Der Regler
`schluckFaktor` steht im Bildschirm schon als „Härte“, und zwei Regler mit
demselben Namen — einer für Gläser, einer für Texte — stellt niemand richtig
ein. Im Bildschirm heißt die Stufe „harmlos / pikant / derb“.

**Genau oder gemischt** (`inhaltsMischung`, seit dem 27.09.2026, Robin: „es
soll nur die Stufen haben, oder man macht gemischt an, dann ist zufällig aus
allen“). Bis dahin war die Stufe eine Obergrenze: Ein derber Tisch bekam
alles bis derb, und weil die Kataloge zu rund 60 % harmlos sind, praktisch
vor allem Harmloses. Jetzt:

- `genau` (Vorgabe, und was die Kacheln harmlos/pikant/derb schicken): nur
  Einträge genau dieser Stufe. Ist die Stufe im Katalog zu dünn, kommen
  **danach** die der nächst milderen, dann der mildesten — nie derbere, und
  ohne Wiederholung, solange irgendeine erlaubte Stufe noch etwas hat
  (`inhaltsStapel` in `src/inhalte/stapel.ts`; die dünne Stufe steht als
  `inhaltsRueckfall.stufeDuenn` in der Runde). Heute betrifft das „derb“ fast
  überall (Schätzen hat 2 derbe Fragen, Wer bin ich 7, die Regel-Karten 3) —
  die parallele Inhaltsprüfung (`docs/PARTYKISTE-INHALTE.md`) füllt nach.
- `gemischt` (die vierte Kachel, geschickt als `inhaltsHaerte: 3`, Gast: 2):
  je Stufe ein gemischter Stapel, und jede Ziehung wählt per Saat erst eine
  **Stufe** (gleich wahrscheinlich unter denen mit Vorrat), dann deren
  nächsten Eintrag. Je Eintrag zu ziehen wäre wieder die alte Obergrenze.
- **Fehlt das Feld**, gilt die alte Obergrenze wortgleich weiter (Lesart
  `'bis'`, `inhaltsLesart` in `regeln.ts`). Ohne Feld kommen nur Regelsätze
  von vor der Umstellung an: wartende Tische, deren Öffner „derb“ noch als
  „bis derb“ meinte, und vor allem Snapshots **laufender** Partien — läse man
  die plötzlich als „genau“, zöge die nächste Runde aus einem anderen Stapel,
  und eine gespielte Frage könnte wiederkommen. `createParty` erfindet das
  Feld deshalb auch bei Unsinn nicht, und die Sicht meldet `'bis'`.
- Bei „harmlos“ sind alle drei Lesarten Stelle für Stelle dasselbe (Test);
  ein Tisch, der nie etwas gewählt hat, zieht also dieselben Fragen wie vorher.
- Die App-Zähmung (`appRegeln` im Server) kappt nur `inhaltsHaerte` — „gemischt“
  heißt dort „gemischt bis zur App-Grenze“.

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

**Offene Lücke:** „Verifiziert“ heißt hier nur „kein Gast“ (geprüft
am 27.09.2026: Die Kappung sitzt allein im Modul, gefüllt aus `account.gastSeit`
in `runtime/party.ts`; das Menü sperrt „derb“ zusätzlich, ist aber nicht die Sperre). Ein normales
Konto hat Mail und Passwort, aber die Mail ist nicht bestätigt, und eine
**Altersangabe gibt es nirgends** in der Datenbank. Wer „derb nur ab 18“
ernst meint, braucht ein Feld am Konto — das ist eine Plattformfrage, keine
der Kiste.

**Themenpaket** (`paket`, Entscheidung P3): eine Zielgruppe, kein Motto.
Pakete: `wg-abend`, `jga`, `weihnachten`, `studenten`, `arbeit`. Seit dem
Vorrat vom 22.09.2026 trägt jeder neue Eintrag mindestens ein Paket, der
Altbestand keins. **Folge:** Findet ein Paket-Tisch mindestens
`MINDESTMENGE` eigene Einträge, spielt er NUR diese — der Altbestand kommt
dort nicht mehr vor. Darunter mischt der Filter Allgemeingut dazu, und die
Runde hält das fest (siehe unten). Dünn ist heute „jga" bei „harmlos"
(5 bis 8 je Katalog, die JGA-Einträge sind meist pikant) und „weihnachten"
bei Wahrheit (9): Solche Tische spielen mit Rückfall.

**Auswahl im Menü** (seit dem 22.09.2026, `minispiele/partykiste/Auswahl.tsx`,
Logik in `wahl.ts`): Minispiele (an- und ausklicken wie die
Doppelkopf-Regeln, mindestens drei; seit dem 27.09.2026 ohne Reihenfolge,
das Modul mischt), Inhaltsstufe „harmlos / pikant / derb / gemischt“ (vier
Kacheln seit dem 27.09.2026; „gemischt“ nur, wenn `defaultConfig()` das Feld
`inhaltsMischung` kennt — `mischungBekannt`) unter der Überschrift
**„Inhalte“** (nicht „Härte“, siehe oben),
Themenpaket („alles“ = `paket: null`) und — erst, wenn `defaultConfig()`
ein Feld `modus` hat — der Modus. Gemerkt in `localStorage`, gilt für
Bot- und Online-Tische. Der Regelsatz entsteht als **Vorgabe des Moduls**
(`useSpielVorgabe('partykiste')`), darauf Trinkmodus und Schluckfaktor,
darauf die Auswahl (`regelsatzAus`); was niemand gewählt hat, kommt aus
der Vorgabe. Die Minispielliste der Kacheln ist deshalb `MINISPIELE` des
Moduls, keine Abschrift — ein neues Minispiel steht ohne Änderung im Menü.
Wer alle anklickt, dem wird nichts gemerkt, damit ein
neues Minispiel später von selbst dazukommt. Für einen Gast (`me.gast`) ist
„derb“ gesperrt („nur mit Konto“); die Kappung beim Start bleibt trotzdem
die eigentliche Sperre. Paketnamen, Modusnamen und „gleichzeitig/reihum“
sind Spiegelbilder, die `vertrag/partykiste-auswahl.test.ts` gegen
`PAKETE`, `istReihum` und `validateConfig` hält. `inhaltsHaerte` und
`paket` dürfen im Regelsatz weiterhin fehlen — ältere Tische kennen sie
nicht. Seit dem 27.09.2026 trägt die Sicht `inhaltsHaerte`, `inhaltsMischung`
und `inhaltsHaerteGewollt`, und die Regelzeile nennt die Inhalte („Inhalte
pikant“, „Inhalte gemischt“, bei alten Tischen „Inhalte bis derb“; `inhaltsChip`
im Client). Das Paket steht dort weiterhin nur im Themenabend.

### Wie die Inhalte ausgewählt werden

Jede Ziehung geht durch **einen** Filter, `waehlbareInhalte` in
`src/inhalte/filter.ts`. Er lässt die Katalogreihenfolge stehen (gemischt
wird erst danach, mit dem Saatkorn — sonst zöge dieselbe Saat andere Fragen,
sobald irgendwo ein Eintrag ein Paket bekommt) und gibt stufenweise nach,
wenn weniger als `MINDESTMENGE` (10) Inhalte passen:

1. `paket` — nur Inhalte des Pakets
2. `paketUndAllgemein` — dazu Inhalte ohne Paket, aber nichts aus fremden Paketen
3. `ohnePaket` — Paket egal
4. `ohneMinSitze` — auch die Sitzgrenze fällt. **Letzter Halt**: Hier gilt
   nur noch die Härte.

Bis zum 23.09.2026 gab es als fünfte Stufe `vollerKatalog`, den ganzen
Katalog ohne Härte. Im Betrieb kam sie nie vor, aber ein Katalog mit zu wenig
Harmlosem hätte einem harmlosen Tisch still Derbes gegeben. Jetzt gilt:
Reicht der erlaubte Vorrat nicht, wird **innerhalb der erlaubten Stufen
wiederholt**, deterministisch und erst nach einem vollen Durchlauf des
gemischten Stapels (`an()`). Gibt es gar keinen erlaubten Eintrag, spielt in
dieser Runde **ein anderes Minispiel**, und zwar das nächste der Liste mit
erlaubtem Vorrat, zur Not Bus fahren (`spielbaresMinispiel`, Kataloge je
Minispiel in `VORRAT`). Die Engine hängt nie. Mit den heutigen Katalogen
kommt der Ersatz nicht vor: Jeder Katalog, auch die aus #213 und #218, hat
mindestens zwölf harmlose Einträge (Test). In der Eskalation legt
`stufenStapel` außerdem die Auswahl jeder milderen Stufe in den Stapel. Ein
Paket-Topf, der auf der Decke nur Derbes hergibt, ließ sonst das erste
Drittel ohne harmlosen Eintrag.

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

## Spielmodi

Seit dem 22.09.2026 (Robins Entscheidung): neben dem Turnier drei Modi —
**nicht** Schnellrunde oder Marathon, die Rundenzahl stellt man ohnehin ein.
Alles, was einen Modus ausmacht, steht in `src/modi.ts`; `partie.ts` hängt
sich an wenigen Stellen ein (Rundenaufbau, Reihum-Folge, Aufstellung,
Rangliste). Der Ablauf der Minispiele ist in jedem Modus derselbe — aus
demselben Grund, aus dem der Trinkmodus kein zweiter Ablauf ist.

**Eskalation.** Inhaltsstufe und `schluckFaktor` steigen über den Abend:
erstes Drittel 1, zweites 2, letztes 3 (`eskalationsStufe`,
`floor(nr * 3 / runden) + 1`). Die eingestellten Werte gelten dann nicht; die
Kurve steht je Runde in `regelnDerRunde`, und jede Ziehung, jede Aufgabe und
jede Abrechnung liest den Regelsatz der Runde, nicht den der Partie. Die
Kurve **ist** die Stufenwahl: Der Regelsatz der Runde trägt
`inhaltsMischung: 'genau'`, egal was unter „Inhalte“ eingestellt war.
**Die Gast-Kappung wird nicht umgangen**: Die Eskalation will am Ende „derb",
geht aber wie jeder Tisch durch `wirksameInhaltsHaerte`; mit Gast steht in
`regeln.inhaltsHaerte` „pikant", und die Kurve steigt nie über diese Decke
— auch nicht in der letzten Runde. Die Härte der Gläser steigt trotzdem bis 3.
Die Sicht sagt es (`eskalation.gekappt`), die Regelzeile auch.

Damit sich über die Stufen nichts wiederholt, gibt es in der Eskalation EINEN
Stapel je Katalog (gefiltert auf die Decke, gemischt wie im Turnier), und
`belegeStufenweise` verteilt ihn auf alle Plätze des Abends: jeder Platz den
ersten unbenutzten Inhalt **genau** seiner Stufe, sonst der nächst milderen.
Eskalation heißt, dass die Stufe ausgeschöpft wird — ab Stufe 2 kommen die
pikanten Sprüche, sofern es welche gibt. Wie viele Plätze eine Runde hat
(„Wer bin ich“ und W/P: einer je Sitz), steht in `platzeJeRunde`; wer die
Zählung in `baueRunde` ändert, ändert sie dort mit.

**Themenabend.** Ein `paket` ist Pflicht (`validateConfig` meldet
`ruleset.partykiste.themenOhnePaket`; ein Tisch aus der Datenbank ohne Paket
spielt als Turnier). Das Paket bestimmt die Minispiele (gemischt wie
immer; `THEMEN_MINISPIELE`, geschnitten mit dem, was der Tisch überhaupt spielen
will) und die Inhalte über den Filter — reicht der Paketvorrat nicht, gibt
der Filter weich nach wie bei jedem Paket-Tisch. Beim Arbeitsabend fehlen
„Ich hab noch nie“ und W/P. Ein neues Minispiel spielt in keinem Themenabend
mit, bis es dort eingeordnet ist.

**Team-Abend.** Zwei Lager, zu Beginn abwechselnd nach Sitz (`startLager`).
Vor der ersten Runde stellt der **Tischöffner** (Sitz 0) auf: Solange
`partie.aufstellung` gilt, ist nur er am Zug, `lagerwechsel` setzt einen Sitz
hinüber (nie den letzten Anwesenden eines Lagers — die erlaubten Sitze stehen
in der Sicht als `aufstellung.wechselbar`), `bereit` gibt frei. Ist Sitz 0
ein Bot oder gegangen, endet die Aufstellung von selbst. Die erste Runde wird
danach neu gebaut, weil ihre Reihum-Folge an den Lagern hängt. In
Reihum-Spielen wechseln die Lager (A, B, A, B …; welches anfängt, wechselt je
Runde — `reihumFolge`). Punkte und Schlücke zählen fürs Lager
(`lagerWertung`); entschieden wird der **Schnitt je Kopf**, damit das größere
Lager nicht allein durch seine Größe gewinnt. Die Bots stimmen bei „Wer würde
eher“ und beim Imposter für das andere Lager.

## Wertung

Gewertet wird das **ganze Turnier**: `standings` liefert die aufaddierten
Punkte, die Plattform rechnet daraus Trophäen (mehr Punkte = besserer Platz).
Die Schlücke stehen daneben und zählen **nicht** mit.

**Im Team-Abend** bleibt die Rangliste für die Trophäen eine je **Person**
— die Plattform verteilt an Konten, und ein Lager ist keins. Der **Platz**
aber kommt aus dem Lager-Ergebnis (`lagerPlaetze`): Wer im Siegerlager die
wenigsten eigenen Punkte hat, steht trotzdem vorn, sonst schadete sich, wer
seinem Lager hilft. Gezählt wird wie die Plattform zählt — das Siegerlager
auf 1, das andere auf „Größe des Siegerlagers + 1“; mit „2“ verteilte
`awardForParty` die Plätze falsch, und die Nullsumme wäre hin.
`standings[i].points` bleiben die eigenen Punkte.

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

**Die drei mit Uhr** (seit dem 23.09.2026, Robins Entscheidung vom
22.09.2026; Regeln in `src/zeitdruck.ts`, Ansichten in
`minispiele/partykiste/RundenZeitdruck.tsx`, Inhalte in
`inhalte/zehnsekunden.ts` und `koenigsbecher.ts`, die Bombe zieht aus den
Kategorien):

- **Die Uhr lebt auf dem Server.** Das Modul bleibt uhrlos wie jedes Modul:
  Es nennt nur die Dauer (`phaseMs`), die Plattform misst sie und ruft nach
  Ablauf `advancePhase` — der Tisch schaltet weiter, ohne dass ein Gerät
  etwas schickt (`packages/server/test/partykiste-uhr.test.ts`). Eine Uhr im
  Client wäre die zweite Fassung derselben Regel (Runden.tsx): Zwei Handys
  zählen nie gleich. Die Frist gilt nur in den drei Phasen, die ohne Uhr kein
  Spiel wären — die tickende Bombe, das Sprechen bei „10 Sekunden", das
  „Hand hoch" nach einer Sieben (5 s). Sie ist immer kürzer als die Zugzeit
  und bei `PHASE_HOECHST_MS` (30 s) gedeckelt, nimmt also niemandem Zugzeit
  weg; die Laufzeit stellt für beide einen Timer, den früheren. `phaseKey`
  trennt zwei Siebenen hintereinander, die Bombe behält ihres über alle
  Weitergaben (die Frist steht ab dem ersten Ticken fest).
- **Die Restzeit der Bombe geht nie über die Leitung.** Die Zündzeit steht
  in keiner Sicht, auch nicht im Ergebnis, und die Plattform schickt die
  Frist als `phaseDeadline: null` (`phaseHidden`, neu in game-api). Der
  Bildschirm zeigt nur, dass sie tickt — gleichmäßig, denn schneller werdendes
  Ticken wäre eine Auskunft, die er nicht hat.
- **Reißleine ohne Uhr:** Nach `BOMBE_WEITERGABEN_HOECHST` (200) Weitergaben
  geht die Bombe auch ohne Uhr hoch. Am echten Tisch kommt die Uhr immer
  zuerst (Bots geben im 220-ms-Takt weiter, in 25 s gut 110-mal); ohne die
  Reißleine hinge jede Bot-Partie, die niemand mit einer Uhr treibt — die
  Invarianten, der Vertrag, der Schaukasten.
- **„10 Sekunden" spricht ein Mensch** (reihum über die Runden, Versatz aus
  der Saat), die Aufgabe kommt erst mit seinem „Los" — vorher sieht sie
  niemand, sonst hätte er Bedenkzeit, die keine Uhr misst. Es urteilen die
  anwesenden Menschen außer ihm (Bots hören nicht), gibt es keinen, er selbst.
  Nur an einem Tisch ganz ohne Menschen spricht ein Bot. Die Urteile sind bis
  zur Abrechnung verdeckt.
- **Königsbecher:** Die Kartentexte sagen „kassiert", nie „trinkt" — ob das
  ein Schluck oder ein Strafpunkt ist, sagt die Wertung. „Du wählst" nimmt die
  vorhandene Aktion `stimme`. Bei „Hand hoch" sind **Bots zuerst** am Zug
  (sonst warteten sie auf den Menschen, der dann nie der Letzte wäre); tippen
  alle, kassiert der Letzte sofort, sonst nach 5 s jeder, der nicht getippt
  hat. Der **Bube** bringt eine Regel-Karte, die nach der Runde gilt und die
  alte ablöst wie eine Regelkarten-Runde (`regelAbrechnen(…, abgeloest)`);
  die vier möglichen Karten zieht `baueRunde` vorab aus einem eigenen Stapel.
  Wer den letzten König der Runde zieht, bekommt den Becher (je König 1).
- Bombe und Königsbecher laufen wie das Kategorien-Battle **im Kreis in
  Sitzreihenfolge**, auch im Team-Abend. Die Kachel im Menü nennt sie
  trotzdem „reihum" — dafür gibt es `ablaufVon` neben `istReihum`.
- Seit diesen dreien ist `protocolVersion` 4 (3 kam mit den Spielmodi).

**Imposter seit dem 19.09.2026:** Der Imposter sieht **„IMPOSTER“ und einen
Hinweis** (grobe Kategorie, `inhalte/imposter.ts`), kein Nachbarwort mehr. Die
Runde bekommt eine **feste Redereihenfolge** (`reihenfolge`, je Runde
gemischt), die auf jedem Schirm steht. Statt zu stimmen kann jeder **„Noch
eine Runde reden"** verlangen (`nochmal`): Will das mehr als die Hälfte der
Anwesenden, fallen alle Stimmen, die Reihenfolge rückt um einen Platz, und es
wird neu geredet — höchstens dreimal (`MAX_REDERUNDEN`). Ohne Mehrheit zählt
der Tipp als Enthaltung.

## „Passt nicht“ — Inhalte am Tisch melden (nur auf staging)

Seit dem 27.09.2026 (Robin: „ja, nur auf staging wie der Bug-Knopf“), die
zweite Hälfte der Inhaltsprüfung aus `docs/PARTYKISTE-INHALTE.md`: In jeder
Runde, die einen Katalog-Eintrag zeigt, steht unter der Runde ein leiser
Knopf **„Passt nicht“** (44 pt, beschriftet; `minispiele/partykiste/PasstNicht.tsx`).
Das Blatt fragt — bei mehreren Einträgen zuerst „Welcher?“ — nach dem Grund
(ergibt keinen Sinn · zu zahm für die Stufe · zu hart für die Stufe · kennt
keiner · falsch · sonstiges) und optional nach Freitext. Die Liste der
Einträge wird beim Öffnen festgehalten, damit ein Weiterschalten der Runde
nicht den falschen meldet.

- **Welcher Eintrag:** Die Sicht trägt `gezeigt` (Katalog + Kennung + Text),
  abgeleitet aus der fertigen Sicht — der Imposter bekommt die Kennung seines
  Wortes erst im Ergebnis, bei „Wer bin ich“ fehlt der eigene Name, bei
  „10 Sekunden“ die Aufgabe vor dem „Los“ (`gezeigteInhalte` in `sicht.ts`).
  Die geltende Regel-Karte steht immer mit drin. Bus fahren zeigt nichts.
- **Nur auf staging**, doppelt: Der Client zeigt den Knopf nur bei
  `me.stage === 'staging'` (wie `FeedbackWidget.tsx`), und der Server nimmt
  `POST /api/partykiste/meldung` nur an, wenn `deps.stage` staging ist
  (sonst 404 `nurAufStaging`) — dieselbe Quelle, die `me` ausliefert.
- **Server** (`http/partykiste-routen.ts`): angemeldet, Katalog aus
  `INHALTS_KATALOGE`, Kennung in fester Form und im Katalog vorhanden
  (`gibtInhalt`), Grund aus `PASST_NICHT_GRUENDE` (Modul, der Client spiegelt
  sie, Vertrag `vertrag/partykiste-passtnicht.test.ts`), Freitext ≤ 500,
  Stufe 1–3, Tisch muss existieren; 60 Meldungen je Stunde. Tabelle
  `partykiste_meldung` (Migration 0032). `GET /api/partykiste/meldungen`
  nur für die Aufsicht (`requireAufsicht`): je Eintrag Anzahl, verschiedene
  Melder, Gründe und Stufen gezählt, die jüngsten fünf Freitexte, dazu Text
  und Härte aus dem Katalog **von heute** (`inhaltKurz`).
- Geändert wird der Katalog weiterhin von Hand bzw. über die Prüfseite —
  nie aus einer Meldung heraus.

## Neue Inhalte ergänzen

Die Kataloge sind reine Daten: Fragen, Wortpaare, Namen, Sprüche. Seit dem
22.09.2026 (Entscheidung P4, Datenbank später) steht jeder als **JSON-Datei**
unter `src/inhalte/daten/<katalog>.json`; die gleichnamige `.ts` daneben lädt
und prüft sie nur. Neue Einträge kommen **hinten** dazu und bekommen die
nächste freie Kennung (eins über der höchsten je vergebenen); bestehende
Kennungen ändern sich nie — sie stehen in abgelegten Rundenprotokollen, und
die Ziehung hängt an der Reihenfolge.

**Maßstab für jeden Eintrag ist seit dem 27.09.2026
[PARTYKISTE-INHALTE.md](PARTYKISTE-INHALTE.md)** — was je Spiel taugt, was
jede Stufe darf, wie viele Einträge jede Stufe braucht. Geprüft wird in zwei
Schritten (Vorprüfung durch die KI, dann Robin auf der Prüfseite); die
Vorschläge liegen als Prüfprotokoll unter `docs/partykiste-pruefung/`.

Jede Datei hat einen Kopf (`katalog`, `grenze`, `pflege`, `inhalt`,
`entfernt`) und darunter `eintraege`, ein Eintrag je Zeile. **`grenze` ist
Pflicht** und fasst das Regelwerk zusammen: harmlos geht an jedem Tisch,
pikant ist Kneipenniveau und die Decke für Gäste, **derb ist richtig derb und
nur für Konten ab 18**; tabu auf jeder Stufe sind reale benannte Personen in
sexuellen oder herabwürdigenden Zusammenhängen, alles mit Minderjährigen,
Gewalt, Herabwürdigung von Gruppen, Aufforderungen zu Straftaten oder
Gefährlichem, Selbstverletzung; kein Text fordert zum Trinken auf.

**Streichen** (seit dem 27.09.2026): Ein schlechter Eintrag wird gelöscht,
seine Kennung kommt in die Liste `entfernt` im Kopf (bei den TS-Katalogen
`KATEGORIEN_ENTFERNT` usw.) und wird **nie wieder vergeben**. Bis dahin
verlangte das Schema lückenlose Kennungen — das ließ nur „umschreiben“ zu,
und eine Kennung mit neuem, fremdem Text hätte in einer alten Partie auf
etwas anderes gezeigt als damals. Mit der Liste bleibt die Lücke sichtbar
und die Wiederverwendung prüfbar.

**Das Schema** (`src/inhalte/schema.ts`, eigener Prüfer, kein zod — das Paket
hat keine Laufzeitabhängigkeit außer game-api) läuft an drei Stellen: beim
Import jedes Katalogs (wirft), im Build (`werkzeug/inhalte-pruefen.mjs` nach
`tsc`, nennt alle Fehler auf einmal und bricht ab) und im Test
(`test/inhalte-json.test.ts`). Es verlangt über die Form hinaus:

- Kennungen **steigen in Katalogreihenfolge** (`q001`, `q002`, …), und jede
  Nummer bis zur höchsten steht als Eintrag da **oder** unter `entfernt` —
  nie in beiden. Wer umsortiert, still löscht oder eine gestrichene Kennung
  neu vergibt, fällt im Build auf (`pruefeKennungen` in `schema.ts`, dieselbe
  Regel prüfen die Tests der TS-Kataloge).
- **Keine Dubletten**, normalisiert (Groß/klein, Satzzeichen, Leerraum egal;
  bei Entweder-oder auch das vertauschte Paar, bei Wahrheit/Pflicht über
  beide Arten).
- **Keine unbekannten Felder** — so sieht ein Tippfehler im Feldnamen aus.
- Beim Imposter darf der Hinweis das Wort nicht wörtlich enthalten.

**Der Altbestand** — die 918 Einträge vom 22.09.2026 — liegt als die
ursprünglichen TS-Dateien unter `test/altbestand/`, und ein Test vergleicht
jeden davon Feld für Feld mit seiner Stelle im JSON — gestrichene überspringt
er (sie bleiben im Altbestand stehen), die übrigen müssen in alter
Reihenfolge vor allem Neuen stehen. Wer einen alten Eintrag bewusst
korrigiert, korrigiert ihn dort mit (so am 27.09.2026 für 48 umgeschriebene
oder umgestufte). Neue Einträge (alles jenseits des Altbestands) brauchen
`haerte`, Quiz und Schätzen auch `stufe`. Ein `paket` ist seit dem
27.09.2026 freiwillig: Die Prüfung hat Pakete nur vergeben, wo ein Eintrag
wirklich zu einem Anlass gehört; ohne Paket ist er Allgemeingut. Die alte
Mischungsregel (60 % harmlos, 30 % pikant, 10 % derb) ist ersetzt durch die
**Mindestzahl je Stufe** aus dem Regelwerk (`test/inhalte-json.test.ts`,
`ohne-uhr.test.ts`, `zeitdruck.test.ts`) — mit ihr wäre „derb“ nie allein
spielbar geworden.

Stand 27.09.2026 nach der Prüfung — Einträge je Katalog, harmlos/pikant/derb,
in Klammern der verbliebene Altbestand:

- Wahrheit oder Pflicht: 617 (100 von 120) — Wahrheit 136/89/86, Pflicht 138/85/83
- Wer würde eher: 351 — 185/84/82 (73 von 108)
- Ich hab noch nie: 343 — 169/90/84 (84 von 110)
- Entweder – oder: 275 — 173/52/50 (82 von 100)
- Allgemeinwissen: 311 — 214/61/36 (118 von 140)
- Schätzen: 212 — 131/51/30 (53 von 80) — **offen:** 20 derbe fehlen zum Ziel 50
- Imposter: 311 — 210/50/51 (116 von 120)
- Wer bin ich: 325 — 249/48/28 (119 von 140) — **offen:** 2 pikante, 2 derbe
  fehlen (Robin hat vier vorgeschlagene Rollen nicht übernommen)

Die offenen Lücken stehen als Ausnahme mit Untergrenze im Test
(`OFFEN_JE_STUFE`); sobald das Ziel erreicht ist, verlangt der Test, dass
die Ausnahme verschwindet.

Dazu seit dem 22.09.2026 die drei Kataloge ohne Uhr (#213, noch als
TS-Quelltext unter `src/inhalte/`, nicht Teil der JSON-Umstellung) und seit
dem 23.09.2026 „10 Sekunden“: 147 Kategorien (66/51/30), 162
Mehrheitsfragen (60/50/52), 161 Regel-Karten (53/55/53), 154 Aufgaben für
10 Sekunden (54/50/50) — jeder Eintrag **mit** `haerte` und mindestens einem
`paket`, je Paket mindestens zehn harmlose (`test/ohne-uhr.test.ts`).
Regel-Karten sind Befehle an alle und tragen deshalb wie Wahrheit oder
Pflicht gar kein Trinkwort. Die 13 Karten des Königsbechers sind fest (eine
je Rang) und haben keine Stufe.

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

Die Sätze zum Kiffen (n101–n110, w101–w108, zusammen 18) waren seit dem
22.09.2026 **pikant** (`haerte: 2`); seit der Prüfung vom 27.09.2026 sind
sie **derb** (Drogen gehören nach dem Regelwerk auf „derb“, Gäste bekommen
höchstens „pikant“), sechs davon sind gestrichen (n102, n103, n110, w103,
w106, w107). Sonst trägt im Altbestand nur eine Härte, was die Prüfung
umgestuft hat (`test/partykiste.test.ts` gleicht das mit den `umstufen` im
Prüfprotokoll ab); die neuen Einträge tragen alle eine.

## Ein weiteres Minispiel einbauen

1. `MinispielId` in `src/regeln.ts` erweitern, Kennung in `MINISPIELE`.
2. Rundentyp in `src/partie.ts` ergänzen (`Runde`-Union, `baueRunde`,
   `werteAus`) und, falls es reihum läuft, in `istReihum` — läuft es im
   Kreis (Kategorien, Bombe, Königsbecher), nur in `ablaufVon`.
   Braucht es eine Uhr: `phaseMs`/`advancePhase` im Adapter, nie im Client
   (siehe „Die drei mit Uhr").
3. Sicht in `src/sicht.ts` — und dabei zuerst entscheiden, was **nicht**
   mitfährt.
4. Bot in `src/bot.ts`, Ansicht in
   `packages/client/src/minispiele/partykiste/Runden.tsx`, Spiegelbild der
   Sicht in dessen `sicht.ts`.
5. Punkte und Schlücke in `PUNKTE`/`SCHLUECKE` eintragen — sie stehen
   absichtlich an einer Stelle, damit man das Turnier dort austariert.
6. In `src/modi.ts` den Stapel-Zweck in `zweckArt` (und die Plätze je Runde
   in `platzeJeRunde`) — sonst wiederholt die Eskalation Inhalte über die
   Stufen — und das Minispiel in die passenden `THEMEN_MINISPIELE`, mitten in
   die Liste. Im Client `MINISPIEL_NAME`/`MINISPIEL_ANSAGE` in `sicht.ts`,
   `MINISPIEL_ABLAUF`/`MINISPIEL_ZEICHEN` in `wahl.ts`.

Der Vertrag (`packages/client/src/vertrag/partykiste.test.ts`) bricht den
Client-Bau, wenn Sicht und Beschreibung auseinanderlaufen. Der Schaukasten
bekommt einen neuen Eintrag, sonst sieht den neuen Zustand nie jemand.
