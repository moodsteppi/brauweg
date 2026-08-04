# Zauberer — Spezifikation v1.0

Regelwerk und Umsetzungsvorgabe für das zweite Spielmodul der Plattform.
Was hier steht, ist die Wahrheit für die Engine; die Plattformregeln
(Trophäen, Timeouts, Lobby) stehen unverändert in
[plattform-plan.md](plattform-plan.md).

**Name.** Das Spiel heißt in der Oberfläche **Zauberer**. Die interne
Kennung bleibt `wizard`, weil sie in Datenbankzeilen, Protokollnachrichten
und Dateinamen steht und dort nichts zu suchen hat, was sich noch ändern
kann. Der Anzeigename läuft wie alles andere über `i18n.ts`.

Der Grund für den deutschen Namen ist nicht Geschmack: „Wizard" ist eine
eingetragene Marke (Ken Fisher / US Games Systems, in Deutschland Amigo).
Spielregeln sind nicht schützbar, ein Produktname schon — und die App soll
in den App Store.

---

## 1. Das Spiel in fünf Sätzen

Jeder sagt vor der Runde an, wie viele Stiche er machen wird. Wer seine
Ansage **genau** trifft, bekommt 20 Punkte plus 10 je Stich; wer daneben
liegt, verliert 10 Punkte je Stich Abweichung. Die Handgröße wächst mit
jeder Runde: Runde 1 hat eine Karte, Runde 12 hat zwölf. Vier Zauberer
stechen alles, vier Narren verlieren alles, und die aufgedeckte Karte des
Reststapels bestimmt den Trumpf. Gewonnen hat, wer nach der letzten Runde
die meisten Punkte hat.

Der entscheidende Unterschied zum Doppelkopf: **Es gibt keine Parteien.**
Jeder spielt für sich, es gibt keine verdeckte Partnerschaft, keine Re- und
Kontra-Ansagen und keinen Grund, eine Zuschauersicht besonders zu fürchten.

---

## 2. Blatt

60 Karten, jede genau einmal:

| Gruppe | Anzahl | Darstellung im Protokoll |
| --- | --- | --- |
| Vier Farben zu je 13 Werten (1–13) | 52 | `suit` = `C`/`S`/`H`/`D`, `rank` = `'1'`…`'13'` |
| Zauberer | 4 | `suit` = `Z`, `rank` = `'1'`…`'4'` |
| Narren | 4 | `suit` = `N`, `rank` = `'1'`…`'4'` |

Die `id` ist die laufende Nummer im ungemischten Deck und bleibt die einzige
Kennung, mit der Aktionen auf Karten zeigen.

**Warum Zauberer und Narren durchnummeriert sind, obwohl sie gleichwertig
sind:** Der Client zeigt vier verschiedene Motive (siehe
`docs/ASSETS-WIZARD.md`). Für die Regeln ist der Rang bedeutungslos — es
gewinnt der **zuerst gespielte** Zauberer, nicht der höchste. Wer aus dem
Rang eine Stärke ableitet, hat einen Fehler gebaut.

**Kartenzahl ist keine Zufälligkeit.** 60 Karten sind durch 3, 4, 5 und 6
teilbar. Genau darum sind es 20, 15, 12 bzw. 10 Runden: In der letzten
Runde ist der Stapel leer.

---

## 3. Ablauf einer Runde

Runde *n* hat *n* Karten je Hand. Der Geber wechselt nach jeder Runde im
Uhrzeigersinn.

1. **Geben.** Jeder bekommt *n* Karten.
2. **Trumpf aufdecken.** Die oberste Karte des Rests wird aufgedeckt:
   - **Farbkarte** → diese Farbe ist Trumpf.
   - **Narr** → in dieser Runde gibt es keinen Trumpf.
   - **Zauberer** → der **Geber** nennt eine Trumpffarbe.
   - **Kein Rest** (letzte Runde) → kein Trumpf.
