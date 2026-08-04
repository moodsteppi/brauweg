# Brauweg — Rundenablauf Doppelkopf (Zeremonie)

Verbindlich für die **Schleife einer Runde**: vom Geben über die
Gesund-Abfrage, das Spiel, das Einsammeln, die Auswertung und den
Zwischenstand bis zum neuen Geben. Ergänzt [DESIGN-DOKO.md](DESIGN-DOKO.md)
(Aufbau des Tisches) und [DESIGN.md](DESIGN.md) (allgemein) — bei
Widerspruch gilt für den Ablauf diese Datei.

Ziel ist **nicht** ein neuer Look, sondern ein **erzählter Ablauf**: Wie am
echten Tisch bekommt jeder Takt einen kurzen, klaren Moment — geben,
fragen, spielen, einsammeln, abrechnen, Stand ansehen, neu mischen. Kein
Takt wird übersprungen, keine tote Wartezeit dazwischen. Vorbild ist der
Rhythmus des Doppelkopf-Palasts (Referenzbilder), umgesetzt aber in
**unserem dunklen Filz** mit unseren Bausteinen und Farben.

## Zwei feste Grundsätze (aus DESIGN-DOKO.md, hier kritisch)

- **Volle Sicht nach jedem Beitritt.** Jeder Takt muss aus dem reinen
  Serverzustand rekonstruierbar sein. Wer mitten in der Runde beitritt
  (oder nach einem Reconnect zurückkommt), sieht den **aktuellen** Takt —
  nie eine nachgespielte Animation, nie eine Blase von vor zehn Sekunden.
  Animationen laufen nur bei einem **echten Übergang**, nie beim ersten
  Snapshot (so wie `seenKey`/`seenDeal` es heute schon halten).
- **Kein Client-Regelwissen.** Punkte, Sieger, Augen, Sonderpunkte kommen
  fertig vom Server. Die Auswertung **zeigt** nur, sie **rechnet nie**.

## Die sechs Takte

1. **Geben** — Karten der Vorrunde sammeln sich zu einem Stapel, mischen,
   austeilen.
2. **„Gesund?"** — jeder wird der Reihe nach gefragt; die Antwort erscheint
   als Sprechblase am Spieler.
3. **Spielen** — Stiche; jeder volle Stich bleibt kurz liegen.
4. **Einsammeln** — am Rundenende ein Blick auf die Stich-Stapel der Vier.
5. **Auswertung** — welche Partei gewonnen hat, Augen und Punkte.
6. **Zwischenstand** — der Tisch-Stand und wie viele Runden bleiben.

Dann von vorn bei 1, bis die Partie zu Ende ist (danach das bestehende
Partie-Ende, `PartyEnd`).

---

## 1 — Geben (sammeln → mischen → austeilen)

Baut auf der bestehenden Austeil-Zeremonie (`DealCeremony`, `doko-deal-*`)
auf, bekommt aber einen **Sammel-Takt** davor:

- **Sammeln (`doko-deal-gather`, ~0,4 s):** Die vier gewonnenen
  Stich-Stapel (`doko-stiche`) an den Sitzen gleiten zur Tischmitte und
  verschmelzen zu einem Stapel. Das ist der sichtbare Übergang „die Runde
  ist vorbei, jetzt wird neu gemischt".
- **Mischen (`doko-deal-mix`) → Austeilen (`doko-deal-fly`):** wie heute.
  Ein Schub je Platz, kein Karte-für-Karte. Danach das Hand-Aufdecken
  (`doko-hand-reveal`).
- Nur nach **vollem Geben** (48 bzw. 40 Karten), erkannt über
  `isVollesGeben` — nicht nach Einzelkarten (Armut).

**Zustand, nicht Zeit:** Der Server sagt „neue Runde, volle Hand" — die
Animation hängt an diesem Übergang. Ein Beitritt mitten im Geben zeigt
einfach die fertige Hand, ohne Zeremonie.

## 2 — „Gesund?" — Frage als Blatt, Antwort als Blase

Die **Entscheidung** bleibt ein Blatt von unten (`doko-sheet`,
`VorbehaltDialog`): „Bist du gesund?" ja/nein, bei Nein die Auswahl, immer
mit Bestätigung. Das ist Regel aus DESIGN-DOKO.md und bleibt — ein Fehltipp
darf keine Runde entscheiden.

