# Kartenmanufaktur — Spezifikation

Stand 23.10.2026 (Emile, mit Claude). Ein Idle-Spiel wie *Idle Miner Tycoon*,
nur in Brauweg: Pinguine drucken Spielkarten. Allein gespielt, **nur in der
App**, eigene Währung, Meilensteine geben ein paar Münzen.

## Der Kreislauf

```
   Versandhalle:  Packtisch ──► Träger ──► Lieferwagen ──► Taler
        ▲
   Paternoster (fährt alle Etagen ab, hält an jeder Kiste)
        │
   ├── Etage 1  Presse (Skatblatt)    ──► Ablage-Kiste 1
   ├── Etage 2  Presse (Doppelkopf)   ──► Ablage-Kiste 2
   └── … bis Etage 8 (Goldblatt)
```

**Eine Werteinheit: Warenwert in Talern.** Pressen erzeugen Warenwert
(Karten × Kartenwert der Sorte), Paternoster und Versand *bewegen* ihn, erst
der Versand macht daraus Taler. Transportstationen haben deshalb Ladung und
Kapazität, nie „Taler je Sekunde".

Alles läuft in **Zyklen** (seit dem 23.10.2026 abends, vorher flossen Raten):

- **Presse:** Pinguin geht zur Presse, presst, trägt den Stapel zur Kiste,
  legt ab. Der Warenwert landet genau beim Ablegen in der Kiste.
- **Paternoster:** fährt bis zur tiefsten Etage, hält an jeder Kiste und lädt
  bis zur Kapazität, fährt hinauf, entlädt auf den Packtisch. Ohne Ware fährt
  er nicht.
- **Versand:** Der Träger nimmt vom Packtisch, was in den Wagen passt, der
  Wagen fährt ab, unterwegs wird verkauft, er kommt leer zurück. Ohne Ware
  fährt er nicht.

**Einkommen je Sekunde = min(Summe der Pressen, Paternoster, Versand).**
Das langsamste Glied ist der Engpass und wird an der Station gezeigt.

## Stationen arbeiten lassen

- **Ohne Meister** läuft eine Station genau **einen Zyklus je Tipp**, danach
  schläft der Pinguin.
- Ein **Meister** (einmal kaufen, je Station) lässt sie ohne Pause arbeiten.
  Jeder Meister hat eine **Fähigkeit**: doppeltes Tempo für 30 s, danach 5 min
  Pause. „Boost" löst alle bereiten Fähigkeiten auf einmal aus.

## Zahlen

Alle Formeln stehen in `packages/manufaktur-kern/src/formeln.ts`, die
Stellschrauben gesammelt in `STELLSCHRAUBEN`. **Server und Client rechnen mit
demselben Kern** — der Server maßgeblich (Aktionen, Münzen, Nachrechnen),
der Client in jedem Bild mit, damit jede Bewegung an einem echten Zyklus hängt.

- **Kosten:** `K(L) = K0 · g^(L−1)`, g = 1,13 für Pressen, 1,12 für
  Paternoster und Versand. Kaufmengen x1, x10, x50, Max (geometrische Summe).
- **Pressen:** Leistung wächst linear mit der Stufe, Kartenwert ×6 je Etage.
  Der Zyklus wird mit jeder Stufe etwas kürzer (bis halb so lang).
- **Meilensteine** bei Stufe 10, 25, 50, 100, 150, 200, 300, 400: je ×2. Bis
  Stufe 100 bringt jeder einen sichtbaren Arbeiter mehr (höchstens 5).
- **Transport** wächst geometrisch (×1,09 je Stufe), nicht linear: Ein linear
  wachsender Paternoster war in der ersten Simulation ab Etage 3 eine Mauer.
- **Neue Etage:** 180 Taler für Presse 2, danach rund ×12 je Etage — früh
  steiler, hinten flacher (`FREISCHALT_FORM`), sonst ist die Mitte zu leicht
  und das Ende zäh.
- **Jede weitere Manufaktur** leistet ×2 und kostet ×1,8 — der Umzug lohnt
  sich, ist aber keine Abkürzung.
- Höchststufe je Station: 400.

Angezeigt werden ganze Zahlen: `1.240`, `12 Tsd.`, `3,4 Mio.`, `34 Mio.`,
`Mrd.`, `Bio.`, danach `aa`, `ab` … (`packages/client/src/manufaktur/zahlen.ts`).

## Die Simulation

`npm run sim --workspace @brauweg/manufaktur-kern` spielt drei Stunden mit
einem vernünftigen Spieler (tippt dreimal je Sekunde, solange Meister fehlen,
kauft den besten Ertrag je Taler, zieht um, sobald er kann). `-- --suche`
fährt eine Rastersuche über die wichtigsten Stellschrauben.

Stand 23.10.2026:

