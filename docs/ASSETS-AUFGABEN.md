# Bildbestellung: Tagesaufgaben

Es gibt sechs Tagesaufgaben, jeden Tag dieselben: eine Partie spielen, drei
Partien, eine gewinnen, je eine Partie Doppelkopf und Zauberer, sechzig Karten
legen. Sie stehen mit Fortschrittsbalken auf dem Aufgaben-Bildschirm, zusammen
mit den Truhen.

**Der Bildschirm funktioniert vollständig** — er besteht aus Holztafeln,
Balken und Text, also aus vorhandenen Bausteinen. Diese Bestellung gibt den
Aufgaben ein Gesicht: **sechs Zeichen und ein Kopfbild.** Mehr braucht es nicht,
und mehr wäre auch falsch: Eine Aufgabenliste, in der jede Zeile ein gemaltes
Bild trägt, liest sich nicht mehr als Liste.

---

## Für alle Bilder verbindlich

**Format**
- PNG mit **echtem Alphakanal**, sRGB.
- Originale nach `packages/client/art/aufgaben/`. Die Auslieferungsfassung als
  WebP erzeuge ich daraus — **Originale gehören nicht nach `public/`**.

**Echte Transparenz — der häufigste Fehler**
Kein Schachbrett-Muster und keine weiße oder schwarze Fläche als
„Transparenz". Probe: auf knallroten **und** auf weißen Grund legen, gleich
hell, ohne Saum.

**Was NICHT ins Bild gehört**
- **Keine Schrift und keine Zahlen.** Der Aufgabentext und „2 / 3" stehen als
  Text daneben. Die Ziele können sich ändern — sechzig Karten heute, achtzig
  morgen.
- **Kein Häkchen und kein Schloss.** Beides setzt die App als Zustand; ein
  eingebranntes Häkchen wäre auch dann da, wenn die Aufgabe offen ist.
- Keine Bedienelemente, kein Rahmen, kein Fortschrittsbalken.
- Kein Alkohol.

**Ton und Stil**
Wie die Bedien-Icons des Hubs (`icon-truhe.webp`, `icon-chat.webp`): gemalt,
warm, satt, mit klarer Silhouette. Nicht als Strich-Icon — die sind laut
DESIGN.md für Bedienelemente reserviert, und das hier sind Bildchen.

**Lesbar bei 36 Pixeln.** Das ist die Größe in der Zeile. Ein Zeichen, das
erst groß erkennbar wird, ist an der einzigen Stelle wirkungslos, an der es
vorkommt: **große Form, ein Gedanke je Bild, höchstens drei Farben.**

---

## 1 — Sechs Aufgaben-Zeichen

**Maße:** je **192 × 192** px, Motiv mittig, ringsum etwas Luft.
**Ablage:** `packages/client/public/hub/aufgaben/`

Die Dateinamen entsprechen den Kennungen aus
`packages/server/src/quests.ts` — sie werden im Client direkt daraus
zusammengesetzt, deshalb müssen sie **genau so** heißen.

| Datei | Aufgabe | Motiv |
| --- | --- | --- |
| `quest-partie-spielen.png` | Spiel eine Partie | Eine einzelne Spielkarte, leicht schräg, mit sichtbarer Rückseite. Die einfachste Aufgabe, das einfachste Bild. |
| `quest-drei-partien.png` | Spiel drei Partien | Drei Karten als Fächer. Muss vom Bild darüber auf 36 px **an der Anzahl** unterscheidbar sein — also klar getrennte Karten, kein dichter Stapel. |
| `quest-partie-gewinnen.png` | Gewinn eine Partie | Ein kleiner Siegerkranz oder eine Medaille. **Nicht der Pokal** — `pokal.png` steht für Trophäen, und die haben mit Tagesaufgaben nichts zu tun. |
| `quest-doppelkopf-am-tag.png` | Ein Doppelkopf am Tag | Zwei Kreuz-Damen nebeneinander — das Zeichen des Spiels. Die Farbsymbole dürfen ins Bild, sie sind keine Schrift. |
| `quest-zauberer-am-tag.png` | Ein Zauberer am Tag | Ein Zauberhut mit Sternen, in der kühleren Palette des Zauberer-Blatts (siehe [ASSETS-WIZARD.md](ASSETS-WIZARD.md)). |
| `quest-karten-legen.png` | Leg 60 Karten | Eine Hand voll Karten, die eine davon nach unten gelegt — Bewegung nach unten, damit „legen" und nicht „halten" gemeint ist. |

