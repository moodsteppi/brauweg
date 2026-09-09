# Bildbestellung: untote Figuren für Tafelrunde (drei Blätter)

**Stand 06.09.2026. Das hier ist eine benannte Lücke mit Preisschild, kein
Auftrag.** Ob er erteilt wird, entscheidet Robin — die Figuren der Tafelrunde
sind seine Entscheidungen (Kamerawinkel, Größe, vorgerendert statt live).

---

## Der Befund: eine Untote kann heute gar nicht anders aussehen

Seit dem 06.09.2026 zeigen Brett, Bank, Ladenkarte und Arena die
vorgerenderte 3D-Figur (`Figur3D.tsx`), und die hängt an der **Rolle**, nicht
an der Einheit:

- `packages/client/src/figuren3d/figuren3d.ts`: `Rolle3D` kennt fünf Werte,
  `Blatt3D.rolle` ist der Schlüssel, `FIGUREN3D` hat fünf Einträge.
- `packages/client/src/minispiele/tafelrunde/bildfolge.ts`, Kopf: „DIE
  ZUORDNUNG IST DIE ROLLE, NICHT DIE EINHEIT. Es gibt fünf Blätter für 22
  Einheiten." `blattPfad(rolle)` bekommt die Einheit gar nicht zu sehen.
- `packages/client/src/minispiele/tafelrunde/Zeichen.tsx`, `EinheitenFigur`:
  „Der Preis ist, dass sich acht Einheiten eine Figur teilen; ihr NAME steht
  daneben, ihre Marken darüber, ihre Kosten am Punkt." Das ist die
  ausdrückliche Entscheidung, keine Nachlässigkeit.
- `packages/client/src/figuren3d/bildfolgen-rendern.mjs`, `ROLLEN`: „Je Rolle
  eine Figur, eine Garnitur und fünf Animationen."

Die 22 Pixelfiguren aus `figuren.ts` sind seitdem nur noch der **Rückfall**
(`ersatz` von `Figur3D`, greift über `onError`). Der Tausch des Schildknappen
gegen die Wächtermumie (Commit a43345d) hat deshalb geändert, was man sieht,
wenn ein Blatt **nicht** lädt. Am Bildschirm steht weiter der lebende Ritter
mit Untot-Chip.

Und das gilt nicht nur für Untot. Der Moosheiler (ein wandernder Pilz) spielt
den Druiden, der Wurzelriese (ein Holzgolem) und das Irrlicht (eine Kugel)
den Ritter, das Drachenkind den Armbrustschützen. Die Figur sagt die Rolle,
alles andere sagen Name, Chip und Kostenpunkt. Untot fällt nur deshalb
stärker auf, weil „lebendig" und „tot" ein Widerspruch ist und „Ritter" und
„Holzgolem" nur eine Ungenauigkeit.

## Was NICHT gemacht wird, und warum

**Keine Färbung per CSS-Filter** (entsättigt, grünlich, durchscheinend) an
untoten Einheiten. Das wäre die billigste Abhilfe — eine Datenmarke am
Ausschnitt und eine Regel im Stylesheet — und sie trifft daneben:

1. Entsättigen bedeutet in dieser Oberfläche schon etwas anderes.
   `Mitspieler.module.css` setzt ausgeschiedene Mitspieler auf
   `saturate(0.35)`, die Arena lässt Gefallene verblassen. Ein grauer Ritter
   auf dem Brett liest sich als „aus" oder „getroffen", nicht als „untot".
2. Ein umgefärbter lebender Ritter ist kein Untoter, sondern ein Ritter mit
   Filter. Robin hat die Platte unter den Figuren entfernen lassen, weil sie
   „mehr 2D wirken" ließ — ein Farbstich auf einer vorgerenderten Figur ist
   derselbe Verlust.
3. Es wäre eine zweite Anzeige für eine von sieben Marken. Naturwesen,
   Drache, Elementar bekämen keine; das ist kein System, sondern ein Flicken.

**Kein Zeichen am Fuß.** Der Untot-Chip (Schädel, 9 px, oben links auf der
Wabe, `Markenzeichen` in `Synergien.tsx`) ist genau dieses Zeichen. Ein
zweites am Fuß wäre dieselbe Auskunft zweimal.

**Keine 22 Blätter.** Ein Blatt je Einheit wären rund 1,3 MB statt 284 kB —
gegen Robins Entscheidung, die 3D-Figuren wegen der Ladezeit vorzurendern.

## Die ehrliche Abhilfe: ein Blatt je Rolle **und Gestalt**

Der Schlüssel des Blattes wird von `Rolle` zu `Rolle × Gestalt`, mit den zwei
Gestalten `lebend` und `untot`. Die Gestalt kommt aus den **Marken** der
Einheit (`einheit.marken` enthält `untot`), nicht aus ihrer Kennung: So folgt
das Bild dem Katalog. Als der Schildknappe am 05.09.2026 die Marke bekam,
hätte er das Blatt gleich mitbekommen; wer sie ihm wieder nimmt, bekommt den
Ritter zurück, ohne ein Bild anzufassen.

Drei Einheiten tragen Untot, in drei Rollen — und dafür gibt es passende
CC0-Figuren **vom selben Urheber, im selben Stil, auf demselben Rig** wie die
fünf vorhandenen Blätter:

