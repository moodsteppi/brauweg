# Spiele-Ideen und Merkliste

Sammlung möglicher Spiele für Brauweg, nach Genre. Der Aufwand ist in
**Doppelkopf-Einheiten** angegeben: 1,0 entspricht dem spielabhängigen Teil
von Doppelkopf, also rund 8.300 Zeilen (Engine 3.434, Engine-Tests 2.375,
Client 2.529). Die Plattform darunter — Server, Konten, Clans, Hub,
Ranglisten, rund 10.100 Zeilen — ist bezahlt und wird nicht noch einmal
fällig.

Die Zahlen sind Schätzungen aus dem Vergleich mit dem, was Doppelkopf
tatsächlich gekostet hat. Sie sind zur Reihenfolge-Entscheidung gedacht,
nicht als Angebot.

---

## Merkliste

Ausdrücklich vorgemerkt:

- **Arschloch** (Präsident) — siehe Ablegespiele. Billig und passt zum USP.
- **Schach** — siehe Brettspiele. Passt technisch überraschend gut, bringt
  aber eine eigene Tischform und die Bot-Frage mit.

---

## Was ein Spiel billig oder teuer macht

Nicht die Regeltiefe entscheidet, sondern die Passform zu zwei Annahmen,
die fest in der Plattform stecken:

1. **Ein Sitz ist am Zug, mit Frist.** Läuft sie ab, übernimmt ein Bot.
   (`currentActor`, `turnDeadline`)
2. **Eine Partie besteht aus Runden mit Geberrotation.** Die Rundenzahl ist
   ein Vielfaches davon, damit jeder gleich oft gibt. (`rotationSize`)

Was dazu passt, ist ein neues Paket und eine Zeile in der Registrierung.
Was nicht dazu passt, verlangt eine Änderung an `GameModule` — und genau
die hält die Plattform billig.

**Die Tischform ist der zweite Kostenblock.** Der Stichkartentisch steht;
jedes weitere Stichspiel erbt ihn fast unverändert. Für Brett-, Würfel- und
Auslegespiele gibt es ihn nicht. Wer das erste Brettspiel baut, zahlt die
Brett-Tischform (~0,3) einmal für alle folgenden mit.

---

## Stichspiele — die billigste Familie

Der Tisch steht, das Kartenbild steht, das Sortieren steht.

| Spiel | Aufwand | Anmerkung |
| --- | --- | --- |
| **Schnapsen / 66** | 0,3–0,4 | Zwei Spieler, kleines Blatt, Melden. Guter Einstieg in 2-Personen-Tische. |
| **Herzeln / Hearts** | 0,3–0,4 | Keine Trümpfe, Strafpunkte. Regeln kompakt. |
| **Wizard** | 0,35–0,45 | Stichansage je Runde, wechselnde Handgröße. |
| **Watten** | 0,4–0,5 | Bayerisch/österreichisch, viel Hausregel-Varianz. |
| **Schafkopf** | 0,6–0,8 | Rufspiel, Wenz, Solo, Tarif. Regeltiefe unter Doppelkopf. |
| **Jass / Schieber** | 0,6–0,8 | Schweizer Blatt, Trumpfansage, Weis. |
| **Skat** | 0,8–1,1 | Reizen ist ein eigener Ablauf, dazu Null-Ordnung und Spielwert-Tabelle. |
| **Tichu** | 0,8–1,0 | Partner, Bomben, Ansagen. Reizvoll, aber komplex. |
| **Bridge** | 1,3–1,8 | Das Reizen ist eine eigene Sprache. Nur mit klarem Publikum sinnvoll. |

## Ablegespiele — noch billiger, und beste Passform zum USP

Hier zeigt sich „spiel nach euren Regeln" am deutlichsten: Über kaum etwas
wird am Tisch mehr gestritten als über Mau-Mau-Hausregeln.

| Spiel | Aufwand | Anmerkung |
| --- | --- | --- |
| **Arschloch / Präsident** | 0,2–0,3 | **Merkliste.** Rangfolge, Kartentausch nach Platzierung, endloser Hausregel-Katalog. Passt perfekt zum Rundenmodell. |
| **Mau-Mau** | 0,25–0,35 | Sieben zieht zwei, Bube wünscht, Ass aussetzt, Richtungswechsel — jede Familie anders. |
| **Lügen / Cheat** | 0,25–0,35 | Bluff statt Regeltiefe. Bot ist hier reizvoll schwierig. |
| **Elfer raus** | 0,2–0,3 | Sehr einfach, gutes Einsteigerspiel. |
| **Phase 10** | 0,6–0,8 | Phasenliste ist im Grunde ein Regelsatz — passt zum Editor. |

## Sammel- und Auslegespiele — neuer Tisch nötig

Auslagen, Anlegen, Ziehen und Ablegen haben mit der Stich-Oberfläche nichts
zu tun. Der erste zahlt die Tischform.

| Spiel | Aufwand | Anmerkung |
| --- | --- | --- |
| **Rommé** | 0,9–1,3 | Engine mittel, Tisch komplett neu. |
| **Canasta** | 1,0–1,4 | Wie Rommé plus Teams und Sonderwertungen. |
| **Mahjong (Rummy-Art)** | 1,0–1,3 | Steine statt Karten, eigene Grafik. |

## Brettspiele, zwei Personen, perfekte Information

Passen technisch **sehr gut**: streng abwechselnd, ein Zug, klare
Zugliste — genau das Modell der Plattform. Die Schachuhr ist unsere Frist.
Was fehlt, ist die Brett-Tischform und ein Bot, der nicht sofort verliert.

