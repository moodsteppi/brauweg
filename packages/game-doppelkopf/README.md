# Doppelkopf-Engine

Reine Logik-Bibliothek. Kein UI, kein Netzwerkcode, keine Accounts. Alles
deterministisch und unit-testbar.

## Loslegen

```bash
npm install
npm run build
node --test "dist/test/*.test.js"
```

97 Tests, alle grün, davon 1000 zufällige Runden, 200 gemischte Partien und 1000 vollständig botgespielte Partien.

## Aufbau

| Datei | Inhalt |
|---|---|
| `src/cards.ts` | Kartenmodell, Deck (48/40), Augenwerte |
| `src/ruleset.ts` | RuleSet-Typ mit allen Optionen, Default |
| `src/validator.ts` | Blockt widersprüchliche Regelsätze beim Speichern |
| `src/order.ts` | Trumpfordnung je Spielart, Bedienzwang, Schweinchen |
| `src/vorbehalte.ts` | Rangfolge der Vorbehalte |
| `src/hochzeit.ts` | Klärung, stille Hochzeit |
| `src/armut.ts` | Trumpfabgabe und Rückgabe |
| `src/schmeiss.ts` | Luschen- und Vollen-Erkennung |
| `src/round.ts` | **Rundenablauf-Maschine**, Aktionen, Sichtbarkeitsfilter |
| `src/party.ts` | **Partie-Maschine**, Geberrotation, Pflichtsolo-Zyklus, Bock |
| `src/bot.ts` | **Notfall-Bot**, arbeitet nur auf der gefilterten Sicht |
| `src/trick.ts` | Stichauswertung inkl. Zweite-Dulle-Option |
| `src/deal.ts` | Deterministisches Geben aus Seed |
| `src/bock.ts` | Bock-Fenster-Modell |
| `src/scoring.ts` | Rundenabrechnung, Sonderpunkte |
| `src/pflichtsolo.ts` | Pflichtsolo-Status und Vorführ-Regel |
| `src/pflichtansage.ts` | Pflichtansage und Ansagefristen |
| `src/trophies.ts` | Trophäen aus Platzierung |

## Umgesetzt

- Beide Blattvarianten, Augensumme in beiden Fällen 240
- Normalspiel, Farbsolo (4 Farben), Damensolo, Bubensolo, Fleischlos
- **Schweinchen** (beide Karo-Ass über die Dulle) und **Superschwein**
  (zusätzlich das niedrigste Trumpfpaar auf derselben Hand, steht über den
  Schweinchen). Beides gilt automatisch ohne Ansage
- **Entschärfte Dullen**: Herz-Zehn verliert den Trumpfstatus; im Herz-Solo
  rutscht sie auf ihren Farbplatz zwischen Ass und König
- **Vorbehalts-Rangfolge**: Solo, Schmeissen, Armut, Hochzeit; bei gleicher Art
  entscheidet die Sitzreihenfolge ab Vorhand
- **Hochzeit**: Klärung durch den ersten fremden Stich innerhalb der Frist,
  sonst spielt die Braut allein. Stille Hochzeit zählt als Solo, erfüllt das
  Pflichtsolo, hat aber kein Aufspiel
- **Armut**: ansagbar mit höchstens drei Trümpfen, Abgabe aller Trümpfe (ohne
  Trumpf drei freie Karten), freie Rückgabe gleicher Anzahl, erster Annehmer
  bekommt den Zuschlag, sonst Neugabe
- **Schmeissen**: Lusche ist die Neun, bei Scharfem Doko der König; Volle sind
  Ass und Zehn
- Zweite Dulle sticht Erste als Option
- Bedienzwang mit Trumpf als eigener Farbe
- Sonderpunkte: Fuchs, Karlchen, Doppelkopf, Charlie, Herzdurchlauf, jeweils
  einzeln schaltbar und optional im Solo unterdrückt
- Ansagen und Absagen inklusive **Komplementärregel**: Sagt Re "keine 90" an,
  gewinnt Kontra bereits mit 90 Augen, nicht erst mit 120
- **Punkteschema festgelegt**: additive Punkte zuerst, dann Ansagen-Faktor,
  dann Bock-Faktor
- Verfehlen beide Parteien ihre Absage, endet die Runde mit 0
- Bock-Fenster mit Überlappung, Multiplikator ohne Limit
- Pflichtsolo mit Vorführ-Regel und Sitzreihenfolge ab Vorhand
- Pflichtansage ab 30 Augen (zwingend) und moralischer Hinweis ab 29
- Trophäen aus Platzierung, nullsummig, Mittelwert bei Gleichstand,
  Aussteiger als Letzter plus 10 Abzug. Die Werte (4er: +9/+3/−3/−9,
  5er: +12/+6/0/−6/−12) sind so gewählt, dass jeder Mittelwert ganzzahlig
  bleibt
- Validator inkl. Fuzzing über 2000 zufällige Regelsätze

## Geprüfte Invarianten

- Jede Kartenordnung deckt das Deck vollständig und überschneidungsfrei ab,
  für alle Spielarten, beide Blattvarianten und beide Dullen-Einstellungen
- Geben verteilt jede Karte genau einmal, über 200 Seeds je Variante
- Augensumme einer Runde ist immer 240
- Sitzpunkte einer Runde summieren sich immer zu 0
- Trophäensumme einer Partie ist immer 0
- Trophäen sind bei **jedem** Gleichstandsmuster ganzzahlig, erschöpfend
  geprüft über alle Kompositionen von 3, 4 und 5 Spielern

## Rundenablauf-Maschine (M1)