| Ereignis | Ziel | erreicht |
| --- | --- | --- |
| erste Karte verkauft | < 15 s | 0:10 |
| erstes Upgrade | < 20 s | 0:10 |
| erster Meister | 1–2 min | 0:57 (3 s zu früh) |
| Presse 2 | 2–3 min | 3:29 (30 s zu spät) |
| Presse 3 | 6–8 min | 7:12 |
| Presse 5 | 25–35 min | 27:21 |
| alle 8 Pressen und erster Umzug | 60–90 min | 77:33 |
| längste Strecke ohne Kauf | < 3 min | 1,1 min |

Die beiden Abweichungen kommen daher, dass der Sim-Spieler vor Presse 2 alle
drei Meister kauft. Die Manufakturen 2–4 dauern 64, 57 und 51 min.

## Offline-Verdienst

Ohne Meister schlafen die Pinguine nach ihrem Zyklus ein — deshalb zählt
offline von selbst nur die **Meister-Kette**, ohne Versand-Meister gibt es
nichts. Offline läuft alles **zum halben Tempo und höchstens eine Stunde**
(`OFFLINE_TEMPO`, `OFFLINE_MS`); als weg gilt, wer länger als eine Minute
nicht gefragt hat. Der Server rechnet beim nächsten Öffnen mit derselben
Simulation nach und meldet „Willkommen zurück". Liegt das Produzierte weit
über dem Verkauften, erklärt das Blatt den Stau und führt zu den Meistern.

Simulation Gelegenheitsspieler (4 × 3 min am Tag), Stand 23.10.2026:
Presse 5 nach 0,9 Tagen, erster Umzug nach 1,5 Tagen. Vor der Halbierung
waren es 0,8 und 1,3 Tage — der Hebel für ein längeres Spiel ist nicht der
Offline-Deckel, sondern der Preis der späteren Manufakturen.

## Neue Manufaktur (Prestige)

Mit **allen acht Pressen** kann man umziehen: alles beginnt von vorn
(Pressen, Stufen, Meister, Taler), dafür leistet jede weitere Manufaktur
**dauerhaft ×2** (die zweite ×2, die dritte ×4 …) und kostet ×1,8. Neuer
Name, neue Kulisse. Höchstens 5. Wer umzieht, bekommt den **Kartenrücken**
der verlassenen Manufaktur (nur erspielbar, am Tisch wählbar; Bilder:
`docs/ASSETS-KARTENMANUFAKTUR-RUECKEN.md`).

## Jubiläum (nach Manufaktur 5)

Im Kartenpalast mit allen acht Pressen: **Jubiläum feiern** — der Palast
beginnt neu, und es gibt ein **Gildensiegel**, dauerhaft **+10 %
Kartenwert** je Siegel (aufaddiert). So endet das Spiel nicht. Das erste
Jubiläum schenkt den Kartenrücken „Kartenpalast". Münzen fürs Hub: 100 je
Jubiläum, aber nur für die ersten zehn — sonst wäre es eine endlose
Münzquelle.

**Münzen fürs Hub (Meilensteine, eigene Währung bleibt getrennt):**

| Meilenstein | Münzen |
| --- | --- |
| erste Million Taler (je Manufaktur) | 50 |
| neue Manufaktur eröffnet | 300 |
| Jubiläum (die ersten zehn) | 100 |

Weitere Münzen gibt es nicht — wer wartet, erzeugt Taler, keine Münzen
(Wirtschaftsmodell, CLAUDE.md: „Edelsteine kaufen alles, Münzen nicht").

## Server und Bildschirm

- Tabelle `manufaktur` (eine Zeile je Konto, Stand als JSON mit `fassung`,
  Zeitpunkt des letzten Nachrechnens). Migration 0037. Ältere Fassungen
  übernimmt `migriere` beim Lesen — Spielstände werden nie verworfen.
- `GET /api/manufaktur` rechnet bis jetzt nach und liefert `{ stand, zeit,
  offline, muenzen }` — den ganzen Stand, nicht abgeleitete Raten.
- `POST /api/manufaktur/aktion` mit `arbeiten` (Tipp), `ausbauen` (mit
  `menge`), `meister`, `faehigkeit`, `boost`, `freischalten`, `umziehen`. Der
  Server rechnet erst bis jetzt nach, dann wendet er die Aktion an.
- Der Bildschirm (`client/src/manufaktur/steuerung.ts`) rechnet denselben
  Kern bis „jetzt" weiter, wendet eine Aktion sofort an (Vorhersage), schickt
  sie der Reihe nach und gleicht jede Antwort ab. Nachfragen alle 30 s und
  beim Zurückkommen in die App.
- Gerechnet wird in festen Takten von 50 ms. Gleicher Stand plus gleiche Zeit
  ergibt auf Server und Client dasselbe, egal in wie vielen Schritten.

## Bilder

Erst gezeichnet (Formen und Farben), dann gemalt: Die Bestellung für
ChatGPT steht in `docs/ASSETS-KARTENMANUFAKTUR.md`.
