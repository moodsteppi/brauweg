# Übergabe: Der Edelstein als universelle Währung

> **Diese Übergabe ist abgearbeitet.** Der Umbau ist am 4. August 2026
> übernommen, gebaut, getestet und mit der Clan- und Shop-Arbeit
> zusammengeführt worden; er liegt auf `staging`. Was hier steht, ist also
> **kein offener Auftrag mehr**, sondern die Begründung hinter dem Code —
> und die ist weiter gültig.
>
> **Drei Punkte bleiben offen** und sind der Grund, warum diese Datei
> aufgehoben wird:
>
> 1. **Die gewürfelten Kauftruhen** (Abschnitt „Die Würfel-Entscheidung, die
>    nachgeprüft werden muss") gehören vor einem echten Bezahlweg noch
>    einmal auf den Tisch.
> 2. **Zwei Sätze des Nutzers brachen mitten im Wort ab** und wurden nie
>    aufgelöst — es kann eine Vorgabe darin stecken.
> 3. **Season Pass und VIP** haben Preise, aber keinen Kaufweg; beim Season
>    Pass fehlt außerdem das Modell.
>
> Nicht mehr zutreffend ist alles zur **Umgebung** (die Windows-Maschine ohne
> Node), zu **„was noch zu tun ist"** und der **Nachtrag zu `tischware.ts`** —
> das ist erledigt. Der aktuelle Stand steht in [STAND.md](STAND.md).

Stand **4. August 2026**, mitten in der Arbeit abgebrochen. Diese Datei ist so
geschrieben, dass sie allein reicht — wer sie liest, braucht die Sitzung nicht,
aus der sie stammt.

**Der Umbau ist im Code weitgehend fertig, aber NICHTS davon ist gebaut,
typgeprüft oder getestet worden.** Der Grund steht unter „Umgebung"; er ist
keine Nachlässigkeit, sondern eine fehlende Node-Installation.

---

## Der Auftrag

Wörtlich vom Nutzer, in zwei Runden abgefragt:

> Im neuen Shop soll man mit Juwelen Münzen kaufen können. In den Angeboten kann
> man bisher alles nur gegen Geld kaufen, aber man soll alles auch gegen Juwelen
> kaufen können. Und Juwelen kosten am Ende Geld. Alle anderen Sachen sollen
> primär nur Juwelen kosten. Mit Juwelen soll man praktisch alles kaufen können,
> außer eben Juwelen.

Daraus entschieden (die Antworten sind bestätigt, nicht geraten):

| Frage | Entscheidung |
|---|---|
| Kurs | **15 Münzen je Edelstein** |
| Kosmetik | **Doppelpreis** — Münzen **oder** Edelsteine, der Käufer wählt |
| Münzpakete | gegen **Edelsteine**, wirklich kaufbar |
| Truhen | **gegen Edelsteine kaufbar**, zusätzlich zu den Münzpaketen |
| Truheninhalt | **gewürfelt** wie die Tagestruhe |
| Season Pass | Preis in **Edelsteinen**, noch nicht kaufbar |
| VIP-Pass | Preis in **Geld**, noch nicht kaufbar |
| Edelsteinpakete | gegen **Geld**, noch nicht kaufbar (kein Bezahlweg) |

**Zwei Sätze des Nutzers brachen mitten im Wort ab** und wurden nie
aufgelöst: „Und für…" und „…mit gems kamm man a". Es kann eine weitere Vorgabe
darin stecken. **Bitte nachfragen, bevor am Preisgefüge etwas verschoben wird.**

### Warum das den alten Grundsatz nicht bricht

In `waehrung.ts` und `DESIGN.md` stand: *„Getrennt und ohne Wechselkurs, mit
Absicht: Gäbe es einen, wäre jede Truhe indirekt eine Geldquelle."*

Die Begründung gilt weiter — sie trifft aber **nur die Gegenrichtung**. Solange
aus Münzen keine Edelsteine werden, ist keine Truhe und keine Tagesaufgabe ein
Weg zu etwas, das Geld kostet. Der Grundsatz ist deshalb **umformuliert, nicht
aufgegeben**: Der Umtausch läuft einseitig, und die Einseitigkeit ist im Code
keine Regel in einem Kommentar, sondern eine **fehlende Funktion**. Es gibt
`edelsteineZuMuenzen()` und bewusst nichts daneben.

**Wer eine Funktion `muenzenZuEdelsteinen()` ergänzt, bricht das Wirtschaftsmodell.**

### Die Würfel-Entscheidung, die nachgeprüft werden muss

Die gekauften Truhen würfeln. Das war ein ausdrücklicher Wunsch, nachdem der
Einwand vorlag: Eine gewürfelte Ausschüttung auf eine mit echtem Geld gekaufte
Währung ist derselbe Grenzbereich, wegen dem Plan 11 Einsätze und Zufallsboxen
schon ausschließt.

Entschärft ist es an zwei Stellen: Die **Spanne steht dran**, und ihre **Mitte
ist genau der Kurs** — das Würfeln kostet im Erwartungswert nichts. Daneben
steht ein Münzpaket, das dasselbe in eine feste Zahl umsetzt.

**Vor dem Anschluss eines echten Bezahlwegs gehört das noch einmal auf den
Tisch.** Der Hinweis steht auch im Kopf von `src/truhen.ts`, damit er nicht nur
hier steht.

---

## Umgebung — bitte zuerst lesen

**Auf dieser Maschine ist kein Node.js installiert.** Kein `node.exe` unter
`C:\` oder `D:\` in drei Ebenen Tiefe, `npm` weder in PowerShell noch in der
Git-Bash. Deshalb ist nichts gelaufen: kein `npm install`, kein
`npm run build`, kein `npm test`, kein `tsc --noEmit`.

Alles unten Beschriebene ist **von Hand geprüfter Code**, keine grüne Testreihe.
Jede Aufrufstelle der geänderten Signaturen ist einzeln durchgesucht worden
(`\.preis`, `\.waehrung`, `wuerfeln\(`, `\.cents`, `RegalStueck`), aber
Handarbeit ist kein Compiler.

**Erster Schritt der nächsten Sitzung:**

1. Node ≥ 22 installieren.
2. `npm install` **im Wurzelverzeichnis**.
3. `npm run build` **im Wurzelverzeichnis** — nicht
   `--workspace @brauweg/server`. Sonst ist die `.d.ts` von `@brauweg/game-api`
   der alte Stand und `tsc` meldet Felder als fehlend, die längst da sind
   (`xpBasis`, `interludeMs`). Steht so auch in `STAND.md`.
4. `npm test` im Wurzelverzeichnis.

Weitere Eigenheiten dieses Arbeitsverzeichnisses:

- Es liegt unter `C:\Users\G5000\Documents\Claude\brauweg` und ist **über HTTPS**
  geklont (`https://github.com/moodsteppi/brauweg.git`). Das Projekt arbeitet
  normalerweise über SSH. **Es liegen keine Push-Zugangsdaten vor.**
- `gh` ist nicht installiert. Pull Requests gehen von hier aus nicht.
- Ausgecheckt ist **`staging`** — der Arbeitszweig. `main` löst den Deploy aus
  und wird aus einer Sitzung heraus nicht angefasst.
- Es ist **noch kein Zweig angelegt und nichts committet.** Alle Änderungen
  liegen als unsaubere Arbeitskopie auf `staging`.

---

## Keine Migration nötig

**Dieser Umbau ändert das Datenbankschema nicht.** Das ist kein Zufall, sondern
folgt aus dem vorhandenen Entwurf:

- Der Doppelpreis lebt im Katalog (`src/kosmetik.ts`), nicht in der Datenbank —
  in `account_cosmetic` steht kein Preis.
- Die Kauftruhen benutzen `chest_claim` unverändert, samt der bestehenden
  `chest_grade`-Aufzählung (sie tragen die Grade `silber`, `gold`, `diamant`).
- Die Pakete stehen ausschließlich im Code.

Die letzte Migration bleibt `0012_waehrungen_truhen_aufgaben`. **Wer hier eine
`0013` anlegt, hat etwas anders gebaut als beschrieben.**

---

## Das Preisgefüge, wie es jetzt im Code steht

Kurs: `MUENZEN_JE_EDELSTEIN = 15` in `src/waehrung.ts`. Abgeleitet aus den
Cent-Platzhaltern der kleinsten Pakete (5,98 ct je Edelstein ÷ 0,398 ct je
Münze = 15,0), damit der Umtausch sich nicht gegen einen späteren echten Preis
stellt.

### Kosmetik (27 Stücke, `src/kosmetik.ts`)

Gepflegt wird **eine** Zahl je Stück, die zweite leitet der Kurs ab:

- `muenzen(id, slot, coins)` → `{ coins, gems: inEdelsteine(coins) }` — **aufgerundet**
- `edelsteine(id, slot, gems)` → `{ coins: inMuenzen(gems), gems }`
- `frei(...)` und `geschenk(...)` → `{ coins: 0, gems: 0 }`

Aufgerundet wird mit Absicht: Abgerundet wäre der direkte Edelsteinpreis
billiger als derselbe Betrag über den Umtausch — ein Rabatt, den niemand
entschieden hat.

**Folge, die bewusst hingenommen ist:** Die fünf legendären Stücke sind jetzt
auch erspielbar (Krone 40 💎 = 600 Münzen). Sie kosten in Münzen das
Fünfzehnfache und sind damit weit teurer als alles andere im Regal, aber nicht
mehr unerreichbar für den, der nicht zahlt.

### Münzpakete — gegen Edelsteine, laufen wirklich

| Kennung | gibt | kostet | je Edelstein | bonus |
|---|---|---|---|---|
| `muenzen-klein` | 500 Münzen | 35 💎 | 14,3 | — |
| `muenzen-mittel` | 1.500 Münzen | 100 💎 | 15,0 | 5 % |
| `muenzen-gross` | 4.000 Münzen | 250 💎 | 16,0 | 12 % |

`cents: null` — Münzen sind kein Ziel eines Geldkaufs mehr.

### Kauftruhen — gegen Edelsteine, laufen wirklich

| Kennung | Grad | kostet | Spanne | Mitte |
|---|---|---|---|---|
| `truhe-silber` | silber | 25 💎 | 250–500 | 375 = 25 × 15 |
| `truhe-gold` | gold | 60 💎 | 650–1.150 | 900 = 60 × 15 |
| `truhe-diamant` | diamant | 150 💎 | 1.700–2.800 | 2.250 = 150 × 15 |

Die Preise liegen **zwischen** den Münzpaketen, damit neben einem Paket nie eine
Truhe steht, die dasselbe zum selben Preis tut, nur gewürfelt.

Die Spannen sind **absichtlich nicht** in `SPANNE[grad]`: Die Stufentruhe
`silber` gibt 10–20 Münzen, die Kauftruhe `silber` 250–500. Der Grad ist damit
das Aussehen und der Rang **innerhalb seiner Art**, kein fester Betrag. Ein Test
hält das fest.

### Nicht kaufbar (Preis steht dran, es gibt keinen Endpunkt)

| Kennung | kostet | warum nicht kaufbar |
|---|---|---|
| `edelsteine-klein/-mittel/-gross` | 299 / 799 / 1.899 ct | Bezahlweg fehlt |
| `vip-pass` | 499 ct | Bezahlweg fehlt |
| `season-pass` | 150 💎 | Modell fehlt (Stufen, Belohnungen, Laufzeit) |

Der Edelsteinpreis des Season Pass ist aus dem mittleren Edelsteinpaket
genommen, damit die Zahl nicht aus der Luft kommt.

---

## Was fertig ist

13 Dateien geändert, +1.386 / −138 Zeilen. Alles unter
`packages/{server,client}/src` und `packages/server/test`.

### `packages/server/src/waehrung.ts`

- Kopf umgeschrieben: einseitiger Umtausch samt Begründung, warum der alte
  Grundsatz weiter gilt.
- Neu: `MUENZEN_JE_EDELSTEIN = 15`, `inMuenzen(edelsteine)`,
  `inEdelsteine(muenzen)` (**aufgerundet**),
  `edelsteineZuMuenzen(db, accountId, edelsteine, muenzen) → Stand`.
- `edelsteineZuMuenzen` bucht **erst ab, dann gutschreiben** — dieselbe
  Reihenfolge wie beim Kauf. Beide Beträge kommen vom Aufrufer, weil die Pakete
  bewusst nicht kursgenau sind.

### `packages/server/src/kosmetik.ts`

- Neu: `interface Preis { coins, gems }`.
- **`Stueck.preis` ist jetzt `Preis` statt `number`; `Stueck.waehrung` ist
  entfallen.** Das ist die einzige wirklich brechende Änderung dieses Umbaus.
- Katalog-Helfer leiten den zweiten Preis aus dem Kurs ab.
- `besitzt()` prüft jetzt **beide** Preise auf 0 (`{coins:0, gems:3}` wäre sonst
  gratis statt günstig).
- Neu: `preisIn(stueck, waehrung)`.

### `packages/server/src/truhen.ts`

- Kopf: drei Arten Truhe statt zwei, plus der Glücksspiel-Hinweis.
- `interface Spanne` exportiert, `SPANNE` damit typisiert.
- Neu: `Kauftruhe`, `KAUFTRUHEN`, `KAUFTRUHE_NACH_ID`, `KAUF_PRAEFIX = 'kauf-'`.
- `wuerfelnIn(spanne, zufall)` ist der neue Kern; `wuerfeln(grad, zufall)` bleibt
  als Hülle, damit die vorhandenen Tests unverändert gelten.
- Neu: `Kauffund`, `truheKaufen(db, accountId, truheId)`. Ablauf: Katalog prüfen
  → Edelsteine abbuchen → würfeln → `chest_claim` mit `kauf-<uuid>` eintragen →
  Münzen gutschreiben → beide Stände zurück.
- **Je Kauf eine eigene Kennung (`kauf-<uuid>`)**, weil der Primärschlüssel
  (Konto, Kennung) sonst den zweiten Kauf sperren würde. Eine Kauftruhe muss man
  zweimal kaufen können.
- `gradPruefen()` weist `kauf-`-Kennungen ausdrücklich mit
  `notFound('chestUnknown')` ab. Ohne diesen Riegel wäre die Kennung aus der
  Kaufantwort, an `/chests/:id/open` weitergegeben, der Weg, denselben Wurf ein
  zweites Mal gutzuschreiben.

### `packages/server/src/shop.ts`

- Kopf umgeschrieben: drei Sorten Angebot, und die Ordnung „Geld kauft nur
  Edelsteine, Edelsteine kaufen alles andere".
- `Paket`: `cents: number|null`, `gems: number|null`, `kaufbar: boolean`.
- Die drei Listen auf die Tabelle oben umgestellt, `PAKET_NACH_ID` ergänzt.
- `RegalStueck.preis` ist `Preis`, `waehrung` entfallen.
- `ShopAnsicht` trägt zusätzlich `truhen` und `kurs`.
- `kaufen(db, accountId, itemId, waehrung = 'coins')` — **Preis aus dem Katalog,
  Währung aus der Anfrage.** Ohne Angabe Münzen: die Währung, die man nicht
  kaufen muss.
- Neu: `Paketkauf`, `paketKaufen(db, accountId, paketId)` mit drei Riegeln —
  unbekannt (`packUnknown`), `kaufbar: false` oder `gems === null`
  (`packNotForSale`), gibt keine Münzen (`packNotForSale`). **Der mittlere ist
  der wichtigste:** ohne ihn wäre `edelsteine-gross` der Weg, 400 Edelsteine
  gegen null zu bekommen.

### `packages/server/src/http/app.ts`

- `POST /api/shop/:itemId/buy` nimmt jetzt einen optionalen Rumpf
  `{ waehrung }`, `z.enum(WAEHRUNGEN).default('coins')`, geparst über
  `request.body ?? {}`. Der Rumpf darf fehlen — alte Aufrufe bleiben gültig.
- Neu: `POST /api/shop/pakete/:paketId/buy`.
- Neu: `POST /api/shop/truhen/:truheId/buy`.
- Beide neuen Wege liegen fünf Segmente tief und kollidieren deshalb nicht mit
  `/api/shop/:itemId/buy` (vier Segmente).

### Client

- **`api.ts`**: `Preis`, `Kauftruhe`, `Paketkauf`, `Kauffund` neu; `RegalStueck`,
  `Paket`, `Shop` angepasst; `buyItem(itemId, waehrung)` erweitert,
  `buyPack(paketId)` und `buyChest(truheId)` neu.
- **`i18n.ts`**: `error.packUnknown`, `error.packNotForSale`.
- **`screens/Aufgaben.tsx`**: `TruhenBild` und `FundBlatt` exportiert; `FundBlatt`
  nimmt nur noch `{ grad, coins }`, damit der Kauffund aus dem Shop durchpasst.
  Kein zweites gezeichnetes Truhenbild — es gibt nur `truhe.png` im Ordner, und
  vier weiße Kästen sind der Fehler, der laut STAND.md schon zweimal live ging.
- **`screens/Kleiderschrank.tsx`**: `betragText()`; `preisText()` zeigt **beide**
  Preise; `kauftMit`-Zustand; `jetztKaufen(stueck, waehrung)`; das Kaufblatt hat
  zwei Kaufknöpfe (Münze / Edelstein, mit Symbol) und „Später" darunter. Die
  Eingabetaste kauft in Münzen.
- **`screens/GameSelect.tsx`**: `PaketKachel` umgebaut (Preisschild Euro **oder**
  Edelsteine, „Bald" nur wenn `!kaufbar`, Tipp führt in die Rückfrage);
  `preisSchild()`; `TruheKachel`; `Kaufwunsch`; `KaufFrage` als Rückfrageblatt;
  im `Shop` die Zustände `frage`/`laeuft`/`fund`, `kaufePaket`, `kaufeTruhe`, und
  die Regale in neuer Reihenfolge: **Pinguin → Münzen → Truhen → Edelsteine →
  Pässe → Sonst noch.**
- **`styles.css`**: `.ks-kauf-womit`, `.ks-kauf-waehl`, `.ks-kauf-icon`,
  `.hub-preis` auf `inline-flex`, `.shop-preis-stein`, `.shop-truhe .truhe-bild`.

**Ein Tipp bucht nirgends ab.** Pakete und Truhen bekommen dieselbe Rückfrage,
die die Kosmetik schon hatte — hier wäre ein Fehlgriff teurer, weil Edelsteine
am Ende Geld kosten. Nach einem Truhenkauf zeigt `FundBlatt`, was drin war; eine
gekaufte Truhe, die nur den Münzstand ändert, wäre eine Zahl ohne Erklärung.

**Kein vierter Knopf.** Die Knöpfe tragen gemalte `border-image`-Bilder, und es
gibt genau drei (`menue-knopf-holz/-gruen/-rot.webp`). Ein blaugrüner wäre eine
Bildbestellung, kein CSS. Die zwei Kaufknöpfe sind deshalb beide grün und
unterscheiden sich über Symbol und Zahl.

### Tests, die schon geschrieben sind

**`packages/server/test/shop.test.ts`**

- Angepasst: freies Stück (beide Preise 0), Kauf-Test (`preis.coins`),
  Shop-Ansicht (genau **ein** Preis je Paket, `truhen`, `kurs`).
- **Ersetzt:** „Ein Edelstein-Stueck ist mit Muenzen nicht zu haben" — das war
  die alte Regel und ist jetzt falsch. An seiner Stelle stehen vier Tests: der
  Doppelpreis über den ganzen Katalog, das legendäre Stück in beiden Währungen,
  ein Münzen-Stück gegen Edelsteine, und die Vorgabe „ohne Angabe Münzen".
- Neu: „Geld kauft nur Edelsteine, Edelsteine kaufen alles andere", „Die
  Münzpakete liegen um den Kurs herum", „Die Mitte jeder Kauftruhe ist genau der
  Kurs", `paketKaufen` läuft / ohne Deckung / nicht kaufbar / unbekannt.

**`packages/server/test/truhen.test.ts`**

- Neu, sechs Tests: Wurf in der eigenen Spanne (samt Riegel, dass eine Kauftruhe
  mehr ausschüttet als die Stufentruhe desselben Grades), Kauf zahlt Edelsteine
  und schüttet Münzen aus und ist wiederholbar, ohne Edelsteine kein Wurf und
  keine Zeile, eine gekaufte Truhe lässt sich nicht noch einmal öffnen, eine
  Kauftruhe steht nicht in der Truhenansicht, erfundene Kennungen.

---

## Nachtrag: `origin/staging` ist weitergelaufen

Nach dem Schreiben des obigen Teils sind auf `origin/staging` **zwölf Commits**
dazugekommen, von `4f83e5d` auf **`755b555`**. Sie stammen aus einer zweiten
Sitzung desselben Tages und sind ein anderes Thema — Clanchat, Clankrieg, Zurufe
am Tisch, Szenerien und Kartenrückseiten im Shop, Wappen, plus die Migrationen
**0013** und **0014**. **Der Edelstein-Umbau ist dort nicht enthalten.**

**Sechs der geänderten Dateien überschneiden sich:**
`packages/server/src/shop.ts`, `packages/server/src/http/app.ts`,
`packages/client/src/api.ts`, `packages/client/src/i18n.ts`,
`packages/client/src/screens/GameSelect.tsx`,
`packages/client/src/styles.css`. Ein Merge ohne Nacharbeit gibt es nicht.

### Die eine Stelle, die wirklich Arbeit macht: `tischware.ts`

Neu auf `staging` liegt `packages/server/src/tischware.ts` — ein **zweiter
Katalog** für Szenerien, Kartenrückseiten, Wappen und Zurufe. Er ist im **alten
Ein-Währungs-Modell** gebaut:

```ts
export interface RegalWare {
  readonly preis: number;
  readonly waehrung: Waehrung;   // eine Währung, nicht zwei
  …
}
```

Und er läuft durch **dasselbe `kaufen()`**, das dieser Umbau um einen
Währungsparameter erweitert — der Kollege hat oben eine Abzweigung eingesetzt:

```ts
export async function kaufen(db, accountId, itemId) {
  const ware = wareMit(itemId);
  if (ware) return kaufeWare(db, accountId, ware);   // neue Abzweigung
  const stueck = requireStueck(itemId);
  …
}
```

Daraus folgt zwingend: **Tischware braucht denselben Doppelpreis wie die
Pinguin-Kosmetik.** Sonst gilt „mit Edelsteinen ist alles zu haben" für die
halbe Auslage nicht — und das war der Auftrag. Zu tun:

- `Ware.preis` auf `Preis` (`{coins, gems}`) umstellen, `Ware.waehrung` streichen
  — dieselbe Änderung wie an `Stueck` in `kosmetik.ts`, mit denselben Helfern
  `inMuenzen`/`inEdelsteine`. `tischware.ts` muss `waehrung.ts` importieren.
- `RegalWare.preis` mitziehen, `waehrung` streichen.
- `kaufeWare(db, accountId, ware, waehrung)` um den Parameter erweitern und den
  Wert von `kaufen()` durchreichen.
- Die Preise laut STAND.md (Szenerien 250–900, Rückseiten 200–900, Wappen
  250–800, Zurufe 80–150) sind in Münzen gepflegt — der Edelsteinpreis kommt
  also aus `inEdelsteine()`. **Nachsehen, ob einzelne Waren schon in Edelsteinen
  ausgezeichnet sind**; dann ist es dort umgekehrt.
- Der Client zeigt Tischware in `GameSelect.tsx`; `preisText`-artige Stellen
  brauchen dieselbe Behandlung wie im Kleiderschrank.
- Tests: `packages/server/test/tischware.test.ts` existiert und prüft die alten
  Preisfelder — er wird mit umgestellt.

**Reihenfolge:** erst Node installieren und diesen Umbau für sich übersetzen und
testen, dann `tischware.ts` umstellen, dann auf `origin/staging` mergen. Nicht
umgekehrt — ein Merge in unübersetzten Code lässt nicht mehr unterscheiden,
welcher Fehler woher kommt.

---

## Was noch zu tun ist

In dieser Reihenfolge.

### 1. Bauen und testen (siehe „Umgebung")

Node installieren, `npm install`, `npm run build`, `npm test` — jeweils im
Wurzelverzeichnis. **Erwartbar sind Tippfehler und Kleinigkeiten**, die ein
Compiler in Sekunden findet und Handarbeit nicht.

Bekannte Stellen, an denen es am ehesten klemmt:

- `packages/server/test/truhen.test.ts` greift auf `schema.chestClaim` zu.
  `helpers.ts` exportiert `schema` als `* as schema from '../src/db/schema.js'`,
  der Zugriff sollte also stehen — geprüft ist er nicht.
- `EdelsteinIcon` hängt sich immer `front-waehrung-icon` an und dazu die
  übergebene Klasse. Die neuen Regeln (`.shop-preis-stein`, `.ks-kauf-icon`)
  sind mit dieser Verdopplung geschrieben; ob die Spezifität reicht, sagt erst
  der Browser.
- `quests.test.ts:176` prüft `ergebnis.waehrung` aus den Tagesaufgaben. Das ist
  eine andere Struktur und sollte unberührt sein.

### 2. Die fehlenden Tests

**`packages/server/test/waehrung.test.ts`** — hier steht noch **nichts** zum
Umtausch. Nötig:

- `inEdelsteine()` rundet auf: 120 → 8, 250 → 17, 1 → 1.
- `inMuenzen()` ist die Umkehrung ohne Rundung.
- `edelsteineZuMuenzen()` bucht ab und schreibt gut, gibt beide Stände zurück.
- Ohne Deckung: `gemsInsufficient`, **und beide Stände bleiben unberührt**.
- Betrag ≤ 0 → `invalidInput`.
- Testkonto (`is_staff`): zahlt nicht, der sichtbare Stand bleibt `STAFF_STAND`.
- Ein Test, der festhält, dass es **keine** Funktion in die Gegenrichtung gibt —
  am ehesten als Kommentar plus Prüfung, dass das Modul nichts derartiges
  exportiert.

**`packages/server/test/waehrung-http.test.ts`** — hier steht noch nichts zu den
neuen Endpunkten. Nötig:

- `POST /api/shop/:itemId/buy` mit `{"waehrung":"gems"}` bucht Edelsteine ab.
- Derselbe Weg **ohne Rumpf** bucht Münzen ab (der Rumpf darf fehlen — das ist
  eine Zusicherung, nicht ein Zufall).
- `{"waehrung":"euro"}` → 400 `invalidInput`.
- `POST /api/shop/pakete/muenzen-mittel/buy` läuft; `.../edelsteine-klein/buy`
  und `.../vip-pass/buy` → 403 `packNotForSale`.
- `POST /api/shop/truhen/truhe-silber/buy` läuft, zweimal hintereinander auch.
- `POST /api/chests/<chestId aus der Kaufantwort>/open` → 404 `chestUnknown`.
- `GET /api/shop` trägt `truhen` und `kurs`.

Zielmarke: **211 Servertests vorher**, mit den geschriebenen und den fehlenden
landet man bei etwa 235. Doppelkopf (128) und Zauberer (117) sind unberührt.

### 3. Die Dokumentation nachziehen

**`docs/DESIGN.md`** — im Abschnitt „Startbereich (`front-*`)" steht heute:

> **Zwei Währungen, getrennte Bedeutung.** … Es gibt keinen Wechselkurs — gäbe
> es einen, wäre jede Truhe indirekt eine Geldquelle.

**Das ist jetzt falsch und muss auf den einseitigen Umtausch umgeschrieben
werden** (Begründung oben unter „Warum das den alten Grundsatz nicht bricht").
Der Satz „Was mit Edelsteinen zu haben ist, ist mit Münzen nicht zu haben"
stimmt ebenfalls nicht mehr.

Dazu gehört in `DESIGN.md` ergänzt: das Preisschild trägt **einen** Preis, nie
zwei; die Kaufrückfrage gilt auch für Pakete und Truhen.

**`docs/STAND.md`** — braucht einen neuen Abschnitt in der Art der vorhandenen:
was gebaut ist, was es kostet, was bewusst nicht gebaut ist. Der Abschnitt
„Zwei Währungen, Truhen, Tagesaufgaben, Pinguin" beschreibt den Stand **vor**
diesem Umbau; die Sätze über den fehlenden Wechselkurs und darüber, dass die
Cent-Beträge Platzhalter ohne Endpunkt sind, stimmen so nicht mehr. Auch der
Prüfstand („211 Servertests") ist danach eine andere Zahl.

### 4. Committen und mergen

Noch nichts committet, kein Zweig angelegt. Das Vorgehen des Projekts:

```bash
git fetch && git checkout -b edelstein-waehrung origin/staging
```

Dann die Änderungen übernehmen, committen, Zweig pushen, nach `staging` mergen
(`git merge --ff-only`), `staging` pushen. **`main` bleibt unberührt** — was von
`staging` in die Produktion geht, entscheidet Jan.

Vor dem Mergen immer `git fetch`: auf den Zweigen landen auch Commits aus Cursor.

Hierfür braucht es Zugangsdaten, die in dieser Arbeitskopie nicht liegen (HTTPS
statt SSH, kein `gh`).

### 5. Am laufenden Server prüfen

Das Projekt prüft Preisliches nicht nur in Tests. Der Durchlauf, der hier
ansteht:

```bash
DATABASE_URL=pglite NODE_ENV=development INVITE_CODE=BRAUWEG-BETA npm run dev:server
npm run dev:client
```

Guthaben setzen (es gibt bewusst keinen Endpunkt dafür):

```sql
UPDATE account SET coins = 2000, gems = 500 WHERE email = 'DEINE-ADRESSE';
```

Anzusehen: Münzpaket kaufen, Truhe kaufen und den Fund sehen, Kosmetik einmal
mit Münzen und einmal mit Edelsteinen, ein legendäres Stück in Münzen, die
Fehlerpfade (zu wenig Edelsteine, Edelsteinpaket antippen → „Bald", Season Pass
antippen → „Bald"), und die Kopfzeile nach jedem Kauf.

---

## Offene Punkte, die bewusst offen sind

- **`zeigeKaufbares` versteckt in der iOS-App weiter den ganzen Shop-Tab.**
  Jetzt liegt darin auch alles, was nur virtuelle Währung kostet und damit
  unbedenklich wäre. Die Trennung ist grob und läuft über den ganzen Tab; sie
  feiner zu ziehen ist eine App-Store-Entscheidung und keine Code-Entscheidung.
  Der Hinweis steht im Kopf von `src/shop.ts`.
- **Der VIP-Kauf ist nicht gebaut.** Er bräuchte Verlängerungslogik auf
  `premiumUntil` samt Tests. War ausdrücklich nicht Teil des Auftrags.
- **Der Season Pass hat kein Modell.** Nur einen Preis und eine Bald-Marke.
- **Die Cent-Beträge bleiben Platzhalter.** Plan 13 führt „Konkrete Preise für
  Abo und Münzpakete" weiter als offenen Punkt.
- **Truhen enthalten nur Münzen.** Der Nutzer hat angekündigt, dass später auch
  anderes darin liegen soll — das ist mit der Begründung, warum Paket und Truhe
  nebeneinander stehen dürfen, ausdrücklich vorgesehen, aber nicht gebaut. Wer
  Kosmetik hineinlegt, macht daraus eine Zufallsbox, und die schließt Plan 11
  aus.
- **Für die Kauftruhen gibt es keine Bildbestellung.** Sie benutzen das
  gezeichnete SVG aus dem Aufgaben-Vollbild. Wenn sie eigene Bilder bekommen
  sollen, gehört das als `docs/ASSETS-*.md` bestellt, mit Maßen, Freihalte-Zonen
  und der Liste, was nicht ins Bild gehört.
