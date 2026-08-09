# Übergabe: Netzpartien werden wieder strittig

Stand: 7. August 2026, spät. **Ursache gefunden und behoben, dazu
Selbstheilung eingebaut — siehe „Lösung" direkt hierunter.** Der Rest des
Dokuments bleibt als Protokoll der Suche stehen.

Der Auftraggeber hat am 7. August auf Produktion eine Netzpartie gespielt
(zwei Geräte, Sitz 2 auf dem Handy) und bekam mitten im Spiel das Banner
*„Die Partie ist strittig: Die Geräte haben verschiedene Stände gemeldet.
Niemand gewinnt."* — die beiden Geräte haben also an derselben
40er-Taktgrenze verschiedene Prüfsummen gemeldet.

Das ist derselbe Fehlerklasse wie im August zuvor (siehe
`docs/FELDHERR-UEBERGABE.md`, Abschnitt *Fallstricke*), aber die dort
gefundenen sechs Ursachen sind alle behoben.

---

## Lösung (7. August 2026, spät)

**Die Regeln vom 7. August sind unschuldig.** Die Zugliste der
Gleichlauf-Probe wurde wie unten in Abschnitt 4 gefordert erweitert
(Mauern nebeneinander UND gestapelt, Aufwertung mit Stufenwechsel am
Haupthaus rauf und runter, Abriss mitten aus der Gruppe, Halt-Befehle,
Front-Werk, Kanone, Gefechte) — live gegen Replay gegen beide Sitze bleibt
über 110 Grenzproben **GLEICH**. `mauerNetz`, `hausStufe`, `playCard`,
`razeEnt` und `trefferAuf` rechnen deterministisch; auch der Zeichen- und
Bedienpfad zieht nirgends `zufall()` (geprüft per Volltextsuche und
Code-Durchsicht von `animate`, `render`, `berechnePrev`, HAKEN).

**Die eigentliche Lücke steckte im Gleichschritt-Protokoll — der Absender
war vor seinem EIGENEN schwebenden Zug nicht geschützt.** Der Fix vom
6. August (schwebende Züge) deckelt nur den GEMELDETEN Stand, damit die
Gegenseite vor dem Zugtakt wartet. Die Rechnung für den Absender selbst:
Zug geplant bei T = Takt + VORLAUF + MELDE_PUFFER (= +10); die Gegenseite
wartet bei T−4, meldet aber weiter — also durfte der Absender bis
(T−4) + VORLAUF + MELDE_PUFFER − 1 − POLSTER = **T+2** rechnen. Kam das
Server-Echo des eigenen Zuges später zurück als die ~500 ms, die der
Absender bis T braucht (Funkloch am Handy, langsamer Datenbank-Schreiber),
führte der Notnagel den Zug verschoben aus, während die Gegenseite ihn
pünktlich bei T rechnete: stille Divergenz, Banner an der nächsten
40er-Grenze, Warnung nur in der am Handy unsichtbaren Konsole. Das passt
Punkt für Punkt zum Vorfall (Handy, mitten im Spiel, direkt nach einem
Legen) — und erklärt, warum jede headless Probe grün blieb: sie kennt
keine Echo-Verspätung.

Drei Änderungen:

1. **Absender-Deckel** (`anbindung-fuss.js`, Schleife): Solange ein eigener
   Zug schwebt, rechnet auch der Absender höchstens bis T−1
   (`wissen = min(wissen, schwebend[0].takt − 1 + POLSTER)`). Normal kehrt
   das Echo in 100–300 ms zurück und der Deckel greift nie; bei einer
   Störung stottert die Partie, statt auseinanderzulaufen.
2. **Notnagel meldet sofort** (`zugAnnehmen`): Ein Zug, der erst nach
   seinem Takt eintrifft, wird nicht mehr still verschoben ausgeführt —
   der Kern hält an und ruft `aufStrittig` mit `grund: 'zugVersatz'`
   (Probenabweichung: `grund: 'probe'`).
