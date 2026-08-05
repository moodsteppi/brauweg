# Für Claude: 3D-Truhen ins Spiel einbauen

Kurze Übergabe von Emile/Cursor. Ziel: Die **flachen 2D-Truhen-Icons** im Shop
(Silber / Gold / Diamant) und die Öffnungs-Animation durch das **echte 3D-Modell**
ersetzen (Korpus + Deckel getrennt).

---

## Was schon fertig ist (nicht nochmal machen)

### Modelle
| Datei | Ort |
|---|---|
| `chest_bottom.glb` | `brauweg-art/3d/chest/` **und** `packages/client/public/3d/chest/` |
| `chest_top.glb` | dasselbe |
| `chest_normalize.json` | dasselbe (Posen + Konvention) |

Originale bleiben unberührt:
- `pirate chest bottom 3d model.glb`
- `chest 3d  top model.glb`

Konvention:
- Breite ≈ 1 Einheit, Boden des Korpus auf **Y = 0**
- Deckel-Ursprung = Unterkante Deckel
- Deckel ist **Kind** des Korpus (oder einer gemeinsamen Gruppe)

### Visuell eingestellte Posen (verbindlich)

```json
"lid_open": {
  "position": [0.004, 0.423, -0.083],
  "rotation": [0, 0, 0],
  "scale": [1.02, 1.02, 1.02]
}

"lid_closed": {
  "position": [0.006, 0.291, -0.098],
  "rotation": [0.3984, 0, 0],
  "scale": [1.02, 1.02, 1.02]
}
```

Rotation in **Radiant** (Three.js). Geschlossen hat spürbare Rotation X.

### Dev-Ausrichter (zum Prüfen)
```
http://localhost:5173/?dev=chest
```
Code: `packages/client/src/screens/ChestAligner.tsx`  
Buttons „Geschlossen“ / „Offen“, Slider, „Werte kopieren“.  
Deps liegen schon im Client: `three`, `@react-three/fiber`, `@react-three/drei` (lazy geladen, nicht im Hauptbundle der App).

---

## Was im Spiel heute 2D ist (ersetzen)

### 1) Shop-Kacheln „TRUHEN“ (Screenshot)
Datei: `packages/client/src/screens/GameSelect.tsx`  
Komponente: **`TruhenBild`** in der Kachel `.shop-truhe` (und in der Kauf-Rückfrage).

```tsx
<TruhenBild grad={truhe.grad} offen={false} />
```

Das ist die flache 2D-Grafik auf den drei Karten. Definition:
`packages/client/src/screens/Aufgaben.tsx` → `export function TruhenBild`.
Ersetzen durch 3D mit `pose="closed"` (gleiche Stelle / Größe über CSS `.truhe-bild`).
Am saubersten: `TruhenBild` intern auf 3D umstellen, dann Shop + Aufgaben + Kauf-Dialog auf einmal.

Server-IDs (unverändert lassen):
- `truhe-silber` / Grad `silber`
- `truhe-gold` / Grad `gold`
- `truhe-diamant` / Grad `diamant`

### 2) Öffnungs-Animation
Datei: `packages/client/src/TruhenOeffnung.tsx`

Architektur ist schon richtig gedacht:
- **Körper** + **Deckel** getrennt
- Choreografie (wackeln → drehen → Deckel auf → Glut) in CSS
- Design je Grad über `designFuer(grad)`

Aktuell: **SVG-Platzhalter** für Körper/Deckel, farbig je Grad.  
Geplant war 2D-WebP (`/hub/truhe/<grad>-koerper.webp`). **Stattdessen 3D.**

CSS-Animation: `.truhe-koerper` / `.truhe-deckel` in `styles.css` (~Zeile 7857+).
Die 2D-Deckel-Animation (`truhe-deckel-auf`) muss durch **Lerp der 3D-Transform**
`lid_closed` → `lid_open` ersetzt werden (nicht CSS `rotate` auf einem `<img>`).

