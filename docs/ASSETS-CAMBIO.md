# Bildbestellung: Cambio

Cambio ist das dritte spielbare Spiel und das erste ohne Stiche: Jeder hat
vier verdeckte Karten vor sich, in der Mitte liegen zwei Stapel. Das
Regelwerk steht in `docs/cambio-spec.md`.

Es fehlen **drei Bilder**. Alles andere ist schon da — Kartenblätter,
Tischszenerien, Rückseiten und die Menü-Bausteine gelten hier unverändert.

---

## Für alle Bilder verbindlich

**Format**
- PNG, sRGB, **volle Auflösung** — ich verkleinere und wandle selbst um.
- Freigestellte Teile mit **echtem Alphakanal**.

**Echte Transparenz — der häufigste Fehler**
**Kein Schachbrett-Muster** und **keine weiße Fläche** als „Transparenz".
Probe: auf knallroten Grund legen — sichtbar ist nur, was sichtbar sein soll,
ohne hellen Saum. Das ist uns schon dreimal passiert.

**Was NICHT ins Bild gehört**
- **Keine Schrift, keine Zahlen.** Alle Texte setzt die App.
- **Keine Markenzeichen.** Das Spiel heißt bei uns Cambio; „Cabo" und jede
  Anlehnung an die Aufmachung des AMIGO-Originals gehören nicht ins Bild.
- Keine Bedienelemente, kein Handyrahmen, kein Alkohol.

**Ton und Stil**
Wie `spielwahl-doppelkopf.webp` und `spielwahl-wizard.webp`: gemalt, warm,
plastisch. Handyspiel, kein Fotorealismus, kein Comic-Umriss.

---

## 1 — `spielwahl-cambio.png`

**Wo:** Die Kachel in der Spielauswahl, neben Doppelkopf und Zauberer.
**Format:** PNG, **1200 × 300** (4:1), wie die anderen Banner.

**Motiv:** Vier verdeckte Karten nebeneinander auf grünem Filz, leicht
angeschrägt — eine davon **halb aufgedeckt**, sodass man einen roten König
erkennt. Das ist das Bild des Spiels: Man kennt nur einen Teil dessen, was
vor einem liegt.

**Freihalte-Zonen** (wie in `docs/ASSETS-SPIELWAHL.md`)
- **Unteres Drittel:** Dort läuft der Name als Verlauf ein — ruhig und eher
  dunkel halten.
- **Oben rechts:** Dort sitzt bei Vorschau-Spielen die Bald-Marke. Bei
  Cambio bleibt sie leer, aber die Ecke sollte trotzdem ruhig sein.

---

## 2 — `cambio-ruecken-stapel.png` (freigestellt)

**Wozu:** Der Nachziehstapel in der Tischmitte. Er soll nach *Stapel*
aussehen, nicht nach einer einzelnen Karte.

**Format:** PNG mit Alpha, **512 × 720** (Kartenformat 5:7).

**Motiv:** Drei bis vier leicht versetzt übereinanderliegende Kartenrücken,
die oberste vollständig sichtbar. **Die Rückseite selbst gehört nicht ins
Bild** — die kommt aus dem gewählten Kartenblatt und wird darübergezeichnet.
Gebraucht wird nur der *Stapeleffekt*: die Kanten der darunterliegenden
Karten und ein weicher Schatten.

Wenn das zu fummelig ist: Das Bild kann entfallen, dann zeichnet die App
weiterhin eine einzelne Rückseite. Es ist reine Verbesserung, kein Muss.

---

## 3 — `cambio-ruf.png` (freigestellt)

**Wozu:** Das Zeichen, das aufleuchtet, wenn jemand „Cambio" ruft. Danach
ist jeder nur noch einmal am Zug — dieser Moment muss auffallen.

**Format:** PNG mit Alpha, **800 × 400**.

**Motiv:** Eine gemalte Glocke oder ein Handzeichen in warmem Messing, mit
einem angedeuteten Strahlenkranz. **Ohne das Wort „Cambio"** — das setzt die
App darüber, sonst lässt es sich nicht übersetzen.

Wichtig: Es liegt über dem laufenden Tisch. Also **nicht flächendeckend**,
sondern ein Zeichen mit viel Luft ringsum, das man auch bei halber Deckkraft
noch erkennt.

---

## Ablage

Alles nach `packages/client/public/hub/` unter genau diesen Namen.

**Es liegen Platzhalter unter diesen Namen**, damit der Tisch schon jetzt
vollständig läuft. Die echten Bilder überschreiben sie einfach; am Code ist
dafür nichts zu ändern.

Und: `GEMALTE_BANNER` in `packages/client/src/hub.tsx` muss `cambio`
enthalten, sonst greift für die Spielauswahl weiter `spielwahl-bald.webp`.
Das ist schon eingetragen.

## Prüfung vor der Übergabe

1. Kein Text, keine Zahlen, kein Markenbezug im Bild.
2. Freigestellte Teile auf rotem Grund geprüft: echtes Alpha, kein
   Schachbrett, kein heller Saum.
3. Das Banner auf Kachelgröße verkleinert: Sind die vier Karten noch als
   vier zu erkennen?
4. Das Ruf-Zeichen bei 50 % Deckkraft über einem grünen Filz: noch lesbar?
