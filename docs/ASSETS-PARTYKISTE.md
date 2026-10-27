# Bilder für die Partykiste

Nach CLAUDE.md Regel 5 wird neue Grafik **bestellt, nicht beschrieben**. Diese
Bestellung ist geschrieben, **bevor** ein einziges Bild existiert: Das Banner
der Partykiste in der Spielauswahl ist bis heute gezeichnet
(`packages/client/src/minispiele/partykiste/Banner.tsx`, SVG mit Konfetti,
Kärtchen und Glas), „aus demselben Grund wie bei Filler, Eiland und Golf"
(Kommentar am Kopf der Datei). Die Partykiste steht deshalb in keiner
`GEMALTE_BANNER`-Liste (`packages/client/src/hub.tsx:69-89`) und zeigt im
Themen-Tab das gemeinsame „Bald"-Motiv. **Kein `<img>` auf eine Datei, die es
noch nicht gibt.**

Stand: 22. September 2026, nichts geliefert.

---

## 1 — Was gebraucht wird

| Was | Ziel unter `packages/client/public/` | Anzahl | Maß | Format |
| --- | --- | --- | --- | --- |
| Hub-Banner Spielauswahl | `hub/spielwahl-partykiste.webp` | 1 | 1200 × 300 (4:1) | WebP q82, kein Alpha |
| Icon je Minispiel (für die kommende Minispielauswahl) | `partykiste/minispiele/` | 9 | 64 × 64 (Faustregel „dreifache Anzeigegröße", DESIGN.md; genaue Anzeigegröße offen) | WebP q85, Alpha |
| Kacheln für Themenpakete | `partykiste/themenpakete/` | 5 | offen — hängt am Layout der Paketauswahl, die es noch nicht gibt | WebP q80, Alpha |
| Icon-Paar Schluck/Strafpunkt, **ohne Bier-Emoji** | `partykiste/` | 2 | 32 × 32 (Faustregel wie oben; Anzeigegröße orientiert sich an `<span className="pk-schluck">`, heute Text + 🍺) | WebP q85, Alpha |

Die neun Minispiele (`packages/game-partykiste/src/regeln.ts:29-59`,
`MinispielId`/`MINISPIELE`): Imposter, Quiz, Wer bin ich, Ich hab noch nie,
Wer würde eher, Busfahrer, Schätzen, Entweder-oder, Wahrheit oder Pflicht.

Die fünf Themenpakete (Entscheidung Robin, 22.09.2026): WG-Abend,
Junggesellenabschied, Weihnachten, Studenten, Arbeit. **Diese Entscheidung
steht bisher nur hier** — im Code oder in `docs/PARTYKISTE.md` (das dieser
Zweig nicht anfasst, siehe unten) findet sich noch keine Zeile dazu (`grep
-rn "Themenpaket" packages/ docs/` liefert nur diese Datei). Wer die
Bestellung auslöst, sollte vor der Abnahme in `docs/PARTYKISTE.md`
nachsehen, ob die Entscheidung inzwischen dort eingetragen wurde.

**Minispielauswahl und Paketauswahl gibt es noch nicht.** Kein Bildschirm
stellt heute neun Minispiele oder fünf Pakete zur Wahl (`grep -rn
"Minispielauswahl" packages/ docs/` liefert nichts). Icons und Kacheln sind
hier mit Blick auf diese kommenden Bildschirme bestellt.

---

## 2 — Maße, und warum genau diese (oder eben offen)

**Das Hub-Banner** folgt exakt der Vorgabe aus
[ASSETS-SPIELWAHL.md](ASSETS-SPIELWAHL.md): 1200 × 300 px, sRGB, kein
Alphakanal, unteres Drittel und obere rechte Ecke ruhig halten. Motiv: ein
Stillleben aus den drei Requisiten, die das gezeichnete Banner schon zeigt
— Kärtchen, Frage, Glas —, ohne die Konfetti-Bewegung, die im Bild ohnehin
keine Rolle spielt.

**Die Minispiel-Icons sind 64 × 64**, dieselbe Faustregel wie bei den
Stationen in [ASSETS-BROCOOKED.md](ASSETS-BROCOOKED.md).

**Das Schluck/Strafpunkt-Paar ist 32 × 32**, kleiner als die
Minispiel-Icons, weil es laut `Partykiste.tsx` heute als kleines Zeichen
neben einer Zahl steht (`<span className="pk-schluck">{zahl} 🍺</span>`,
Zeilen 437 und 476) — nicht als eigenständige Kachel.

**Die Themenpaket-Kacheln: Maß offen.** Es gibt keine Paketauswahl im Code,
die eine Größe vorgibt.

---

## 3 — Freihalte-Zonen

- **Hub-Banner:** wie in ASSETS-SPIELWAHL.md — unteres Drittel und obere
  rechte Ecke frei von wichtigem Motiv.
- **Minispiel-Icons:** auf 48 px noch unterscheidbar, über Silhouette statt
  nur über Farbe — dieselbe Regel wie bei den Stationen in
  ASSETS-BROCOOKED.md.
- **Schluck/Strafpunkt-Paar:** beide Zeichen müssen auch **ohne** Farbe
  (Graustufen, Farbenblindheit) unterscheidbar bleiben, weil sie im
  laufenden Spiel direkt nebeneinander vorkommen können (Trinkmodus an/aus,
  `sicht.trinkmodus`).

---

## 4 — Abnahmekriterien

1. **Echter Alphakanal, kein Schachbrett** bei allem außer dem Hub-Banner.
   Auf rotem Grund prüfen.
2. **Kein eingebrannter Text**, in keiner Sprache.
3. **Die neun Minispiel-Icons sind auf einen Blick unterscheidbar** und
   deuten das jeweilige Minispiel an (z. B. Imposter = Maske/Fragezeichen,
   Quiz = vier Antwortfelder, Busfahrer = Bus/Pfeil, Schätzen = Zielscheibe
   mit Zahl) — ohne Namen oder Zahlen im Bild, die stehen daneben.
4. **Schluck-Icon ohne Bier-Emoji.** Entscheidung Robins vom 22.09.2026:
   „Schluck" bleibt als Begriff und als Motiv (z. B. Glas oder Tropfen ohne
   Alkoholbezug), 🍺 fällt raus — deckungsgleich mit der ohnehin geltenden
   Regel „Kein Alkohol-Marketing" in DESIGN.md, Grundhaltung. Das
   Strafpunkt-Icon daneben braucht eine eigene, klar andere Form (kein
   zweites Glas in anderer Farbe).
