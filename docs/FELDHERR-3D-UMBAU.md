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

### Stufe 2 — 3D-Renderer daneben, nicht darüber

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
> `packages/game-feldherr/quelle/feldherr.html`. Setze Stufe 1 um: Simulation
> als eigenes Modul ohne DOM, Standalone-Datei wird daraus gebaut,
> `gleichlauf-probe.mjs` liefert vor und nach dem Umbau dieselben
> Prüfsummen. Erst danach Stufe 2 beginnen.
