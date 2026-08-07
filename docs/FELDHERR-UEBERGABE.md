# Feldherr — Übergabe

Stand: 5. August 2026, abends. Das Netzspiel **ist gelaufen**: zwei Browser,
ein Tisch, zwei vollständige Partien, Abrechnung geprüft. Der Zweig ist in
`staging` gemergt.

**Repo:** https://github.com/moodsteppi/brauweg

---

## 2. Was Feldherr ist und warum es anders läuft

Ein Echtzeit-Taktikduell zu zweit auf einem geteilten Brett. **Es ist die erste
Echtzeitgattung im Haus**, und `GameModule` ist zugbasiert und ausdrücklich
uhrlos. Der Befund samt der drei möglichen Wege steht in
[`docs/FELDHERR-PLAN.md`](FELDHERR-PLAN.md) — **das ist die wichtigste Datei
für den Einstieg.**

Gewählt wurde **Weg B, Gleichschritt**: Der Server bleibt Schiedsrichter für
Tisch, Sitze, Start und Ende, die Partie rechnen beide Geräte selbst — aus
einem gemeinsamen Saatkorn und derselben Aktionsliste. Über die Leitung gehen
nur Spieleraktionen, davon hat eine Partie einige Dutzend statt zwanzig
Zuständen je Sekunde.

Daraus folgen zwei Dinge, die man beim Ändern kennen muss:

* **`currentActor` liefert immer null, `legalActions` ist leer.** In Echtzeit
  ist niemand am Zug. Die Partie-Laufzeit darf daraus **keinen Zugtimer**
  ableiten — ein Tisch ohne Aktion ist hier der Normalfall.
* **Der Spielkern muss bitgenau gleich rechnen.** Sein Zufall kommt
  ausschließlich aus `saat()` (mulberry32), nie aus `Math.random()`. Wer das
  aufweicht, bricht jedes Netzspiel — nicht sichtbar, sondern erst daran, dass
  beide einen anderen Sieger haben.

---

## 3. Entscheidungen (vom Auftraggeber, nicht verhandelbar ohne Rückfrage)

1. **Weg B**, Gleichschritt über den vorhandenen Tisch.
2. **Keine Belohnung für örtliche Partien** — weder gegen die KI noch zu zweit
   an einem Gerät. Beides lässt sich beliebig oft herbeiführen; ein Endpunkt,
   den nur der Client füllt, ist eine Münzquelle, und ein Tagesdeckel macht
   daraus nur eine langsamere. *(Ein solcher Endpunkt war schon gebaut und ist
   bewusst wieder entfernt worden — nicht erneut anlegen.)*
3. **Keine Rangliste** vorerst. Damit wird Weg C (Server rechnet mit) nicht
   gebraucht.
4. **Erfahrung nach Dauer mit fallendem Ertrag:** 20 Punkte je Minute für die
   ersten drei, danach halbiert sich jede weitere. 3 min → 60, 5 min → 75, ab
   8 min praktisch nichts mehr. Hinziehen soll sich nicht lohnen.
5. **Tagesaufgaben:** `partie-spielen`, `drei-partien` und `partie-gewinnen`
   zählen mit, die kartenspezifischen nicht. Braucht keine neue Aufgabe und
   keine Migration.
6. **Eigenes Paket** `game-feldherr`, das `GameModule` erfüllt.
7. **Keine Bildbestellung** für die Kachel; die SVG-Zeichnung genügt vorerst.

---

## 4. Was fertig ist

### `packages/game-feldherr` — das Spielmodul

13 Tests, grün. Saatkorn aus `CreatePartyOptions.seed`, Takte zu 50 ms, sechs
Takte Vorlauf für jede Aktion. Beide Geräte melden den Ausgang **getrennt mit
Prüfsumme**; weichen sie ab, ist die Partie strittig und niemand gewinnt.
Aufgeben und Aussteigen geben dem anderen den Sieg — ein Bot-Ersatz geht nicht,
die KI lebt im Spielkern auf den Geräten.

### `packages/client/src/minispiele/feldherr/kern.js` — der Spielkern

**Maschinell erzeugt**, nicht von Hand ändern. Seit Stufe 1 des 3D-Umbaus
(7. August 2026) ist die Erzeugungsrichtung umgedreht — EIN Bau erzeugt aus
den Modulen unter `packages/game-feldherr/quelle/teile/` sowohl den Kern als
auch die Standalone-Datei:

```bash
node packages/game-feldherr/werkzeug/bauen.mjs
```

