# Tafelrunde: Fähigkeiten und Markeneffekte — Messbericht

**Stand 27.11.2026.** Gehört zu `docs/TAFELRUNDE-NEU-UMSETZUNG.md`,
Abschnitte 2, 3 und 5. Gemessen mit den Werkzeugen des Moduls
(`packages/game-tafelrunde/werkzeug/`). „Alt“ ist der Regelkern vor dem Umbau,
gebaut aus `HEAD` in einem ausgeschlossenen Nebenordner, „neu“ der Stand
dieses Zweigs.

## Was gebaut ist

- **Fähigkeiten** (`src/faehigkeiten.ts`): 16 aktive mit Mana, 3 passive,
  2 Einheiten ohne. Mana kommt aus eigenen Angriffen (+10) und erlittenen
  Treffern (+5). Ist der Balken voll, wirkt die Einheit statt des nächsten
  Angriffs. Verpufft eine Fähigkeit (kein Ziel, niemand verwundet), bleibt das
  Mana voll.
- **Zustände im Kampf** (`src/kampf.ts`): betäubt, verlangsamt, Schild,
  Panzer, Schildwall, Brand, Kampfgeist. Dazu Sprünge und Wiederkehr. Neue
  Ereignisse `faehigkeit`, `zustand`, `sprung`, `wiederkehr`; Treffer tragen
  das Mana beider Beteiligten, die Quelle und den vom Schild geschluckten Teil.
- **Markeneffekte** (`src/synergien.ts`): je Marke ein sichtbarer Effekt plus
  ein kleiner Zahlenanteil. Die bisherigen, gemessenen Boni bleiben als
  `schaetzung` für den Bot.
- **Bot**: rechnet die Marken mit der Schätzung und die Fähigkeiten mit einem
  Aufschlag je Fähigkeit (`FAEHIGKEIT_WERT`).
- **Spiegeläquivarianz bleibt**: Alle Auswahlen gehen über Abstand und Rang,
  die Probe dazu ist grün.

## Ausgewogenheit der Marken (1.000 Partien zu viert, zwei Saatbasen)

| Marke | alt | neu (basis) | neu (zweite) |
| --- | --- | --- | --- |
| Drache | x1,12 | x0,91 | x0,91 |
| Naturwesen | x1,08 | x1,13 | x0,94 |
| Meuchler | x1,07 | x1,08 | x1,20 |
| Elementar | x1,03 | x0,94 | x1,00 |
| Krieger | x1,03 | x0,92 | x0,93 |
| Wächter | x0,88 | x1,03 | x1,02 |
| Untot | x0,78 | x0,99 | x1,00 |
| **Spanne** | **x0,78–1,12** | **x0,91–1,13** | **x0,91–1,20** |

Die Marken liegen jetzt **enger beieinander als vorher**. Der Weg dahin hatte
vier Runden:

| Runde | Änderung | Spanne |
| --- | --- | --- |
| 1 | erster Wurf | x0,57–1,43 (Naturwesen und Meuchler zu stark, Untot und Wächter zu schwach) |
| 2 | Wachstum halbiert, Meuchler ohne Tempo, Schild und Wiederkehr stärker | x0,72–1,20 |
| 3 | Meuchler-Tempo zurück, Untot gesenkt, Wachstum weiter gesenkt | x0,83–1,21 |
| 4 | Bot kennt die Fähigkeiten (`FAEHIGKEIT_WERT`) | x0,91–1,20 |

## Monokultur-Turnier (je Rolle, drei Kopien je Seite)

| Rolle | alt | neu |
| --- | --- | --- |
| Wache | 12,5 % | 28,7 % |
| Schütze | 82,3 % | 41,9 % |
| Magier | 66,0 % | 60,4 % |
| Meuchler | 57,7 % | 73,7 % |
| Beistand | 42,1 % | 63,2 % |

Die Rollen liegen enger als vorher. Das Turnier ist bewusst ein Zerrbild (drei
gleiche Einheiten erreichen immer die Markenschwelle 3) und wird neben der
Ausgewogenheit gelesen, nicht allein.

Zwei Befunde aus dem Turnier sind sofort behoben:

- **Hinterhalt nur für Nahkämpfer.** Nachtpfeil (Armbrust, Marke Meuchler)
  sprang sonst mitten unter die Gegner und fiel von 71 % auf 0 %.
- **Lichtsegen stärker** (Mana 60, Heilung 1,5, heilt auch die Wirkerin). Der
  Lichtpinguin fiel sonst von 40 % auf 0 % und war wieder die letzte Zeile
  seiner Stufe.

## Spielzeit (300 Partien zu viert)

| | alt | neu |
| --- | --- | --- |
| Partie | 6:10 | 6:30 |
| Kampf im Median | 15,4 s | 16,0 s |
| an der Höchstdauer abgebrochen | 2,4 % | **7,5 %** |

Die Partie bleibt im Ziel (höchstens 8 Minuten). **Offen** ist der Anteil der
Kämpfe, die bis zur Höchstdauer laufen. Er hat sich verdreifacht, vor allem
durch die Schilde der Wächter und die Wiederkehr. Das ist noch kein Fehler (die
Entscheidung nach Zeit ist geregelt), aber die erste Schraube, wenn echte
Partien zu zäh wirken: Schild der Wächter senken (heute 22 / 33 / 50 % des
Lebens).

## Angepasste Proben (mit Begründung im Test)

- `kampf.test.ts`: Nachspielen kennt Sprung und Wiederkehr. Den Angriffstakt
  prüft es nur an gewöhnlichen Hieben. „Heilt nur, wer die Rolle trägt“ heißt
  jetzt: jede Heilung nennt ihre Quelle, und jede Quelle hat ihre Träger.
- `turnier.test.ts`: „Gewänne ohne Heilung null Kämpfe“ ist jetzt „gewinnt ohne
  Heilung deutlich weniger“, weil der Runenschild auch ohne Heilfaktor wirkt.
- `bewertungsprobe.test.ts`: Die Aussage ist wie dort vorhergesagt gekippt.
  Ohne Deckung sagt die Bot-Stärke die Kampfmessung jetzt ebenfalls vorher
  (+0,30, früher −0,29). Geprüft wird, dass die Deckung nicht schadet.
- Neu: `faehigkeiten.test.ts` (8 Proben): jede aktive Fähigkeit löst aus,
  Mana in Grenzen, Betäubte handeln nicht, Schild vor Leben, Wiederkehr
  einmal je Seite, Sprung nur für Nahkämpfer, Brand wirkt.

Stand: 358 Modultests grün.
