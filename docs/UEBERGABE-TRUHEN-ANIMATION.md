# Übergabe: Truhen-Öffnungsanimation fertigstellen

Für den Kollegen, der die **3-D-Grafiken** macht (Pinguin via glTF/react-three-
fiber). Die Truhen-Öffnung steht als **Platzhalter** — Choreografie und
Einbaupunkt sind da, das Aussehen ist noch SVG. Deine Aufgabe: das echte Bild
liefern und die Animation fertig machen. Weil du ohnehin 3-D machst, ist der
naheliegende Weg eine **glTF-Truhe mit Deckel-Auf-Animation** — genau wie beim
Pinguin. (Der 2-D-Ebenen-Weg geht auch, siehe unten.)

---

## Was schon da ist

- **`packages/client/src/TruhenOeffnung.tsx`** — die Komponente. Die
  **Choreografie** steht (wackeln → im Raum drehen → Deckel klappt 3-D auf →
  Lichtstrahlen/Glut → Belohnung steigt auf). Das **Aussehen** ist Platzhalter:
  `designFuer(grad)` liefert zurzeit gezeichnete SVG-Ebenen.
- **CSS**: alle `.truhe-*`-Regeln in `packages/client/src/styles.css`.
- **`docs/ASSETS-TRUHEN-EBENEN.md`** — Bestellung für den 2-D-Weg (Körper + Deckel
  als getrennte Ebenen), falls du nicht in glTF gehst.
- **Vorschau des Platzhalters** (zeigt die Bewegung je Grad):
  https://claude.ai/code/artifact/99924280-8b83-4483-a447-77ef3124f4ca

---

## Der Vertrag — bitte beibehalten

Der Shop mountet nur diese Komponente; **das Innenleben gehört dir**:

```tsx
<TruhenOeffnung grad={grad} muenzen={coins} onFertig={() => …} />
```

- `grad`: `'holz' | 'bronze' | 'silber' | 'gold' | 'diamant'`
- `muenzen`: die gefundenen Münzen (Zahl, wird beim Aufsteigen gezeigt)
- `onFertig`: aufrufen, wenn die Animation durch ist **oder** der Nutzer tippt
- `TRUHE_DAUER_MS = 3200` — nach der Zeit erscheint „Tippen zum Weiter"

Solange diese Signatur bleibt, ist der Einbau unabhängig von der Umsetzung.

---

## Dein 3-D-Weg (wie beim Pinguin)

- glTF-Modelle liegen unter **`public/3d/*.glb`**, geladen mit `useGLTF`
  (`@react-three/drei`) in einem `<Canvas>` (`@react-three/fiber`) — Muster in
  **`Avatar3D.tsx`**. `three`/`fiber`/`drei` sind bereits Abhängigkeiten.
- Also z. B. **`public/3d/truhe.glb`** mit dem Deckel als eigenem Node, den du
  ums Scharnier aufklappst (oder eine eingebackene „open"-Clip). **Ein Modell,
  fünf Grade** als Material/Skin (Holz → Diamant) — **eine Animation, das Design
  ist Daten**. Lichtfarbe je Grad kann wie bisher aus `designFuer` kommen.
- Quellen (Blender o. Ä.) ins Archiv **`brauweg-art`**; ausgeliefert wird nur die
  `.glb` unter `public/3d/` (Ablauf: `docs/JETZT-AUSFUEHREN.md`).

**Prinzip:** Die eine Animation gilt für alle Truhen. Eine neue Truhe ist eine
neue Haut (Material/Skin bzw. Körper+Deckel-Ebenen), keine neue Animation.

---

## Wo es eingeklinkt wird

Die Animation ist **noch nicht** in die Shop-Oberfläche eingebaut (bewusst, um
dem Shop-Strang nicht in die Dateien zu greifen). Einbaupunkt:

- **`packages/client/src/screens/Aufgaben.tsx`**, `TruhenZeile`: Der Öffnen-Knopf
  ruft `api.openChest(chestId)` und bekommt zurück
  **`Fund { chestId, grad, coins, stand }`**. Statt die Zeile still auf „offen"
  zu flippen, `<TruhenOeffnung grad={fund.grad} muenzen={fund.coins}
  onFertig={…} />` als Vollbild-Overlay zeigen; in `onFertig` dann den Stand
  aktualisieren (`stand`). **Keine Doppel-Gutschrift** — der Server bucht schon
  beim `open`, die Animation zeigt nur.
- Truhen erscheinen außerdem im **Shop-Regal** (`GameSelect.tsx`, `TruheKachel`)
  und als **Tagestruhe** am Startbildschirm — dieselbe Komponente überall.

Am besten mit dem Shop-Strang kurz abstimmen, wer den Öffnen-Flow anfasst.

---

## Server-Daten (nur lesen)

- Grade und Spannen: **`packages/server/src/truhen.ts`** (`GRADE`, `SPANNEN`).
  Truhen geben **Münzen**, sonst nichts. Das Ergebnis steht fest, sobald geöffnet
  wird (`chest_claim`) — die Animation ändert daran nichts.
- Rückgabe: `api.openChest(id)` → `Fund { grad, coins, stand }`.

---

## Choreografie (Soll)

Vorfreude-**Wackeln** → Truhe **dreht sich leicht im Raum** → **Deckel klappt
dreidimensional auf** → **Lichtstrahlen/Glut** brechen heraus → die **Münzen
steigen auf** (Zahl = `muenzen`). Grad bestimmt Material und Lichtfarbe. Dauer
~3,2 s, dann `onFertig`. **`prefers-reduced-motion` beachten** — dann kein
Geruckel, Truhe offen zeigen und Belohnung ohne Flug.

---

## Arbeitsweise (Pflicht)

- Gegen **`staging`** arbeiten, vor dem Push `git pull --no-rebase origin
  staging`, Build im **Wurzelverzeichnis** (`npm run build`, nicht `--workspace`).
  Was nach `main` geht, entscheidet Nils.
- **Bilder/Modelle:** Originale ins Archivrepo `moodsteppi/brauweg-art`, nur das
  Ausgelieferte (`.webp`/`.glb`) nach `public/`. `packages/client/art/` ist
  gitignored. Voller Ablauf: `docs/JETZT-AUSFUEHREN.md`.
- **Kein `<img>`/Modell auf eine Datei, die noch nicht existiert** — bis zur
  Lieferung bleibt der SVG-Platzhalter stehen (ein weißer Kasten sieht nach
  Fehler aus, der Platzhalter nach Absicht).

## Abnahme

- Truhe öffnet sich sichtbar dreidimensional, Deckel klappt auf, Münzen kommen
  heraus, die `muenzen`-Zahl stimmt.
- Fünf Grade am Material klar unterscheidbar, **eine** Animation.
- Auto-Ende nach ~3,2 s, Tippen überspringt, reduced-motion sauber.
- In den Öffnen-Flow eingeklinkt (Aufgaben/Shop), keine Doppel-Gutschrift.