**Neu ist die Rückmeldung an den Tisch:** Sobald ein Sitz geantwortet hat,
zeigt eine kurze **Sprechblase** (`doko-blase`) an seinem Avatar das
Ergebnis — genau wie am echten Tisch angesagt:

- „Gesund." — der Normalfall.
- „Vorbehalt", „Hochzeit", „Armut", „Solo · Damen" … — je nach Wahl.
- Später ebenso für Ansagen im Spiel: „Re", „Kontra", „Keine 90".

Ablauf: Die Frage geht **der Reihe nach** (Vorhand zuerst); wer dran ist,
sieht das Blatt, die anderen sehen nacheinander die Blasen aufpoppen. So
wird sichtbar „alle wurden gefragt", bevor die Runde losgeht.

Die Blase ist eine **Ansage, keine Bedienung** — sie ist der erlaubte
Sonderfall zur „Entscheidungen als Blatt"-Regel: man kann sie nicht
antippen, sie verschwindet von selbst (siehe Sprechblasen-Spezifikation
unten).

## 3 — Der Stich bleibt liegen

Ein voller Stich (vier Karten) bleibt **1,6 s** in der Mitte liegen, jede
Karte vor dem, der sie gelegt hat (`doko-trick`, `at-<slot>`), bevor er
abgeräumt wird — auch dann, wenn der nächste Spieler schon herausgekommen
ist (die bestehende `frozenKey`-Härte gegen schnelle Bots bleibt, die Dauer
steigt von 1 s auf **1,6 s**).

- Danach gleitet der Stich zum Gewinner (`doko-trick`→ Stapel des Siegers),
  sein `doko-stiche`-Zähler wächst um eins. Das ist der sichtbare Beleg
  „der hat den Stich".
- Der Knopf ⟲ (letzten Stich nachsehen) bleibt für den ruhigen Blick.

## 4 — Einsammeln: der Blick auf die Stapel

Wenn die letzte Karte der Runde gefallen ist, **kurz innehalten** (~1,5 s):
Die vier Stich-Stapel (`doko-stiche`, mit Anzahl) werden an ihren Sitzen
hervorgehoben — wer wie viele Stiche geholt hat. Kein neuer Bildschirm,
sondern ein Moment auf dem Filz, bevor die Auswertung als Blatt kommt.

## 5 — Auswertung der Runde (`doko-abrechnung`)

Ein Blatt von unten (`doko-sheet`), zweispaltig **Re** (links) und **Kontra**
(rechts) — Parteifarben fest: Re grün (`doko-party--re`), Kontra rot
(`doko-party--kontra`). Je Partei:

- Die Spieler der Partei mit Avatar und Name.
- **Erreichte Punkte:** „7 Stiche, 156 Augen" und die Zeilen, die zählen:
  „Sieg +1", „keine 90 +1" … — genau die Schlüssel, die der Server liefert.
