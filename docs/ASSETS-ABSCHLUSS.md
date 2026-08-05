# Bildbestellung: Abschluss einer Partie

Der Bildschirm nach der letzten Runde ist der einzige, der noch komplett
ungestaltet ist: dunkler Farbverlauf, flache Karte, Emoji-Medaillen. Es ist
aber der Moment, in dem die Partie sich auszahlt — er sollte sich wie ein
Abschluss anfuehlen und nicht wie ein Fehlerdialog.

Vier Dateien.

---

## Für alle Bilder verbindlich

**Format**
- PNG, **1024 × 1536** (Hochkant 2:3) für den Hintergrund.
- Freigestellte Teile: PNG mit **echtem Alphakanal**, sRGB.
- **Kein Schachbrett-Muster** und **keine weiße Fläche** als „Transparenz".
  Probe: auf knallroten Grund legen — sichtbar ist nur, was sichtbar sein
  soll, ohne hellen Saum.

**Bitte in voller Auflösung liefern.** Ich verkleinere und wandle selbst um.

**Was NICHT ins Bild gehört**
- **Keine Schrift, keine Zahlen, keine Namen.** Punkte, Plätze und Namen
  setzt die App.
- Keine Bedienelemente, kein Handyrahmen, kein Alkohol.
- **Keine Spielkarten im Hintergrund** — die Partie ist vorbei.

**Ton und Stil**
Wie `bg-spieltisch.png` und `truhe.png`: gemalt, warm, plastisch, Licht von
oben. Feierlich, aber ruhig — kein Konfetti-Feuerwerk. Auch wer Letzter
wird, sieht diesen Bildschirm.

---

## 1 — `bg-abschluss.png`

**Wo:** Hinter der Ergebnisliste.
**Motiv:** Der Blick nach dem Spiel: dieselbe Stube wie beim Spieltisch,
aber von weiter weg und ruhiger. Im Hintergrund ein Regal oder Sims mit
Pokalen und Krügen — angedeutet, nicht ausgearbeitet. Warmes Abendlicht von
einer Lampe, weicher Lichtkegel in der Mitte.

**Zonen**
| Höhe | Was dort liegt | Anforderung |
| --- | --- | --- |
| 0–20 % | Luft über der Karte | darf Motiv tragen (Regal, Lampe) |
| 20–80 % | **Die Ergebniskarte** | sehr ruhig und dunkel, keine Muster |
| 80–100 % | Knopf und Luft | ruhig |

Die Mitte trägt die Karte — dort bitte flächig, damit weiße Schrift
darüber steht wie auf Papier und nicht wie auf einem Foto.

---

## 2 bis 4 — `medaille-1.png`, `medaille-2.png`, `medaille-3.png`

**Wozu:** Der Platz in der Ergebnisliste. Bisher stehen dort die Emojis
🥇🥈🥉 — die sehen auf jedem Gerät anders aus und passen zu nichts.
**Format:** PNG mit Alpha, **256 × 256**, Medaille mittig, bei allen drei
**exakt gleich groß und gleich ausgerichtet**.

**Motiv:** Eine runde Medaille an einem kurzen Band, leicht schräg
hängend. Gold, Silber, Bronze. Auf der Medaille ein schlichtes Zeichen —
ein Lorbeerkranz oder ein Stern —, **aber keine Ziffer**: Die Zahl setzt
die App, und bei Gleichstand hängen zwei gleiche Medaillen nebeneinander.

**Wichtig:** Die Medaille wird nur etwa **28 Pixel** groß angezeigt. Feine
Gravuren verschwinden dort. Was zählt, ist die Silhouette und die klare
Unterscheidung Gold / Silber / Bronze auf einen Blick.

---

## Was ich bewusst NICHT bestelle

- **Konfetti, Sternenregen, Sieger-Pose.** Drei von vier verlieren.
- **Eine eigene Verlierer-Grafik.** Der Bildschirm ist für alle derselbe.
- **Eine Karte als Rahmen** — dafür nehme ich `tafel.png`, das gibt es.

---

## Ablage

Alles nach `packages/client/public/hub/` unter genau diesen Namen.

**Es liegen Platzhalter unter diesen Namen**, damit der Bildschirm schon
jetzt vollständig läuft. Die echten Bilder überschreiben sie einfach; am
Code ist dafür nichts zu ändern.

## Prüfung vor der Übergabe

1. Kein Text, keine Ziffern im Bild — auch nicht auf den Medaillen.
2. Die drei Medaillen übereinandergelegt: gleiche Größe, gleiche Neigung.
3. Eine Medaille auf 28 Pixel verkleinert: Gold, Silber und Bronze noch
   auseinanderzuhalten?
4. Hintergrund genau 1024 × 1536, die mittleren 60 % wirklich ruhig.
5. Freigestellte Teile auf rotem Grund geprüft: echtes Alpha, kein Saum.