3. **Selbstheilung statt Strittig** (`FeldherrTisch.tsx`): Bei
   Gleichlauf-Verlust startet der Tisch den Kern neu und spielt Saatkorn
   plus Server-Zugliste nach — die Zugliste ist die gemeinsame Wahrheit,
   das Replay ist der kanonische Lauf, beide Geräte finden wieder
   zusammen („Gleichlauf wird wiederhergestellt …"). Erst die dritte
   Heilung binnen zwei Minuten gilt als echt strittig (dann rechnen die
   Geräte wirklich verschieden) und meldet wie bisher das Ergebnis.
   Nebenbei gestopft: Beim Neustart mitten in der Partie bekommt der
   frische Kern die schon verwahrten Züge jetzt SOFORT — der
   zahlgebundene Effekt lief nur, wenn sich die Zugzahl änderte.

Nachgewiesen headless (Szenario „letzter Zug kommt 20 Takte zu spät"):
`aufStrittig(zugVersatz)` feuert im Ankunftstakt, und ein frischer
Replay-Lauf trifft alle kanonischen Grenzsummen. Erweiterte Probe, volle
Suite (265 Tests) und Client-Build grün. **Noch offen: eine echte
Zwei-Geräte-Partie auf staging/prod als Gegenprobe.**

Restrisiko, bewusst hingenommen: Braucht ein Echo länger als der
Schwebe-Verfall (4 s), hebt sich der Deckel und ein danach doch noch
eintreffendes Echo läuft wieder in den Notnagel — das fängt jetzt die
Selbstheilung. Die Versatz-Suche der Probe ist parametrisiert
(`VERSATZ_GRENZE`/`VERSATZ_SUMME` aus einer echten Meldung eintragen);
ohne beobachtete Summe bleibt sie aus, weil sie sonst Scheintreffer
listet.

---

## 1. Wie der Gleichschritt funktioniert (Kurzfassung)

Beide Geräte rechnen dieselbe Partie aus **einem Saatkorn und derselben
Zugliste**. Über die Leitung gehen nur Spielerhandlungen, nie Zustände.
Alle 40 Takte bildet jedes Gerät eine **Prüfsumme** und schickt sie mit dem
Herzschlag. Weichen zwei Summen derselben Grenze ab, endet die Partie
sofort als strittig.

Die Prüfsumme (in `quelle/teile/anbindung-fuss.js`, `pruefsumme()`) deckt:

```
res[0], res[1], ents.length
je Objekt: type, owner, r, c, lvl, Math.round(hp)
```

**Alles, was diese Werte beeinflusst, muss auf beiden Geräten Zeichen für
Zeichen gleich laufen.** Nicht gedeckt sind `G.fx`, Partikel (`PT`),
`G.hb`, `hpMax` — die können abweichen, ohne dass es auffällt (das ist
zugleich eine Falle: ein Fehler dort wird erst sichtbar, wenn er auf
`lvl`/`hp` durchschlägt).

---

## 2. Was bereits ausgeschlossen ist

**Der 3D-Lesepfad ist nicht die Ursache** (am 7.8. gemessen). Die Sorge
war berechtigt: `lesen()` gibt der 3D-Bühne Funktionen an die Hand
(`feldMarken`, `schilder`, `bauVorschau`, `partikel`, `raster`,
`erschuetterung`), und die Bühne ruft sie **je Bild** auf — zusätzlich zum
2D-Renderer, der weiterläuft. Ein Gerät mit 3D rechnet diese Funktionen
also doppelt so oft wie eines ohne. Hätten sie Nebenwirkungen, wären
Bildrate und 3D-Schalter unmittelbar desync-wirksam.

Gemessen im Standalone mit aktivem Kartenzug und aktivem Peek:

```js
// 200 Aufrufe von markenListe() + schildListe()
ZSTAND (Saatkorn-Zustand)  : unverändert
res, ents(type,owner,r,c,lvl,round(hp)), hb, nextId : unverändert
```

→ **nebenwirkungsfrei.** Diesen Pfad nicht weiter verdächtigen, aber bei
jeder Erweiterung von `lesen()` erneut so prüfen.

---

## 3. Hauptverdächtige (Änderungen vom 7. August, die Zustand schreiben)

In dieser Reihenfolge prüfen:

### a) `mauerNetz()` in `quelle/teile/simulation.js` — der stärkste Verdacht

Neu am 7.8.: Mauern werden durch Verbinden stärker. Die Funktion schreibt
**`m.lvl`, `m.hp`, `m.hpMax`** — also mitten in die Prüfsumme. Aufgerufen
wird sie aus `playCard` (Mauer gelegt/gestapelt), `kill` (Mauer gefallen)
und `razeEnt` (Mauer abgerissen).

Worauf zu achten ist:

* **Reihenfolgeabhängigkeit.** Die Funktion sammelt
  `G.ents.filter(...)` und läuft eine Tiefensuche mit `offen.pop()`. Das
  Ergebnis (welches Stück welchen Anteil bekommt) hängt an der
  **Reihenfolge von `G.ents`**. Weicht die Reihenfolge zwischen den
  Geräten je ab — etwa weil ein Objekt an anderer Stelle entfernt und
  angehängt wurde —, verteilt sich das Leben anders, und `hp` läuft
  auseinander.
* **`quote = m.hp / altMax`** und `Math.round(gesamt * gewicht / gewichtSumme)`
  sind zwar deterministisch, aber sie verstärken jede noch so kleine
  Vorabweichung sofort in einen sichtbaren `hp`-Unterschied.
* **Aufrufzeitpunkt in `kill()`**: `mauerNetz` läuft dort NACH `removeEnt`.
  Prüfen, ob `kill` auf beiden Geräten im selben Takt und in derselben
  Reihenfolge über mehrere gleichzeitig fallende Mauern läuft
  (Kesselexplosion trifft mehrere Stücke auf einmal!).

### b) `hausStufe()` — läuft **jeden Takt**

Ebenfalls am 7.8. geändert (Stufe 3 jetzt auch durch zwei Stützpunkte auf
Stufe 2). Sie wird in `update()` je Takt für beide Spieler ausgewertet und
schreibt `G.hb[own]` sowie bei Stufenwechsel **`h.hp`**. Damit hängt die
Hausgesundheit an der Nachbarschaftsauswertung — und die hängt an
`entAt()`, also am Gitter.

Besonders prüfen: Die neue Zählung nutzt ein `Set` über `o.id`. Das ist
deterministisch. Aber der **Übergang** ist heikel: Fällt ein Stützpunkt
genau im selben Takt, in dem ein anderer entsteht, muss die Reihenfolge auf
beiden Geräten identisch sein.

### c) `trefferAuf()` — neue Zeile für den Waldschutz des Haupthauses

```js
if(o.type==='haus' && envAt(o.r,o.c)==='wald') d = Math.max(1, Math.round(d*0.80));
```

Deterministisch, aber sie ändert `hp`. Falls `envAt` je nach Gerät etwas
anderes liefert (z. B. nach einem Vulkanausbruch, der `o.type` auf
`krater` setzt), schlägt das sofort durch.

### d) Schützenturm im Wald (7.8., NACH dem beobachteten Fehler gebaut)

`addEnt` setzt `e.turm` jetzt auch im Wald, `trefferAuf` zieht dort ein
Drittel ab, `preisFuer` schlägt +4 auf. Alles deterministisch, aber es
schreibt `hp` und ändert die Beweglichkeit — beim Eingrenzen mit
berücksichtigen. Diese Änderung kann den **beobachteten** Fehler nicht
verursacht haben (sie kam später), wohl aber die Suche verkomplizieren.

### e) `playCard` — `halt` überlebt die Aufwertung

`if(o.halt) nu.halt = true;` — `halt` steht **nicht** in der Prüfsumme,
wirkt aber über `trefferAuf` (`o.halt` → −12,5 % Schaden) auf `hp`. Eine
Abweichung im `halt`-Flag bleibt also unsichtbar, bis der erste Treffer
fällt. Guter Kandidat für „läuft lange gut und kippt dann".

---

## 4. Die größte Lücke im Prüfstand

**`werkzeug/gleichlauf-probe.mjs` testet keine einzige Karte.** Seine
Zugliste besteht aus:

```js
{ art:'muenze' }, { art:'haus' }, { art:'haus' }
```

Damit läuft die Probe grün, obwohl `playCard`, `mauerNetz`, Aufwertungen,
`razeEnt` und `hausStufe`-Wechsel **nie ausgeführt werden**. Genau dort
liegen aber alle Änderungen vom 7. August. Dass die Probe grün ist, sagt
über diesen Fehler nichts aus.

**Erster Schritt für die Fehlersuche: die Zugliste erweitern**, bis sie
das Verdächtige abdeckt — mehrere Mauern nebeneinander und gestapelt,
Aufwertungen, ein Abriss, eine Truppe anhalten, ein Werk in Kesselnähe
sprengen. Wenn live gegen replay dann auseinanderläuft, ist die Ursache
eingekreist, ohne dass zwei Geräte nötig sind.

---

## 5. Bekannte Fallen aus früheren Runden (alle behoben, aber lehrreich)

Aus `docs/FELDHERR-UEBERGABE.md`. Die neue Ursache ist wahrscheinlich vom
gleichen Kaliber:

1. `sort(()=>zufall()-0.5)` — wie oft `sort` seinen Vergleicher ruft,
   entscheidet die Engine. Safari ≠ Chrome. Deshalb mischt nur `mische()`.
2. `Math.pow` ist zwischen Engines nicht bitgenau. Nur `sqrt` und die
   Grundrechenarten sind exakt spezifiziert. `sin/cos/pow/atan2/hypot`
   gehören NIE in den Zustandspfad.
3. Der Zeichenpfad verbrauchte Spielzufall (`zufall()` statt `deko()`).
4. Zwei `requestAnimationFrame(loop)` — ein Bildzeit-Schritt zu viel.
5. Gegnerstand aus fremden Zügen abgeleitet und dadurch überschätzt.
6. Puls überholte den Zug im Server.

**Regel zum Mitnehmen:** Eine Abweichung, die nur auf einem Gerätetyp
auftritt (iPhone gegen Desktop), ist fast immer Engine-abhängige
Mathematik oder Zufallsverbrauch. Eine Abweichung, die von der Bildrate
oder vom 3D-Schalter abhängt, ist ein Nebeneffekt im Zeichenpfad.

---

## 6. Werkzeuge

```bash
node packages/game-feldherr/werkzeug/gleichlauf-probe.mjs
```

Fährt dieselbe Zugliste als Live-Lauf, als Wiedereinstieg und für beide
Sitze (gespiegelt und nicht) und vergleicht die Grenzprüfsummen. Enthält
außerdem eine **Versatz-Suche**: Sie spielt den letzten Zug um −8 bis +12
Takte verschoben nach und meldet, welcher Versatz eine beobachtete
Prüfsumme reproduziert. Damit lässt sich unterscheiden, ob ein Zug zu spät
ankam (Protokollproblem) oder ob die Regeln selbst auseinanderlaufen.

```bash
node packages/game-feldherr/werkzeug/bauen.mjs    # nach jeder Änderung
npm test --workspace @brauweg/game-feldherr
```

**Örtlich zu zweit testen:** Server
`DATABASE_URL=pglite NODE_ENV=development INVITE_CODE=x PUBLIC_URL=http://localhost:5173 node packages/server/dist/src/index.js`,
Client `npm run dev:client`. Zwei Konten, zwei Ursprünge:
`localhost:5173` und `app.localhost:5173` haben getrennte Cookie-Räume.
Testkonten örtlich: `anna@test.de` / `feldherr-test-eins`.

Im Kern gibt es außerdem die laute Warnung
`feldherr: Zug fuer Takt … kam erst bei … an`. Erscheint sie vor dem
Strittig-Banner, ist es ein **Protokoll**-, kein Regelproblem.

---

## 7. Erster Befehl für die neue Sitzung

> Lies `docs/FELDHERR-BUG-STRITTIG.md`, `docs/FELDHERR-UEBERGABE.md`
> (Abschnitt *Fallstricke*) und den Kopf von
> `packages/game-feldherr/quelle/teile/kopf.html`.
>
> Erweitere zuerst die Zugliste in
> `packages/game-feldherr/werkzeug/gleichlauf-probe.mjs` um Kartenzüge —
> Mauern nebeneinander und gestapelt, eine Aufwertung, einen Abriss, einen
> Halt-Befehl — und sieh nach, ob live gegen replay auseinanderläuft.
> Läuft es auseinander, engt die Versatz-Suche die Stelle ein. Läuft es
> zusammen, liegt die Ursache nicht in der Zugreihenfolge, sondern in
> etwas Geräteabhängigem: dann `mauerNetz` und `hausStufe` auf
> Reihenfolgeabhängigkeit von `G.ents` prüfen.
>
> Nicht anfassen, ohne einen nachgewiesenen Fehler: das
> Gleichschritt-Protokoll (Wissensgrenze, Meldepuffer, schwebende Züge,
> Puls-Deckel, Polster). Jede Konstante dort hat eine Rechnung im
> Kommentar.