| Einheit | Rolle | Figur aus „KayKit Skeletons 1.1" | Ausrüstung |
|---|---|---|---|
| Schildknappe (1 Gold) | wache | `Skeleton_Warrior` | `Skeleton_Blade`, `Skeleton_Shield_Large_A` |
| Knochenspäher (2 Gold) | meuchler | `Skeleton_Rogue` | `Skeleton_Dagger` (beidhändig) |
| Grabfürstin (3 Gold) | magier | `Skeleton_Mage` | `Skeleton_Staff` |

Das Paket liegt in demselben Spiegel wie der Druide
(`SY227/kaykit-complete-v6-1-assets`, Ordner `KayKit Skeletons 1.1`;
`characters/gltf`, `assets/gltf`, `Animations/gltf/Rig_Medium`), unter
derselben `License.txt` (CC0 1.0). Nachgesehen am 06.09.2026. Die Figuren
sind nach 2.0-Art gebaut — ohne eingebaute Animation —, also läuft der
**Druiden-Weg** (`baueAusTeilen` im Renderskript): Figur aus dem Paket,
Bewegungen aus „Character Animations 1.1" (`Rig_Medium_General`,
`Rig_Medium_MovementBasic`, dazu `CombatMelee` für Hieb und Doppelklinge,
`CombatRanged` für den Zauberstoß), Ausrüstung an `handslot.r` — wie der
Stab des Druiden; wo die zweite Klinge und der Schild hängen, sagt das
Modell (`Knife_Offhand` und `Round_Shield` im Knight/Rogue der 1.0-Blätter
sind das Vorbild).
`baueAusTeilen` bricht ab, wenn ein Knochenname fehlt — ob das Rig wirklich
passt, weiß man nach dem ersten Lauf, nicht vorher.

Sollte je ein Schütze oder Beistand Untot bekommen: `Skeleton_Rogue` mit
`Skeleton_Crossbow` und der `Necromancer` liegen im selben Paket.

### Was es kostet

- **Bytes:** drei Blätter zu je 50 bis 80 kB (die fünf vorhandenen wiegen
  48 bis 78 kB). Das Vorladen wächst von 284 auf rund 450 kB; `BLATT_PFADE`
  in `bildfolge.ts` nimmt neue Blätter von selbst mit.
- **Code:** `figuren3d.ts` (Schlüssel und drei Einträge), `bildfolge.ts`
  (`blattPfad(rolle, marken)`), die vier Aufrufer von `Figur3D` reichen die
  Marken durch (`Zeichen.tsx`, `KampfAnzeige.tsx`), drei `ROLLEN`-Einträge
  im Renderskript mit eigenem Paketpfad (heute ist `TEILE_BEISTAND` auf
  Adventurers 2.0 festgeschrieben).
- **Ein Renderlauf**, und der ist der eigentliche Preis: Der Ausschnitt ist
  **einer für alle Blätter** (Kopf von `FIGUREN3D_FUSSPUNKT`). Greift eine
  Skelettfigur weiter aus als die fünf heutigen — der Krieger mit dem großen
  Schild könnte es —, verschieben sich
  `FIGUREN3D_FUSSPUNKT` und `FIGUREN3D_ZELLHOEHE_METER`, damit werden **alle
  acht** Blätter neu gerendert, und die vier von Hand gesetzten Zahlen in
  `styles.css` (`.tr-figur3d` 71,8 % / 23,1 %, `.tr-bankplatz .tr-figur3d`
  92,8 % / 2,8 %) sind neu zu rechnen. Beides steht mit Rechenweg an Ort und
  Stelle.
- **Werkzeug:** Auf diesem Mac fehlen `playwright` und sein Chromium
  (`npm ls` leer, kein `~/Library/Caches/ms-playwright`); `sharp` liegt in
  `~/bildwerkzeug`. Der Lauf braucht Netz zum Spiegel und einmalig rund
  150 MB Chromium.
- **Abnahme durch Robin** am Gerät, wie bei jedem Blatt bisher.

### Abnahmekriterien

- Auf der Wabe (rund 56 px) und in der Arena (72 px) als Skelett erkennbar,
  und die drei untereinander unterscheidbar: Schild, zwei Dolche, Stab.
- Neben dem lebenden Rollengenossen (Dorfwache, Gassendieb, Frostweberin)
  dieselbe Größe, derselbe Fußpunkt, dieselbe Blickrichtung (rechts).
- Alphakanal, auf rotem Grund geprüft — kein Schachbrett. Kein Text, keine
  Zahl, kein Wappen im Bild (es wird gespiegelt).
- Ausgeliefert nur das WebP-Blatt unter `public/tafelrunde/figuren3d/`,
  kein Original, keine Zwischendatei.
- `LIZENZ.txt` neben den Blättern nennt das dritte Paket.

## Bis dahin

Der Chip ist die wahre Anzeige. Er steht auf Wabe, Bank, Ladenkarte und im
Einheitenblatt; in der Arena gibt es keinen, dort sagt die Figur für **alle**
22 Einheiten nur die Rolle. Das ist der Stand, und er ist im Code so
beschrieben — nicht schön, aber nicht gelogen.