`src/round.ts` ist der Zustandsautomat. Er ist die einzige Stelle, die Zustand
ändert: eine Aktion rein, ein neuer Zustand raus. Keine Seiteneffekte, kein
Zufall außer dem Seed.

```
vorbehalt -> (armutExchange) -> playing -> finished
                                       \-> redeal
```

Aktionen: `vorbehalt`, `armutAccept`, `armutDecline`, `armutExchange`,
`playCard`, `announce`, `confirmPflichtansage`.

Jede Aktion wird im Automaten validiert, auch wenn der Client sie schon
geprüft hat. Ein illegaler Zug wirft `RuleViolation`.

**Sichtbarkeitsfilter:** `viewFor(state, seat)` liefert die reduzierte Sicht.
Ein Spieler sieht seine Hand, die Kartenanzahl der anderen, den laufenden
Stich, den letzten abgeschlossenen Stich und den aktuellen Punktestand.
Parteizugehörigkeit wird nur offengelegt, wo sie ohnehin sichtbar ist: Solist,
geklärte Hochzeit, Armut-Paar, nach Rundenende. Ein Test prüft, dass fremde
Kartennummern in keiner serialisierten Sicht auftauchen.

**Stille Hochzeit** fällt automatisch heraus: Hält ein Spieler beide
Kreuz-Damen und sagt nichts an, ergibt die normale Parteibildung eine Re-Partei
aus einer Person. Das wird als Solo abgerechnet.

## Partie-Maschine (M2)

`src/party.ts` verbindet Runden zu einer Partie.

- **Geberrotation.** Der Geber wandert, Vorhand sitzt links davon. Am
  5er-Tisch setzt der Geber aus, gespielt wird immer zu viert.
- **Geberrotation statt Tischgröße.** Am 3er-Tisch sitzt ein Bot dauerhaft
  mit, die Rotation umfasst dort also vier Sitze und eine volle Geberrunde
  dauert vier Runden. Der Validator prüft gegen `rotationSize`, nicht gegen
  `tableSize`.
- **Pflichtsolo-Zyklus** über die Partie inklusive Vorführung. Ein
  vorgeführter Spieler bekommt in der Vorbehaltsabfrage nur noch das Solo
  angeboten.
- **Bock-Fenster** werden nach jeder Runde aus den konfigurierten Auslösern
  registriert und wirken auf die Folgerunden. Bockrunden verlängern die Partie
  nie.
- **Neugabe** (Schmeissen, Armut ohne Abnehmer) wiederholt dieselbe Runde mit
  neuem Seed. Geber und Rundenzähler bleiben stehen.
- **Partie-Ende** mit Endstand, Platzierung und Trophäen.

## Notfall-Bot (M3)

Bewusst schwach. Er soll nicht gewinnen, sondern unauffällig einspringen, ohne
die Runde zu zerstören.

- **Keine Ansagen, keine Vorbehalte.** Der Bot erhöht nie den Einsatz und
  wählt nie eine Spielart. Eine moralische Pflichtansage lehnt er ab, eine
  zwingende bestätigt er. Eine Armut nimmt er nie an.
- **Ausnahme Vorführung:** Übernimmt er einen Sitz mit offenem Pflichtsolo,
  muss er ein Solo ansagen. Er wählt dann seine längste Farbe.
- **Kartenwahl:** beim Ausspielen die billigste Karte; hält ein *bekannter*
  Partner den Stich, wird die wertvollste Karte geschmiert; sonst mit der
  knappsten ausreichenden Karte stechen, andernfalls billigste Karte abwerfen.
  Im verdeckten Normalspiel schmiert er nicht, weil er die Partnerschaft nicht
  kennen kann.

**Der Bot sieht nur die gefilterte Spielersicht.** `botAction` nimmt
ausschließlich eine `PlayerView` entgegen, nie den vollen Rundenzustand. Damit
ist strukturell ausgeschlossen, dass er fremde Handkarten kennt. Das ist keine
Stilfrage: ein Bot mit Vollzugriff wäre ein unschlagbarer Mitspieler und ein
Einfallstor, sobald jemand die Bot-Logik in den Client verlagert.

Gemessen gegen zufälliges Kartenlegen holt der Bot über 400 Runden rund 57
Prozent der Augen. Für einen Einspringer reicht das.

## Noch offen

Das Regelwerk ist vollständig, die Rundenmaschine steht. Offen ist die Ebene
darüber:

- Server, Persistenz, UI

## Punkteschema (festgelegt)

Additiv:

| Posten | Wert |
|---|---|
| Grundwert | 1 |
| Gegen die Alten (Kontra gewinnt) | +1 |
| Verlierer unter 90 / 60 / 30 / schwarz | je +1 |
| Absage keine 90 / 60 / 30 / schwarz | je +1 |
| Sonderpunkt (netto zugunsten des Gewinners) | je +1 |

Anschließend multiplikativ, in dieser Reihenfolge:

1. **Re angesagt** verdoppelt, **Kontra angesagt** verdoppelt erneut (beide: x4)
2. **Bock-Multiplikator** der Runde

Solo: Der Solist erhält den dreifachen Wert, jeder Gegner den einfachen.

Hinweis zur Varianz: Beide Ansagen (x4) plus Doppelbock (x4) ergeben x16 auf
eine einzelne Runde. Da "Re und Kontra angesagt" zugleich ein Bock-Auslöser
ist, verstärkt sich das über die Partie. Für die Rangliste unkritisch, weil
Trophäen an der Platzierung hängen.

## Nächster Schritt

M4, Server und Persistenz: Auth, Lobby, Echtzeitverbindung, Reconnect,
Timeout-Balken und Verlassen-Logik.