- **Sonderpunkte** (Doppelkopf, Karlchen, Fuchs …), sofern welche fielen.
- **Gesamt** der Partei, groß, in **Gold** (`--gold` = „wert").

Werte kommen fertig vom Server; die Auswertung setzt sie nur. Ein „Teilen"
darf danebenstehen (wie im Vorbild), ist aber optional und zweitrangig.

Weiter geht es mit **„Weiter"** — siehe Steuerung/Zeiten.

## 6 — Zwischenstand (`doko-zwischenstand`)

Ein Blatt mit der **Tafel des Tisches**: alle Sitze nebeneinander mit
Avatar, Name und laufendem Gesamtpunktestand (positiv gold, negativ in
`--danger`), darunter „Verbleibende Runden: n" und **„Weiter"**. Das ist
der ruhige Überblick vor der nächsten Runde — dieselbe Standings-Logik wie
`PartyEnd`, nur zwischendrin und ohne Medaillen.

Danach zurück zu Takt 1 (Geben) — der Loop.

---

## Zeiten & Steuerung

| Takt | Dauer | Weiter durch |
| --- | --- | --- |
| Geben (sammeln + mischen + austeilen) | ~2,2 s | automatisch |
| Antwort-Blase | 1,6 s, dann verblassen | automatisch |
| Voller Stich | 1,6 s | automatisch |
| Stapel-Blick (Rundenende) | ~1,5 s | automatisch |
| Auswertung | Blatt, „Weiter" | Spieler **oder** Auto |
| Zwischenstand | Blatt, „Weiter" | Spieler **oder** Auto |

**Der Tisch darf nie an einem AFK-Spieler hängen.** Auswertung und
Zwischenstand sind Blätter mit „Weiter", aber sie **blockieren nicht**: Der
Server hält eine kurze **Zwischenrunden-Pause** (Vorschlag: 10 s bzw. sobald
alle anwesenden Sitze „Weiter" getippt haben, je nachdem was zuerst kommt)
und startet dann die nächste Runde von selbst. Der Client zeigt in dieser
Pause nacheinander Auswertung → Zwischenstand; startet der Server die neue
Runde, ersetzt das Geben die Blätter.

> **Server-Notiz (offen):** Dafür braucht der Zwischenzustand einen eigenen
> Takt („zwischen den Runden") mit optionalem „Weiter" je Sitz und einem
> Timeout. Die reine Anzeige (dieses Doc) steht; die Engine-Seite ist ein
> eigener Umsetzungsschritt.

## Sprechblasen (`doko-blase`)

- Weiße, runde Blase mit kleinem Zipfel zum Avatar hin — wie im Vorbild,
  aber gedeckt (nicht knallweiß): `--panel`-nahes Weiß, `--text` dunkel,
  weicher Schatten. Position folgt dem Sitz (`slotFor`), Zipfel zeigt zum
  Spieler.
- **Kurzlebig:** einblenden (`doko-pop`), 1,6 s stehen, ausblenden. Nie
  antippbar, nie stapelnd — eine Blase je Sitz, eine neue ersetzt die alte.
- Inhalt ist immer eine **Ansage** (Text über `t()`): „Gesund.",
  „Vorbehalt", „Re", „Kontra", Solo-Name … nie ein Wert, nie eine Zahl.
- Beim ersten Snapshot (Beitritt) **keine** Blase nachziehen — sie gehört
  zum Übergang, nicht zum Zustand.

## Was neu ist, was schon steht

**Steht schon** (nur verfeinern):
- Austeil-Zeremonie `DealCeremony`, Hand-Aufdecken, `isVollesGeben`.
- Stich-Freeze über `frozenKey` (Dauer 1 s → **1,6 s**).
- Stich-Stapel `doko-stiche` mit Anzahl je Sitz.
- Vorbehalt als Blatt (`VorbehaltDialog`), Ansage-Aktionen aus `legalActions`.
- Partie-Ende `PartyEnd` mit Standings (Basis für den Zwischenstand).

**Neu zu bauen:**
- `doko-blase` — Sprechblasen für Ansagen (Takt 2, später Ansagen im Spiel).
- `doko-deal-gather` — Stapel-Sammeln als Auftakt des Gebens (Takt 1).
- Stapel-Blick am Rundenende (Takt 4) — Hervorhebung, kein neuer Screen.
- `doko-abrechnung` — Auswertungs-Blatt je Runde (Takt 5).
- `doko-zwischenstand` — Zwischenstand-Blatt (Takt 6).
- Server: Zwischenrunden-Takt mit „Weiter"/Timeout (siehe Server-Notiz).

## Bewegung & Barrierefreiheit

- Alle Bewegungen sind **Zierde und kurz** (Blase 1,6 s, Sammeln 0,4 s,
  Stich 1,6 s). Nichts trägt Information allein über Bewegung — die Blase
  sagt denselben Text auch ohne Animation.
- Jede Animation endet ersatzlos unter
  `@media (prefers-reduced-motion: reduce)`: Blasen erscheinen und
  verschwinden hart (aber werden gezeigt), das Sammeln entfällt, das
  Austeilen springt zum Ergebnis, der Stich-Freeze bleibt (er ist Lesezeit,
  keine Animation).

## Assets

**Keine gemalten Bilder nötig.** Der ganze Ablauf entsteht aus Filz,
Karten, Tokens und bestehenden Bausteinen (Blatt von unten, Stich-Stapel,
Avatare). Sonderpunkte-Symbole (Fuchs, Karlchen, Doppelkopf) sind, falls
gewünscht, kleine **Strich-SVGs** im Bundle (wie `regelbilder.ts`), keine
externen Dateien. Sollte sich das ändern, kommt eine eigene Bestellung im
Muster von [ASSETS-DOKO.md](ASSETS-DOKO.md).

## Festgelegte Entwürfe & Datenvertrag (Umsetzung)

Aus den A/B/C-Entwürfen (`packages/client/art/ablauf-entwuerfe/`) ist
gewählt: **Auswertung → A**, **Zwischenstand → C**. Beide sind **rein
clientseitig** baubar — die Daten liegen schon vor.

### Auswertung A (`doko-abrechnung`)

- Blatt über dem Filz, **zwei Spalten**: Re links (grünes Banner,
  `doko-party--re`), Kontra rechts (rotes Banner, `doko-party--kontra`).
  Im Solo steht der Solist allein als „Re", die drei anderen als „Kontra".
- Je Partei: die **Avatare** der Spieler (Ring in Parteifarbe), darunter
  eine Aufschlüsselung Zeile für Zeile:
  - **Kartenpunkte** (Augen) — `result.rePoints` / `result.kontraPoints`.
  - **Spielwert-Zeilen** — Grundwert, „gegen die Alten", „keine 90/60/30",
    „schwarz", Ansagen; abgeleitet aus `result`, Texte über `t()`.
  - **Sonderpunkte** — je Eintrag aus `result.specials` (Fuchs, Karlchen,
    Doppelkopf, Charlie, Herzdurchlauf) mit Partei.
  - **Gesamt** groß in **Gold** (`--gold`) — der Rundenwert je Kopf, Zeichen
    je Partei aus `result.scores`.
- Unten **„Weiter"** über die volle Breite.

### Zwischenstand C (`doko-zwischenstand`)

- Gerahmte Tafel, Titel „Zwischenstand" (Versalien, Gold) mit Rauten-Trenner.
- **2×2-Raster** der Sitze: Avatar mit Gold-Ring, Name, **kumulierter**
  Punktestand — **+ in Gold, − in `--danger`**. Quelle: `view.scores` je Sitz,
  Namen aus `party.seats`.
- Fußzeile: kleines Karten-Icon + „Verbleibende Runden: n"
  (`totalRounds − roundIndex − 1`).
- **„Weiter"** in Grün (`--accent`).

### Datenvertrag — steht bereits

Beide Blätter brauchen **keine neuen Serverdaten**:

- **Auslöser:** `round.phase === 'finished'`. Die Engine (`round.ts`) setzt
  das nach dem Zählen, deckt alle Hände auf und füllt `round.result`.
- **`round.result`** (heute clientseitig `unknown`) wird typisiert nach dem,
  was die Engine liefert (`RoundResult` in `game-doppelkopf/scoring.ts`):

  ```ts
  interface RoundResult {
    rePoints: number;
    kontraPoints: number;
    winner: 're' | 'kontra' | null;
    value: number;                 // Spielwert je Kopf, inkl. Bock
    specials: {
      kind: 'fuchs' | 'karlchen' | 'doppelkopf' | 'charlie' | 'herzdurchlauf';
      party: 're' | 'kontra';
      trickIndex: number;
    }[];
    scores: Record<number, number>; // Punkte je Sitz, Summe 0
    isSolo: boolean;
    soloSeat: number | null;
  }
  ```

- **Re/Kontra je Sitz:** `round.knownParties` (bei `finished` vollständig
  aufgedeckt).
- **Zwischenstand:** `view.scores`, `view.roundIndex` / `view.totalRounds`,
  `party.seats` — alles vorhanden.

Reihenfolge im `finished`-Takt: **Auswertung** → **Zwischenstand** → der
Server startet die nächste Runde, deren Geben die Blätter ersetzt.

### Einzige Server-Anpassung

Der `finished`-Takt muss **lang genug stehen** und ein **„Weiter" je Sitz**
(mit Timeout) kennen, damit der Tisch weder hetzt noch an einem AFK-Spieler
hängt. Die reine Anzeige läuft ohne Serveränderung; nur das Tempo des
Zwischenrunden-Halts braucht die Engine-Seite.

### Umsetzungs-Reihenfolge (Vorschlag)

1. `round.result` typisieren (Client-Protokoll) + `doko-zwischenstand` und
   `doko-abrechnung` als Komponenten, eingehängt bei `phase === 'finished'`.
2. CSS für beide Blätter (Tokens, keine gemalten Bilder).
3. Ceremony-Feinschliff: Stich-Freeze 1 s → 1,6 s, `doko-blase`,
   `doko-deal-gather`, Stapel-Blick.
4. Server: Zwischenrunden-Halt mit „Weiter"/Timeout.
