# Messung 06.11.2026 — Der Bot mauert wieder (Wegterm, Plaetze je Feld)

Entscheidung Niklas "b+": Unter Regel 2 (keine Mauer verkleinert, was ein
Sitz erreicht) war der Gebietsterm von `bewerteWaende` immer 0, und der Bot
baute 0,00 Mauern je Partie. Neu zaehlt die Wandbewertung (`src/bot.ts`),
wie weit der Gegner zu den freien Feldern hat: 0-1-Breitensuche,
gleichfarbiges freies Nachbarfeld kostet 0 Zuege, jedes andere 1, Tiefe 3
(`reichweite`, gewichtet 4 − d). In Extreme kommt der Platzterm dazu: Macht
eine Wand ein freies Feld voll (`mauernAmFeld` >= `mauernJeFeld`, Rand
zaehlt mit), ist das ein Platz weniger — gut, wenn das Feld naeher am
Gegner liegt, schlecht, wenn naeher an mir.

Gemessen mit

    node werkzeug/simulation.mjs --extreme 200 --klar 200 --build 200 --ohne-ausbeuter --faeden 16

(dasselbe Skript wie b5a8ad30). Die Simulation ruft jetzt `bewerteWaende`
aus dem Bot selbst auf statt einer Abschrift; die Zeile "Abweichung
bewerteWaende gegen botZug" ist in beiden Spielarten 0.

## Vorher / nachher (200 Saaten je Spielart, Bot gegen sich selbst)

| Messgroesse                          | Extreme vor Regelfix (f210ab0a) | Extreme vorher (0c98d5bf) | Extreme nachher | Build vor Regelfix | Build vorher | Build nachher | Klar (alle) |
|--------------------------------------|------|------|------|------|------|------|------|
| Mauern je Partie                     | 9.32 | 0.00 | 42.63 | 3.65 | 0.00 | 18.92 | – |
| Sieg Sitz 0                          | 57.5 % | 60.0 % | 60.5 % | 56.5 % | 52.0 % | 53.5 % | 52.0 % |
| Sieg Sitz 1 / remis                  | 38.5 / 4.0 | 34.5 / 5.5 | 37.0 / 2.5 | 31.5 / 12 | 36 / 12 | 44.0 / 2.5 | 36 / 12 |
| Punkte Sitz 0 / Sitz 1               | 71.5 / 68.5 | – | 77.4 / 62.6 | 29.0 / 27.0 | 28.8 / 27.2 | 28.9 / 27.1 | 28.8 / 27.2 |
| EINGESPERRT (>= 10 frei, <= 1/4)     | 9.5 % | 1.0 % | 66.5 % | 4.5 % | 0.0 % | 54.0 % | 0.0 % |
|   davon gewinnt der Eingesperrte nicht | 19 von 19 | – | 130 von 133 | 8 von 9 | – | 108 von 108 | – |
| Fronten zu, davon direkt durch Mauer | 25.0 % | 0.0 % | 0.0 % | 24.0 % | 0.0 % | 0.0 % | – |
| beste Wand: Weg- / Platzterm im Mittel | – | – | 2.44 / 0.02 | – | – | 2.22 / 0.00 | – |

Extreme "vor Regelfix" lief noch auf dem kleinen Brett ohne Aufbau-Tabelle;
die Zeile steht zum Vergleich der Groessenordnung, nicht als Paar.

Mauern mit dem echten Bot je Saat (die Saaten der Tests): Build 18, 20, 18,
20, 20; Extreme 35, 47, 33, 48, 45. Daraus die Pflichtschwellen in
`test/barrieren.test.ts`: Build >= 5, Extreme >= 10 — ein Viertel des
Gemessenen, damit eine kleine Gewichtsaenderung den Test nicht rot faerbt,
ein Rueckfall auf 0 aber sofort.

Mehr Mauern als der Vorrat (Extreme 42,6 bei 20 je Sitz): Jeder Stern bringt
`STERN_MAUERN` dazu. Kein Fehler.

## Schwelle (`WAND_SCHWELLE`): Variante gegen 2, gepaart

Jede Saat zweimal (Variante auf Sitz 0, dann auf Sitz 1), 60 Build- und 30
Extreme-Saaten. Angegeben: Siege der Variante.

| Schwelle | Build | Extreme | Bemerkung |
|---|---|---|---|
| 1   | 50.8 % | 46.7 % | gleich stark |
| 1.5 | 50.8 % | 51.7 % | gleich stark |
| 3   | 28.3 % | 15.0 % | verliert deutlich |
| 4   | 0 %    | 1.7 %  | baut kaum (0,09 / 2,12 Mauern) |
| 6   | 0 %    | 0 %    | baut nicht |

Die Schwelle bleibt 2: darunter kein Gewinn, darueber verliert der Bot.

Mit Schwelle 3 gegen sich selbst (200 Saaten), als Vergleich zum Befund
unten: Mauern 25,26 / 10,79 je Partie, EINGESPERRT 48,5 % / 41,5 %
(Extreme / Build), Sieg Sitz 0 56,5 % / 47,5 %. Eine hoehere Schwelle
senkt das Einsperren also nur wenig und kostet deutlich Spielstaerke.

## Neuer Bot gegen bisherigen Bot (0c98d5bf), gepaart

    node werkzeug/bot-duell.mjs --alt <Kopie dist/src von 0c98d5bf> --build 200 --extreme 200

Siehe Nachtrag unten.

## Befund: Einsperren entscheidet jetzt die Partie

Die Regeln verbieten, dass eine MAUER den letzten Weg schliesst — sie
verbieten nicht, dass eine Mauer einen Weg so verengt, dass ein ZUG (Faerben)
ihn schliesst. Genau das tut der Bot jetzt: In 54 % (Build) bzw. 66,5 %
(Extreme) der Partien ist ein Sitz mit mindestens zehn freien Feldern
auf ein Viertel davon eingesperrt, und er gewinnt fast nie. "Direkt durch
Mauer" bleibt 0 % — Regel 2 haelt. Ob das so gewollt ist, ist eine
Spielentscheidung (Niklas), keine Bot-Frage.
