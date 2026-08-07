# Feldherr → 3D: Übergabe für den Strukturumbau

Stand: 7. August 2026. Entschieden mit dem Auftraggeber: **kein Neustart auf
grüner Wiese**, sondern ein Struktur-Schnitt in drei Stufen. Ziel dahinter:
3D-Modelle statt gemalter Figuren und ein Bild, das sich „richtig echtzeitfähig"
anfühlt.

**Pflichtlektüre zuerst:** `docs/FELDHERR-UEBERGABE.md` (Abschnitt
*Fallstricke*) und der Dokumentationskopf von
`packages/game-feldherr/quelle/feldherr.html`. Dort steht das bezahlte
Lehrgeld einer Woche Gleichlauf-Fehlersuche — es ist der Grund für diese
Entscheidung.

---

## Warum kein Rewrite

Der wertvollste Teil des Codes ist unsichtbar: der über sechs Live-Fehler
gehärtete Determinismus (Engine-abhängige `sort`-Vergleicher, `Math.pow`,
Deko-Zufall, Puls-Zug-Wettrennen, Gegnerstand-Überschätzung, doppelter
Schleifenstart) und das Gleichschritt-Protokoll (Wissensgrenze, Meldepuffer,
schwebende Züge, Prüfsummen, Wiedereinstieg, Spiegelung). Ein Neustart wirft
das weg und bezahlt es in einer 3D-Umgebung erneut — teurer.

Die Kerneinsicht: **3D ersetzt die Darstellung, nicht das Spiel.** Die
Simulation muss für den Gleichschritt ohnehin ein deterministisches
Takt-Gitter bleiben. Was für 3D weichen muss, ist genau die unkritische
Hälfte der Spieldatei.

---

## Die drei Stufen

### Stufe 1 — Simulation vom Renderer trennen

Ein Paket ohne DOM und ohne Canvas: Regeln, Zustand `G`, `update(dt)`,
Befehlsfunktionen, Saatkorn-Zufall. Die Grenze ist schon halb gezogen
(Befehlsfunktionen, `zufall()`/`deko()`-Trennung, `update` gegen `render`) —
jetzt wird sie hart. Dabei dreht sich die Erzeugungsrichtung um: Heute
schneidet `packages/game-feldherr/werkzeug/kern-erzeugen.mjs` den Kern AUS
der HTML-Datei; künftig wird die Standalone-Datei AUS den Modulen gebaut.

**Sicherheitsnetz und Abnahme:** `packages/game-feldherr/werkzeug/
gleichlauf-probe.mjs` muss nach jedem Umbauschritt dieselben Grenzprüfsummen
liefern wie vorher — dann ist die Simulation bitgleich geblieben. Das ist der
Beweis, den ein Rewrite nie hat. Zusätzlich einmal im Browser gegenspielen
(zwei Ursprünge: localhost und app.localhost, siehe FELDHERR-UEBERGABE).

**Stand 7. August 2026: umgesetzt.** Die Quelle liegt in
`packages/game-feldherr/quelle/teile/` — `simulation.js` (Teil 1, DOM-frei),
`darstellung.js` (Teile 2–4), `ki.js` (Teil 6, DOM-frei), `oberflaeche.js`
(Teil 5) plus `kopf.html`, `stil.css`, `huelle.html` und die Gleichschritt-
Anbindung `anbindung-kopf.js`/`anbindung-fuss.js` (vorher als Text im
Erzeuger versteckt). `werkzeug/bauen.mjs` baut daraus beide Artefakte;
`kern-erzeugen.mjs` leitet nur noch weiter. Beweis geführt: Die
Wiederzusammensetzung der Teile war byte-identisch zum alten Stand, die
Gleichlauf-Probe lieferte dieselben Grenzprüfsummen (59 Proben, u. a.
2280→x01aye), 13 Modultests grün. Wächter im Bauer erzwingen dauerhaft:
`simulation.js`/`ki.js` ohne DOM, Uhr und `Math.random` (zwei wörtlich
erlaubte Ausnahmen: Startsaat, `deko`), `simulation.js` lauffähig im nackten
Sandkasten, genau zwei `loop`-Anstöße, beide in der Oberfläche.