(Der alte Aufruf `kern-erzeugen.mjs` leitet dorthin weiter.) Zwei getrennt
gepflegte Fassungen liefen unweigerlich auseinander. Das Werkzeug bricht ab,
wenn es seine Ankerstellen in den Teilen nicht findet, statt stillschweigend
Halbes zu liefern — und es erzwingt mit Wächtern, dass `simulation.js` und
`ki.js` DOM-, Uhr- und `Math.random`-frei bleiben.

Die Quelle liegt **im Repo**: die Module unter
`packages/game-feldherr/quelle/teile/` (Schnitt entlang der dokumentierten
Teile; die Wiederzusammensetzung wurde beim Umbau byte-identisch gegen den
alten Stand bewiesen, die Gleichlauf-Probe lieferte dieselben
Grenzprüfsummen). `quelle/feldherr.html` ist seither ein **gebautes**
Artefakt, läuft aber weiterhin per Doppelklick (der Duo-Münzwurf hing
übrigens auch dort, coinTick lief nur mit KI). Der Dokumentationskopf —
Aufbau, Zustand, Zeichenschichten, die Regeln beim Ändern — lebt in
`teile/kopf.html` und steht wie immer am Anfang der gebauten Datei; darunter
die zwei wichtigsten Regeln: `zufall()` nur für Spielrelevantes, `deko()` für
alles Sichtbare; und jede Spielerhandlung läuft durch eine Befehlsfunktion,
nie direkt in den Zustand.

### Der Gleichschritt

Vier Dinge halten beide Geräte zusammen:

1. **Feste Takte von 50 ms** statt Bildzeit. Zwei Geräte haben nie dieselbe
   Bildfolge, und schon die dritte Nachkommastelle trennt beide Läufe.
2. **Eingaben werden gemeldet, nicht ausgeführt** — auch beim Absender. Nur so
   legen beide dieselbe Karte im selben Takt.
3. **Gerechnet wird höchstens bis zum sicheren Takt**, so weit die Züge beider
   Seiten bekannt sind. Rückstand wird mit bis zu zehn Takten je Bild aufgeholt.
4. **Prüfsumme** über Ressourcen und alle Objekte, die mit der Ergebnismeldung
   geht.

### Client

`FeldherrTisch.tsx` mit den drei Modi, angebunden an `useTable`. Weiche in
`App.tsx` vor Lobby und Kartentisch, Kachel in `GameSelect.tsx`,
Übersetzungsschlüssel.

---

## 5. Erledigt am Abend des 5. August — und was blieb

Die Punkte a–d der ursprünglichen Liste sind umgesetzt und im Browser
nachgewiesen (zwei Partien, zwei Browser, ein Tisch):

* **Alle Handlungen sind Züge:** `muenze`, `haus` (fehlte in der Liste — das
  Setzen des Haupthauses wurde nie gemeldet!), `karte`, `halt`, `abriss`,
  `drehen`. Details und Fallstricke: Nachtrag in `FELDHERR-PLAN.md`.
* **Das Brett ist für Sitz 0 gespiegelt:** Jeder verteidigt unten, auch die
  eigene Kartenleiste wandert nach unten. Gespiegelt wird die Brettebene in
  der Projektion `P()` — einmal für alles Gezeichnete, Höhen und Schrift
  bleiben aufrecht. Regeln dazu im Kopf der Spieldatei (Abschnitt
  Koordinaten); mitspiegeln müssen nur Malersortierung, Facettenfolge und
  Zeigereingabe. Die Spiegelung ist reine Darstellung — die
  Gleichlauf-Probe belegt, dass beide Sitze denselben Zustand rechnen.
* **Takt-Herzschlag** als flüchtige `takt`-Relais-Nachricht im Gateway (wie
  Zurufe, nichts läuft durchs Modul oder die Datenbank), Wissensgrenze im
  Kern, Aufholen ohne Uhr, Web-Worker-Antrieb für verdeckte Tabs.
* **Abgleichprobe alle 40 Takte** fährt mit dem Herzschlag; bei Abweichung
  endet die Partie sofort strittig. Grenze 0 entlarvt ein falsches Saatkorn.
* **Tisch erstellen/beitreten** im Feldherr-Bildschirm selbst (fest 2 Sitze,
  1 Runde), samt Wartebereich und Liste der offenen Tische.
* **Tagesaufgaben:** partie-spielen/drei-partien/partie-gewinnen zählen mit,
  die Kartenaufgabe nicht (`GameMeta.xpBasisZaehltKarten: false`).
* **Erfahrung nach Dauer** wird gebucht (beide 77 XP nach ≈5 Minuten,
  fallender Ertrag sichtbar). Trophäen gibt es keine — und die Abrechnung
  reißt dabei nicht mehr ab (siehe Fallstricke).

### Was noch offen ist

