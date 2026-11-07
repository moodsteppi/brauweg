# Messung 06.11.2026 — Farbduell-Regelfix (faire Ecken, Mauerregeln)

Gleiches Skript, gleiche Saaten vorher und nachher:

    node werkzeug/simulation.mjs --extreme 200 --klar 200 --build 200 --ohne-ausbeuter --faeden 16

„Vorher" ist der Stand f210ab0a (12 x 11-Extreme, alte Einmauer-/Einsperr-Regel),
„nachher" fae4a420. Weniger Partien als in MESSUNG-2026-11-07.md (1000/200/200),
weil das alte Extreme je Partie rund 23 s rechnet; jene Messung lief zudem noch
auf dem 8 x 7-Extreme und ist mit dieser nicht vergleichbar.

## Kurz

| Messgroesse                                    | Extreme vorher | Extreme nachher | Build vorher | Build nachher | Klar (beide) |
|------------------------------------------------|----------------|-----------------|--------------|---------------|--------------|
| Ecke mit zwei gleichfarbigen Nachbarn (Sitz 1) | 23.5 %         | 0.0 %           | 28.0 %       | 28.0 %        | 28.0 %       |
| Sitz 1 nach Zug 1 ohne nutzbare Farbe          | 4.0 %          | 0.0 %           | 5.5 %        | 5.5 %         | 5.5 %        |
| EINGESPERRT (>= 10 frei, <= 1/4)               | 9.5 %          | 1.0 %           | 4.5 %        | 0.0 %         | 0.0 %        |
| Fronten zu, davon direkt durch Mauer           | 25.0 %         | 0.0 %           | 24.0 %       | 0.0 %         | 0.0 %        |
| Mauern je Partie (Bot)                         | 9.32           | 0.00            | 3.65         | 0.00          | –            |
| Sieg Sitz 0 / Sitz 1 / remis                   | 57.5/38.5/4.0  | 60.0/34.5/5.5   | 56.5/31.5/12 | 52/36/12      | 52/36/12     |

**Stand dieser Messung: fae4a420, NICHT der Endstand des Zweigs.** Danach
wurde der Bot auf Niklas' Entscheidung "b+" umgebaut (eac0ba11) und mauert
wieder — mit Folgen, die hier noch nicht stehen: 42,63 / 18,92 Mauern je
Partie und EINGESPERRT 66,5 % / 54,0 % (Extreme / Build). Diese Zahlen stehen
in MESSUNG-2026-11-06-bot-mauert.md. Der folgende Absatz und die Spalten
"nachher" beschreiben den Regelfix mit dem damals unveraenderten Bot.

Der Bot ist (bei fae4a420) unveraendert. Sein Wandwert lebt vom Abtrennen (Felder, die nur
einer erreicht); genau das verbietet Regel 2 jetzt. Uebrig bleibt der halbe
Zugterm, hoechstens 1,0 gegen die Schwelle 2 — er mauert nicht mehr. Build
spielt dadurch Zug fuer Zug wie Klar.

## Vorher (f210ab0a)

### 1. Eroeffnung: Sitz ohne nutzbare Farbe