**Feinschnitt — erledigt am 7. August 2026:** Die Befehlsfunktionen
(`playCard`, `setzeHaus`, `haltBefehl`, `abrissBefehl`, `drehBefehl`,
`coinAuslosen`/`coinWahl`/`coinTick`) und die Bauregeln (`placeSpot`,
`preisFuer`, `fitsAt`) liegen jetzt in `simulation.js`. Sichtbare Wirkungen
melden sie über die **Wirkungs-Haken** (`HAKEN`, No-Op-Standards; die
Oberfläche hängt Partikel/HUD/Overlay ein) — genau dort kann sich später
auch der 3D-Renderer einhängen. Der Sandkasten-Wächter in `bauen.mjs`
erzwingt seither, dass die Befehle in der Simulation bleiben. Dabei
bereinigt: Die Münzrauch-Deko zog `zufall()` statt `deko()` — synchron,
aber gegen die Regel, und jede headless gerechnete Partie hätte einen
anderen Zufallsstrom gehabt als der Browser.

**Noch offen aus derselben Familie:** Der Vulkanausbruch am Ende von
`simulation.js` ruft weiterhin direkt `burst`/`shake`/`bakeStatic` und zieht
seine Rauchpositionen aus `zufall()`. Gleicher Umbau wie bei der Münze
(Haken + `deko()`), eigene Abnahme über die Gleichlauf-Probe.

### Stufe 2 — 3D-Renderer daneben, nicht darüber

**Torwächter davor: der Geometrie-Entscheid — GEFALLEN am 7. August 2026**
(vom Auftraggeber mit `werkzeug/feld-vorschau.html` am Handy festgelegt):
**8 × 12 Felder, Zellverhältnis 1,00 (quadratisch), nur noch diese eine
Feldgröße.** Umgesetzt in `simulation.js` (setzeFeld fest), `resize()`
(ZELL = 1,00) und den Menüs (Auswahl entfernt; Standalone wie Client). Die
alten Schlüssel klein/mittel/gross bleiben im Tisch-Schema gültig und
bedeuten alle dasselbe Brett — alte Snapshots laden weiter. Ebenfalls
entschieden: Im Netz sieht jeder die ganze Karte und nur die EIGENE
Kartenleiste; die Gegnerleiste ist ausgeblendet (anbindung-fuss.js), das
Duo am geteilten Gerät behält beide.

Three/R3F liest je Bild den Simulationszustand und **interpoliert zwischen
den Takten**: Die Simulation bleibt bei 20 Takten je Sekunde, das Bild läuft
mit 60. Flüssigkeit ist ein Darstellungsproblem, kein Simulationsproblem —
das ist der ganze Trick hinter „echtzeitfähig".

* Vorbild im Haus: Pro-Subway (`packages/client/src/screens/Runner.tsx`) —
  GLB-Laden mit `useGLTF`, Modelle unter `packages/client/public/3d/`.
  Dessen Lehren gelten auch hier (kein `clone()` je Instanz, nichts
  Anhaltendes ungeprüft in `<Canvas>`, Resize-Anstoß — siehe CLAUDE.md).
* Ein Ritter-GLB liegt beim Auftraggeber bereits vor; weitere Modelle werden
  nach Regel 5 (CLAUDE.md) bestellt, nicht beschrieben.
* Der 2D-Canvas-Renderer bleibt als Rückfall und Referenz, bis 3D die volle
  Zeichenliste kann (Truppen, Bauten, Gelände, Effekte, Vorschau,
  Markierungen, Spiegelung für Sitz 0).

**Stand 7. August 2026: Gerüst umgesetzt und im Client verifiziert.**
`packages/client/src/minispiele/feldherr/Buehne3D.tsx` liest je Bild
`sitzung.lesen()` und stellt Brett, Gelände, Bauten und Truppen dar —
Platzhalterkörper, nur der Ritter kommt als GLB. Umschalter „3D“ im
Feldherr-Bildschirm (beide Modi); die Ansicht liegt über dem `#stage` des
Kerns, lässt Zeiger durch (`pointer-events: none`) — bedient wird weiter
der 2D-Pfad samt HUD und Bau-Vorschau. Geprüft per KI-Partie im Client:
Gelände je Partie neu gebaut, Objekte folgen der Simulation, Ritter-GLB
gerendert samt Spielerring.