3. **Ansagen.** Reihum, beginnend links vom Geber, nennt jeder seine
   Stichzahl (0 bis *n*). Alle Ansagen sind öffentlich, der Geber sagt
   zuletzt an.
4. **Stiche.** Die Vorhand (links vom Geber) spielt aus. Es wird *n* Stiche
   gespielt.
5. **Abrechnen.** Punkte nach Abschnitt 6, dann die nächste Runde.

---

## 4. Bedienpflicht

- Wer die angespielte Farbe hat, muss sie bedienen.
- **Zauberer und Narr dürfen immer gespielt werden**, auch wenn man
  bedienen könnte. Sie sind die einzige Ausnahme.
- Wird ein **Zauberer angespielt**, gibt es keine Farbpflicht — alle spielen
  frei.
- Wird ein **Narr angespielt**, setzt die **nächste echte Karte** die zu
  bedienende Farbe. Bleiben nur Narren, gibt es keine Pflicht.
- Trumpf muss **nie** bedient werden; wer die angespielte Farbe nicht hat,
  darf beliebig abwerfen oder stechen.

Diese Regeln bestimmt allein die Engine. Der Client bekommt fertig
gerechnete `legal`-Karten und bildet nichts nach.

---

## 5. Wer den Stich gewinnt

In dieser Reihenfolge:

1. Der **erste gespielte Zauberer**.
2. Sonst der **höchste Trumpf**.
3. Sonst die **höchste Karte der zu bedienenden Farbe**.
4. Sind nur Narren im Stich, gewinnt der **erste Narr**.

Der Gewinner spielt den nächsten Stich an.

**Hausregel „Der letzte sticht" (`lastSpecialWins`, Vorgabe aus)** dreht die
Zeilen 1 und 4 um: Dann gewinnt der **zuletzt** gelegte Zauberer, und bei
einem Stich aus lauter Narren der **letzte** Narr. Zeile 2 und 3 bleiben
unberührt — bei Trumpf und Farbe entscheidet die Höhe, nie die Reihenfolge.

Der Unterschied ist kein Detail: Im Standard lohnt es, früh zuzustechen; mit
der Hausregel lohnt es, abzuwarten. Beides ist verbreitet, deshalb ein
Schalter und keine Entscheidung.

---

## 6. Wertung

| Fall | Punkte |
| --- | --- |
| Ansage genau getroffen | **20 + 10 je gemachtem Stich** |
| Daneben | **−10 je Stich Abweichung** |

Beispiele: 3 angesagt, 3 gemacht → 50. 3 angesagt, 5 gemacht → −20. 0
angesagt, 0 gemacht → 20. 0 angesagt, 2 gemacht → −20.

Punkte können negativ werden; das ist kein Sonderfall, sondern der
Normalzustand einer schlechten Runde. Für die Plattform zählt am Ende nur
die **Platzierung** (`PartyStanding.place`), nie die Punktzahl selbst.

---

## 7. Regelsatz

Der Kern ist fest verdrahtet: Bedienpflicht, Zauberer sticht, Narr
verliert, Trumpf per aufgedeckter Karte, 20 + 10 / −10. Ohne diese Regeln
ist es nicht mehr dieses Spiel, und ein Regeleditor, mit dem man den Tisch
unspielbar machen kann, ist kein Vorteil.

Schaltbar sind acht Hausregeln, alle mit **Vorgabe aus**:

| Schlüssel | Name in der Oberfläche | Wirkung |
| --- | --- | --- |
| `lastSpecialWins` | Der letzte sticht | Der **zuletzt** gelegte Zauberer gewinnt statt des ersten; bei lauter Narren gewinnt der letzte Narr. Siehe Abschnitt 5. |
| `bidSumForbidden` | Es darf nicht aufgehen | Der letzte Ansager (der Geber) darf die Summe aller Ansagen nicht auf die Stichzahl bringen. Es liegt immer jemand daneben. |
| `zeroBonus` | Bonus für angesagte Null | Wer 0 ansagt und hält, bekommt `10 × Rundennummer` statt der festen 20. Macht späte Runden mit großen Händen interessanter. |
| `hiddenBids` | Gebote gleichzeitig verdeckt | Alle sagen zugleich an statt reihum. Nimmt dem Geber seinen Positionsvorteil. |
| `blindFirstRound` | Blinde erste Runde | In Runde 1 sieht jeder die Karten **der anderen**, nicht die eigene. |
| `dealerPicksBlind` | Geber wählt blind | Bei aufgedecktem Zauberer nennt der Geber die Trumpffarbe, **bevor** er seine Hand ansieht. |
| `noTrump` | Trumpffrei | Der ganze Tisch spielt ohne Trumpf. Es zählt nur die angespielte Farbe; Zauberer und Narren bleiben. |
| `jesterPicksTrump` | Narr = Geber wählt | Auch bei aufgedecktem Narren nennt der Geber eine Trumpffarbe, statt ohne Trumpf zu spielen. |

Dazu die nicht-schaltbaren Felder `tableSize` (3–6) und `rounds`, die der
Tisch setzt.

### 7.1 Widersprüche, die der Validator abweisen muss

- `noTrump` **und** `jesterPicksTrump` — die zweite Regel wäre wirkungslos.
- `noTrump` **und** `dealerPicksBlind` — dito.
- `hiddenBids` **und** `bidSumForbidden` — bei gleichzeitiger Ansage gibt es
  keinen letzten Ansager, den man einschränken könnte.
- `blindFirstRound` bei einer Partie mit `rounds < 1` — theoretisch, aber
  der Validator prüft es, weil `rounds` von außen kommt.
- `rounds` außerhalb von 1 bis `60 / tableSize`.

### 7.2 Die blinde erste Runde, genauer

Diese Option ist die einzige, die den Sichtbarkeitsfilter umdreht, und
deshalb steht sie hier ausführlich:

In Runde 1 hält jeder seine einzige Karte mit dem Bild nach außen an die
Stirn. Er sieht die Karten aller anderen, nur seine eigene nicht. Angesagt
wird also mit fremdem Wissen.

Für die Engine heißt das: `viewFor` liefert in dieser Runde
`hand: []` für den eigenen Sitz und zusätzlich `blindHands` mit den Karten
der anderen. Ausgespielt wird die eigene Karte weiter über ihre `id` — der
Client kennt sie nicht und sendet stattdessen `{ type: 'playBlind' }`.
Nach dem Ausspielen gilt wieder die normale Sicht.

**Was dabei nicht passieren darf:** dass die eigene Karte irgendwo in der
Sicht mitfährt — nicht in `legal`, nicht in `handCounts`, nicht im
Kartengedächtnis des Bots. Dafür gibt es einen eigenen Test.

---

## 8. Tisch, Rundenzahl und Geberrotation

**Spielerzahlen: 3 bis 6.** Alle sind echte Spielerzahlen; anders als beim
Doppelkopf sitzt am Dreiertisch **kein** Dauerbot.

**Rundenzahl.** Voll ist `60 / Spielerzahl`. Zur Auswahl stehen zusätzlich
eine halbe und eine kurze Partie:

| Sitze | Voll | Halb | Kurz |
| --- | --- | --- | --- |
| 3 | 20 | 10 | 5 |
| 4 | 15 | 10 | 5 |
| 5 | 12 | 8 | 4 |
| 6 | 10 | 6 | 3 |

**`rotationSize` ist 1.** Das ist eine bewusste Abweichung von dem, was das
Doppelkopf-Modul meldet, und der Grund gehört festgehalten:

Die Plattform verlangt, dass die Rundenzahl ein Vielfaches der
Geberrotation ist, damit jeder gleich oft gibt. Bei Wizard geht das nie
auf — 20 durch 3, 15 durch 4, 12 durch 5, 10 durch 6 lässt jedes Mal einen
Rest. Beides zusammen ist unmöglich, also muss eines weichen.

