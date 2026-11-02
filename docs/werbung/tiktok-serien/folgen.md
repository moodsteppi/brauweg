# TikTok-Serie „Plüsch-Spieleabend“ — vier Folgen (Schnitt)

Stand 02.11.2026. Geschnitten aus den 20 Kling-Clips (je 5 s, 1080 × 1920)
im Creative „TikTok-Figuren“ (`bb5cd6da-9b44-47c2-902b-3c8bf71f1a63`).
Die Videos liegen **nicht** im Repo, sondern als Dateien mit der Herkunft SCHNITT am Creative.

| Folge | Asset | Dauer | Geräusche |
|---|---|---:|---|
| F1 Heute gewinn ich | `a3c5caa8-1a88-411c-8ed3-4ad22d4c3b6f` | 16,6 s | Klack (8,8 s), Grillen (ab 12,1 s) |
| F2 Ich schau nicht | `25843061-13d0-44d6-a06f-ffd0d720d43e` | 18,9 s | keine (laut Drehbuch keine vorgesehen) |
| F3 Re | `43a664bb-85ce-4fe5-8d2d-82f3593c8d22` | 16,9 s | Klack (0,7 s), Tock (7,8 s) |
| F4 Die Runde | `3af39f25-c967-4789-be25-d6bcafb946dd` | 19,6 s | Ping (12,5 s) |

Alle: H.264 High, 1080 × 1920, 30 fps, AAC 48 kHz. **Keine Musik.**

## Stimme

**Keine Stimmen.** Auf dem Rechner (Mood XPS) gibt es keinen ElevenLabs-Zugang
(`dienste.mjs liste`: „Kein Dienstzugang eingerichtet“). Der Text steht
stattdessen als eingebrannter Untertitel im Bild: Sprechername in der Farbe der
Figur, darunter die Zeile. Regieanweisungen ohne Sprecher („Stille.“, „Malve zählt.“) stehen
kleiner und grau. Wer später vertont, legt die Stimmen auf dieselben Zeitpunkte.

## Geräusche: woher

- Klack, Tock: `packages/client/public/klang/karte-legen-1.mp3` bzw. `-3.mp3`
- Ping: `packages/client/public/klang/glas/tipp.mp3`
- Kenney, CC0 (siehe `docs/KLANG.md`)
- Grillen: mit ffmpeg (`aevalsrc`) erzeugt, keine fremde Quelle

## Hinweise im Bild

- „KI-generiert“ steht oben links in jedem Bild, weil der Upload `kiHinweis` nicht
  setzen kann.
- Abspann jeder Folge: Logo (`icon-512.png`), „Spieleabend? Link in Bio.“

## Zuordnung Clip → Shot

Es gibt **keinen Einzelclip von Malve**. Ihre Shots sind Ausschnitte aus den Gruppenclips
(Kamera steht dort fest): Malve allein `crop=600:1067:110:300`, Malve und Pelle
`crop=720:1280:0:250`. Ein Clip, in dem Malve eine Karte legt, fehlt ebenfalls.
In F3 kommt deshalb ihr „Tock“ auf den Schnitt zu ihrem zufriedenen Gesicht.

| Clip | Inhalt | verwendet in |
|---|---|---|
| `ce7c639a` | Pelle allein, selbstsicher, Karten | F1 „Heute. Gewinn. Ich.“ |
| `c3bac39a` | Pelle allein, sackt am Ende zusammen | F1 „…morgen gewinn ich.“, F3 „Pelle schluckt“ |
| `5406d880` | Pelle allein, holt ein Handy | F4 „Ich mach den Link.“ + Ping |
| `e447fb53`, `c6fc377c` | Pelle allein, winkt | nicht verwendet |
| `ffaef72d` | Tjark allein, drückt die Karten an die Brust | F2 „du schaust in meine Karten“, F4 „Tjark zockt.“ |
| `633f60ad` | Tjark allein, knallt Karten auf den Tisch | F3 „RE! Und keine Neun! …“ + Klack |
| `684cb088` | Tjark allein, tanzt auf dem Tisch | F3 „War trotzdem geil!“ |
| `f7ff17c1` | Gundi allein, reckt den Hals | F2 Anfang und „beugt sich wieder vor“ |
| `f61f9ffc` | Gundi allein, empört, schielt seitlich | F2 „Ich schau NIE!“, F4 „Gundi schaut nie.“ |
| `03562a78` | Gundi allein, lacht laut | F2 Schluss „HAHAHA!“ |
| `fc9620d3` | Gundi allein, lacht | nicht verwendet (Doppel zu `03562a78`) |
| `45c0e257` | Gruppe, ruhig | Malve-Ausschnitt: F1 „Das hast du gestern auch gesagt.“, F3 „Malve zählt“, F4 „Malve zählt.“ |
| `606fe8f2` | Gruppe, Pelle legt am Ende eine Karte | F1 Karte + Klack, F2 Ausschnitt Malve/Pelle („hebt die Braue, nickt“) |
| `a71f4a7e` | Gruppe, alle schauen | F1 „Stille.“ |
| `7c9ef067` | Gruppe lacht, Malve zufrieden | F4 Anfang „Das ist unsere Runde.“, F3 Malve-Ausschnitt „Danke.“ + Tock |
| `30b26f3f` | Gruppe jubelt | F4 „Spieleabend!“ |
| `c8ad31dd`, `ce9c8429`, `02ad7122` | Gruppe, lacht/jubelt | nicht verwendet (Doppel) |
