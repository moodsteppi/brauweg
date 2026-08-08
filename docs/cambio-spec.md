# Cambio — Regelwerk

Gedächtnis- und Ablegespiel mit verdeckten Karten. Ziel ist der **niedrigste**
Punktestand: Man kennt nur zwei der eigenen vier Karten und tauscht sie im
Lauf der Runde gegen bessere aus. Wer glaubt, vorn zu liegen, ruft „Cambio"
und beendet die Runde.

## Zum Namen

Das Spiel ist unter vielen Namen verbreitet: **Cabo**, Kambio, Golf,
Pablo, Bosco. **„Cabo" ist ein eingetragenes Markenzeichen (AMIGO)** — dieselbe
Lage wie bei „Wizard". Spielregeln sind nicht schützbar, ein Produktname
schon, und die App soll in den App Store.

Deshalb: **interne Kennung `cambio`, Anzeigename „Cambio"**. Das ist der
traditionelle, markenfreie Name derselben Spielfamilie. Kein Bild und kein
Text der App darf sich an die Aufmachung des AMIGO-Originals anlehnen.

---

## Blatt

52 Karten, ein französisches Blatt ohne Joker.

| Karte | Punkte |
| --- | --- |
| Ass | 1 |
| 2 bis 10 | Zahlenwert |
| Bube | 11 |
| Dame | 12 |
| **König Kreuz / Pik (schwarz)** | 13 |
| **König Herz / Karo (rot)** | **0** |

Der rote König ist die beste Karte im Spiel. Er zählt nichts und ist deshalb
das, was man behalten will.

---

## Ablauf einer Runde

**Geben.** Jeder bekommt vier Karten, verdeckt, in einer Reihe vor sich. Die
restlichen Karten bilden den Nachziehstapel; die oberste wird als
Ablagestapel aufgedeckt.

**Erster Blick.** Vor dem ersten Zug darf jeder **seine beiden äußeren Karten**
ansehen (Platz 0 und 3) und sich merken. Danach liegen sie wieder verdeckt.

**Ein Zug.** Wer am Zug ist, tut genau eines:

1. **Vom Stapel ziehen.** Die gezogene Karte wird angesehen. Dann entweder
   - gegen eine eigene Karte tauschen (die ersetzte wandert offen auf den
     Ablagestapel), oder
   - direkt abwerfen. Ist es eine **Aktionskarte**, wird ihre Aktion beim
     Abwerfen ausgeführt.
2. **Vom Ablagestapel nehmen.** Nur die oberste, und nur im Tausch gegen eine
   eigene Karte. Aktionen werden dabei **nicht** ausgelöst — sonst ließe sich
   dieselbe Aktion beliebig oft wiederholen.

**Cambio rufen.** Statt eines Zuges darf man „Cambio" rufen. Danach ist jeder
andere **genau noch einmal** am Zug, dann wird aufgedeckt und gewertet.

---

## Aktionskarten

Werden nur wirksam, wenn sie **vom Nachziehstapel gezogen und abgeworfen**
werden.

| Karte | Wirkung |
| --- | --- |
| **7, 8** | Eine **eigene** Karte ansehen |
| **9, 10** | Eine **fremde** Karte ansehen |
| **Bube** | Zwei Karten blind tauschen (beliebige Spieler, auch man selbst) |
| **Dame** | Eine fremde Karte ansehen, danach **wahlweise** tauschen |

Alle vier sind über den Regelsatz einzeln abschaltbar.

---

## Wertung

Nach dem letzten Zug decken alle auf. Jeder bekommt die Summe seiner vier
Karten als Punkte — **wenig ist gut.**

**Der Rufer.** Hat der Rufer die niedrigste Summe (allein), bekommt er
**0 Punkte** statt seiner Summe. Liegt jemand gleichauf oder darunter, bekommt
der Rufer seine Summe **plus 5 Strafpunkte**.

Das ist der ganze Reiz: Cambio zu rufen lohnt nur, wenn man wirklich vorn
liegt.

**Partieende.** Die Partie geht über eine feste Rundenzahl. Gewonnen hat, wer
am Ende die **wenigsten** Punkte hat.

---

## Hausregeln (Regelsatz)

Der Kern ist nicht schaltbar: vier Karten, zwei zu Beginn ansehen, ein Zug =
eine Handlung, Cambio beendet die Runde, wenig ist gut. Ohne diese Regeln ist
es nicht mehr dieses Spiel.

Schaltbar, alle mit **Vorgabe an**, weil sie zum Grundspiel gehören:

| Schalter | Vorgabe | Wirkung |
| --- | --- | --- |
| `peekOwn` (7/8) | an | Eigene Karte ansehen |
| `peekOther` (9/10) | an | Fremde Karte ansehen |
| `blindSwap` (Bube) | an | Zwei Karten blind tauschen |
| `lookAndSwap` (Dame) | an | Ansehen, dann wahlweise tauschen |
| `redKingZero` | an | Roter König zählt 0 statt 13 |

Schaltbar, Vorgabe **aus** — das sind die eigentlichen Hausregeln:

| Schalter | Vorgabe | Wirkung |
| --- | --- | --- |
| `penaltyOnFailedCall` | **10** statt 5 | Höhere Strafe für einen misslungenen Ruf |
| `callerMustBeStrictlyLower` | an | Gleichstand lässt den Ruf misslingen (sonst gewinnt der Rufer bei Gleichstand) |
| `peekTwoAtStart` | an | Zwei Karten zu Beginn ansehen; aus heißt: gar keine |

Zahlenwerte im Regelsatz:

| Feld | Vorgabe | Grenzen |
| --- | --- | --- |
| `handSize` | 4 | 4 |
| `failPenalty` | 5 | 0 bis 25 |
| `tableSize` | 4 | 2 bis 6 |
| `rounds` | 4 | 1 bis 20 |

**Nicht enthalten:** Einsatz, Topf, Preise. Regelwerk und Währung bleiben
getrennt.

---

## Passform zur Plattform

Cambio passt ohne Ausnahme in das Modell der Plattform:

- **Ein Sitz ist am Zug, mit Frist.** Genau ein Spieler handelt; läuft die
  Frist ab, übernimmt der Bot. Auch die Zwischenschritte (Karte gezogen, jetzt
  tauschen oder abwerfen) sind Züge desselben Sitzes.
- **Runden mit Geberrotation.** `rotationSize` ist die Spielerzahl, die
  Rundenzahl ein Vielfaches davon — jeder gibt gleich oft.

Zwei Dinge, die beim Bauen auffallen und in der Engine gelöst sind:

1. **Ein Zug hat mehrere Schritte.** Nach dem Ziehen ist der Zug noch nicht
   vorbei. Der Rundenzustand hat deshalb eine Phase je Zwischenschritt
   (`draw` → `decide` → ggf. `action`), und `currentActor` bleibt derselbe
   Sitz. Für die Plattform sieht das aus wie mehrere Züge kurz hintereinander.
2. **Wissen ist verdeckt und persönlich.** Was ein Sitz gesehen hat, weiß nur
   er. Das steht als `known` je Sitz im Zustand und geht ausschließlich über
   `viewFor` an genau diesen Sitz — der Bot bekommt dieselbe gefilterte Sicht
   und kann bauartbedingt nicht schummeln.