* **Strittige Partien — Stand 6. August abends: Wurzeln gefunden.** Auf
  echten Geräten (iPhone gegen Desktop) sind nacheinander vier Ursachen
  gefallen: der Doppelstart der Bildschleife, die Gegnerstand-Überschätzung
  aus Zügen, die Engine-abhängige Zufalls-Sortierung im Gefecht und
  `Math.pow` in der Preisformel (alle unter *Fallstricke*). Seither offen:
  mit zwei Geräten verschiedener Browser eine lange Kampfpartie spielen und
  bestätigen, dass nichts mehr strittig wird. Der ältere Befund darunter
  bleibt als Lesehilfe stehen:
  - Der Kern selbst ist nachweislich deterministisch: Das Werkzeug
    `packages/game-feldherr/werkzeug/gleichlauf-probe.mjs` fährt dieselbe
    Zugliste als Live-Lauf, als Wiedereinstieg und für beide Sitze
    (gespiegelt und nicht) — alle Grenzproben stimmen überein.
  - Im Browser wurde die Partie trotzdem mehrfach strittig, sobald ein
    Gerät neu lud, während das andere weiterlief. Muster: Die strittige
    Grenze ist IMMER die erste 40er-Grenze nach dem letzten Zug, und die
    gemeldete Summe entspricht exakt einem Lauf, der diesen Zug drei bis
    zehn Takte VERSCHOBEN ausführte (Versatz-Suche im Werkzeug). Das ist
    der Notnagel in zugAnnehmen: Der Zug kam nach seinem Takt an.
  - Drei Gegenmittel sind schon drin: ein Meldepuffer beim Einplanen
    (zwölf statt sechs Takte Vorlauf), die Zustellung der Zuege am
    React-State vorbei direkt in den Kern (der Umweg ueber setState und
    Effekt verspaetet sich, besonders im verdeckten Tab), und eine laute
    Konsolenwarnung `feldherr: Zug fuer Takt … kam erst bei … an`, wenn
    der Notnagel doch feuert.
  - Der Testaufbau hier hat eine harte Grenze: zwei Tabs in EINEM
    Browserfenster, nur einer je sichtbar. Der verdeckte haengt an
    Web-Worker-Antrieb und gedrosselten Timern — Aufhol- und
    Verdeckungsmomente, die zwei echte Geraete so nicht haben. **Naechster
    Schritt: einmal mit zwei getrennten Browsern/Geraeten spielen und auf
    die Warnung achten.** Feuert sie dort auch, den Meldepuffer erhoehen
    oder die Ausfuehrungstakte serverseitig festschreiben.
* **Strittig stoppt das Geraet still.** Wer die Abweichung entdeckt, meldet
  und friert ein — das Banner erscheint aber erst, wenn BEIDE gemeldet
  haben. Bis dahin sieht der Spieler nur „Warte auf den Gegner". Der
  Bildschirm sollte die eigene Strittig-Meldung sofort zeigen.
* **HUD-Hinweistexte** („Setze dein Haupthaus" / „Gleich bist du dran…")
  stehen im Netz noch mit der Duo-Logik in den Leisten; der große Hinweis
  auf dem Brett stimmt.
