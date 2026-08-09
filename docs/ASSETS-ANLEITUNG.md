# Bildbestellung: Anleitung („Neu hier?")

Hinter dem Knopf **„Neu hier? — So funktioniert Brauweg"** liegt jetzt eine
Anleitung: oben was Brauweg ist (Trophäen, eigenes Aussehen, Truhen), darunter
je Spiel eine Beispielhand aus **echten Karten**. Die Beispielhände sind fertig
und brauchen **kein Bild** — sie werden aus den vorhandenen Kartenblättern
gerendert.

Bestellt werden nur die **vier gemalten Bilder der Intro-Seite**: ein Held-Bild
und drei kleine Symbole. Bis zur Lieferung laufen Platzhalter (das Logo auf
einem Verlauf, und die vorhandenen Icons `pokal.png`, `tab-blatt.webp`,
`truhe.png`) — **es ist nichts kaputt und kein leeres Feld**, diese Bestellung
macht die Seite nur schöner.

Gestaltungsregeln stehen in [DESIGN.md](DESIGN.md) und gelten hier unverändert.

---

## Für alle vier Bilder verbindlich

- **WebP wird ausgeliefert, PNG wird geliefert.** Umwandlung hier
  (`node ~/bildwerkzeug/wandeln.mjs …`). Bitte PNG abgeben.
- sRGB. Ton wie die übrigen Hub-Bilder: gemalt, warm, satt, ein Handyspiel.
- **Kein eingebrannter Text**, kein Spielname, keine Zahl. Kein
  Schachbrettmuster als „Transparenz". Keine Bedienelemente, kein Rahmen, kein
  Handyrand. Kein Alkohol, keine Markenzeichen.
- **Originale nach `packages/client/art/`, nur das WebP nach `public/`** —
  Originalauflösung unter `public/` ist schon zweimal live gegangen.

---

## 1 — Das Held-Bild: `anleitung-held.png`

Das breite Kopfbild oben in der Anleitung.

- **1200 × 600 px, Seitenverhältnis 2 : 1**, **kein Alpha** (füllt die Fläche
  randlos, die Ecken rundet der Client).
- **Motiv:** ein einladender Blick in die „Stube voller Kartenspiele" — der
  Brauweg-Pinguin an einem vollen Spieltisch, Karten aufgefächert, daneben
  angedeutet eine offene Truhe und ein Pokal. Warm, gemütlich, Wirtshauslicht.
  Es soll neugierig machen, nicht erklären.
- **Freihalte-Zone:** In der Mitte/oben liegt kein Text vom Client — das Bild
  darf die ganze Fläche nutzen. **Aber kein gemaltes „Brauweg"-Logo und kein
  Schriftzug ins Bild** (der Platzhalter zeigt das Logo nur, weil das echte
  Bild noch fehlt).

## 2–4 — Die drei Symbole (je ein kleines Quadrat)

Sie stehen links neben den drei Versprechen der Intro-Seite und ersetzen die
vorhandenen Icons. Einheitlich als Satz erkennbar (gleiche Hand, gleiche
Größe, gleicher Glanz).

- **Je 256 × 256 px, quadratisch, PNG mit echtem Alphakanal** (freigestellt,
  wie die vorhandenen Hub-Icons). Auf knallrotem Grund prüfen: kein heller
  Saum, kein Schachbrett.
- Freigestellt heißt: nur das Objekt, kein Kachel-Hintergrund.

| Datei | Steht für | Motiv |
| --- | --- | --- |
| `anleitung-trophaeen.png` | Trophäen sammeln | ein Pokal, gern mit angedeutetem Pfad/Wegpunkt |
| `anleitung-design.png` | Aussehen ändern | ein aufgefächertes Kartenblatt oder eine Palette/Pinsel |
| `anleitung-truhen.png` | Truhen erspielen | eine (leicht geöffnete) Schatztruhe mit Münzen |

---

## Abnahme

1. Vier Dateien, exakt `anleitung-held` (1200 × 600, ohne Alpha) und
   `anleitung-trophaeen` / `anleitung-design` / `anleitung-truhen`
   (je 256 × 256, mit Alpha).
2. Kein eingebrannter Text, kein Logo, keine Marke.
3. Die drei Symbole wirken als Satz (gleich hell, gleich stark) und sind auf
   256 px klar erkennbar.
4. Held-Bild lädt einladend, ohne etwas zu erklären.
5. Auf rotem Grund kein Saum, kein Schachbrett; keine Originalauflösung unter
   `public/`.

---

## Einbau nach der Lieferung

Ablage: `packages/client/public/hub/`. In `GameSelect.tsx`, Komponente
`Anleitung` — **erst wenn die Dateien liegen** (ein `<img>` auf eine fehlende
Datei wäre ein weißer Kasten, CLAUDE.md):

- Held: den Platzhalter
  `<img className="anleitung-held-logo" src="/hub/logo.png" …>`
  ersetzen durch
  `<img className="anleitung-held-voll" src="/hub/anleitung-held.webp" …>`
  (die CSS-Klasse `.anleitung-held-voll` liegt bereit und zieht das Bild
  randlos auf).
- Symbole: die drei `src="/hub/pokal.png"`, `"/hub/tab-blatt.webp"`,
  `"/hub/truhe.png"` in den drei `.anleitung-punkt` ersetzen durch
  `"/hub/anleitung-trophaeen.webp"`, `"/hub/anleitung-design.webp"`,
  `"/hub/anleitung-truhen.webp"`.

Nach dem Wandeln die Dateigröße prüfen (ein Symbol ~10–20 kB, das Held-Bild
~60–90 kB, nicht 1,7 MB) und die Anleitung einmal öffnen.
