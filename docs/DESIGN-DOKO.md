# Brauweg — Design-Richtlinien Doppelkopf-Tisch

Verbindlich für alles im Spiel: Wartebereich, Runde, Partie-Ende, Lobby
(Tischerstellung). Allgemeines steht in [DESIGN.md](DESIGN.md) — bei
Widerspruch gilt für den Tisch diese Datei.

## Der Tisch ist heilig

Während einer Runde zählt nur das Spiel. Alles auf dem Filz dient dem
Zug, der gerade ansteht:

- **Keine Ablenkung:** kein Shop, keine Bald-Marken, keine Werbung für
  irgendetwas auf dem Spielbildschirm.
- **Kein Client-Regelwissen:** Jede Schaltfläche entsteht aus
  `legalActions`, jede Kartenordnung kommt als `order` vom Server. Der
  Client bildet niemals Doppelkopf-Regeln nach.
- **Volle Sicht nach jedem Beitritt:** Der Server schickt immer den
  ganzen Stand; der Client hält keinen eigenen Verlauf.

## Aufbau (Hochkant-Handy)

Fester Bildschirm (`.doko`, `position: fixed`), nichts rollt:

1. **Kopfzeile** (`doko-top`): ‹ Verlassen, Runde x/y + Spielart,
   rechts § (Regeln nachlesen), − / + (Kartengröße), Abzeichen (Bock,
   Zuschauer).
2. **Filz** (`doko-felt`): Mitspieler an den Rändern (`slotFor`-Plätze),
   Stich in der Mitte, jede gelegte Karte vor ihrem Spieler.
3. **Eigener Bereich** (`doko-me`): Avatar, Name, Partei, Zähler.
4. **Aktionsleiste** (`doko-actions`): nur Ansagen und Armut-Antworten.
5. **Hand** (`doko-hand`): gefächert, nach Stärke sortiert.

## Karten

- Maße über Variablen: `--hw` (Hand), `--tw` (Stich), `--bw` (Rücken),
  Seitenverhältnis `--pc-ratio`. Der Nutzer skaliert mit `--zoom`
  (0.7–1.45, am Gerät gespeichert) — neue Kartendarstellungen müssen
  mitskalieren.
- **Alle Handkarten sehen gleich aus.** Keine Hervorhebung spielbarer,
  kein Abdunkeln unspielbarer. Der Tipp auf eine unspielbare Karte
  antwortet mit kurzem Schütteln (`is-shake`), die Karte bleibt liegen.
- **Trumpf** ist ein schmaler grüner Balken am unteren Kartenrand
  (`doko-trump-bar`) — nie eine Umfärbung der Karte.
- Fremde Handkarten gehen **nie** an den Client, auch nicht versteckt.

## Farben am Tisch

- **Re** grün (`doko-party--re`), **Kontra** rot (`doko-party--kontra`),
  **Aufspiel** grüne Plakette, **Bock** orange. Diese Zuordnung ist fest.
- Der Filz bleibt dunkelgrün-ruhig; leuchten darf nur, was gerade
  wichtig ist (Zug-Ring am Avatar, Zugtimer).

## Entscheidungen als Blatt

Alles, was eine Antwort verlangt, kommt als Blatt von unten
(`doko-sheet`), nie als Knopfreihe, auf der ein Fehltipp eine Runde
entscheidet:

- **Vorbehalt:** erst „Bist du gesund?" (ja/nein), bei Nein die Auswahl,
  immer mit Bestätigung.
- **Pflichtansage, Kartenauswahl (Armut), Regeln nachlesen:** gleiches
  Muster. Tipp auf den Hintergrund schließt, wo kein Zwang besteht.

## Namen und Profile

- Spielernamen sind Wege zum Profil (`spielername`, unterstrichen) — im
  Wartebereich, am Filz, am Partie-Ende. Bots und freie Plätze bleiben
  Text: Ein Bot hat kein Profil, und so sieht man nebenbei, wer echt ist.
- Avatare: Bild oder Initialen auf fester Sitzfarbe (`SEAT_HUES`), aktiver
  Sitz bekommt den Zug-Ring mit ablaufender Uhr.

## Rückmeldung

- Jede Aktion, auf die der Server antworten muss, zeigt sofort einen
  Zwischenstand (Kreisel im Knopf, gesperrter Knopf) — nie einen stummen
  Knopf, der Doppeltippen provoziert.
- Fehler erscheinen als rote Pille (`doko-error`) nahe der Ursache und
  verschwinden mit der nächsten gültigen Nachricht.
- Die Legeanimation liegt auf einem inneren Element (`doko-trick-in`),
  damit die Platzierung unberührt bleibt; unter „weniger Bewegung"
  entfällt sie.

## Lobby (Tischerstellung)

- Läuft auf demselben Filz (`doko doko--lobby`): Kopfzeile mit ‹ und
  Spielname, darunter rollender Inhalt (`lobby-rolle`).
- Spieler- und Rundenzahl als **Chips** (`lobby-chip`), nie als
  Auswahlfelder.
- Regeln als **eine Zeile mit Stand** („0 von 24 an — Grundspiel"), die
  das Kachel-Blatt öffnet. Kacheln mit Bild (`regelbilder.ts`), aktiv =
  goldener Rand mit Haken. Dieselben Kacheln zeigt das Nachlese-Blatt (§)
  am Tisch — eine Optik, zwei Orte.
- Offene Tische als Reihen mit einem Punkt je Platz (voll/frei) und
  „Beitreten".

## Was am Tisch verboten ist

- Emojis als Bedienelemente (als Schmuck im Partie-Ende: 🥇🥈🥉 erlaubt).
- Töne (bis es eine bewusste Ton-Entscheidung gibt).
- Alles, was den Tisch verlässt, ohne dass der Spieler es wollte —
  einzige Ausnahme: der bewusste Tipp auf einen Spielernamen.
