# Mememory: Spielen gegen die KI

Seit dem **27. August 2026** gibt es im Mememory-Menü unter der Match-Suche
einen zweiten Knopf: **Gegen die KI spielen**. Er führt auf den Bildschirm
„KI-Match erstellen", dort wählt man die Stärke und startet.

---

## Die vier Stufen

Ein Memory-Bot ist genau so stark wie sein **Gedächtnis** — die Zugwahl
selbst ist trivial. Die vier Stufen sind deshalb vier Arten zu vergessen
(`packages/game-mememory/src/stufen.ts`):

| Stufe | Fenster | Merkt sich | Hält beim Herausfallen | Meidet Bekanntes |
| --- | --- | --- | --- | --- |
| Leicht | 2 Züge | alles | — | nein |
| Mittel | 3 Züge | 50 % je Karte | — | nein |
| Schwer | 4 Züge | alles | 70 %, einmalig | ja |
| Experte | unbegrenzt | alles | immer | ja |

**Das Fenster** zählt abgeschlossene Züge. Im laufenden Zug *N* reicht
„2 Züge" über *N-1* und *N-2* — also über den eigenen letzten und den des
Gegners, genau wie ein Mensch, der sich nur das Letzte merkt.

**Die 50 % bei Mittel fallen je Karte einzeln.** Er kann die eine Hälfte
eines Paares behalten und die andere vergessen — der Fehler, den auch
Menschen machen.

**Die 70 % bei Schwer werden EINMAL gewürfelt**, in dem Moment, in dem eine
Karte aus dem Vierer-Fenster fällt. Besteht sie die Probe, bleibt sie bis zum
Ende (`fest: true`); sonst ist sie weg — und zählt dann auch beim Meiden
bekannter Felder nicht mehr mit. Ein Gedächtnis, das jede Runde neu würfelt,
wäre keines.

**Meidet Bekanntes** heißt: Beim zufälligen Ziehen bevorzugt er Plätze, deren
Bild er noch nicht kennt. Eine Karte, die er schon weiß, dreht er nur um,
wenn sie ein Paar vollendet. Für Leicht und Mittel ist das bewusst aus — ohne
Wissen ist ein reiner Zufallszug ohnehin das Optimum, und ein Bot, der schon
dabei klug täte, wäre nicht leicht.

Was **jede** Stufe tut: Liegt eine Karte offen und kennt er ihren Partner,
nimmt er ihn. Wer sich erinnert, nutzt es auch.

---

## Warum das Gedächtnis im Partiezustand liegt

`botAction` bekommt ausschließlich die **gefilterte Sicht** (game-api: der Bot
kann bauartbedingt nicht schummeln), und diese Sicht trägt aus gutem Grund
keine Liste der schon gesehenen Karten — sonst gewänne jedes Skript mit
offener Konsole. Ein merkfähiger Bot braucht also einen Platz für sein
Gedächtnis, und der einzige, der zwischen zwei Zügen überlebt, ist der
**Partiezustand**.

Also: `partie.erinnerung` ist ein Eintrag je Bot-Sitz, und `sichtFuer(partie,
sitz)` legt ihn genau dem Sitz bei, der in `regeln.botStufen` steht. Ein
Mensch bekommt weiterhin nichts.

**Und warum das kein Verrat ist:** In diesem Spiel sieht jeder jede
umgedrehte Karte. Das Gedächtnis enthält also nur, was ohnehin auf dem Tisch
lag — nie eine verdeckte Karte. Wer sich selbst eine Stufe in die `config`
schriebe, bekäme seine eigenen gesehenen Karten zurück, und die könnte ein
eigener Client ohnehin mitschreiben (steht so schon in `docs/MEMEMORY-PLAN.md`).

**Gewürfelt wird aus der Saat, nicht aus `Math.random()`.** Die
Gedächtnisproben passieren *im* Zustandsübergang; nach einem Serverneustart
müssen sie aus dem Snapshot heraus dasselbe ergeben. Dafür trägt der Zustand
die Saat und eine Zugnummer, und `probe()` in `partie.ts` mischt beides mit
Sitz und Platz (FNV-1a → mulberry32). Die Zugwahl des Bots darf dagegen
weiter würfeln: Sie wandert als gewöhnliche Aktion in die Zugliste.

---

## Snapshot-Version 2

Der Zustand trägt jetzt Zugnummer, Saat und Gedächtnis — also steigt
`SNAPSHOT_VERSION` von 1 auf 2. **`deserialize` nimmt die 1 weiterhin an** und
ergänzt die drei Felder: Sonst bräche der Deploy jede laufende Partie, und das
ausgerechnet für eine Funktion, die diese Partien gar nicht benutzen.

---

## Was wo steht

| Teil | Datei |
| --- | --- |
| Stufen und ihre Regeln | `packages/game-mememory/src/stufen.ts` |
| Gedächtnis im Zustand | `packages/game-mememory/src/partie.ts` (`merke`, `altere`, `probe`) |
| Gedächtnis in der Sicht | `packages/game-mememory/src/sicht.ts` |
| Zugwahl | `packages/game-mememory/src/bot.ts` |
| Stufe je Sitz | `packages/game-mememory/src/regeln.ts` (`botStufen`) |
| Bildschirm | `packages/client/src/minispiele/mememory/KiMatch.tsx` |
| Tests | `packages/game-mememory/test/stufen.test.ts` (14) |

Der Tisch entsteht mit `fillWithBots: true` und `visibility: 'on_request'` —
ein Bot-Tisch in der Lobbyliste finge Leute ab, die einen Menschen suchen.

---

## Eine Falle, die schon zugeschnappt ist

`suchePaar()` liefert einen **Platz** zurück, und Platz `0` ist gültig — im
Sinne von JavaScript aber falsch. Die erste Fassung prüfte `if (paar)` und
ließ damit jedes Paar liegen, das auf Feld 0 begann. Gefunden hat es der Test
„Kennt der Bot ein ganzes Paar, fängt er damit an", weil das Testbrett das
erste Paar zufällig auf 0 und 1 legte. Seitdem steht dort `!== null`.

---

## Nächster Schritt: vier Spieler

Vorbereitet, nicht gebaut. `botStufen` ist eine Abbildung **Sitz → Stufe**,
kein einzelner Wert, und der Client führt die Auswahl schon als **Liste**
(`gegner: Stufe[]`, heute mit genau einem Eintrag). Für drei Bots
verschiedener Stärke braucht es später:

1. **`SEAT_COUNTS` auf `[2, 4]`** in `regeln.ts` — plus Punkte- und
   Rangregeln für mehr als zwei (`platzierungen`, `gegner()` in `partie.ts`
   rechnen heute mit genau zwei Sitzen).
2. **Eine Zeile je Gegner** im KI-Bildschirm; die Liste geht ohnehin schon
   sitzweise in die `config`.
3. Nichts am Gedächtnis: Es ist bereits je Sitz geführt.