**Abnahme:** Alle sechs nebeneinander auf **36 px**. Jedes ist von jedem anderen
zu unterscheiden, und keines wird mit `pokal.png` oder `muenze.png` verwechselt.

---

## 2 — Kopfbild des Bildschirms (ein Bild)

`bg-aufgaben.png` — **1024 × 1536** (Hochkant 2 : 3), sRGB, **kein Alpha nötig**.

**Wozu:** Der gemalte Vollbild-Hintergrund des Aufgaben-Bildschirms. Heute läuft
er ohne eigenen Hintergrund; die übrigen Hub-Bereiche haben je einen
(`bg-shop.webp`, `bg-clan.webp`, `bg-profil.webp`, `bg-blatt.webp`).

**Motiv:** Eine Anschlagtafel oder ein Aushang an einer Wirtshauswand von außen
— Holz, ein paar Nägel, warmes Tageslicht von schräg oben. **Kein Alkohol**,
also keine Fässer, kein Krug, kein Schild mit Bierbezug.

**Zonen**

| Höhe | Was dort liegt | Anforderung |
| --- | --- | --- |
| 0–12 % | Kopfzeile mit „Zurück" und Stand | ruhig, eher dunkel |
| 12–95 % | Holztafeln mit Aufgaben und Truhen | **sehr ruhig und gleichmäßig** — hier liegt alles |
| 95–100 % | unterer Rand | ruhig |

**Beschnitt:** Auf hohen Handys bleiben verlässlich nur die **mittleren 70 % der
Breite** sichtbar (15 % bis 85 %). Die volle Höhe bleibt. Details gehören
deshalb in diesen Streifen oder an den unteren Rand.

**Abnahme:** Mit zwei Holztafeln darüber ist jede Textzeile lesbar. Das ist die
einzige Anforderung, die zählt — der Hintergrund ist Bühne, nicht Bild.

---

## Was NICHT bestellt wird

- **Kein Truhenbild.** Das steht in [ASSETS-TRUHEN.md](ASSETS-TRUHEN.md).
- **Kein Balken.** Der Fortschrittsbalken der Aufgaben ist derselbe Baustein wie
  bei den Stufen; wird er gemalt, kommt er über
  [ASSETS-STUFEN.md](ASSETS-STUFEN.md) und gilt dann für beide.
- **Kein Bild für „erledigt".** Das Häkchen ist ein Zeichen im Text, und die
  erledigte Zeile wird schlicht blasser.

---

## Danach

1. **Umwandeln:** Zeichen auf 108 px (dreifache Anzeigegröße von 36),
   Hintergrund auf 1024 px Breite. Dann WebP Qualität 85 — der ganzseitige
   Hintergrund landet damit bei 100–300 kB.
2. **Ablegen:** Zeichen unter `packages/client/public/hub/aufgaben/`, der
   Hintergrund direkt unter `public/hub/` wie die anderen `bg-*`. Originale nach
   `packages/client/art/aufgaben/`.
3. **Einbauen:** In `AufgabenZeile`
   (`packages/client/src/screens/Aufgaben.tsx`) kommt ein `<img>` mit
   `/hub/aufgaben/quest-${aufgabe.id}.webp` vor den Text; der Hintergrund geht
   über `HubSzene bg="/hub/bg-aufgaben.webp"` wie in den anderen Tabs.

**Die Aufgaben selbst werden nicht angefasst.** Welche es gibt, was sie
verlangen und was sie einbringen, steht am Server
(`packages/server/src/quests.ts`).

**Keine Platzhalter unter diesen Namen.** Bis zur Lieferung läuft der Bildschirm
ohne Zeichen und ohne eigenen Hintergrund — vollständig benutzbar, nur
schmuckloser. Ein leeres PNG unter dem künftigen Namen wäre ein weißer Kasten,
und die sind hier schon zweimal live gegangen.