Es weicht die Gleichverteilung, weil sie hier weniger wiegt: Beim
Doppelkopf ist der Geber-Nachteil in jeder Runde derselbe und summiert sich
sauber auf. Bei Wizard ändert sich mit jeder Runde die Handgröße, der
Geberplatz ist in Runde 1 etwas anderes wert als in Runde 15 — eine „faire
Geberrunde" gibt es dort gar nicht. Die feste Spiellänge dagegen gehört zum
Spiel: 60 Karten, restlos verteilt.

Wem das nicht reicht, schaltet `hiddenBids` ein; dann ist der
Positionsvorteil des Gebers weg.

**Obergrenzen der Plattform bleiben:** 20 Runden an öffentlichen Tischen
(ein 3er-Vollspiel passt genau), 100 an Clantischen.

---

## 9. Trophäen

Unverändert Sache der Plattform, aus der Platzierung. Neu ist nur die
Verteilung für sechs Sitze:

| Sitze | Verteilung |
| --- | --- |
| 6 | +15 / +9 / +3 / −3 / −9 / −15 |

Setzt die bestehende Reihe fort und bleibt bei Gleichstand ganzzahlig, wie
es `trophies.ts` verlangt: Jede zusammenhängende Platzgruppe hat eine durch
ihre Größe teilbare Summe.

---

## 10. Sichtbarkeit

`viewFor(party, seat)` liefert:

- eigene Hand und die daraus gerechneten `legal`-Karten
- Kartenzahl je Sitz, aber **nie fremde Karten** (Ausnahme: `blindFirstRound`)
- alle Ansagen und alle bisher gemachten Stiche — beides ist öffentlich
- aufgedeckte Trumpfkarte und gültige Trumpffarbe
- laufender Stich, letzter Stich, Punktestand, Rundennummer, Handgröße
- `order` für die Sortierung der Hand (Trümpfe stark nach schwach, dann
  Fehlfarben) — dieselbe Struktur wie beim Doppelkopf, damit `cardsort.ts`
  unverändert funktioniert

`spectatorView` liefert dasselbe **ohne jede Hand**. Bei `hiddenBids`
zeigt sie zusätzlich keine noch nicht aufgedeckten Ansagen.

---

## 11. Aktionen

```
{ type: 'bid',         seat, tricks }        Ansage 0..n
{ type: 'chooseTrump', seat, suit }          nur der Geber, nur bei Zauberer
{ type: 'playCard',    seat, cardId }
{ type: 'playBlind',   seat }                nur in der blinden ersten Runde
```

`legalActions` liefert sie fertig — inklusive der bei `bidSumForbidden`
verbotenen Zahl, die schlicht fehlt.

---

## 12. Bot

Der Bot arbeitet ausschließlich auf der gefilterten Sicht und kann deshalb
bauartbedingt nicht schummeln.

**Ansage.** Aus der Hand geschätzt: ein Zauberer ist ein sicherer Stich;
hohe Trümpfe zählen abgestuft nach Handgröße und Zahl der Mitspieler; hohe
Farbkarten nur, solange die Farbe nicht schon gestochen wurde; Narren
zählen nichts. Dazu die Bietposition: Wer spät ansagt, weiß, wie viele
Stiche die anderen schon beansprucht haben, und rundet gegen die Lücke.

**Spiel.** Der Bot vergleicht sein Soll mit den bisher gemachten Stichen:

- **Braucht Stiche** → versucht zu gewinnen, aber so billig wie möglich
  (die niedrigste Karte, die reicht) und hebt Zauberer für später auf.
- **Hat genug** → wirft ab, ohne zu stechen; hat er nur gewinnende Karten,
  nimmt er die kleinste davon.
- **Narren** sind seine Notbremse, wenn er nicht gewinnen darf.

**Nicht gebaut:** Kartengedächtnis über gespielte Zauberer und Trümpfe.
Wurde bewusst zurückgestellt (siehe Abschnitt 14).

---

## 13. Teststrategie

Wie beim Doppelkopf: reine Logik, `node --test`, keine Laufzeitabhängigkeit.