**Ritter-GLB (Lieferung vom 7. August, liegt lokal unter
`packages/client/public/3d/feldherr/ritter.glb`, bewusst NICHT
eingecheckt):** Pivot und Maßstab stimmen (Bodenmitte, ~1 Einheit hoch),
aber 3,7 MB statt ≤ 200 kB (Textur), 4 724 Dreiecke, keine Clips
`stehen`/`gehen`/`schlagen`, keine Materialien `spieler`/`stufe` —
Nacharbeit nach `docs/ASSETS-FELDHERR-3D.md`, erst dann einchecken
(Regel 4: einmal in der Historie, immer in der Historie).

**Ebenfalls umgesetzt (7. August 2026):** Kamera fest auf Neigung 10°,
Abstand 17 (Entscheid am lebenden Spiel per Debug-Regler). **3D ist
spielbar:** Die Buehne registriert am Kern eine Zeiger-Abbildung
(`sitzung.zeigerAbbildung`, Strahl auf die Brettebene) — `cellFromClient`
nutzt sie, solange sie gesetzt ist, die gesamte Eingabelogik (Karten-Drag,
Haus, Halt, Abriss) bleibt unangetastet und läuft im Netz weiter durch die
Befehle. Ein Ziel-Marker leuchtet unterm Zeiger. Nachgewiesen im Client:
Klick in die Canvas-Mitte setzt das Haus in exakt die errechnete Zelle
(Reihe 6, Spalte 4), Karten-Drags landen auf dem markierten Feld.

**Zwei Fallen, die 3D unspielbar machten (7. August 2026, behoben):**

1. **R3F setzt auf seinem Container `pointer-events: auto`** und überstimmt
   damit das `none` der äußeren Hülle. Die 3D-Leinwand schluckte jeden Tipp
   aufs Brett: Das Haupthaus ließ sich nicht setzen, Halt und Abriss blieben
   tot. Karten-Drags liefen weiter — deren Horcher hängen am `window`, nicht
   am Canvas; genau deshalb sah es nach einem Teilausfall aus. Fix:
   `pointerEvents: 'none'` am `<Canvas>` UND in `onCreated` auf
   `gl.domElement`. Diese Ansicht braucht keine eigenen Zeigerereignisse —
   sie rechnet die Zelle aus dem Strahl und bedient den 2D-Pfad darunter.
   **Prüfregel:** Eingabe niemals mit `dispatchEvent` direkt auf `#cv`
   testen — das umgeht die Trefferprüfung. Immer erst
   `document.elementFromPoint()` fragen und auf DAS Element tippen.
2. **Die Brennweite gilt für die Höhe, nicht für die Breite.** Auf einem
   hochkanten Handy (375 × 656) zeigte Abstand 17 nur 7,5 Felder Breite —
   das Brett ist 8 breit, links und rechts fehlte je eine halbe Spalte. Der
   gewählte Abstand ist jetzt eine Untergrenze; die Kamera fährt so weit
   zurück, wie das Format verlangt (`KAMERA_RAND`).

**Overlays und Kampf in 3D (7. August 2026):** Lebensbalken (Billboard,
Farbe nach Restanteil, nur bei Schaden sichtbar; Mauerverbund zeigt auf
allen Stücken den Pool), **beide Aktionsringe wie in 2D** (`drawRing`):
innen der Marschring aus `mtimer/marschDauer` in Hellblau (Halt = voller
oranger Ring), außen der Schlagring aus `timer/schlagDauer` in Bernstein,
beide pulsen bei voller Bereitschaft. Anfangs gab es nur den Marschring in
Spielerfarbe — der wurde als Schlagring gelesen, und die Marschanzeige
fehlte gefühlt ganz. Dazu Ausfallschritt beim
Schlag aus `e.atk`/`adx`/`ady` (Kanone federt zurück) und die Spiegelung
der `G.fx`-Effekte: Schadenszahlen als Leinwand-Sprites, Ringe,
Explosionen, Leichen-Ausblenden. Das Lesefenster reicht dafür
`maxLeben`/`marschDauer`/`beweglich` durch — die Formeln bleiben im Kern.

**Gelände blockweise, Feldmarken, Stellungen (7. August 2026):**

