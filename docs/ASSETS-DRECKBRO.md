# Bildbestellung: DreckBro

DreckBro (Pinguine einsauen, 2 bis 5 Spieler, seit dem 04.11.2026) läuft
bisher mit **gezeichneten Platzhaltern**: Pinguin, Kartenmotive und das
Hub-Banner sind SVG im Client (`packages/client/src/minispiele/dreckbro/Bilder.tsx`,
`packages/client/public/hub/banner-dreckbro.svg`). Das ist spielbar und
sieht nicht kaputt aus, reicht aber nicht an die gemalten Spiele heran.
Diese Bestellung ersetzt die Platzhalter.

**Wichtig zur Herkunft:** DreckBro ist ein eigenes Spiel im Genre „Tiere
einsauen", kein Nachbau eines Verlagsspiels. Die Bilder dürfen deshalb
**nichts** aus „Drecksau" (Kosmos) übernehmen — keine Schweine, keinen
Stall, keinen Bauernhof, keinen Blitz, keine Kartenrahmen in dessen Stil.
Unsere Welt ist Eis und Schlamm, unsere Figur der Pinguin.

Zwölf Dateien.

---

## Für alle Bilder verbindlich

**Format**
- PNG, sRGB, Maße je Datei unten.
- Freigestellte Teile mit **echtem Alphakanal**. **Kein Schachbrett-Muster**
  und **keine weiße Fläche** als „Transparenz". Probe: auf knallroten Grund
  legen — sichtbar ist nur der Pinguin, ohne hellen Saum.

**Bitte in voller Auflösung liefern.** Gewandelt wird beim Einbau mit
`~/bildwerkzeug/wandeln.mjs` (Original ins Archiv `brauweg-art`, WebP ins
Repo — **nie** die Originalauflösung unter `public/`).

**Was NICHT ins Bild gehört**
- **Keine Schrift, keine Zahlen, keine Kartennamen.** „Pfütze",
  „Schneeball" usw. setzt die App über das Bild; eingebrannter Text lässt
  sich weder übersetzen noch korrigieren.
- Keine Schweine, kein Stall, kein Bauernhof (siehe oben).
- Keine Bedienelemente, kein Handyrahmen, kein Alkohol.

**Ton und Stil**
Wie das Pinguin-Maskottchen der App: rund, freundlich, plastisch, Licht von
oben links. Der Schlamm ist **lustig, nicht eklig** — warmes Braun
(um `#7a4a22`), glänzende Kleckse, keine Fliegen.

---

## 1–3 — `pinguin-0.png`, `pinguin-1.png`, `pinguin-2.png`

**Wo:** Die drei Pinguine jedes Spielers, am Handy oft nur 54 px breit.
**Maße:** 512 × 560, freigestellt, Pinguin steht unten mittig, Füße auf
Höhe 95 %.
**Motiv:** Derselbe Pinguin in drei Stufen. Die Stufen **müssen sich auf
54 px Breite unterscheiden lassen** — das ist das ganze Spiel:
- `0` blitzblank, ein bisschen zu ordentlich, leicht genervt.
- `1` fleckig: drei, vier Kleckse am Bauch und am Kopf, neugierig.
- `2` ganz im Schlamm: Bauch braun, Augen vor Freude zugekniffen,
  Schnabel offen, Schlammpfütze unter den Füßen.

## 4 — `iglu.png`

**Wo:** Liegt als eigene Ebene **über** dem Pinguin (Schutz vor
Schneeball, Eisregen und Robbe).
**Maße:** 512 × 560 wie der Pinguin, freigestellt.
**Motiv:** Eine **halbdurchsichtige** Eiskuppel aus Blöcken, der Pinguin
dahinter muss samt Dreckstufe erkennbar bleiben. **Ecken und Innenfläche
müssen durchsichtig sein** — eine undurchsichtige Ecke löscht beim
Stapeln alles darunter (CLAUDE.md, Pinguin-Fall).

## 5–11 — Kartenmotive `karte-<art>.png`

**Wo:** Mittelfeld der Spielkarte, zwischen Namensleiste (oben) und
Regeltext (unten), beides setzt die App.
**Maße:** 512 × 512, freigestellt, Motiv mit 8 % Rand.
**Je eine Datei:**
- `karte-pfuetze.png` — eine glänzende Schlammpfütze, Klecks spritzt hoch.
- `karte-schlammrutsche.png` — eine Eisrutsche, die in Schlamm mündet.
- `karte-schneeball.png` — ein fliegender Schneeball mit Bewegungslinien.
- `karte-eisregen.png` — eine Wolke, aus der Eiskörner prasseln.
- `karte-iglu.png` — ein Iglu von außen, Eingang dunkel.
- `karte-tauwetter.png` — eine Sonne über einem schmelzenden Eisblock.
- `karte-robbenklau.png` — eine verschmitzte Robbe, die einen Pinguin am
  Flügel mitzieht.

## 12 — `banner-dreckbro.png`

**Wo:** Kachel in der Spielauswahl und Kopf des Spiel-Einstiegs
(`bannerFuer` in `StartNeu.tsx`).
**Maße:** 1200 × 800, **ohne** Alpha.
**Motiv:** Drei Pinguine in einer Schlammpfütze vor Eisbergen, der mittlere
ganz eingesaut und glücklich. **Die obere Hälfte ruhig halten** — dort
liegen am Einstieg Titel und Zurück-Knopf.

---

## Abnahme

- Jede freigestellte Datei auf Rot geprüft, Ecken durchsichtig.
- Die drei Pinguinstufen nebeneinander bei 54 px Breite unterscheidbar.
- Kein Buchstabe, keine Ziffer in irgendeinem Bild.
- Gewandelt: Pinguin und Kartenmotiv je unter 40 kB, Banner unter 160 kB
  (`banner-brochess.webp` liegt bei 152 kB).

## Einbau

`PinguinBild` und `KartenMotiv` in `Bilder.tsx` behalten ihre Schnittstelle
und zeigen dann `<img>` auf die WebP statt des SVG; die Ausnahme für
`dreckbro` in `bannerFuer` fällt weg, und `banner-dreckbro.svg` wird
gelöscht. **Erst einbauen, wenn die Dateien da sind** — kein `<img>` auf
eine Datei, die es noch nicht gibt.
