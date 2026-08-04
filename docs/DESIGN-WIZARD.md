# Brauweg — Design-Richtlinien Zauberer-Tisch

Ergänzung zu [DESIGN-DOKO.md](DESIGN-DOKO.md): **Alles dort gilt hier
unverändert** — fester Vollbild-Tisch, keine Ablenkung, kein Regelwissen im
Client, Entscheidungen als Blatt von unten, Namen als Weg zum Profil, keine
Töne. Hier steht nur, was der Zauberer zusätzlich braucht.

## Was dieses Spiel anders macht

Es gibt **keine Parteien**. Jeder spielt für sich, es gibt kein Re und kein
Kontra und nichts Verdecktes außer den Handkarten. Dafür gibt es drei Zahlen,
die ständig sichtbar sein müssen:

1. **Das Gebot jedes Sitzes** — öffentlich, ab der Ansage bis zum Rundenende.
2. **Die gemachten Stiche jedes Sitzes** — ebenfalls öffentlich.
3. **Die Summe aller Gebote gegen die Stichzahl** („2 auf 3"). Sie sagt, ob
   die Stiche knapp oder überzählig sind, und entscheidet, wie man spielt.

Ohne diese Zahlen ist keine einzige Karte zu beurteilen. Sie sind deshalb
keine Zusatzanzeige, sondern Teil des Tisches.

## Bausteine

- **Gebot/Stiche am Sitz** (`wiz-gebot`): `2/1` unter dem Namen. Stimmen beide
  überein, wird die Pille grün (`is-genau`) — der Zustand, den alle anstreben.
  Vor der eigenen Ansage steht ein Gedankenstrich, nie eine Null: Eine Null
  wäre eine Aussage, die noch niemand gemacht hat.
- **Trumpf-Plakette** (`wiz-trumpf`): die aufgedeckte Karte liegt am Tisch,
  nicht in der Kopfzeile. Wer den Trumpf sucht, sucht eine Karte. Ohne Trumpf
  steht dort ein leerer Rahmen und „kein Trumpf" — nicht nichts. Sie hängt
  **unten links** am Filz: Auf halber Höhe sitzt in jeder Verteilung ein
  Mitspieler, und dort lag sie zuerst — über Avatar, Gebot und Punktestand.
  Wer sie verschiebt, prüft das mit drei **und** mit sechs Sitzen.
- **Gebotsblatt** (`wiz-gebote`): Zahlen als große Chips, damit der Daumen
  trifft. **Verbotene Zahlen bleiben sichtbar**, durchgestrichen und mit
  Begründung am Tooltip: Eine Zahl, die kommentarlos fehlt, sieht aus wie ein
  Fehler. Bestätigt wird in zwei Schritten (wählen, dann ansagen) — eine
  Fehlansage kostet die ganze Runde.
- **Trumpfwahl** (`wiz-farben`): vier Farbkacheln, sonst nichts.
- **Rundenblatt**: nach jeder Runde Gebot, Stiche, Punkte und Gesamtstand.
  Schließt nach zehn Sekunden von selbst — bei bis zu zwanzig Runden darf ein
  abgelenkter Mitspieler die anderen nicht aufhalten.
- **Punktetafel** (`wiz-tafel`): alle Runden untereinander, je Zelle
  `Gebot/Stiche` klein und der Stand groß. Rollt in sich, nie die Seite.

## Sechs Sitze

Der Zauberer ist das erste Spiel mit sechs Plätzen. Auf einem Hochkant-Handy
passen keine drei Plätze nebeneinander an den oberen Rand, ohne dass Namen
abschneiden. Deshalb sitzen **links und rechts je zwei übereinander**
(`at-left-high` / `at-right-high`), einer oben, der eigene unten.

## Zwei Blätter, die es hier gibt

- **Blinde erste Runde:** Die eigene Karte bleibt verdeckt, die der anderen
  liegen offen am jeweiligen Sitz. **Gespielt wird sie wie jede andere Karte —
  durch Antippen**, mit demselben Schütteln, wenn man nicht dran ist. Ein
  eigener Knopf dafür war ein Fremdkörper: Am Tisch spielt man Karten, man
  drückt keine Schaltflächen. Der Satz „Deine Karte kennst du nicht — die der
  anderen schon" steht darunter, sonst liest sich die verdeckte Hand wie ein
  Fehler.
- **Geber wählt blind:** Während der Trumpfwahl sieht der Geber seine eigene
  Hand nicht. Das ist Regel, nicht Anzeige — es kommt so aus `viewFor`.

## Handkarten: der Abstand hängt an der Handgröße

Beim Doppelkopf sind es immer zwölf Karten, hier eine bis zwanzig. Der feste
Schritt aus `styles.css` legte drei Karten zu zwei Dritteln übereinander,
obwohl die halbe Breite frei war. Der Zaubertisch setzt deshalb `--luecken`
(Zahl der Zwischenräume) je Runde, und der Schritt wächst bis zur vollen
Kartenbreite plus 5 px. Wer das ändert, prüft **eine** Karte und **zwanzig**.

## Was hier NICHT hingehört

- Keine Trumpf-Umfärbung der Karten. Was sticht, trägt den schmalen grünen
  Balken (`doko-trump-bar`) — bei Zauberern ebenso, denn sie stechen alles.
- Keine Rechnung im Client. Auch die Punktetafel zeigt nur, was der Server
  in der Sicht mitliefert.
- Keine Austeil-Zeremonie. Sie gehört zum vollen Blatt; hier wächst die
  Handgröße mit jeder Runde, eine Zeremonie für zwei Karten wirkt albern.