* **Ein Vulkan ist EIN Berg**, kein Kegel je Feld: `BLOCKWEISE` (Vulkan,
  Krater, See) bekommt ein Modell über den ganzen Block, aus `cells`
  gemessen und auf die Blockmaße skaliert — so wird später auch das
  bestellte `vulkan.glb` eingesetzt. Wald und Gebirge bleiben feldweise;
  das sind Flächen aus vielen Einzelstücken, keine Einzelkörper. Der
  Geländestempel enthält die Typen, damit der Ausbruch (Vulkan → Krater)
  den Neubau auslöst.
* **Feldoverlays** (Bauplätze, Panikzone, Erdwärme, Reichweitengewinn,
  Abriss, Aufstellungsfelder): `drawMarks` ist in `markenListe()` +
  Zeichnen zerlegt. Welche Felder hervorgehoben gehören, ist eine
  **Regelfrage** und bleibt im Kern; 2D und 3D lesen dieselbe Liste
  (`lesen().feldMarken`). Ohne diese Trennung müsste die 3D-Bühne die
  Bauregeln nachbauen — der sichere Weg zu zwei Ansichten, die
  verschiedene Felder anbieten.
* **Stellungen sichtbar:** Steht eine Truppe (`halt` oder Turm), wird aus
  dem Marsch-Füllbogen ein **dickes volles Band in kräftigem Orange**, der
  Schlagring färbt wärmer mit, und darüber schwebt die Gruppenzahl
  **„n/max"** (dieselbe Zahl wie das Stellungsschild in 2D, über
  `lesen().stellungsStand`).

**Offen in Stufe 2:** Marsch-Interpolation über `restAnteil` und `e.mt`
statt Nachzieh-Glättung, Kanonenkugel-Flugbahn (der `ball`-Effekt trägt
2D-Pixelkoordinaten — braucht Brettkoordinaten im fx-Eintrag), Münzflug
in 3D, Bau-Vorschau in 3D färben (heute nur neutraler Marker),
`bogen-turm`/Mörser-Details, Sitz-0-Spiegelung im Netz gegenprüfen.

### Stufe 3 — Ausmustern

Erst wenn 3D vollständig ist: alten Renderer entfernen, Effekte nativ in 3D.

---

## Regeln, die der Umbau nicht brechen darf

1. **`zufall()` nur für Spielrelevantes, `deko()` für alles Sichtbare.** Der
   neue Renderer darf den Saatkorn-Zufall NIE anfassen.
2. **Keine transzendente Mathematik im Zustandspfad** (`sin/cos/pow/atan2/
   hypot` sind zwischen Engines nicht bitgenau; nur `sqrt` und
   Grundrechenarten sind exakt). Listen mischt `mische()`, niemals `sort`
   mit Zufalls-Vergleicher.
3. **Jede Spielerhandlung läuft durch eine Befehlsfunktion**, nie direkt in
   den Zustand — daran hängt die Netz-Umlenkung.
4. **Die Simulation kennt weder DOM noch Uhr noch Bildrate.** Sie bekommt
   `dt` gereicht und sonst nichts.
5. Das Gleichschritt-Protokoll (Wissensgrenze, Meldepuffer, schwebende Züge,
   Puls-Deckel, Polster, Prüfsummen) bleibt unangetastet, solange kein
   nachgewiesener Fehler vorliegt — jede Konstante dort hat eine Rechnung
   im Kommentar.

---

## Erster Befehl für die neue Sitzung

> Lies diese Datei, `docs/FELDHERR-UEBERGABE.md` und den Kopf von
> `packages/game-feldherr/quelle/teile/kopf.html`. Stufe 1 samt Feinschnitt
> ist umgesetzt, der Geometrie-Entscheid ist gefallen (8 × 12, Verhältnis
> 1,00 — Stand oben). Es folgt **Stufe 2**: Three/R3F-Renderer NEBEN den
> 2D-Canvas stellen (Vorbild `packages/client/src/screens/Runner.tsx`,
> Lehren in CLAUDE.md beachten), Simulationszustand je Bild lesen und
> zwischen den Takten interpolieren. Das Ritter-GLB liegt beim
> Auftraggeber; weitere Modelle nach Regel 5 bestellen, nicht beschreiben.
> Kleiner Restposten davor oder parallel: den Vulkanausbruch auf
> Wirkungs-Haken und `deko()` umstellen (siehe oben).
