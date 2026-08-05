# Für Claude: Profil-Trophäen & Konto-Grafik einbauen

Emile lässt die Bilder erzeugen (Bestellung unten). Du verdrahtest danach
Client — **kein** neues Blau, keine Emojis.

## Bestellung (Bilder erzeugen / abnehmen)

**[`docs/ASSETS-PROFIL-TROPHAEEN.md`](ASSETS-PROFIL-TROPHAEEN.md)**

~24 PNGs nach `packages/client/art/`, dann WebP → `public/hub/`.

## Was kaputt ist

- `.hub-stat-hero`, `.hub-stat-kachel`, `.hub-stat-spiel` in `styles.css` =
  **blaue Gradienten** (`#3a7fd4` → `#2458a8`). Das soll weg.
- Komponenten: `StatHero`, `StatKachel`, `StatSpiel` in `hub.tsx`
  (genutzt in Profil-Tab `GameSelect.tsx` + fremdes `Profile.tsx`).
- Einstellungen: `Einstellungen.tsx` — nackte Regler, keine gemalten Icons.
- Benachrichtigungen: Knopf existiert, Screen „Bald“ — mit neuen Icons bauen,
  **keine** 🔔-Emojis.

## Was du baust (nach Bildern)

1. Stat-Gründe als `border-image` / Background, Layout laut Bestellung
   (Hero mit Pokal + Zahl, 2×2, Spielzeilen).
2. Icon-Pfade auf die neuen WebPs umstellen.
3. Einstellungen: Sounds/Musik-Icons + Regler-Trog/Knopf.
4. Benachrichtigungen-UI mit Zeilen-Grund + Typ-Icons + Leer-Zustand.
5. Konto-Knöpfe auf frische `icon-einstellungen` / `-benachrichtigung` /
   `-abmelden` / optional `-konto-loeschen`.

## Nicht anfassen

- Server-Stats / Trophäen-Zählung
- `ASSETS-PROFIL.md`-Tafeln/Knöpfe (schon separat), außer du nutzt sie als Rahmen
- Pose-Werte der 3D-Truhe (`FUER-CLAUDE-3D-TRUHEN.md`) — anderes Thema

## Kurz-Check

Profil-Tab „Trophäen“: kein Blau mehr, Holz/Messing wie Rest-Hub.
Einstellungen/Benachrichtigungen: nur gemalte Icons, null Emoji.
