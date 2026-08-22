# Bilder für Mememory

Nach CLAUDE.md Regel 5 gehört zu jeder Grafik eine Bestellung mit Maßen,
Freihalte-Zonen und Abnahmekriterien. Diese Lieferung wurde **nicht bestellt,
sondern auf diesem Rechner erzeugt** — mit der lokalen SDXL-Installation unter
`D:\AI\ComfyUI` (Werkzeug `D:\AI\tools\txt2img.py`). Die Bestellung steht
trotzdem hier: Sie ist die Prüfliste, gegen die abgenommen wurde, und die
Vorlage, falls jemand Motive nachliefert.

---

## 1 — Was geliefert wurde

| Was | Ordner | Anzahl | Maß | Format | Gewicht |
| --- | --- | --- | --- | --- | --- |
| Motive | `public/mememory/motive/` | 43 | 256 × 256 | WebP q78 | 2,3–15,7 kB · **320 kB gesamt** |
| Tischdecken | `public/mememory/` | 3 | 640 × 936 | WebP q70 | je ~19 kB · **57 kB gesamt** |
| Banner Spielauswahl | `public/hub/spielwahl-mememory.webp` | 1 | 1200 × 300 | WebP q80 | 30 kB |

**Seit dem 23. August sind 13 der 43 Motive nicht mehr selbst erzeugt.**
Der Nutzer hat seine dreizehn Vorlagen ausdrücklich im Deck haben wollen;
sie ersetzen jeweils meine KI-Fassung desselben Motivs. Nebeneinander ging
es nicht — mein Apfel mit Augen und der echte Apfel mit Augen sind auf
80 px nicht auseinanderzuhalten (Abnahmekriterium 4). **Was daran offen
ist, steht unten unter „Herkunft“.**

Originale (PNG, 1024 × 1024 bzw. 832 × 1216) liegen unter
`packages/client/art/mememory/` und sind über `.gitignore` aus dem Repo
gehalten — so will es Regel 4. **Sie sind noch NICHT im Archivrepo
`moodsteppi/brauweg-art`**, weil das auf diesem Rechner nicht ausgecheckt ist;
siehe `docs/MEMEMORY-TICKETS.md`, T-04.

---

## 2 — Maße, und warum genau diese

**256 × 256 für ein Motiv.** Auf einem 375 px breiten Handy sind vier Spalten
mit Abstand 80 CSS-Pixel breit. Bei dreifacher Pixeldichte sind das 240 echte
Pixel; 256 ist die nächste sinnvolle Größe. Vorher standen hier 224 — passend
zu den fünf Spalten, die das Brett bis zum 22. August hatte.

**Quadratisch.** Das Brett trägt ein Seitenverhältnis aus Spalten und Zeilen
(4/6), damit die Zellen fast genau quadratisch werden — gemessen 80 × 79 px.
Vom quadratischen Motiv fällt dadurch kaum noch etwas weg. Die Karte schneidet
mit `object-fit: cover` nach, das Motiv muss also die Mitte tragen.

**Ein Match lädt 12 Motive**, nicht 43: rund **89 kB**. Zusammen mit einer
Tischdecke ist das Spiel damit unter 125 kB spielbereit — trotz größerer
Bilder weniger als vorher. Das ist die Zahl,
an der die Forderung „keine langen Ladephasen" hängt.

**640 × 936 für die Tischdecke.** Sie liegt hinter vierundzwanzig Karten und
ist zum guten Teil verdeckt. Mehr Auflösung landet unter den Karten.

---

## 3 — Abnahmekriterien für ein Motiv

1. **Ein Ding, mittig.** Auf 80 px ist ein Haufen ein Farbfleck, und zwei
   Farbflecken sind im Memory nicht auseinanderzuhalten. Vier Motive sind bei
   der ersten Runde genau daran gescheitert (Apfel, Heul-Emoji, Schere,
   Strichtier — alle wurden zu Wimmelbildern) und wurden nachgezogen.
2. **Kein eingebrannter Text.** Steht im Negativprompt und wird beim Sichten
   geprüft. Einer der drei Fehler aus CLAUDE.md Regel 5.
3. **Heller, ruhiger Hintergrund.** Dunkle Motive verschwinden auf der dunklen
   Tischdecke.
4. **Unverwechselbar gegen die anderen 42.** Zwei ähnliche Motive machen das
   Spiel nicht schwerer, sondern unfair — man kann ein Paar dann nicht mehr
   sicher wiedererkennen. Lama und Alpaka sind der engste Fall im Katalog und
   wurden bewusst behalten (weiß mit Mähne gegen braun und zottelig).
   `dinohund` fiel beim ersten Zug durch: Der Dinosaurier fehlte, übrig blieb
   ein Hund mit großen Augen — also `hundschock` zum Verwechseln ähnlich.
   Nachgezogen mit dem Dinosaurier VORNE im Prompt; SDXL malt zuverlässig
   das, was zuerst genannt wird.
5. **Kein Alphakanal.** Die Karte ist immer voll gefüllt; Transparenz gäbe es
   hier nichts zu tun, und Schachbrett statt Alpha ist laut STAND.md dreimal
   passiert.

## 4 — Abnahmekriterien für die Tischdecke

