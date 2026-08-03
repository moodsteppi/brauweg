# Bildbestellung: Doppelkopf-Bildschirme

Für Tischauswahl, Tisch erstellen und Spieltisch fehlen die gemalten
Hintergründe — dort stehen bisher nur Farbverläufe. Diese Datei sagt genau,
was gebraucht wird. Alles andere (Schrift, Knöpfe, Zahlen, Karten) baut die
App darüber.

---

## Für alle Bilder verbindlich

**Format**
- PNG, **1024 × 1536** (Hochkant 2:3) für Hintergründe.
- Freigestellte Einzelteile: PNG mit **echtem Alphakanal**.
- Farbraum sRGB.

**Echte Transparenz — der häufigste Fehler**
Freigestellte Teile brauchen einen echten Alphakanal. **Kein Schachbrett-
Muster** und **keine weiße Fläche** als „Transparenz" — das ist uns schon
zweimal passiert und muss danach von Hand herausgerechnet werden. Zur Probe:
Das Bild auf einen knallroten Grund legen — sichtbar wird nur, was sichtbar
sein soll, ohne hellen Saum.

**Was NICHT ins Bild gehört**
- **Keine Schrift.** Keine Überschriften, keine Zahlen, keine Namen. Alle
  Texte setzt die App — Bilder mit eingebranntem Text können wir nicht
  übersetzen und nicht ändern.
- **Keine Bedienelemente.** Keine Knöpfe, keine Leisten, keine Tab-Leiste,
  keine Karten in der Hand, keine Spielerbilder. Nur die Szene.
- **Kein Handyrahmen**, kein Schattenwurf eines Geräts, keine Präsentations-
  Collage. Ein Bild = eine Fläche.
- **Kein Alkohol**: keine Biergläser, Krüge, Fässer, Hopfen — auch nicht als
  „Brauweg"-Wortspiel.

**Beschnitt — wichtig für die Aufteilung**
Auf hohen Handys wird das Bild seitlich beschnitten: Sichtbar bleiben
verlässlich nur die **mittleren 70 % der Breite**, also etwa von 15 % bis
85 %. Alles Wichtige gehört in diesen Streifen. Die volle Höhe bleibt
sichtbar.

**Ton und Stil**
Wie die vorhandenen Bilder (`weltkarte.png`, `bg-shop.png`, `bg-clan.png`):
gemalt, warm, satt, freundlich — Handyspiel, kein Fotorealismus, kein
Comic-Umriss. Bitte dieselbe Handschrift, damit Hub und Spiel zusammenpassen.

**Lesbarkeit**
Über jedem Hintergrund steht heller Text. Die unten genannten Zonen müssen
deshalb **ruhig und eher dunkel** sein: kein Muster, kein starker Kontrast,
keine hellen Flecken. Lieber flächig als detailreich.

---

## 1 — `bg-tischauswahl.png`

**Wo:** Liste der offenen Tische.
**Motiv:** Blick in eine Spielstube von der Seite — dunkles Holz, Dielen,
warmes Licht von schrägt oben, im Hintergrund angedeutete Wandvertäfelung
und vielleicht ein Regal. Wie ein Raum, in dem gleich mehrere Tische stehen.
Tiefe durch Licht, nicht durch Gegenstände.

**Zonen**
| Höhe | Was dort liegt | Anforderung |
| --- | --- | --- |
| 0–12 % | Kopfzeile mit Schild | ruhig, dunkel |
| 12–22 % | Filterknöpfe und Suche | ruhig, dunkel |
| 22–88 % | **Die Tischliste** | sehr ruhig, gleichmäßig dunkel — hier steht die meiste Schrift |
| 88–100 % | Großer Knopf | ruhig |

Details (Licht, Maserung, ein Bild an der Wand) bitte an die Ränder und in
die oberen 20 %.

---

## 2 — `bg-tisch-erstellen.png`

**Wo:** Bildschirm zum Anlegen eines Tisches.
**Motiv:** Näher am Tisch — grüner Filz füllt den größten Teil, oben ein
Streifen Holzwand mit warmem Licht. Der Filz darf Struktur haben (Faser,
leichte Abnutzung), aber sehr fein.

