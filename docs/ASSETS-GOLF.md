# Bilder für Golf

Nach CLAUDE.md Regel 5 wird neue Grafik **bestellt, nicht beschrieben**. Diese
Bestellung ist geschrieben, **bevor** ein einziges Bild existiert: Golf läuft
komplett ohne geladene Bilder — die Bahn malt der Zeichner selbst
(`packages/client/src/minispiele/golf/zeichnen.ts`, vier Farbpaletten
`STIMMUNGEN` für die Dekore `wiese`/`wueste`/`eis`/`nacht`), und das Banner in
der Spielauswahl zeichnet vier Bots, die eine Schaubahn spielen
(`packages/client/src/minispiele/golf/Banner.tsx`). Golf steht deshalb bis
heute in keiner `GEMALTE_BANNER`-Liste (`packages/client/src/hub.tsx:69-89`)
und zeigt im Themen-Tab das gemeinsame „Bald"-Motiv. **Kein `<img>` auf eine
Datei, die es noch nicht gibt.**

Stand: 22. September 2026, nichts geliefert.

---

## 1 — Was gebraucht wird

| Was | Ziel unter `packages/client/public/` | Anzahl | Maß | Format |
| --- | --- | --- | --- | --- |
| Hub-Banner Spielauswahl | `hub/spielwahl-golf.webp` | 1 | 1200 × 300 (4:1) | WebP q82, kein Alpha |
| Untergrund-Texturen je Thema (**ggf.**, siehe unten) | `golf/untergrund/` | 4 | offen — kachelbar, keine Referenzgröße im Code | WebP q80, kachelbar |
| Icons je Zonenart (für die kommende Bahnauswahl) | `golf/zonen/` | 9 | 64 × 64 (Faustregel „dreifache Anzeigegröße", DESIGN.md; genaue Anzeigegröße offen, da die Bahnauswahl noch nicht gebaut ist) | WebP q85, Alpha |
| Vorschau-Rahmen (für dieselbe kommende Bahnauswahl) | `golf/` | 1 | offen — hängt am Layout der Bahnauswahl | WebP q85, Alpha |

Die neun Zonenarten (`packages/client/src/minispiele/golf/karte.ts`, Typ
`Zone`): Beschleuniger, Sand, Eis, Wasser, Portal, Bumper, Strudel,
Sprungfeld, Drehkreuz.

**Bahnauswahl gibt es noch nicht.** Weder im Client noch in der Doku findet
sich ein Bildschirm, der 40 Bahnen zur Wahl stellt (`grep -rn
"Bahnauswahl" packages/ docs/` liefert nichts) — Icons und Rahmen sind hier
mit Blick auf diesen Bildschirm bestellt, nicht für einen, der schon steht.
Wird die Bahnauswahl gebaut, bevor die Bilder da sind, läuft sie mit Text
oder gezeichneten Platzhaltern weiter — dieselbe Regel wie beim Banner.

---

## 2 — Maße, und warum genau diese (oder eben offen)

**Das Hub-Banner** folgt exakt der Vorgabe aus
[ASSETS-SPIELWAHL.md](ASSETS-SPIELWAHL.md): 1200 × 300 px, sRGB, kein
Alphakanal, unteres Drittel und obere rechte Ecke ruhig halten (dort liegt
Name bzw. „Bald"-Marke). Motiv: die Schaubahn aus `Banner.tsx` als
Stillleben — Tor, Prallkörper, Beschleuniger, Sandkuhle, von schräg oben.

**Die Zonen-Icons sind 64 × 64** nach derselben Faustregel wie die
Stationen in [ASSETS-BROCOOKED.md](ASSETS-BROCOOKED.md) (dreifache
Anzeigegröße). Wie groß eine Kachel in der Bahnauswahl tatsächlich wird,
ist **offen** — die Zahl ist ein Ausgangswert, kein Messwert.

**Untergrund-Texturen und Vorschau-Rahmen: Maß offen.** Für beide gibt es
keinen Code, der eine Größe vorgibt (anders als beim Hub-Banner, das exakt
die Kachelgröße der Spielauswahl füllen muss). Wer die Bestellung auslöst,
legt die Maße zusammen mit Robin fest.

---

## 3 — Freihalte-Zonen

- **Hub-Banner:** wie in ASSETS-SPIELWAHL.md — unteres Drittel und obere
  rechte Ecke frei von wichtigem Motiv.
- **Zonen-Icons:** Silhouette muss auf 48 px (kleinste absehbare
  Anzeigegröße) noch eindeutig sein — Bumper und Drehkreuz dürfen sich zum
  Beispiel nicht nur über die Farbe unterscheiden lassen, dieselbe Regel wie
  bei den Stationen in ASSETS-BROCOOKED.md.
- **Untergrund-Texturen:** müssen kachelbar sein (keine sichtbare Naht),
  Werkzeug wie in ASSETS-BROCOOKED.md: `~/bildwerkzeug/naht-heilen.mjs`.

---

## 4 — Abnahmekriterien

1. **Echter Alphakanal, kein Schachbrett** bei allem außer dem Hub-Banner
   (das liefert ohne Alpha, siehe oben). Auf rotem Grund prüfen.
2. **Kein eingebrannter Text**, in keiner Sprache.
3. **Die vier Themen sind auf einen Blick unterscheidbar** — Farbwerte aus
   `STIMMUNGEN` in `zeichnen.ts` als Referenz (Wiese warmgrün, Wüste
   ockergelb, Eis kühles Türkis, Nacht dunkles Violettgrün), damit ein
   geliefertes Untergrundbild nicht gegen die schon gemalte Palette
   steht.
4. **Die neun Zonen-Icons sind untereinander unterscheidbar**, auch für
   jemanden, der die Regeln nicht kennt — das Icon muss die Wirkung der
   Zone andeuten (Beschleuniger = Pfeil/Schwung, Eis = Kristall, Portal =
   Ring, Bumper = Stern, Strudel = Spirale, Sprungfeld = Sprungbogen,
   Drehkreuz = Rotationspfeil, Sand = Körnung, Wasser = Welle).
5. **Kein Alkohol-Motiv** (DESIGN.md, Grundhaltung) — gilt hier wie überall.

---

## 5 — Was NICHT ins Bild gehört

- Kein Text, keine Zahlen, keine Tastensymbole.
- Keine Perspektive, die von der Draufsicht der Bahn abweicht (Icons und
  Texturen müssen zum von-oben-gezeichneten Spielfeld passen).
- Keine Anleihen bei bekannten Minigolf- oder Handyspielmarken.
- Kein Alkohol-Marketing (siehe DESIGN.md, Grundhaltung — Brauweg zeigt
  grundsätzlich keine Bier-, Hopfen- oder Glas-Motive).

---

## 6 — Weg ins Repo

Originale (PNG) gehören ins Archivrepo `moodsteppi/brauweg-art`,
`packages/client/art/` steht in `.gitignore`. Ausgeliefert wird
ausschließlich WebP unter `packages/client/public/`. Gewandelt wird mit
`node ~/bildwerkzeug/wandeln.mjs <quelle> <ziel> szene`; der ganze Ablauf
steht in `docs/JETZT-AUSFUEHREN.md`.

**Nach der Lieferung des Hub-Banners** trägt der Einbau `'golf'` in
`GEMALTE_BANNER` (`packages/client/src/hub.tsx`) ein — vorher bleibt die
Zeile hier stehen, weil ein Eintrag ohne Datei einen weißen Kasten ergäbe
(CLAUDE.md). Für Zonen-Icons, Vorschau-Rahmen und Bahnauswahl insgesamt gibt
es noch keine Einbaustelle im Code; die legt an, wer die Bahnauswahl baut.