| Messgroesse                                               | extreme (#0–199, n=200) | klar (#0–199, n=200) | build (#0–199, n=200) |
|-----------------------------------------------------------|-------------------------|----------------------|-----------------------|
| Ecke Sitz 1: beide Nachbarn gleichfarbig                  | 23.5 %                  | 28.0 %               | 28.0 %                |
| Ecke Sitz 0: beide Nachbarn gleichfarbig                  | 18.0 %                  | 22.0 %               | 22.0 %                |
| Eckfarbe 0 = beide Nachbarn 1 (harmlos: 0 muss umfaerben) | 5.0 %                   | 5.0 %                | 5.0 %                 |
| Sitz 0 KOENNTE Sitz 1 mit Zug 1 sperren                   | 23.5 %                  | 28.0 %               | 28.0 %                |
| ohne nutzbare Farbe nach Zug 1 (Sitz 1 am Zug)            | 4.0 %                   | 5.5 %                | 5.5 %                 |
| ohne nutzbare Farbe nach Zug 2 (Sitz 0 am Zug)            | 0.0 %                   | 0.0 %                | 0.0 %                 |
| ohne nutzbare Farbe nach Zug 3 (Sitz 1 am Zug)            | 0.0 %                   | 0.0 %                | 0.0 %                 |
| ohne nutzbare Farbe nach Zug 1 oder 2                     | 4.0 %                   | 5.5 %                | 5.5 %                 |
| Partien mit mind. einem Zug ohne nutzbare Farbe           | 18.0 %                  | 21.0 %               | 21.5 %                |
| solche Zuege je Partie                                    | 0.18                    | 0.21                 | 0.25                  |

### 2. Abgetrennt und eingeschlossen (solange noch freie Felder liegen)

| Messgroesse                                                 | extreme (#0–199, n=200) | klar (#0–199, n=200) | build (#0–199, n=200) |
|-------------------------------------------------------------|-------------------------|----------------------|-----------------------|
| Partien: kein freies Feld mehr fuer beide (Fronten zu)      | 91.0 %                  | 61.0 %               | 88.0 %                |
|   ab Zug / freie Felder dann (Mittel)                       | 41.9 / 6.3              | 23.7 / 2.3           | 22.2 / 4.8            |
|   davon direkt durch eine Mauer                             | 25.0 %                  | 0.0 %                | 24.0 %                |
|   davon mit >= 10 freien Feldern                            | 20.0 %                  | 0.0 %                | 9.5 %                 |
| EINGESPERRT: >= 10 frei, einer hat <= 1/4 davon             | 9.5 %                   | 0.0 %                | 4.5 %                 |
|   davon gewinnt der Eingesperrte nicht                      | 19 von 19               | 0 von 0              | 8 von 9               |
| Sitze ohne erreichbares Feld (von 2n), Endspiel mitgezaehlt | 45.5 %                  | 30.5 %               | 44.0 %                |
|   davon mit >= 10 freien Feldern auf dem Brett              | 5                       | 0                    | 2                     |
|   davon direkt durch eine Mauer                             | 0                       | 0                    | 0                     |
| Ende ueber Leerzug-Deckel mit freien Feldern                | 0.0 %                   | 0.0 %                | 0.0 %                 |

### 3. Anzug: Sitz 0 gegen Sitz 1

| Messgroesse                                        | extreme (#0–199, n=200) | klar (#0–199, n=200) | build (#0–199, n=200) |
|----------------------------------------------------|-------------------------|----------------------|-----------------------|
| Sieg Sitz 0 (zieht zuerst)                         | 57.5 %                  | 52.0 %               | 56.5 %                |
| Sieg Sitz 1                                        | 38.5 %                  | 36.0 %               | 31.5 %                |
| Unentschieden                                      | 4.0 %                   | 12.0 %               | 12.0 %                |
| Punkte Sitz 0 / Sitz 1 im Mittel                   | 71.5 / 68.5             | 28.8 / 27.2          | 29.0 / 27.0           |
| Zuege je Partie                                    | 48.6                    | 26.2                 | 27.3                  |
| Sitz 1 nach Zug 1 gesperrt: Partien / davon Sieg 0 | 8 / 100.0 %             | 11 / 72.7 %          | 11 / 81.8 %           |

### 4. Mauern des Bots

| Messgroesse                                     | extreme (n=200) | build (n=200) |
|-------------------------------------------------|-----------------|---------------|
| Mauern je Partie (beide Sitze)                  | 9.32            | 3.65          |
| Partien mit mind. einer Mauer                   | 100.0 %         | 99.0 %        |
| Zuganfaenge mit Kandidaten                      | 10383           | 4853          |
| bester Wandwert im Mittel / hoechstens          | 1.08 / 21.00    | 0.87 / 11.00  |
|   bester Wert < 0                               | 0.0 %           | 0.0 %         |
|   bester Wert = 0                               | 20.8 %          | 32.1 %        |
|   bester Wert 0,5                               | 10.9 %          | 16.7 %        |
|   bester Wert 1 bis 1,5                         | 48.5 %          | 36.1 %        |
|   bester Wert >= 2                              | 19.8 %          | 15.0 %        |
| beste Wand ohne Gebietsanteil (nur Zugterm)     | 33.6 %          | 48.8 %        |
| Grund: Eroeffnung (mauerfrei)                   | 600             | 600           |
| Grund: beste Wand 0 < x < 2                     | 6362            | 2566          |
| Grund: beste Wand = 0                           | 2157            | 1558          |
| Grund: gebaut                                   | 1864            | 729           |
| Grund: keine erlaubte Kante                     | 606             | 729           |
| Abweichung Abschrift gegen botZug (muss 0 sein) | 188             | 0             |

### 5. Farbwahl des Bots gegen Alternativen

| Messgroesse                                               | extreme (#0–199, n=200) | klar (#0–199, n=200) | build (#0–199, n=200) |
|-----------------------------------------------------------|-------------------------|----------------------|-----------------------|
| Farbentscheidungen (>= 2 erlaubte Farben)                 | 9725                    | 5240                 | 5453                  |
| Sperre verpasst (Zuege / Partien)                         | 246 / 79.0 %            | 143 / 58.0 %         | 224 / 73.0 %          |
| sich sperrbar gemacht, sichere Farbe da (Zuege / Partien) | 32 / 15.0 %             | 54 / 24.5 %          | 46 / 20.5 %           |
| 2-Zug-Verlust >= 3 Punkte (Zuege / Partien)               | 70 / 30.0 %             | 14 / 7.0 %           | 15 / 7.5 %            |
|   Verlust im Mittel                                       | 3.3                     | 3.4                  | 3.5                   |
| Gleichstand beim Gewinn (kleinste Nummer gewinnt)         | 3800                    | 2045                 | 2198                  |
|   davon 2-Zug-Wert >= 2 schlechter                        | 151                     | 80                   | 78                    |

### 7. Beispiel-Saaten (Saatindex; nachspielen mit --zeige <spielart>:<index>)

### extreme
- Sitz 0 koennte Sitz 1 mit Zug 1 sperren: 8; 10; 14; 19; 20
- Eckfarbe 0 = beide Nachbarn 1: 8; 19; 20; 33; 51
- ohne nutzbare Farbe nach Zug 1/2: 47 (nach Zug 1: Sitz 1); 55 (nach Zug 1: Sitz 1); 69 (nach Zug 1: Sitz 1); 91 (nach Zug 1: Sitz 1); 112 (nach Zug 1: Sitz 1)
- Fronten zu: 0 (ab Zug 42 durch Mauer, frei 6:2); 1 (ab Zug 39, frei 9:0); 2 (ab Zug 43, frei 2:0); 3 (ab Zug 39 durch Mauer, frei 4:7); 4 (ab Zug 38 durch Mauer, frei 4:1)
- eingesperrt (>= 10 frei, <= 1/4): 27 (ab Zug 38, frei 1:11, Sieger 1); 32 (ab Zug 38 durch Mauer, frei 10:1, Sieger 0); 34 (ab Zug 42 durch Mauer, frei 9:1, Sieger 0); 42 (ab Zug 38, frei 12:4, Sieger 0); 50 (ab Zug 37 durch Mauer, frei 4:12, Sieger 1)
- Sitz eingeschlossen: 0 (Sitz 1 ab Zug 46); 1 (Sitz 1 ab Zug 39); 2 (Sitz 1 ab Zug 43); 3 (Sitz 0 ab Zug 47); 4 (Sitz 1 ab Zug 40)
- Partie mit Mauer: 0 (Zug 7, 18, 22, 25, 28, 29, 31, 36, 40, 42); 1 (Zug 6, 16, 18, 19, 24, 25, 28, 34); 2 (Zug 7, 10, 11, 19, 21, 22, 24, 25, 32, 33, 34, 36, 42); 3 (Zug 13, 14, 16, 20, 22, 26, 32, 34, 39); 4 (Zug 15, 20, 22, 23, 25, 29, 30, 38)
- Wand knapp unter Schwelle: 0 (20 Zuege mit Wert 1–1,5); 1 (20 Zuege mit Wert 1–1,5); 2 (32 Zuege mit Wert 1–1,5); 3 (19 Zuege mit Wert 1–1,5); 4 (22 Zuege mit Wert 1–1,5)
- Sperre verpasst: 0 (Zug 49 Sitz 1: gewaehlt 0, sperrend 6); 1 (Zug 51 Sitz 1: gewaehlt 0, sperrend 6); 2 (Zug 45 Sitz 1: gewaehlt 1, sperrend 5); 3 (Zug 45 Sitz 1: gewaehlt 3, sperrend 5); 4 (Zug 43 Sitz 1: gewaehlt 1, sperrend 5)
- sich sperrbar gemacht: 17 (Zug 3 Sitz 1: gewaehlt 6, sicher 5); 19 (Zug 42 Sitz 0: gewaehlt 1, sicher 5); 22 (Zug 43 Sitz 1: gewaehlt 0, sicher 5); 25 (Zug 43 Sitz 1: gewaehlt 6, sicher 5); 34 (Zug 41 Sitz 1: gewaehlt 4, sicher 6)
- groesster 2-Zug-Verlust: 118 (Zug 23 Sitz 1: gewaehlt 0, besser 6, verlust 6); 113 (Zug 27 Sitz 1: gewaehlt 3, besser 2, verlust 5); 182 (Zug 27 Sitz 1: gewaehlt 2, besser 6, verlust 5); 65 (Zug 17 Sitz 1: gewaehlt 0, besser 5, verlust 4); 82 (Zug 25 Sitz 1: gewaehlt 3, besser 4, verlust 4)

### klar
- Sitz 0 koennte Sitz 1 mit Zug 1 sperren: 1; 8; 16; 18; 22
- Eckfarbe 0 = beide Nachbarn 1: 1; 27; 36; 42; 55
- ohne nutzbare Farbe nach Zug 1/2: 23 (nach Zug 1: Sitz 1); 66 (nach Zug 1: Sitz 1); 123 (nach Zug 1: Sitz 1); 124 (nach Zug 1: Sitz 1); 128 (nach Zug 1: Sitz 1)
- Fronten zu: 3 (ab Zug 25, frei 1:0); 4 (ab Zug 24, frei 1:0); 5 (ab Zug 24, frei 3:0); 6 (ab Zug 21, frei 1:0); 7 (ab Zug 25, frei 1:0)
- eingesperrt (>= 10 frei, <= 1/4): —
- Sitz eingeschlossen: 3 (Sitz 1 ab Zug 25); 4 (Sitz 1 ab Zug 24); 5 (Sitz 1 ab Zug 24); 6 (Sitz 1 ab Zug 21); 7 (Sitz 1 ab Zug 25)
- Sperre verpasst: 1 (Zug 22 Sitz 0: gewaehlt 0, sperrend 2); 2 (Zug 24 Sitz 0: gewaehlt 1, sperrend 3); 5 (Zug 27 Sitz 1: gewaehlt 0, sperrend 5); 6 (Zug 21 Sitz 1: gewaehlt 1, sperrend 4); 7 (Zug 25 Sitz 1: gewaehlt 0, sperrend 4)
- sich sperrbar gemacht: 1 (Zug 21 Sitz 1: gewaehlt 1, sicher 2); 2 (Zug 23 Sitz 1: gewaehlt 2, sicher 3); 8 (Zug 25 Sitz 1: gewaehlt 2, sicher 3); 17 (Zug 24 Sitz 0: gewaehlt 4, sicher 5); 21 (Zug 26 Sitz 0: gewaehlt 3, sicher 4)
- groesster 2-Zug-Verlust: 118 (Zug 10 Sitz 0: gewaehlt 4, besser 5, verlust 6); 61 (Zug 14 Sitz 0: gewaehlt 1, besser 3, verlust 4); 161 (Zug 8 Sitz 0: gewaehlt 3, besser 4, verlust 4); 21 (Zug 20 Sitz 0: gewaehlt 2, besser 4, verlust 3); 43 (Zug 14 Sitz 0: gewaehlt 2, besser 3, verlust 3)

### build
- Sitz 0 koennte Sitz 1 mit Zug 1 sperren: 1; 8; 16; 18; 22
- Eckfarbe 0 = beide Nachbarn 1: 1; 27; 36; 42; 55
- ohne nutzbare Farbe nach Zug 1/2: 23 (nach Zug 1: Sitz 1); 66 (nach Zug 1: Sitz 1); 123 (nach Zug 1: Sitz 1); 124 (nach Zug 1: Sitz 1); 128 (nach Zug 1: Sitz 1)
- Fronten zu: 0 (ab Zug 24, frei 2:0); 3 (ab Zug 25, frei 1:0); 4 (ab Zug 21, frei 3:1); 5 (ab Zug 24, frei 3:0); 6 (ab Zug 20, frei 3:0)
- eingesperrt (>= 10 frei, <= 1/4): 17 (ab Zug 21 durch Mauer, frei 1:9, Sieger 1); 31 (ab Zug 18 durch Mauer, frei 10:2, Sieger 0); 66 (ab Zug 21 durch Mauer, frei 1:11, Sieger 1); 70 (ab Zug 22, frei 8:2, Sieger 0); 91 (ab Zug 18 durch Mauer, frei 12:1, Sieger 0)
- Sitz eingeschlossen: 0 (Sitz 1 ab Zug 24); 3 (Sitz 1 ab Zug 25); 4 (Sitz 1 ab Zug 22); 5 (Sitz 1 ab Zug 24); 6 (Sitz 1 ab Zug 20)
- Partie mit Mauer: 0 (Zug 19, 22); 1 (Zug 17); 2 (Zug 16, 17); 3 (Zug 13, 15, 20, 21); 4 (Zug 11, 16)
- Wand knapp unter Schwelle: 0 (5 Zuege mit Wert 1–1,5); 1 (13 Zuege mit Wert 1–1,5); 2 (11 Zuege mit Wert 1–1,5); 3 (7 Zuege mit Wert 1–1,5); 4 (4 Zuege mit Wert 1–1,5)
- Sperre verpasst: 0 (Zug 25 Sitz 1: gewaehlt 1, sperrend 2); 1 (Zug 22 Sitz 0: gewaehlt 0, sperrend 2); 2 (Zug 24 Sitz 0: gewaehlt 1, sperrend 3); 5 (Zug 27 Sitz 1: gewaehlt 0, sperrend 5); 6 (Zug 23 Sitz 1: gewaehlt 0, sperrend 5)
- sich sperrbar gemacht: 1 (Zug 21 Sitz 1: gewaehlt 1, sicher 2); 2 (Zug 23 Sitz 1: gewaehlt 2, sicher 3); 15 (Zug 21 Sitz 1: gewaehlt 5, sicher 1); 28 (Zug 18 Sitz 0: gewaehlt 0, sicher 4); 29 (Zug 22 Sitz 0: gewaehlt 1, sicher 5)
- groesster 2-Zug-Verlust: 118 (Zug 10 Sitz 0: gewaehlt 4, besser 5, verlust 6); 11 (Zug 17 Sitz 1: gewaehlt 3, besser 5, verlust 5); 61 (Zug 14 Sitz 0: gewaehlt 1, besser 3, verlust 4); 161 (Zug 8 Sitz 0: gewaehlt 3, besser 4, verlust 4); 21 (Zug 20 Sitz 0: gewaehlt 2, besser 4, verlust 3)


## Nachher (fae4a420)

### 1. Eroeffnung: Sitz ohne nutzbare Farbe

| Messgroesse                                               | extreme (#0–199, n=200) | klar (#0–199, n=200) | build (#0–199, n=200) |
|-----------------------------------------------------------|-------------------------|----------------------|-----------------------|
| Ecke Sitz 1: beide Nachbarn gleichfarbig                  | 0.0 %                   | 28.0 %               | 28.0 %                |
| Ecke Sitz 0: beide Nachbarn gleichfarbig                  | 0.0 %                   | 22.0 %               | 22.0 %                |
| Eckfarbe 0 = beide Nachbarn 1 (harmlos: 0 muss umfaerben) | 0.0 %                   | 5.0 %                | 5.0 %                 |
| Sitz 0 KOENNTE Sitz 1 mit Zug 1 sperren                   | 0.0 %                   | 28.0 %               | 28.0 %                |
| ohne nutzbare Farbe nach Zug 1 (Sitz 1 am Zug)            | 0.0 %                   | 5.5 %                | 5.5 %                 |
| ohne nutzbare Farbe nach Zug 2 (Sitz 0 am Zug)            | 0.0 %                   | 0.0 %                | 0.0 %                 |
| ohne nutzbare Farbe nach Zug 3 (Sitz 1 am Zug)            | 0.0 %                   | 0.0 %                | 0.0 %                 |
| ohne nutzbare Farbe nach Zug 1 oder 2                     | 0.0 %                   | 5.5 %                | 5.5 %                 |
| Partien mit mind. einem Zug ohne nutzbare Farbe           | 8.0 %                   | 21.0 %               | 21.0 %                |
| solche Zuege je Partie                                    | 0.09                    | 0.21                 | 0.21                  |

### 2. Abgetrennt und eingeschlossen (solange noch freie Felder liegen)

| Messgroesse                                                 | extreme (#0–199, n=200) | klar (#0–199, n=200) | build (#0–199, n=200) |
|-------------------------------------------------------------|-------------------------|----------------------|-----------------------|
| Partien: kein freies Feld mehr fuer beide (Fronten zu)      | 70.5 %                  | 61.0 %               | 61.0 %                |
|   ab Zug / freie Felder dann (Mittel)                       | 44.1 / 2.9              | 23.7 / 2.3           | 23.7 / 2.3            |
|   davon direkt durch eine Mauer                             | 0.0 %                   | 0.0 %                | 0.0 %                 |
|   davon mit >= 10 freien Feldern                            | 1.0 %                   | 0.0 %                | 0.0 %                 |
| EINGESPERRT: >= 10 frei, einer hat <= 1/4 davon             | 1.0 %                   | 0.0 %                | 0.0 %                 |
|   davon gewinnt der Eingesperrte nicht                      | 2 von 2                 | 0 von 0              | 0 von 0               |
| Sitze ohne erreichbares Feld (von 2n), Endspiel mitgezaehlt | 35.3 %                  | 30.5 %               | 30.5 %                |
|   davon mit >= 10 freien Feldern auf dem Brett              | 2                       | 0                    | 0                     |
|   davon direkt durch eine Mauer                             | 0                       | 0                    | 0                     |
| Ende ueber Leerzug-Deckel mit freien Feldern                | 0.0 %                   | 0.0 %                | 0.0 %                 |

### 3. Anzug: Sitz 0 gegen Sitz 1

| Messgroesse                                        | extreme (#0–199, n=200) | klar (#0–199, n=200) | build (#0–199, n=200) |
|----------------------------------------------------|-------------------------|----------------------|-----------------------|
| Sieg Sitz 0 (zieht zuerst)                         | 60.0 %                  | 52.0 %               | 52.0 %                |
| Sieg Sitz 1                                        | 34.5 %                  | 36.0 %               | 36.0 %                |
| Unentschieden                                      | 5.5 %                   | 12.0 %               | 12.0 %                |
| Punkte Sitz 0 / Sitz 1 im Mittel                   | 72.1 / 67.9             | 28.8 / 27.2          | 28.8 / 27.2           |
| Zuege je Partie                                    | 47.6                    | 26.2                 | 26.2                  |
| Sitz 1 nach Zug 1 gesperrt: Partien / davon Sieg 0 | 0 / –                   | 11 / 72.7 %          | 11 / 72.7 %           |

### 4. Mauern des Bots

| Messgroesse                                     | extreme (n=200) | build (n=200) |
|-------------------------------------------------|-----------------|---------------|
| Mauern je Partie (beide Sitze)                  | 0.00            | 0.00          |
| Partien mit mind. einer Mauer                   | 0.0 %           | 0.0 %         |
| Zuganfaenge mit Kandidaten                      | 8227            | 4622          |
| bester Wandwert im Mittel / hoechstens          | 0.27 / 1.00     | 0.23 / 0.50   |
|   bester Wert < 0                               | 0.0 %           | 0.0 %         |
|   bester Wert = 0                               | 49.7 %          | 54.0 %        |
|   bester Wert 0,5                               | 45.9 %          | 46.0 %        |
|   bester Wert 1 bis 1,5                         | 4.4 %           | 0.0 %         |
|   bester Wert >= 2                              | 0.0 %           | 0.0 %         |
| beste Wand ohne Gebietsanteil (nur Zugterm)     | 100.0 %         | 100.0 %       |
| Grund: Eroeffnung (mauerfrei)                   | 600             | 600           |
| Grund: beste Wand 0 < x < 2                     | 4137            | 2127          |
| Grund: beste Wand < 0                           | 1               | 0             |
| Grund: beste Wand = 0                           | 4089            | 2495          |
| Grund: keine erlaubte Kante                     | 701             | 18            |
| Abweichung Abschrift gegen botZug (muss 0 sein) | 0               | 0             |

### 5. Farbwahl des Bots gegen Alternativen

| Messgroesse                                               | extreme (#0–199, n=200) | klar (#0–199, n=200) | build (#0–199, n=200) |
|-----------------------------------------------------------|-------------------------|----------------------|-----------------------|
| Farbentscheidungen (>= 2 erlaubte Farben)                 | 9528                    | 5240                 | 5240                  |
| Sperre verpasst (Zuege / Partien)                         | 138 / 59.0 %            | 143 / 58.0 %         | 143 / 58.0 %          |
| sich sperrbar gemacht, sichere Farbe da (Zuege / Partien) | 54 / 25.0 %             | 54 / 24.5 %          | 54 / 24.5 %           |
| 2-Zug-Verlust >= 3 Punkte (Zuege / Partien)               | 55 / 24.0 %             | 14 / 7.0 %           | 14 / 7.0 %            |
|   Verlust im Mittel                                       | 3.4                     | 3.4                  | 3.4                   |
| Gleichstand beim Gewinn (kleinste Nummer gewinnt)         | 3744                    | 2045                 | 2045                  |
|   davon 2-Zug-Wert >= 2 schlechter                        | 139                     | 80                   | 80                    |

### 7. Beispiel-Saaten (Saatindex; nachspielen mit --zeige <spielart>:<index>)

### extreme
- Sitz 0 koennte Sitz 1 mit Zug 1 sperren: —
- Eckfarbe 0 = beide Nachbarn 1: —
- ohne nutzbare Farbe nach Zug 1/2: —
- Fronten zu: 1 (ab Zug 39, frei 7:1); 3 (ab Zug 44, frei 2:0); 4 (ab Zug 40, frei 2:1); 5 (ab Zug 42, frei 2:2); 7 (ab Zug 46, frei 0:3)
- eingesperrt (>= 10 frei, <= 1/4): 86 (ab Zug 39, frei 11:0, Sieger 0); 110 (ab Zug 38, frei 10:0, Sieger 0)
- Sitz eingeschlossen: 1 (Sitz 1 ab Zug 40); 3 (Sitz 1 ab Zug 44); 4 (Sitz 1 ab Zug 42); 5 (Sitz 0 ab Zug 45); 7 (Sitz 0 ab Zug 46)
- Partie mit Mauer: —
- Wand knapp unter Schwelle: 0 (1 Zuege mit Wert 1–1,5); 3 (1 Zuege mit Wert 1–1,5); 4 (2 Zuege mit Wert 1–1,5); 5 (1 Zuege mit Wert 1–1,5); 6 (2 Zuege mit Wert 1–1,5)
- Sperre verpasst: 3 (Zug 45 Sitz 1: gewaehlt 0, sperrend 3); 4 (Zug 40 Sitz 0: gewaehlt 1, sperrend 6); 5 (Zug 44 Sitz 0: gewaehlt 2, sperrend 3); 6 (Zug 46 Sitz 0: gewaehlt 0, sperrend 5); 9 (Zug 46 Sitz 0: gewaehlt 0, sperrend 4)
- sich sperrbar gemacht: 4 (Zug 39 Sitz 1: gewaehlt 5, sicher 6); 6 (Zug 45 Sitz 1: gewaehlt 3, sicher 5); 13 (Zug 41 Sitz 1: gewaehlt 0, sicher 4); 17 (Zug 3 Sitz 1: gewaehlt 6, sicher 5); 19 (Zug 43 Sitz 1: gewaehlt 3, sicher 2)
- groesster 2-Zug-Verlust: 101 (Zug 28 Sitz 0: gewaehlt 5, besser 2, verlust 6); 118 (Zug 23 Sitz 1: gewaehlt 0, besser 6, verlust 6); 9 (Zug 12 Sitz 0: gewaehlt 0, besser 5, verlust 5); 113 (Zug 27 Sitz 1: gewaehlt 3, besser 2, verlust 5); 182 (Zug 27 Sitz 1: gewaehlt 2, besser 6, verlust 5)

### klar
- Sitz 0 koennte Sitz 1 mit Zug 1 sperren: 1; 8; 16; 18; 22
- Eckfarbe 0 = beide Nachbarn 1: 1; 27; 36; 42; 55
- ohne nutzbare Farbe nach Zug 1/2: 23 (nach Zug 1: Sitz 1); 66 (nach Zug 1: Sitz 1); 123 (nach Zug 1: Sitz 1); 124 (nach Zug 1: Sitz 1); 128 (nach Zug 1: Sitz 1)
- Fronten zu: 3 (ab Zug 25, frei 1:0); 4 (ab Zug 24, frei 1:0); 5 (ab Zug 24, frei 3:0); 6 (ab Zug 21, frei 1:0); 7 (ab Zug 25, frei 1:0)
- eingesperrt (>= 10 frei, <= 1/4): —
- Sitz eingeschlossen: 3 (Sitz 1 ab Zug 25); 4 (Sitz 1 ab Zug 24); 5 (Sitz 1 ab Zug 24); 6 (Sitz 1 ab Zug 21); 7 (Sitz 1 ab Zug 25)
- Sperre verpasst: 1 (Zug 22 Sitz 0: gewaehlt 0, sperrend 2); 2 (Zug 24 Sitz 0: gewaehlt 1, sperrend 3); 5 (Zug 27 Sitz 1: gewaehlt 0, sperrend 5); 6 (Zug 21 Sitz 1: gewaehlt 1, sperrend 4); 7 (Zug 25 Sitz 1: gewaehlt 0, sperrend 4)
- sich sperrbar gemacht: 1 (Zug 21 Sitz 1: gewaehlt 1, sicher 2); 2 (Zug 23 Sitz 1: gewaehlt 2, sicher 3); 8 (Zug 25 Sitz 1: gewaehlt 2, sicher 3); 17 (Zug 24 Sitz 0: gewaehlt 4, sicher 5); 21 (Zug 26 Sitz 0: gewaehlt 3, sicher 4)
- groesster 2-Zug-Verlust: 118 (Zug 10 Sitz 0: gewaehlt 4, besser 5, verlust 6); 61 (Zug 14 Sitz 0: gewaehlt 1, besser 3, verlust 4); 161 (Zug 8 Sitz 0: gewaehlt 3, besser 4, verlust 4); 21 (Zug 20 Sitz 0: gewaehlt 2, besser 4, verlust 3); 43 (Zug 14 Sitz 0: gewaehlt 2, besser 3, verlust 3)

### build
- Sitz 0 koennte Sitz 1 mit Zug 1 sperren: 1; 8; 16; 18; 22
- Eckfarbe 0 = beide Nachbarn 1: 1; 27; 36; 42; 55
- ohne nutzbare Farbe nach Zug 1/2: 23 (nach Zug 1: Sitz 1); 66 (nach Zug 1: Sitz 1); 123 (nach Zug 1: Sitz 1); 124 (nach Zug 1: Sitz 1); 128 (nach Zug 1: Sitz 1)
- Fronten zu: 3 (ab Zug 25, frei 1:0); 4 (ab Zug 24, frei 1:0); 5 (ab Zug 24, frei 3:0); 6 (ab Zug 21, frei 1:0); 7 (ab Zug 25, frei 1:0)
- eingesperrt (>= 10 frei, <= 1/4): —
- Sitz eingeschlossen: 3 (Sitz 1 ab Zug 25); 4 (Sitz 1 ab Zug 24); 5 (Sitz 1 ab Zug 24); 6 (Sitz 1 ab Zug 21); 7 (Sitz 1 ab Zug 25)
- Partie mit Mauer: —
- Wand knapp unter Schwelle: —
- Sperre verpasst: 1 (Zug 22 Sitz 0: gewaehlt 0, sperrend 2); 2 (Zug 24 Sitz 0: gewaehlt 1, sperrend 3); 5 (Zug 27 Sitz 1: gewaehlt 0, sperrend 5); 6 (Zug 21 Sitz 1: gewaehlt 1, sperrend 4); 7 (Zug 25 Sitz 1: gewaehlt 0, sperrend 4)
- sich sperrbar gemacht: 1 (Zug 21 Sitz 1: gewaehlt 1, sicher 2); 2 (Zug 23 Sitz 1: gewaehlt 2, sicher 3); 8 (Zug 25 Sitz 1: gewaehlt 2, sicher 3); 17 (Zug 24 Sitz 0: gewaehlt 4, sicher 5); 21 (Zug 26 Sitz 0: gewaehlt 3, sicher 4)
- groesster 2-Zug-Verlust: 118 (Zug 10 Sitz 0: gewaehlt 4, besser 5, verlust 6); 61 (Zug 14 Sitz 0: gewaehlt 1, besser 3, verlust 4); 161 (Zug 8 Sitz 0: gewaehlt 3, besser 4, verlust 4); 21 (Zug 20 Sitz 0: gewaehlt 2, besser 4, verlust 3); 43 (Zug 14 Sitz 0: gewaehlt 2, besser 3, verlust 3)