**Zonen**
| Höhe | Was dort liegt | Anforderung |
| --- | --- | --- |
| 0–12 % | Kopfzeile mit Schild | Holz, ruhig |
| 12–90 % | **Große Holztafel mit den Einstellungen** | flächiger Filz, keine Muster, kein starker Verlauf |
| 90–100 % | Rand | ruhig |

---

## 3 — `bg-spieltisch.png`

**Wo:** Der Spieltisch selbst — das wichtigste Bild.
**Motiv:** Blick von oben schräg auf einen runden Doppelkopf-Tisch in einer
Stube. Grüner Filz mit Holzkante, ringsum dunkles Holz. Oben an der Wand
zwei bis drei warme Lampen, deren Licht auf den Filz fällt.

**Aufteilung (genau einhalten)**
| Höhe | Was dort ist |
| --- | --- |
| 0–10 % | Wand mit Lampen, dunkel |
| 10–75 % | **Der Filz** — füllt die volle Breite, Holzkante oben und unten |
| 75–100 % | Dunkles Holz / Tischkante — darüber liegen die Handkarten |

**Muss frei bleiben**
- **Die Mitte** (30–70 % Breite, 30–65 % Höhe): dort liegt der Stich. Kein
  Muster, kein Wappen, kein Logo auf dem Filz — nur gleichmäßiger Filz mit
  weichem Lichtschein.
- **Die Ränder des Filzes** (links, rechts, oben): dort sitzen die
  Mitspieler. Keine Gegenstände, die mit einem Spielerbild kollidieren.
- **Keine Karten und keine Hände** im Bild.

---

## 4 — `schild.png` (freigestellt)

**Wozu:** Überschrift jedes Bildschirms („Tischauswahl", „Tisch erstellen").
**Format:** PNG mit Alpha, **1200 × 300**.
**Motiv:** Ein längliches Holzschild mit Messing- oder Goldrand, leicht
gewölbt, mit sichtbarer Maserung — wie ein Wirtshausschild.
**Wichtig:** Die **mittleren 70 % müssen leer und ruhig** sein, dort setzt
die App die Schrift. Verzierungen nur an die kurzen Enden.

---

## 5 — `tafel.png` (freigestellt, dehnbar)

**Wozu:** Die Holztafeln, auf denen Einstellungen und Tischzeilen liegen.
**Format:** PNG mit Alpha, **600 × 600**.
**Aufbau — bitte genau so:**
- Ein Rahmen aus Holz mit Messingnieten in den Ecken.
- Der Rahmen ist **exakt 60 Pixel breit** an allen vier Seiten.
- Die **inneren 480 × 480 Pixel** sind gleichmäßige, ruhige Holzfläche ohne
  Ecken und ohne Verlauf — dieser Bereich wird gedehnt, wenn die Tafel
  größer oder kleiner wird. Eine auffällige Maserung dort würde beim Dehnen
  verzerren.

Das ergibt eine Tafel, die in jeder Größe sauber aussieht.

---

## 6 — `pinguin-1.png` bis `pinguin-4.png` (freigestellt)

**Wozu:** Spielerbilder am Tisch. Bisher sitzen vier gleiche Pinguine da.
**Format:** PNG mit Alpha, **512 × 512**, Figur mittig, Brustbild.
**Motiv:** Derselbe Pinguin wie `pinguin.png`, aber in vier klar
unterscheidbaren Ausführungen — verschiedene Mützen- und Schalfarben
(zum Beispiel Blau, Rot, Grün, Violett). Gleiche Haltung, gleicher
Ausschnitt, gleiche Größe, damit sie nebeneinander ruhig wirken.

---

## Ablage

Alles nach `packages/client/public/hub/` unter genau diesen Namen. Danach
baue ich sie ein — die Bildschirme sind schon so gebaut, dass nur der
Hintergrund getauscht werden muss.

## Prüfung vor der Übergabe

1. Kein Text, keine Knöpfe, kein Handyrahmen im Bild.
2. Freigestellte Teile auf rotem Grund geprüft: echtes Alpha, kein
   Schachbrett, kein heller Saum.
3. Hintergründe genau 1024 × 1536.
4. Die genannten ruhigen Zonen sind wirklich ruhig.