Weitere Stellen mit Truhen-Bild (optional mitziehen):
- Hub-Kacheln / Profil (`/hub/truhe.png`) — nicht der Shop; erst Shop + Öffnung.

---

## Wie einbauen (Vorschlag für Claude)

### A — Wiederverwendbare Komponente
Neu z.B. `packages/client/src/Truhe3D.tsx`:

```tsx
// Props grob:
//   pose: 'open' | 'closed' | number (0..1 Interpolation)
//   grad: 'silber' | 'gold' | 'diamant' | ...
//   interactive?: boolean  // Orbit nur in Dev, im Shop aus
```

- Laden: `/3d/chest/chest_bottom.glb` + `/3d/chest/chest_top.glb` (wie im ChestAligner)
- Deckel-Group: Transform aus `lid_open` / `lid_closed` (Werte aus JSON oder Konstanten)
- **Farben je Grad:** Ein Mesh hat aktuell ein festes Material (Piraten-Holz/Gold).
  Für Silber/Gold/Diamant entweder:
  1. Materialfarbe/emissive zur Laufzeit tinten (`mesh.material.color.set(...)`), oder
  2. später drei Varianten-GLBs — für den ersten Wurf reicht Tinting analog zu `FARBEN` in `TruhenOeffnung.tsx`.

Shop-Kachel: kleines `<Canvas>` (oder ein gemeinsames Offscreen-Setup), **geschlossen**,
kein OrbitControls, feste Kamera (schräg von vorne oben), dunkler/transparenter Clear.

### B — Shop
In der Truhen-Karte (`.shop-truhe`) das `<img>` / Icon durch `<Truhe3D pose="closed" grad={…} />`
ersetzen. Größe an `.truhe-bild` / `.shop-truhe .truhe-bild` anpassen (CSS).

### C — Öffnung
In `TruhenOeffnung.tsx` die beiden `<img className="truhe-koerper|deckel">` durch
eine 3D-Bühne ersetzen:
1. Start `pose=closed`
2. Während der bestehenden Timing-Kurve (ca. 0.9s Deckel-Phase) Transform interpolieren
   von `lid_closed` → `lid_open` (position + rotation + scale lerpen)
3. Glut/Strahlen können 2D-Overlays bleiben (`.truhe-glut`, `.truhe-strahlen`)

Die äußeren CSS-Wrapper `.truhe-dreh` / `.truhe-schuettel` können die **ganze**
Canvas-Gruppe weiter wackeln/drehen — oder die Bewegung nach Three.js holen.
Einfachster Weg: Canvas in `.truhe-schuettel` lassen, CSS-Wackeln behalten,
nur den Deckel intern per 3D lerpen.

### D — Bundle
R3F ist bereits **lazy** für Dev-Tools (`main.tsx`). Für Shop/Öffnung entweder:
- dieselbe lazy-Grenze (`React.lazy` um Truhen-UI), oder
- akzeptieren, dass der Shop-Tab Three nachlädt, wenn man Truhen öffnet.

Nicht Three in den Auth-Screen ziehen.

---

## Nicht tun
- GLBs nicht nach `public/hub/` als WebP „wandeln“ — bleiben GLB unter `public/3d/chest/`
- Die eingestellten Posen nicht „neu schätzen“ — Werte oben sind final vom Ausrichter
- Server-Kauf-Logik (`packages/server/src/truhen.ts`) unverändert lassen

---

## Kurz-Checkliste
- [ ] `Truhe3D` mit closed/open + Grad-Tint
- [ ] Shop-Karten: 2D-Icon → geschlossene 3D-Truhe
- [ ] `TruhenOeffnung`: 2D-Ebenen → 3D + Lerp closed→open
- [ ] Mobile: kleine Canvas, keine Orbit-Gesten die Scroll stehlen
- [ ] Visuell gegen `/?dev=chest` halten (gleiche Posen)

Referenz-Ausrichter: `ChestAligner.tsx`  
Meta: `public/3d/chest/chest_normalize.json`  
Docs-Gesamt: `docs/UEBERGABE-ANNI.md`