* **Zurück während der Partie** trennt nur die Verbindung (Partie läuft
  serverseitig weiter, Wiedereinstieg über „Weiterspielen"). Aufgeben geht
  über Menü → „Partie beenden". Ein echtes „Verlassen = Aufgabe" braucht
  eine bewusste Entscheidung.
* **Ergebnis nachrechnen** (Weg zur Rangliste) — unverändert offen, siehe
  Plan.
* **Freundes-Einladung** an den Feldherr-Tisch: Der Freundesweg besteht
  (`social/service.ts`), der Filter ist noch nicht verdrahtet.

---

## 6. Fallstricke, die schon Zeit gekostet haben

* **`sort(()=>zufall()-0.5)` frisst je Browser-Engine verschieden viel
  Zufall.** Wie oft `sort()` seinen Vergleicher ruft, entscheidet die
  Engine — Safari (JSC) sortiert anders als Chrome (V8). Die Angriffs- und
  Marschreihenfolge mischten so, jeder Vergleich zog aus dem Saatkorn:
  iPhone gegen Desktop trennte sich mit dem ersten Gefecht, gleiche Engine
  gegen gleiche Engine blieb synchron — deshalb fanden es weder die
  Desktop-Tests noch der Headless-Prüfstand. Jetzt mischt `mische()`
  (Fisher-Yates, exakt n−1 Züge). Gleiches Kaliber: `Math.pow` ist
  zwischen Engines nicht bitgenau festgelegt und stand in der
  Preisformel — jetzt Bit-Schub. Nur `sqrt` und die Grundrechenarten sind
  exakt spezifiziert; `sin/cos/pow/atan2/hypot` gehören NIE in den
  Zustandspfad.
* **Der Kern-Erzeuger entfernte von zwei `requestAnimationFrame(loop)`
  nur die erste Fundstelle** — der Eigenstart blieb, und jede Sitzung
  feuerte EIN Bildzeit-update mit gerätseigenem dt: winzige, je Gerät
  verschiedene Verschiebung, „manchmal strittig". Headless unsichtbar,
  weil der Zusatzschritt dort deterministisch gleich war. Der Erzeuger
  erzwingt jetzt genau zwei Fundstellen und entfernt beide.
* **Aus fremden Zügen den Gegnerstand abzuleiten überschätzt ihn** (geplant
  wird bei `max(eigener Takt, Gegnerstand)+Vorlauf`): Beide Geräte „holten"
  aufeinander auf, die Partie rannte der Echtzeit davon (Ressourcen
  schneller als die Rate!), ruckelte im Dauersprint und wurde strittig.
  Den Gegnerstand kennen allein die Herzschläge.
* **Der Zeichenpfad verbrauchte Spielzufall.** Rauch, Funken, Wackeln zogen
  aus `zufall()` je Bild — Gleichlauf-Tod durch bloßes Zuschauen, und kein
  Headless-Nachweis kann es finden, weil er nicht zeichnet. Regel steht im
  Kopf der Spieldatei: `deko()` für alles Sichtbare.
* **`awardForParty` kennt keine zwei Sitze** und warf bei der ersten
  Feldherr-Abrechnung — still, als `actionRejected` beim meldenden Client:
  keine Stats, keine Aufgaben, keine Erfahrung. Jetzt: ohne
  Trophäenverteilung keine Trophäen, aber Erfahrung aus `xpBasis`.
* **`gameIdSchema` in `http/app.ts` kannte `feldherr` nicht** — Tisch
  erstellen und auflisten liefen in ein 400, obwohl das Modul registriert
  war. Wer ein Spiel einbaut: Registry UND HTTP-Enum.
* **`hidden` verliert gegen `.btn{display:block}`.** Der „Neue Runde"-Knopf
  blieb im Netz-Endbild sichtbar; Autorenregeln schlagen das UA-Stylesheet
  für `[hidden]`. `style.display='none'` statt Attribut.
* **Verdeckte Tabs:** `requestAnimationFrame` steht, `setInterval` tropft
  einmal je Sekunde — nur Worker-Timer laufen ungedrosselt. Ohne den
  Worker-Antrieb fror die Partie für beide ein, sobald ein Tab in den
  Hintergrund ging.
* **Der Kern war einmal falsch geschnitten:** Das Extraktionsskript traf auf
  `<style>` und `<body>` **im Dokumentationskommentar** der Spieldatei. Stil
  und Hülle enthielten Fließtext. Das Werkzeug entfernt den Kommentar jetzt
  zuerst — beim Ändern nicht wieder ausbauen.
* **Ein Belohnungsendpunkt zahlte auch gegen die KI.** Genau die Lücke, die
  Entscheidung 2 ausschließt. Entfernt.
* **`tables.test.js` wird in engen Containern nach ~100 s per SIGKILL
  abgeräumt**, *nach* dem letzten bestandenen Test. Sieht wie ein Fehlschlag
  aus, ist keiner — auf einer normalen Maschine läuft es durch.
* **React-Effekte an einen Schlüssel hängen, nicht an ein Objekt.** Der Effekt,
  der Züge in den Kern reicht, hängt an der *Anzahl* der Züge. Mit dem
  Sichten-Objekt in der Abhängigkeitsliste liefe er bei jedem Serverfunk neu —
  derselbe Fehler, an dem am Kartentisch schon einmal der Rundenabschluss
  verschwunden ist.
* **Nach Umbauten prüfen, ob jede aufgerufene Kernfunktion noch existiert.**
  Bei der Arbeit an der Spieldatei sind zweimal ganze Funktionsblöcke
  verlorengegangen und erst im Spiel aufgefallen.

---

## 7. Erster Befehl für die neue Sitzung

> Lies `docs/FELDHERR-PLAN.md` und `docs/FELDHERR-UEBERGABE.md`. Das Netzspiel
> läuft; offen sind die Punkte unter „Was noch offen ist": Brett für Sitz 0
> spiegeln, HUD-Hinweise im Netz, Verlassen-Regel entscheiden,
> Freundes-Einladung an den Tisch.
>
> Zum örtlichen Ausprobieren: zwei Konten, zwei Ursprünge (localhost und
> app.localhost, getrennte Cookies), Server mit
> `DATABASE_URL=pglite INVITE_CODE=x` starten — in der Entwicklung ist die
> WS-Herkunftsprüfung dafür offen.
