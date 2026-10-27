# Bestellung: Feature-Grafik für Google Play

Stand 23.09.2026. Google Play verlangt zum Veröffentlichen eine
**Feature-Grafik** (Kopfbild der Store-Seite, auch Hintergrund des
Vorschauvideos). Es gibt sie noch nicht. Zusammenhang:
`docs/store/SCREENSHOTS.md`, `docs/store/CHECKLISTE.md`.

## Maße und Format

| | Wert |
| --- | --- |
| Größe | **1024 × 500 px**, genau |
| Format | PNG 24 Bit **ohne Alphakanal** oder JPEG |
| Dateigröße | höchstens 1 MB |
| Ablage | Original ins Archiv `moodsteppi/brauweg-art` (`store/feature-1024x500.png`), **nicht** nach `packages/client/public/` — die Grafik wird nie ausgeliefert, nur in die Play Console hochgeladen |

## Inhalt

- Stimmung der Spielauswahl: warmes Holz, Kerzenlicht, Kartentisch
  (Vorbild: `packages/client/public/hub/` und die Kacheln in
  `docs/ASSETS-SPIELWAHL.md`).
- Der **Pinguin** mit Ritterhelm (Logo-Figur, `docs/ASSETS-LOGO.md`) links
  oder mittig, dazu ein aufgefächertes Blatt (Doppelkopf/Skat) und ein
  Partykiste-Motiv (Becher mit Fragezeichen wie auf der Kachel).
- Nur die **drei Spiele der Version 1.0** andeuten — keine Zauberer-,
  Golf- oder Poker-Motive.

## Freihalte-Zonen

- **Mittig 60 % der Breite und 50 % der Höhe ruhig halten:** Play legt dort
  bei Videos den Abspielknopf darüber.
- Ränder 40 px frei von wichtigen Teilen — Play schneidet auf manchen
  Geräten an.

## Abnahme

- Auf **rotem Grund** geprüft: kein Schachbrett, kein durchscheinender Rand
  (dreimal passiert, `CLAUDE.md`).
- Genau 1024 × 500, Farbtyp ohne Alpha (`file` oder PNG-Kopf: Farbtyp 2).
- Wirkt auch verkleinert auf 512 × 250 (so erscheint sie in Listen).

## Was NICHT ins Bild gehört

- **Kein eingebrannter Text** außer dem Schriftzug „Brauweg" aus dem Logo
  (keine Werbezeilen, kein „Jetzt kostenlos" — Play verbietet Preis- und
  Rangangaben in Grafiken).
- **Kein Alkohol im Vordergrund**, keine Gläser, kein Bier — die Store-Seite
  soll die Partykiste nicht als Trinkspiel bewerben (Apple 1.4.3 prüft die
  Metadaten mit, Play die Grafik).
- Keine Marken oder Figuren Dritter, keine echten Personen, keine
  Screenshots von Geräten mit fremden Logos.
- Keine Originalauflösung irgendwo unter `public/`.
