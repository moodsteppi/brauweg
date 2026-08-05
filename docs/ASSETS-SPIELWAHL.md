# Bildbestellung: Banner für den Themen-Tab

Der Themen-Tab beginnt mit der Frage **„Für welches Spiel?"** — eine Liste
aller Spiele, jedes als breite Kachel. Bisher war jede Kachel eine leere
Textzeile; jetzt trägt sie ein Banner. Als Platzhalter läuft dort das gemalte
SVG-Stillleben des Spiels (`SpielBild` in `GameSelect.tsx`) — **es fehlt kein
Bild und nichts ist kaputt**, diese Bestellung ersetzt die Platzhalter nur
durch gemalte Banner.

Bestellt werden **drei** Banner: eins für Doppelkopf, eins für den Zauberer,
und **ein gemeinsames** für alle noch nicht gebauten Spiele (Skat, Schafkopf,
Rommé, Mau-Mau, Schwimmen, Backgammon, Bauernskat). Die sieben teilen sich ein
„Bald"-Motiv — für ein Spiel, das es noch nicht gibt, lohnt kein eigenes Bild.

Gestaltungsregeln stehen in [DESIGN.md](DESIGN.md); sie gelten hier
unverändert.

---

## Für alle drei Bilder verbindlich

**Format**
- **WebP wird ausgeliefert, PNG wird geliefert.** Die Umwandlung passiert hier
  (`node ~/bildwerkzeug/wandeln.mjs … szene`). Bitte PNG abgeben.
- **1200 × 300 px, Seitenverhältnis genau 4 : 1.** Das ist das Verhältnis des
  SVG-Platzhalters (320 × 80); nur so bleibt die Kachelhöhe beim Austausch
  gleich und die Liste gerade. Wird ein anderes Verhältnis geliefert, springt
  die Reihe.
- sRGB, **kein Alphakanal** — das Banner füllt die Kachel randlos, die Ecken
  rundet der Client selbst.

**Wo Text liegt — Freihalte-Zonen**
Der Client schreibt Name und eingestellte Wahl selbst auf das Banner, auf einen
dunklen Verlauf. Ins Bild gehört **kein Text**. Zwei Zonen deshalb ruhig
halten:
- **Unteres Drittel (unter 66 % Höhe):** Dort liegt der Verlauf mit Name und
  Zeile „Blatt · Tisch". Keine Gesichter, keine Schrift, kein wichtiges Detail
  hier — es verschwindet unter dem Verlauf.
- **Obere rechte Ecke (rechte 30 %, obere 40 %):** Dort sitzt bei den Vorschau-
  Spielen die goldene „Bald"-Marke. Nichts Wichtiges dorthin.

Das Motiv (Karten, Requisiten) gehört also in die **obere linke bis mittlere**
Fläche.

**Echte Transparenz — der häufigste Fehler**
Entfällt hier, weil ohne Alphakanal geliefert wird. Trotzdem: **kein
Schachbrettmuster** als vermeintlicher Hintergrund. Der Grund ist gemalt und
deckend.

**Ton und Stil**
Wie die vorhandenen Hub-Bilder (`bg-blatt.webp`, `bg-shop.webp`): gemalt, warm,
satt, ein Handyspiel — kein Fotorealismus, kein Comic-Umriss. Ein breites
Stillleben, das das Spiel auf einen Blick erkennbar macht.

**Was NICHT ins Bild gehört**
- **Kein Text**, kein Spielname, keine Zahl, keine Zierzeile.
- **Keine Bedienelemente**, keine Knöpfe, keine Leisten, kein Handyrahmen.
- **Kein Alkohol** — keine Krüge, Fässer, kein Hopfen.
- **Keine Markenzeichen.** Das Stichspiel heißt bei uns **Zauberer**; „Wizard"
  und jede Anlehnung an die Aufmachung des Amigo-Originals gehören nicht ins
  Bild. Eigene Figuren, eigene Handschrift.

---

## 1 — `spielwahl-doppelkopf.png`

Ein Doppelkopf-Stillleben: ein aufgefächertes Blatt auf grünem Filz, die
Karten, an denen man Doppelkopf erkennt — **die beiden Kreuz-Damen** vorn,
dazu Herz-Zehn und Ass. Warmes Wirtshauslicht von oben links. Motiv in der
oberen linken bis mittleren Fläche; unteres Drittel und obere rechte Ecke ruhig
(siehe Freihalte-Zonen).

## 2 — `spielwahl-wizard.png`

Ein Zauberer-Stillleben, kühler und nächtlicher als das Doppelkopf-Banner: ein
Fächer des Zauberwald-Blatts, sichtbar **ein Zauberer und ein Narr** als die
beiden Karten, die das Spiel ausmachen, dazu Sterne oder ein Sternkranz wie auf
den Zauberer-Karten. Dieselbe Hand wie beim vorhandenen Zauberwald-Blatt.
Freihalte-Zonen wie oben.

## 3 — `spielwahl-bald.png`

Das gemeinsame „Bald"-Motiv für alle noch nicht gebauten Spiele. **Kein
bestimmtes Spiel** — es steht für sieben verschiedene. Ein neutrales, gemaltes
Karten-Stillleben: ein verdeckter Kartenstapel, vielleicht ein paar Rücken
aufgefächert, gedämpfter als die zwei echten Banner, damit es sich als „kommt
noch" liest. Es liegt unter der goldenen „Bald"-Marke oben rechts — die Ecke
also besonders ruhig halten.

---

## Abnahme

1. Drei Dateien, exakt `spielwahl-doppelkopf`, `spielwahl-wizard`,
   `spielwahl-bald`, je 1200 × 300 px (4 : 1).
2. Kein eingebrannter Text, keine Marke, kein Bedienelement.
3. Im unteren Drittel und in der oberen rechten Ecke liegt nichts, was gebraucht
   wird — auf den Verlauf gelegt bleibt der weiße Name gut lesbar.
4. Doppelkopf und Zauberer sind auf einen Blick auseinanderzuhalten; das
   „Bald"-Banner liest sich neutral und etwas zurückgenommen.
5. Nebeneinander in der Liste (alle Kacheln gleich hoch) steht die Reihe gerade.

---

## Einbau nach der Lieferung

Ablage: `packages/client/public/hub/`. Wandeln:

```bash
node ~/bildwerkzeug/wandeln.mjs <quelle> \
  ~/…/brauweg/packages/client/public/hub/spielwahl-doppelkopf.webp szene
# ebenso wizard und bald
```

Dann in `packages/client/src/screens/GameSelect.tsx` im `ThemenTab` das
Platzhalter-SVG durch das gelieferte Banner ersetzen — **erst jetzt**, wo die
Dateien wirklich liegen (ein `<img>` auf eine fehlende Datei wäre ein weißer
Kasten, CLAUDE.md):

```tsx
// aus
<span className="hub-themenspiel-bild" aria-hidden="true">
  <SpielBild id={spiel.id} />
</span>
// wird (Doppelkopf und Zauberer eigenes Banner, alles andere das Bald-Motiv)
<span className="hub-themenspiel-bild" aria-hidden="true">
  <img
    src={`/hub/spielwahl-${spiel.id === 'doppelkopf' || spiel.id === 'wizard' ? spiel.id : 'bald'}.webp`}
    alt=""
    draggable={false}
  />
</span>
```

Das CSS trägt den Austausch bereits: `.hub-themenspiel-bild svg` und ein
`<img>` darin werden beide auf volle Breite mit `height: auto` gelegt.
