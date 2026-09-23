# Bilder für BroCooked

Nach CLAUDE.md Regel 5 wird neue Grafik **bestellt, nicht beschrieben**. Diese
Bestellung ist geschrieben, **bevor** ein einziges Bild existiert: Das Spiel
läuft zunächst mit gezeichneten Flächen auf der Leinwand
(`packages/client/src/minispiele/brocooked/zeichnen.ts`), damit niemand auf
eine Lieferung wartet. Jedes Bild ist Zugabe — fehlt es, bleibt die gezeichnete
Fassung stehen. **Kein `<img>` auf eine Datei, die es noch nicht gibt.**

Stand: 22. September 2026, nichts geliefert.

---

## 1 — Was gebraucht wird

| Was | Ziel unter `packages/client/public/brocooked/` | Anzahl | Maß | Format |
| --- | --- | --- | --- | --- |
| Boden- und Wandkacheln | `kacheln/` | 6 | 128 × 128 | WebP q80, **kachelbar** |
| Stationen (Kiste, Brett, Topf, Pfanne, Fritteuse, Ablage, Spüle, Tellerstapel, Rückgabe, Durchreiche, Tonne, Löscher) | `stationen/` | 12 | 128 × 128 | WebP q85, Alpha |
| Zutaten je Zustand (roh, geschnitten, gar, verkohlt) | `zutaten/` | 9 × 4 = 36 | 64 × 64 | WebP q85, Alpha |
| Teller (leer sauber, leer schmutzig, gefüllt) | `teller/` | 3 | 64 × 64 | WebP q85, Alpha |
| Koch, vier Farben, vier Richtungen, zwei Laufbilder | `koeche/` | 4 × 4 × 2 = 32 | 64 × 96 | WebP q85, Alpha |
| Banner Spielauswahl | `../hub/spielwahl-brocooked.webp` | 1 | 1200 × 300 | WebP q80 |

Gewichtsgrenze: **eine Küche lädt höchstens 400 kB**. Kacheln und Stationen
sind der größte Posten; eine Station liegt bei 8–14 kB, eine Zutat bei 2–4 kB.
Gemessen wird vor dem Einbau (Regel 4: eine Spielkarte wiegt 80 kB, nicht
1,7 MB — genau das ist hier zweimal live gegangen).

---

## 2 — Maße, und warum genau diese

**Eine Kachel ist 64 Spieleinheiten.** Geliefert wird in **128 px**, also
doppelt: Auf einem Handy mit dreifacher Pixeldichte wird eine Kachel je nach
Zoom 48–96 CSS-Pixel groß, und Hochskalieren sieht man sofort.

**Der Koch ist 64 × 96** — einen Kachel breit, anderthalb hoch. Er steht auf
der unteren Kante; über ihm bleibt Platz für Fortschrittsring und getragenes
Ding. Die Figur darf nach oben **nicht** in die obersten 8 px ragen.

**Zutaten sind 64 × 64**, weil sie zusätzlich klein in den Tickets stehen
(24 px). Alles, was das Motiv erkennbar macht, gehört deshalb in die mittleren
70 % — dünne Konturen am Rand verschwinden im Ticket.

---

## 3 — Freihalte-Zonen

- **Über jeder Station** bleiben die obersten 24 px (von 128) frei von
  wichtigen Teilen: Dort liegen Fortschrittsringe, Flammen und der Hinweis,
  was gerade in der Station steckt.
- **Unter jedem Koch** bleiben 8 px frei: Dort liegt der Farbring, der sagt,
  wer das ist.
- **Das Banner** trägt links 300 px Freifläche für den Schriftzug, der im
  Client gesetzt wird — kein eingebrannter Text.

---

## 4 — Abnahmekriterien

1. **Echter Alphakanal, kein Schachbrett.** Vor der Abnahme auf rotem Grund
   prüfen. Das ist hier dreimal passiert.
2. **Kein eingebrannter Text**, in keiner Sprache. Beschriftung setzt der
   Client.
3. **Kacheln ohne Naht.** Kantenabstand gegen Innenvarianz messen; über
   Faktor 3 sieht man die Linie. Werkzeug: `~/bildwerkzeug/naht-heilen.mjs`.
4. **Auf 48 px noch unterscheidbar.** Zwei Stationen, die klein gleich
   aussehen (Topf und Pfanne), sind eine Rückgabe wert — Unterschied über
   Silhouette, nicht über Farbe allein.
5. **Zustände sind auf einen Blick verschieden:** roh blass, geschnitten in
   Stücken, gar satt und dampfend, verkohlt schwarz mit klarer Silhouette.
   Wer „gar" und „verkohlt" nur an der Sättigung unterscheidet, hat es nicht
   erfüllt.
6. **Vier Kochfarben** aus derselben Palette wie die Sitzfarben der Plattform,
   gegen den Küchenboden mindestens 3:1.
7. **Keine Anleihen bei Overcooked** — keine Figuren, keine Küchenlayouts,
   keine Namen, kein Logo, keine Farbwelt daraus.

---

## 5 — Was NICHT ins Bild gehört

- Kein Text, keine Zahlen, keine Tastensymbole.
- Keine Schatten auf den Boden gemalt (die zeichnet der Client, sonst steht
  der Schatten falsch, wenn die Station umzieht).
- Keine Perspektive von der Seite: Alles ist von schräg oben gesehen,
  dieselbe Blickachse wie der Boden.
- Keine Rahmen, keine Ecken-Vignetten, keine „UI-Platten" um die Station.
- Keine Menschen mit erkennbarer Ähnlichkeit zu echten Personen.

---

## 6 — Weg ins Repo

Originale (PNG) gehören ins Archivrepo `moodsteppi/brauweg-art`,
`packages/client/art/` steht in `.gitignore`. Ausgeliefert wird
ausschließlich WebP unter `packages/client/public/brocooked/`. Gewandelt wird
mit `node ~/bildwerkzeug/wandeln.mjs <quelle> <ziel> szene`; der ganze Ablauf
steht in `docs/JETZT-AUSFUEHREN.md`.
