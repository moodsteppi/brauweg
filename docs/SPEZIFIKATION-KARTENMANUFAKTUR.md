# Kartenmanufaktur — Spezifikation

Stand 23.10.2026 (Emile, mit Claude). Ein Idle-Spiel wie *Idle Miner Tycoon*,
nur in Brauweg: Pinguine drucken Spielkarten. Allein gespielt, **nur in der
App**, eigene Währung, Meilensteine geben ein paar Münzen.

## Der Kreislauf

```
   ┌──────────── Oben: Lager ──► Versand ──► Taler ──┐
   │                                                 │
 Laufband (fährt die Bögen nach oben)          Ausbauen, Meister,
   │                                           neue Pressen
   ├── Presse 1  (Skat)        ──► Ablage 1          │
   ├── Presse 2  (Doppelkopf)  ──► Ablage 2          │
   ├── Presse 3  (Zauberer)    ──► Ablage 3   ◄──────┘
   └── …
```

- **Pressen** (wie die Schächte im Vorbild) drucken Bögen in ihre Ablage.
  Jede tiefere Presse druckt eine wertvollere Kartenart.
- Das **Laufband** (wie der Aufzug) holt die Bögen aus den Ablagen nach
  oben ins Lager — von oben nach unten, bis seine Ladung voll ist.
- Der **Versand** (wie das Lager im Vorbild) verkauft aus dem Lager. Was er
  verkauft, wird zu **Talern**, der Währung der Manufaktur.

Gerechnet wird alles in **Wert** (Taler), nicht in Stück: Eine Presse
„druckt 12 Taler je Sekunde". So vergleicht man drei Stationen mit einer
Zahl, und der Engpass ist sofort sichtbar — genau dort rüstet man auf.

## Stationen arbeiten lassen

- **Ohne Meister** arbeitet eine Station nur nach einem Tipp: eine **Schicht**
  von 10 Sekunden. Wer dabei bleibt, tippt.
- Ein **Meister** (einmal kaufen, je Station) lässt sie ohne Pause arbeiten.
  Erst mit Meistern läuft die Manufaktur, wenn man weg ist.

## Zahlen

Alle Formeln stehen in `packages/server/src/manufaktur/regeln.ts` und nur
dort. Der Bildschirm bekommt Raten und Kosten fertig gerechnet.

| | Grundwert | je Stufe | Ausbaukosten |
| --- | --- | --- | --- |
| Presse p (1 … 8) | `1 · 9^(p−1)` Taler/s | linear, ×2 alle 25 Stufen | `10 · 11^(p−1) · 1,13^(L−1)` |
| Laufband | 4 Taler/s | linear, ×2 alle 25 Stufen | `25 · 1,14^(L−1)` |
| Versand | 4 Taler/s | linear, ×2 alle 25 Stufen | `25 · 1,14^(L−1)` |

- Neue Presse p freischalten: `60 · 13^(p−2)` (Presse 1 steht von Anfang an).
- Meister: Presse p `100 · 12^(p−1)`, Laufband und Versand je 150.
- Höchststufe je Station: 200.

Zahlen wachsen schnell; angezeigt wird mit Kürzeln (Tsd., Mio., Mrd., Bio.,
danach aa, ab, …).

## Offline-Verdienst

Mit Meistern läuft die Manufaktur weiter, während die App zu ist — bis zu
**8 Stunden**. Der Server rechnet die Zeit beim nächsten Öffnen nach
(Sekundenschritte, dieselbe Rechnung wie online) und meldet einmal „Während
du weg warst: +… Taler".

## Neue Manufaktur (Prestige)

Ab **10 Mrd. Taler Gesamtverdienst** in der laufenden Manufaktur kann man
umziehen: alles beginnt von vorn (Pressen, Stufen, Meister, Taler), dafür
druckt jede weitere Manufaktur **dauerhaft ×2** (die zweite ×2, die dritte ×4
…) und bekommt einen neuen Namen und eine neue Kulisse. Höchstens 5.

**Münzen fürs Hub (Meilensteine, eigene Währung bleibt getrennt):**

| Meilenstein | Münzen |
| --- | --- |
| erste Million Taler (je Manufaktur) | 50 |
| neue Manufaktur eröffnet | 300 |

Weitere Münzen gibt es nicht — wer wartet, erzeugt Taler, keine Münzen
(Wirtschaftsmodell, CLAUDE.md: „Edelsteine kaufen alles, Münzen nicht").

## Server und Bildschirm

- Tabelle `manufaktur` (eine Zeile je Konto, Stand als JSON, Zeitpunkt des
  letzten Nachrechnens). Migration 0037.
- `GET /api/manufaktur` rechnet bis jetzt nach und liefert die Ansicht:
  Stationen mit Stufe, Rate, Ausbaukosten, Meister, Ablagen, Lager, Taler,
  Einkommen je Sekunde, Engpass, Offline-Meldung.
- `POST /api/manufaktur/aktion` mit `ausbauen`, `meister`, `freischalten`,
  `schicht` (Tipp), `umziehen` (Prestige). Der Server rechnet erst bis jetzt
  nach, dann wendet er die Aktion an.
- Der Bildschirm zählt zwischen zwei Antworten mit den gelieferten Raten
  hoch und fragt alle 20 Sekunden und nach jeder Aktion neu.

## Bilder

Erst gezeichnet (Formen und Farben), dann gemalt: Die Bestellung für
ChatGPT steht in `docs/ASSETS-KARTENMANUFAKTUR.md`.