1. **Die drei Farben müssen deckungsgleich sein.** Sie werden beim Zugwechsel
   ineinander geblendet; ein anderer Faltenwurf wäre ein Bildsprung.
   **Deshalb sind es keine drei Aufnahmen:** Aus einem geänderten Farbwort
   macht SDXL auch bei gleichem Startwert ein anderes Bild (geprüft — die
   weiße Decke hing diagonal, die blaue lag mittig). Geliefert wurde die
   **blaue** Aufnahme; Rot und Weiß entstehen daraus durch Farbdrehung, und
   zwar nur auf dem Stoff. Der Holztisch am Rand bleibt Holz.
2. **Die Maske trennt Stoff von Holz.** Stoff ist bläulich und farbig
   (Farbton 0,50–0,78, Sättigung > 0,15), Holz ist orange. Die Maske wird
   weich gezeichnet, sonst zieht der Farbwechsel einen harten Saum. Gemessen:
   47,8 % der Fläche sind Stoff — das passt zum Bild.
3. **Die Mitte bleibt ruhig.** Dort liegen die Karten.

## 5 — Was NICHT ins Bild gehört

- Text, Wasserzeichen, Signaturen, Bildunterschriften
- Rahmen, Ränder, Collagen, Bildraster
- Menschen und Hände (bei den Decken auch Geschirr, Besteck, Essen)
- mehrere gleichartige Objekte

---

## 6 — Kartenrückseite: bewusst kein Bild

Die Rückseite ist **CSS**, kein Asset: dunkles Pflaumenblau mit Goldrahmen,
feinem Diagonalmuster, einem Ring und dem Monogramm „M" (`.mm-rueck` in
`styles.css`). Gründe:

- Sie erscheint **vierzig Mal gleichzeitig** auf demselben Schirm. Als Bild
  wäre sie eine Datei mehr im Ladepfad für null zusätzliche Information.
- Sie muss auf jeder Kartengröße scharf sein. CSS und Schrift skalieren, ein
  224er WebP nicht.
- Ein Goldrahmen mit Alphakanal ist genau der Fall, bei dem hier schon dreimal
  ein Schachbrett statt Transparenz ausgeliefert wurde.

---

## 7 — Herkunft: was bei den 13 Vorlagen offen ist

Die dreizehn Motive `apfel`, `kartoffel`, `greis`, `heulemoji`, `denkemoji`,
`hamster`, `waschbaer`, `schere`, `strichtier`, `zerrgesicht`, `spritzglas`,
`katzenfilter` und `dinohund` sind **fremde Bilder aus dem Netz**, vom Nutzer
mitgeschickt. Die Originale liegen unter
`packages/client/art/mememory/vorlagen/` (aus dem Sitzungsprotokoll geholt,
weil Anhänge sonst nirgends auf der Platte landen).

Der Rest des Katalogs — 30 Motive — ist weiterhin selbst erzeugt.

**Das ist eine bewusste Entscheidung des Nutzers, keine Empfehlung.** Diese
Punkte gehören dazu und sind mit dem Einbau nicht erledigt:

1. **Urheberrecht.** Mindestens `dinohund` ist ein Filmstandbild
   (Spinosaurus aus *Jurassic Park III*). Bei den übrigen ist die Quelle
   unbekannt. Für eine öffentliche Produktion ist „im Netz gefunden“ keine
   Rechtsgrundlage.
2. **Recht am eigenen Bild.** `greis`, `zerrgesicht` und `katzenfilter`
   zeigen **erkennbare Personen**. In Deutschland braucht die Verbreitung
   eines Personenbildnisses grundsätzlich die Einwilligung der abgebildeten
   Person (§ 22 KUG). Das ist der Punkt mit dem größten Gewicht, unabhängig
   vom Urheberrecht am Foto.
3. **Eine Attribution wurde entfernt.** `zerrgesicht` trug rechts unten die
   Handles `@max_jaou` / `@czroc`. Der Zuschnitt schneidet sie weg — nach der
   Hausregel „kein eingebrannter Text“, aber die Wirkung ist, dass der
   einzige Hinweis auf die Quelle jetzt fehlt. Er steht deshalb hier.
4. **`docs/KLANG.md` führt für jeden Ton Herkunft und Lizenz.** Für Bilder
   gibt es diese Spalte nicht. Diese dreizehn wären die ersten Einträge.

**Wer das aufräumen will**, hat zwei Wege: die KI-Fassungen zurückholen (die
Erzeugerskripte und Prompts liegen im Sitzungs-Scratchpad, die Motive lassen
sich jederzeit neu ziehen) oder für die Vorlagen Rechte klären. Der Katalog
ist so gebaut, dass beides eine Datei je Motiv ist.

---

## 8 — Nachliefern

Die Prompts stehen in den Erzeugerskripten (Sitzungs-Scratchpad,
`mememory_motive.py` / `mememory_nachzug.py` / `mememory_kulisse.py`), die
Wandlung in `mememory_ausliefern.py`. Vorlagen des Nutzers werden über
`vorlagen_einbauen.py` eingebaut — dort stehen auch die Zuschnitte als Zahlen
und die Regel, Transparenz gegen die **Kartenfarbe** zusammenzulegen und nicht
gegen Schwarz (`.convert("RGB")` nimmt sonst Schwarz, und ein freigestelltes
Emoji wird zum schwarzen Kasten).

Wer ein Motiv ersetzt, muss **beides**
tun: die Datei unter `public/mememory/motive/<kennung>.webp` austauschen **und**
die Kennung in `packages/game-mememory/src/motive.ts` stehen lassen bzw.
mitändern. Der Katalog ist der Vertrag zwischen Modul und Client — eine Kennung
ohne Datei ist ein weißer Kasten auf der Karte.