- **Karten und Blatt:** 60 Karten, jede genau einmal, teilbar durch 3–6.
- **Stichgewinner:** jede der vier Regeln einzeln, dazu die Grenzfälle
  „nur Narren", „Zauberer als letzte Karte", „Trumpf schlägt hohe Farbe".
- **Bedienpflicht:** Zauberer/Narr immer erlaubt; Narr angespielt setzt die
  Farbe erst mit der nächsten echten Karte; Zauberer angespielt hebt die
  Pflicht auf.
- **Wertung:** Treffer, Übertreffer, Untertreffer, Null mit und ohne Bonus.
- **Ansagen:** `bidSumForbidden` verbietet genau eine Zahl, und nie beim
  vorletzten Ansager.
- **Trumpf:** Farbkarte, Narr, Zauberer mit Geberwahl, leerer Stapel,
  `noTrump`, `jesterPicksTrump`.
- **Blinde Runde:** die eigene Karte taucht in **keinem** Feld der Sicht auf.
- **Partie:** Rundenzahl, Geberwechsel, Punktesumme, Platzierung, Gleichstand.
- **Sicht:** fremde Hände tauchen nirgends auf; Zuschauersicht hat keine Hand.
- **Eigenschaften (property-based):** aus zufälligen Seeds gespielte Partien
  laufen ohne Ausnahme durch, jede Runde verteilt genau *n* Stiche, und die
  Summe der Handkarten bleibt konsistent.

Zielmarke: mindestens 80 Tests, Adapter und Server zusätzlich.

---

## 14. Bewusst nicht gebaut

- **Sonderkarten** (Bombe, Wolke, Drache, Fee der Neuauflagen). Das wäre ein
  zweites Spiel im ersten.
- **Auf und ab** (Handgröße steigt und fällt wieder). Verdoppelt die
  Partielänge und braucht eigene Rundenzahlen.
- **Bot mit Kartengedächtnis.** Später, ohne Eingriff in die Schnittstelle.
- **Wertungsvarianten** (30 statt 20, −20 statt −10). Machen Partien
  untereinander unvergleichbar; die Rangliste lebt von der Platzierung, aber
  die Punktetafel am Tisch soll lesbar bleiben.

---

## 15. Stand der Umsetzung

**Vollständig gebaut und spielbar** (4. August 2026).

| Teil | Stand |
| --- | --- |
| Engine `packages/game-wizard` | 117 Tests, keine Laufzeitabhängigkeit |
| Adapter gegen `GameModule` | inkl. Snapshot, Zuschauersicht, Bot |
| Server | in der Registrierung, Trophäen für sechs Sitze, 12 eigene Tests |
| Client | eigener Tisch `WizardTable.tsx`, Punktetafel, Rundenblatt |
| Bildbestellung | `docs/ASSETS-WIZARD.md` — Blatt, Szenerien, Plakette |

**Am laufenden Server geprüft**, nicht nur in Tests: Sechsertisch mit fünf
Bots, Ansage, Trumpfwahl durch den Geber nach aufgedecktem Zauberer,
Stichverlauf, Rundenabrechnung, Punktetafel und die blinde erste Runde (fremde
Karten offen, eigene verdeckt, Bot verliert mit dem Zauberer seine Null).

**Zwei Dinge, die beim Bauen aufgefallen sind:**

1. `rotationSize` musste 1 werden (Abschnitt 8). Ohne das hätte der Server
   jeden Zaubertisch mit „Rundenzahl muss eine volle Geberrunde ergeben"
   abgewiesen — bei **jeder** Spielerzahl.
2. `PLACEMENT_TROPHIES` kannte nur drei bis fünf Sitze und hätte am Ende jeder
   Sechserpartie geworfen — nach der letzten Runde, wenn die Partie schon
   gespielt war.

**Offen:** das gemalte Blatt (Bestellung liegt), Bot mit Kartengedächtnis,
Varianten aus Abschnitt 14.
