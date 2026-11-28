# Hub-Details: Collection, Einstellungen und Spieleinstieg

Stand: 28.11.2026. Lokaler Umbau, noch nicht veröffentlicht.

## Bildbestellung und Herkunft

Eigene Bildgenerierung im bestehenden Spielstubenstil: Walnussholz,
Messing, waldgrüner Filz und elfenbeinfarbene Spielobjekte. Keine Fremdbilder.

| Datei               | Auslieferung                   | Motiv und Freihaltefläche                                                                                                                                         |
| ------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sammel-icons.webp` | 512 × 512, Alpha, 78.006 Bytes | Vier gleich große Felder: Kartenblatt, grüner Spieltisch, Kartenrücken, Schachfiguren. Motive innerhalb ihres Viertels mit transparentem Abstand zu allen Kanten. |
| `sprache.webp`      | 192 × 192, Alpha, 13.940 Bytes | Kleiner Globus auf einem Holzsockel mit Buch, auch bei 38–44 px lesbar.                                                                                           |

Originale liegen lokal unter `packages/client/art/hub-details/originale/`
(ignoriert), verkleinerte PNG-Arbeitskopien unter `wappen/` daneben.
Auslieferung ausschließlich als WebP unter `packages/client/public/hub/zierwerk/`.
Umwandlung mit `~/bildwerkzeug/wandeln.mjs`, Profil `wappen`.

Abnahme: echter Alphakanal, kein eingebranntes Schachbrett, keine Schrift in
den Bildern, keine Originalauflösung unter `public/`. Der Symbolatlas wird
mit 200 % Hintergrundgröße in vier Felder geteilt. Texte, ausgewählte Werte,
Fokus und Bedienzustände bleiben in HTML. Die vorhandenen Bildrahmen aus
`ASSETS-HUB-ZIERWERK.md` behalten als neun Segmente feste Ecken.

## Einbau und Verhalten

- `hub-details.css` gestaltet Collection-Unterseiten, Rückkehrknöpfe,
  Designbereiche, Auswahlkarten sowie Sound- und Sprachfelder.
- Soundregler bleiben native, per Touch und Tastatur bedienbare Eingaben;
  Sprache behält die vorhandene Speicherung und Radio-Semantik.
- Die gemeinsame Spielseite zeigt zuerst Spielname und Startknopf, dann
  die tatsächlich gewählten Karten, Tisch und Rückseite. Trophäen und
  Rangliste folgen darunter. BroChess zeigt nur seinen Figurensatz.
- Jeder Designknopf öffnet über `GameSelect` den passenden
  `SammlungNeu.einstieg`. Auch ein erneuter Einstieg in denselben Bereich
  funktioniert; der allgemeine Collection-Knopf öffnet dessen Übersicht.
- Kleine Bildschirme reduzieren Banner und Vorschauhöhen; reduzierte
  Bewegung und sichtbarer Tastaturfokus bleiben berücksichtigt.

## Prüfung

Browser-Sichtprobe in Handygröße: Doppelkopf und Skat mit sichtbarem
Startknopf und vollständiger Kartenvorschau; BroChess mit Figurensatz;
direkte Auswahl, Zurück-Knopf, Bildsymbole und Settings. Zusätzlich bei
320 × 568 px geprüft: Start und komplette Kartenvorschau ohne Scrollen.
Komponententests decken gewählte Karten, Bildfallback, direkten
Designwechsel und wiederholten Collection-Einstieg ab.
Keine native TestFlight-Prüfung und keine Veröffentlichung in dieser Aufgabe.

## Tafel-Nachtrag für die spätere Veröffentlichung

- Hub → Spieleinstieg: Startaktion und echte Designvorschau vor Fortschritt.
- Spieleinstieg → Collection: optionaler Bereichseinstieg für Blatt, Tisch
  und Rückseite; BroChess ausschließlich Figurensatz.
- Hub → Detailgestaltung: gemeinsamer Bildatlas und bestehende
  Neun-Segment-Rahmen; Soundregler bleiben native Eingaben.
