# Übergabe an Anni — Grafik & 3D für Brauweg

Kurzfassung, was schon liegt, was ins Spiel soll, und was du als Nächstes
brauchst. Alles unter `brauweg-art/` (Originale) bzw. Client `public/` /
`packages/client/art/` (Arbeitskopien).

---

## 1. Sofort öffnen: 3D-Mütze ausrichten

Im laufenden Client-Dev-Server:

```
http://localhost:5173/?dev=avatar
```

Dort siehst du den 3D-Pinguin mit der lila Mütze. Schieberegler für
Position / Rotation / Größe. Unten **„Werte kopieren“** → JSON in die
Zwischenablage, Format:

```json
{
  "position": [x, y, z],
  "rotation": [rx, ry, rz],
  "scale": [s, s, s]
}
```

Diese Werte gehören später in die Item-Konfiguration der Mütze.

**Modelle (bereits normalisiert):**

| Datei | Ort | Bedeutung |
|---|---|---|
| `penguin_base.glb` | `brauweg-art/3d/` und `packages/client/public/3d/` | Nackter Pinguin, Höhe ≈ 1, Füße Y=0 |
| `beanie.glb` | dasselbe | Lila Strickmütze, auf Kopfgröße skaliert |
| `avatar_normalize.json` | dasselbe | Messwerte + Start-Socket |

Originale (unverändert): `cute penguin 3d model.glb`,
`assets/purple knitted beanie 3d model.glb`.

**Noch nicht im Produkt:** Der 2D-Pinguin (`pinguin.tsx` + WebPs) läuft weiter.
3D ersetzt ihn erst, wenn Ausrichtung + Einbau fertig sind.

### Truhe (Deckel + Korpus)

| Datei | Ort |
|---|---|
| `chest_bottom.glb` / `chest_top.glb` | `brauweg-art/3d/chest/` und `public/3d/chest/` |

Ausrichten im Browser: `http://localhost:5173/?dev=chest`  
Deckel-Posen (eingestellt im Ausrichter):

```json
"lid_open":   { "position": [0.004, 0.423, -0.083], "rotation": [0, 0, 0], "scale": [1.02, 1.02, 1.02] }
"lid_closed": { "position": [0.006, 0.291, -0.098], "rotation": [0.3984, 0, 0], "scale": [1.02, 1.02, 1.02] }
```

---

## 2. Was schon erstellt wurde (Grafik-Bestellungen)

### A — Shop (`ASSETS-SHOP`)
Fertig unter `public/`:
- 10 Kartenrücken → `public/karten/<id>/ruecken.png`
- 10 Szenerien → `public/hub/szene-*.png`
- Wappen 9–18 → `public/hub/wappen-*.png`
- Lach- und Spruch-Emotes → `public/hub/emote-*.png`, `spruch-*.png`

### B — Biom Wiesen
- `packages/client/art/biom-2-wiesen.png` (sonnige offene Wiese) — WebP von dir

### C — Karten-Vorderseiten (`ASSETS-BLATT-VORDERSEITEN`)
- 10 Decks × 24 = **240 PNGs** neben jeweiliger `ruecken.png`
- Builder: `packages/client/art/_blattbau/`
- **Code-Registrierung** (decks.ts / Server / tischware) noch offen bei dir

### D — Pinguin 2D-Kosmetik (`ASSETS-PINGUIN`)
- ~34 Teile in `brauweg-art/pinguin/` und WebP unter `public/hub/pinguin/`
- Einbau: Profil/Pfad/GameSelect nutzen schon `<Pinguin />` statt Ritter-Fallback

### E — Profil-UI (`ASSETS-PROFIL`) — **nur in art/, noch nicht WebP**
Alles in `packages/client/art/`:

**Knöpfe 512×160:** `menue-knopf-holz`, `-holz-gedrueckt`, `-gruen`, `-rot`  
**Tafeln:** `menue-tafel` (768×512, Mitte ~85 %), `menue-tafel-kopf` (768×96)  
**Balken/Schild:** `menue-balken-trog`, `menue-balken-fuellung`, `menue-schild`  
**Icons 256×256:** Kleiderschrank, Klanghalle, Aufgaben, Benachrichtigung,
Abmelden, Freunde (zwei Pinguine), Trophäen

**Dein Schritt:** nach `brauweg-art` kopieren → `wandeln.mjs` → `public/hub/` →
CSS/`border-image` verdrahten.

---

## 3. Was ins Spiel soll (Priorität)

1. **Profil-UI-Assets** (E) wandeln + einbauen — Hub sieht dann nach Holz aus,
   nicht nach iOS.
2. **Blätter freischalten** (C), falls noch nicht registriert.
3. **3D-Avatar:** Mütze im Panel ausrichten → JSON speichern → später
   `penguin_base` + Accessories statt 2D-SVG/WebP im Hub/Profil/Tisch.
4. Shop-Assets (A) sind schon in `public/` — nur noch Shop-Logik/Freischaltung
   prüfen.

---

## 4. Plot / Produktbild (für die Story)

**Brauweg** ist ein mobiles Kartenspiel (Doppelkopf/Wizard) in einer warmen,
gemalten Wirtshaus-Welt. Der Spieler ist ein **Pinguin** — zuerst als 2D-Figur
mit Hüten und Kleidung, bald als **echtes 3D-Maskottchen**, das man im Hub und
am Tisch sieht.

Die Grafik soll sich anfühlen wie bemaltes Holz und Messing (Clash-Royale-Nähe,
kein Flat-iOS). Neue Menüflächen und Knöpfe ersetzen CSS-Verläufe. Der Shop
verkauft Blätter, Szenen, Wappen und Emotes. Der Trophäenpfad und der
Kleiderschrank drehen sich um denselben Pinguin.

**Nächster sichtbarer Meilenstein für Spieler:** Profil und Hub mit echten
Holz-Tafeln/Knöpfen + 3D-Pinguin mit erster Mütze.

---

## 5. Kurz-Checkliste für dich

- [ ] Dev-Server starten, `/?dev=avatar` öffnen, Mütze setzen, JSON kopieren
- [ ] Profil-PNGs aus `art/` → Archiv → WebP → Hub verdrahten
- [ ] Offen: Deck-Registrierung der neuen Vorderseiten
- [ ] Später: 2D-Pinguin durch 3D-Komponente ersetzen (gleiche Slots: Hut, …)
- [ ] Profil-Trophäen weg vom Blau: Bestellung `ASSETS-PROFIL-TROPHAEEN.md`,
      Einbau-Hinweis `FUER-CLAUDE-PROFIL-TROPHAEEN.md`

Fragen oder fehlende Dateien → Emile / dieses Repo (`docs/` + `brauweg-art/3d/`).