| Spiel | Aufwand | Anmerkung |
| --- | --- | --- |
| **Vier gewinnt** | 0,15–0,25 | Billigster Weg, die Brett-Tischform zu bauen. |
| **Mühle** | 0,2–0,3 | Drei Phasen, überschaubar. |
| **Reversi / Othello** | 0,25–0,35 | Zugerzeugung trivial, Bot einfach brauchbar. |
| **Dame** | 0,3–0,4 | Schlagzwang und Mehrfachsprünge sind die Arbeit. |
| **Backgammon** | 0,5–0,7 | Würfel je Zug, Verdopplungswürfel. |
| **Schach** | 0,6–0,9 | **Merkliste.** Siehe unten. |
| **Go** | 1,0+ | Ko-Regel und Gebietswertung sind machbar; ein brauchbarer Bot ist ein eigenes Projekt, und 19×19 auf dem Handy ist eng. |

### Schach im Einzelnen

**Wofür es spricht:** Die Passform ist die beste von allen. Ein Zug, ein
Spieler, eine Uhr. Und — oft übersehen — **Schach bedient den USP
hervorragend**: Chess960, König der Hügel, Drei-Schach, Atomschach, Horde
sind nichts anderes als frei konfigurierbare Regelsätze. Genau das
Versprechen, nur auf einem Brett.

**Wogegen:** Zwei Sitze statt vier — Lobby-Filter, Trophäenmodell und die
Rundenlogik sind auf drei bis fünf Sitze gebaut und müssten das erste Mal
zweit-tauglich werden. Dazu die Bot-Frage: Für den Zugzwang nach Zeitablauf
reicht ein zufälliger legaler Zug, aber sobald jemand gegen den Bot
*spielen* will, ist das ein eigenes Vorhaben. Und Schach hat bereits
lichess und chess.com — der Wettbewerb ist eine andere Liga als bei
Doppelkopf.

## Würfelspiele — eigene Tischform, aber kleine Engines

| Spiel | Aufwand | Anmerkung |
| --- | --- | --- |
| **Kniffel / Yahtzee** | 0,25–0,35 | Der Block ist die ganze Regel. Würfel-Tischform einmal bauen. |
| **Schocken** | 0,3–0,4 | Sehr verbreitet am Stammtisch, viel Hausregel-Varianz. |
| **Meiern / Mäxchen** | 0,3–0,4 | Bluffspiel, winzige Engine. |
| **Zehntausend** | 0,25–0,35 | Reine Rechnerei, gute Zweitverwertung der Würfel-Tischform. |

## Legespiele

| Spiel | Aufwand | Anmerkung |
| --- | --- | --- |
| **Domino** | 0,3–0,4 | Braucht ein Spielfeld mit Verzweigung. |

## Vorsicht geboten

| Spiel | Aufwand | Warum heikel |
| --- | --- | --- |
| **Poker (Spielgeld)** | 0,5–0,7 | Auch ohne echtes Geld stuft Apple das als Glücksspiel-Simulation ein (Altersfreigabe, in einigen Ländern gesperrt). Dazu widerspricht es dem Grundsatz in `game-api`: Regelwerk und Währung bleiben getrennt. |
| **Werwolf** | 0,5–0,7 | Braucht Nachtphase, Rollen und **freien Text** — also Moderation (Plan M8), die noch aussteht. |
| **Stadt-Land-Fluss** | 0,4–0,6 | Freier Text und menschliche Bewertung. Ohne Moderation nicht vor dem App-Store-Release. |
| **Codenames-artig** | 0,6–0,8 | Freier Hinweistext, Teams, Wortlisten mit Lizenzfragen. |

## Passt nicht zur Plattform

| Idee | Aufwand | Warum |
| --- | --- | --- |
| **Auto-Battler (Merge Tactics)** | 2,5–4 + Dauerkosten | Nicht zugbasiert: `currentActor` gäbe dauernd `null`, `legalActions` müsste jede Einheit auf jedem Feld aufzählen, „Frist abgelaufen, Bot übernimmt" greift nicht. Nichts von der Oberfläche ist wiederverwendbar. Der teuerste Teil hört nie auf: Einheiten, Balancing, Saisons. `docs/plattform-plan.md` schließt es ausdrücklich aus. |
| **Match-3, Idle, Echtzeit-Duelle** | — | Dasselbe Argument. Eigene Produkte, nicht Module. |

---

## Reihenfolge, wenn ich entscheiden müsste

1. **Arschloch oder Mau-Mau** — beweist die Mehrspiel-Architektur zum
   Viertel des Preises und bedient den USP am direktesten.
2. **Skat oder Schafkopf** — nach den Stimmen. Die Abstimmung läuft bereits
   in der Spielauswahl, `/api/games` liefert sie mit. Das ist die billigste
   Marktforschung, die es gibt.
3. **Vier gewinnt** — falls Brettspiele kommen sollen: der günstigste Weg,
   die Brett-Tischform und die Zwei-Sitz-Fähigkeit zu bauen.
4. **Schach** — danach fast geschenkt, weil die Vorarbeit dann steht.

Ein Hinweis zum Schluss: Die Zahl der Spiele ist nicht das
Produktversprechen. Laut Plan lautet es **„spiel nach euren Regeln, über
alle Spiele hinweg gewertet"**. Drei Spiele mit tiefer Regelkonfiguration
tragen weiter als zehn mit festen Regeln.