5. **Fünf Themenpakete sind auf einen Blick unterscheidbar** und passen zum
   jeweiligen Anlass, ohne eine Zielgruppe zu karikieren (z. B. kein
   Klischeebild für „Studenten").

---

## 5 — Was NICHT ins Bild gehört

- Kein Text, keine Zahlen, keine Tastensymbole.
- **Kein Alkohol-Marketing**: keine Biergläser, Flaschen, Fässer, kein
  Hopfen — weder im Schluck-Icon noch in den Themenpaket-Kacheln (auch
  „WG-Abend" und „Junggesellenabschied" bekommen kein Glas- oder
  Flaschenmotiv, DESIGN.md gilt hier ohne Ausnahme).
- Keine Menschen mit erkennbarer Ähnlichkeit zu echten Personen (Quiz,
  Werbinich).
- Keine Markenzeichen bekannter Partyspiele.

---

## 6 — Weg ins Repo

Originale (PNG) gehören ins Archivrepo `moodsteppi/brauweg-art`,
`packages/client/art/` steht in `.gitignore`. Ausgeliefert wird
ausschließlich WebP unter `packages/client/public/`. Gewandelt wird mit
`node ~/bildwerkzeug/wandeln.mjs <quelle> <ziel> szene`; der ganze Ablauf
steht in `docs/JETZT-AUSFUEHREN.md`.

**Nach der Lieferung des Hub-Banners** trägt der Einbau `'partykiste'` in
`GEMALTE_BANNER` (`packages/client/src/hub.tsx`) ein — vorher bleibt die
Zeile hier stehen, sonst zeigt ein Eintrag ohne Datei einen weißen Kasten
(CLAUDE.md). Für Minispiel-Icons, Themenpaket-Kacheln und das
Schluck/Strafpunkt-Paar gibt es noch keine Einbaustelle im Code außer dem
bestehenden `🍺` in `packages/client/src/screens/Partykiste.tsx`
(Zeilen 437, 476) — den zu ersetzen ist Anwendungscode und nicht Teil
dieser Bestellung.
