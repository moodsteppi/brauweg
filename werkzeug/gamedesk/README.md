# GameDesk

Ein Board zum Entwerfen von Spielen: eine unendliche Fläche, auf der modulare
Fenster liegen, die mit beschrifteten Pfeilen verbunden werden.

Läuft komplett lokal im Browser — kein Build, keine Abhängigkeiten, kein Internet.

## Starten

Doppelklick auf **`index.html`** genügt.

Alternativ mit dem mitgelieferten Server (identisches Verhalten, sauberere
Adresse, und er schaltet den Browser-Cache ab — beim Entwickeln sonst die
häufigste Fehlerquelle):

```bash
node gamedesk/tools/serve.mjs 5190
```

Dann `http://localhost:5190` öffnen. `GameDesk starten.bat` macht das in einem Schritt.

## Bedienung

### Board
| Aktion | Wirkung |
|---|---|
| Ziehen auf leerer Fläche | Board verschieben |
| Mittlere Maustaste / Leertaste + Ziehen | Board überall verschieben |
| Mausrad | Zoomen an der Mausposition |
| Umschalt + Ziehen | Auswahlrechteck |
| Rechtsklick | Kontextmenü (Modul einfügen, einpassen …) |
| Doppelklick auf leere Fläche | Neue Notiz |
| `Strg`+`0` / `Strg`+`1` | Zoom 100 % / alles einpassen |
| `Strg`+`F` | Springen zu … (suchen und hinfahren, s. u.) |
| `Strg`+`Umschalt`+`D` | Änderungssicht ein/aus |
| `Strg`+`Umschalt`+`A` | Änderungsfenster (Liste, Zusammenfassung, Commit) |

### Springen zu … — Wiederfinden statt Suchen

Auf einer Tafel mit hundert Kacheln ist nicht das Anlegen die Arbeit, sondern
das Wiederfinden. `Strg`+`F` (oder ⌕ in der Leiste) öffnet ein Feld über dem
Brett. Gesucht wird in **Titeln, Modulnamen, Rahmenuntertiteln, Notiztexten,
Quelltexten, Wireframe-Beschriftungen, Mediennamen und Pfeilbeschriftungen**.

| Taste | Wirkung |
|---|---|
| tippen | Alle Wörter müssen vorkommen, aber nicht am Stück: „regel karte" findet „Kartenregeln" |
| `Hoch` / `Runter` | Durch die Treffer blättern — **die Kamera fährt mit** |
| `Eingabe` | Dort bleiben |
| `Esc` | Zurück dorthin, wo man vor dem Suchen war |

Der Rückweg ist der eigentliche Punkt: Wer sucht, will meist nachsehen, nicht
umziehen. Ohne ihn traut man sich nicht, mitten in der Arbeit zu suchen.

Beim Tippen wartet der Flug einen Wimpernschlag ab — sonst führe die Kamera bei
„k", „ka", „kar" dreimal quer über die Tafel. Beim Blättern fliegt sie sofort:
Da ist es die Absicht. Ein Treffer im Titel wiegt schwerer als einer im
Fließtext, sonst schwemmen lange Notizen das Gesuchte weg.

### Fenster
Verschieben an der Titelleiste, Größe an allen acht Rändern. Beim Verschieben
rasten Kanten und Mittelachsen an den anderen Fenstern ein (pinke Hilfslinien);
`Alt` schaltet das Einrasten kurz aus. **Ein Klick auf den Titel** benennt um —
Ziehen an derselben Stelle verschiebt weiter, entschieden wird beim Loslassen.
Doppelklick auf die freie Leiste klappt ein.

Ein Rahmen wandert samt seiner Kacheln nach vorn bzw. nach hinten; verdecken
kann er sie nie, er liegt in einem eigenen, tieferen Stapelband.

`Strg`+`Pfeiltasten` ändert die Größe der Auswahl um einen Pixel (mit
`Umschalt` um ein Rastermaß). Das ist der einzige Weg, der bei **jedem** Zoom
auf den Pixel genau arbeitet — ein Griff ist herausgezoomt immer ein
Kompromiss, eine Taste nie.

### Weit herausgezoomt — Eckgriff und leuchtende Ränder
Alles, was man mit der Maus trifft, liegt im Weltraum und schrumpft mit dem
Zoom. Bei 20 % war die Titelleiste zwei Pixel hoch, der Randgriff anderthalb —
Anfassen wurde zum Zielschießen, und ein Rahmen mit zwanzig Kacheln ließ sich
praktisch nicht mehr bewegen. Drei Dinge halten dagegen:

- **Griffe und Anschlussknöpfe behalten ihre Bildschirmgröße.** `windows.js`
  rechnet je Kachel ein `--griff` und ein `--port` aus, das gegen den Zoom
  gerechnet ist — gedeckelt an der Kachelgröße, damit eine kleine Kachel nicht
  nur noch aus Griffen besteht.
- **Der Eckgriff.** Unter 55 % Zoom öffnet sich oben rechts in jeder Kachel ein
  Viertelkreis, dessen Mittelpunkt genau auf der Ecke sitzt. Er liegt fast
  durchsichtig da und tritt hervor, sobald die Maus in seine Nähe kommt;
  Ziehen verschiebt die Kachel — bei einem Rahmen samt Inhalt. Er verschiebt
  **nur**: Zwei Bedienteile auf einem Viertelkreis standen sich gegenseitig im
  Weg. Griffe kleiner Kacheln liegen über denen großer Rahmen, weil die
  kleinen die schwerer zu treffenden sind.
- **Leuchtende Ränder.** Kommt der Zeiger einer Kachel nahe, wird ihre Kante
  weiß und dicker — immer nur bei **einer** Kachel, sonst flimmerte bei
  kleinem Maßstab das halbe Brett.

Eingerastet wird nur an dem, was auf dem Bildschirm steht. Vorher zählte jede
Kachel der Tafel: Bei siebzig lag immer irgendeine Kante im Fangbereich, auch
die einer Kachel zehn Bildschirme weiter — die Hilfslinie zeigte dann auf
nichts. Eine einmal gefangene Kante hält außerdem 1,85-mal so weit, wie sie
gefangen hat; ohne diese Haftung zittert eine Kachel am Rand des Fangbereichs
zwischen eingerastet und frei.

### Pfeile
Beim Überfahren eines Fensters erscheinen vier Anschlussknöpfe — ein Kreis mit
einem Plus darin. Es gibt **zwei Wege** von dort zum Pfeil:

- **Ziehen:** Knopf drücken, auf das Zielfenster ziehen, loslassen.
- **Klicken:** Knopf antippen und loslassen — der Pfeil hängt am Zeiger, der
  nächste Klick setzt ihn ab. `Esc` bricht ab. Für lange Wege, für Trackpads
  und für alle, denen Ziehen über weite Strecken schwerfällt.

Welcher Weg gemeint war, entscheidet sich am Ende von selbst: ohne Bewegung
war es ein Klick. Doppelklick auf den Pfeil oder auf seine Beschriftung öffnet
die Texteingabe; die Beschriftung lässt sich am Pfeil entlangziehen.

**Pfeile laufen im rechten Winkel.** Sie verlassen ihre Kante senkrecht, biegen
höchstens zweimal ab und treffen die Gegenkante wieder senkrecht — so ist auf
einen Blick zu sehen, wo ein Pfeil ansetzt und wo er ankommt. Hängt sein Anfang
an einer einzelnen Wireframe-Form, sitzt dort ein farbiger Punkt.

**Die Beschriftung hat eine feste Pixelgröße** und bleibt beim Zoomen exakt gleich
groß. Von allein stellt sie sich auf das längste gerade Stück, das **neben** den
Kacheln verläuft und breit genug für sie ist; erst wer sie anfasst, legt eine
eigene Stelle fest (im Inspector wieder frei stellbar). Die Größe wird pro Pfeil
im Inspector rechts eingestellt (6–42 px), ebenso Farbe, Stärke, Linienstil
(durchgezogen/gestrichelt/gepunktet), Verlauf (rechtwinklig/gerade/geschwungen),
Pfeilspitzen und die Ankerpunkte. Unter etwa 30 % Zoom blenden sie aus — sie
behalten ihre Pixelgröße, der Abstand zwischen den Pfeilen aber nicht, und sonst
liegt alles übereinander.

> Damit eine Beschriftung im Freien Platz findet, brauchen verdrahtete Spalten
> eine **Gasse**: rund 460 Welteinheiten reichen für eine Zeile bei 32 % Zoom.
> Kacheln direkt nebeneinander bekommen ihre Pfeilbeschriftung nie unter.

Pfeile liegen **über** den Fenstern. Ein Rahmen darf seinen Inhalt nie
verdecken, ein Pfeil schon — er soll die Verbindung zeigen, nicht dahinter
verschwinden. Getroffen wird trotzdem nur der Strich selbst.

### Bündel — was denselben Weg nimmt, läuft als Strang

Mehrere Pfeile lassen sich zu einem **Bündel** zusammenfassen. Ihre Enden
bleiben, wo sie sind; in der Mitte laufen sie durch einen gemeinsamen Kanal —
nebeneinander, quer darüber in Abständen ein **Wickel**, wie Kabel, die man
zusammenbindet.

| Zustand | Was man sieht | Wozu |
|---|---|---|
| **aufgezogen** | die Adern nebeneinander, Wickel darüber | jede einzelne Ader ist zu verfolgen |
| **zugezogen** | eine Leitung mit kräftigem Mantel und einer Zahl | fünf lange Pfeile kreuzen nicht mehr das halbe Board |

Bedienung: **Doppelklick** auf einen Wickel oder auf die Sprechblase klappt
auf und zu — die Adern fahren dabei auseinander, sie springen nicht.
**Ziehen** an der Sprechblase legt den Strang an eine andere Stelle. Im
Inspector stehen Name, Farbe, **Dicke**, Aderabstand und Stranglänge; einzelne
Adern lassen sich dort aus dem Bündel lösen. Ein Pfeil kommt über
*Verbindung → Bündel* hinein.

Aufgelöst wird über *Bündel auflösen* — die Pfeile bleiben, sie laufen danach
wieder einzeln.

### Pfeile an einzelnen Wireframe-Elementen
Ein Pfeil muss nicht am ganzen Fenster hängen. Wird eine Form im Wireframe
ausgewählt, erscheint rechts daneben ein **blauer Punkt**; von dort lässt sich
ein Pfeil an genau diesem Element aufziehen. Beim Ablegen zählt ebenso das
einzelne Element: Die Zielform leuchtet grün auf.

Damit lassen sich Knopfwirkungen abbilden — „Online spielen" → Netz-Tisch,
„HALT" → welche Nachricht das auslöst. Der Pfeil wandert mit, wenn die Form
verschoben, skaliert oder gedreht wird. Wird sie gelöscht oder das Fenster
eingeklappt, fällt der Pfeil sauber auf den Fensterrand zurück. Im Inspector
steht, an welchem Element ein Ende hängt, samt Knopf zum Lösen.

## Anordnen — das Board aufräumen lassen

Der Knopf **„⤡ Anordnen"** in der Werkzeugleiste setzt fünf Regeln durch. Sind
mehrere Fenster ausgewählt, gilt er nur für diese, sonst für das ganze Board.

| Regel | Was passiert |
|---|---|
| 1 · Text vollständig sichtbar | Die Höhe von Notiz- und Quelltext-Fenstern wird **gemessen**, nicht geschätzt: der Inhalt wird versteckt außerhalb des Boards gerendert, sein `scrollHeight` ist die Antwort |
| 2 · keine Überlappungen | Kollidierende Kacheln weichen nach unten aus — nur nach unten, damit die Leserichtung bleibt und das Verfahren sicher endet. Rahmen zählen nicht mit |
| 3 · Rahmen sitzen am Inhalt | Jeder Rahmen legt sich um das, was in ihm liegt: 44 px Luft ringsum, oben zusätzlich das **Kopfband** |
| 4 · Bereiche benannt | Jeder Rahmen gehört zu einem Bereich aus einer festen Taxonomie |
| 5 · Überschriften frei | Im Kopfband eines Rahmens liegt nichts. Was hineinragt, wandert nach unten |

Das Kopfband ist keine geschätzte Zahl: `modules/frame.js` **misst** Titelleiste,
Wasserzeichen und Untertitel und meldet die Höhe an `GD.layout` (`kopfHoehe()`).
Die Vorgaben für den ungezeichneten Fall stehen als `--fr-kopf` und
`--fr-kopf-note` in `css/app.css` — wer die Schriftgrößen des Rahmenkopfs
ändert, ändert sie dort mit.

### Die Überschrift eines Rahmens

Sie liegt **über** den Kacheln, in einer eigenen Ebene (`#frame-layer`), die
`windows.js` an der Fenstergeometrie führt — der Rahmen selbst bleibt im
unteren Stapelband und verdeckt weiter nichts.

**Sie wächst gegen den Zoom.** Weit draußen bliebe sie sonst ein Pixelklecks,
und man wüsste nicht mehr, welcher Bereich unter einem liegt; sie hält
deshalb rund 20 Bildpunkte Bildschirmgröße, bis zum Vierzehnfachen. Beim
Hineinzoomen wächst sie **nie über ihre Grundgröße** — dann sitzt sie wieder
sauber im Kopfband und überlappt nichts. Vergrößert wird über `transform:
scale()`, nicht über die Schriftgröße: Das rechnet kein Layout neu, und die
Messung des Kopfbands bleibt vom Maßstab unabhängig.

Zwei Feinheiten für die Lesbarkeit: Vergrößert bekommt der Titel eine eigene
Platte und der Untertitel entfällt, und Rahmen unter 130 Bildpunkten Breite
lassen ihre Überschrift ganz weg — zwanzig Schilder übereinander sind
unlesbarer als keines.

**Verschieben:** Die Überschrift lässt sich anfassen und im Rahmen woanders
hinlegen (`kopfX`/`kopfY` im Zustand). Bei breiten Bereichen steht sie sonst
weit weg vom Inhalt. Das Kopfband, das die Anordnung freihält, wandert nicht
mit.

Unter **⚙ Einstellungen → Anordnung** steht, was die fünf Regeln gerade
bemängeln, mit einem „zeigen"-Knopf, der zur betroffenen Stelle springt.

Die Bereiche — Gamedesign, Menüs, Game, Charaktere, Mechanik, Technik, Daten,
Betrieb, Medien, Sonstiges — haben je eine Farbe und eine Ordnungszahl. Gewählt
wird der Bereich im Inspector eines Rahmens; die Ordnungszahl bestimmt, in
welcher Folge `GD.layout.bereich()` neue Bereiche untereinanderlegt. Die Liste
steht in `js/core/layout.js` und lässt sich mit `GD.layout.merkeBereich()`
erweitern.

```js
GD.layout.BEREICHE                      // [{ id, label, tint, ordnung }]
GD.layout.textHoehe(html, breite, size) // gemessene Höhe
GD.layout.passeHoehenAn(ids)            // Höhen an den Inhalt
GD.layout.entwirre(ids)                 // Überlappungen auflösen
GD.layout.rahmenNachziehen()            // alle Rahmen anpassen
GD.layout.pruefe()                      // Bericht: was verletzt die Regeln
GD.layout.aufraeumen(ids)               // alles zusammen, ein Historieneintrag
GD.layout.bereich(id, titel, kacheln)   // Raster + Rahmen anlegen
```

Ein Modul kann seine gewünschte Höhe selbst angeben — `inhaltsHoehe(breite)`
liefert die Höhe, bei der sein Inhalt vollständig steht. Ohne diese Auskunft
schaut das Layout auf den Überlauf des mit `data-gd-scroll` ausgezeichneten
Bereichs; damit kann es ein Fenster nur vergrößern, nicht verkleinern.

## Änderungen — Commits und die Änderungssicht

Neben dem Rückgängig-Stapel führt jede Tafel einen zweiten, gröberen Verlauf:
**Commits**. Ein Commit ist ein festgeschriebener Stand. Alles, was danach
passiert, ist *offen* — und offen heißt sichtbar.

Zwei Bedienstellen, beide in der Werkzeugleiste:

| | |
|---|---|
| **⬚** (Strg+Umschalt+D) | Änderungssicht ein/aus |
| **Änderungen** *n* (Strg+Umschalt+A) | Das Änderungsfenster; die Zahl zählt das Offene |

### Die Änderungssicht

Jede geänderte Kachel bekommt einen **roten Kasten mit beschriftetem Reiter** —
Klasse und Titel, wie bei einer Objekterkennung. Alles Unveränderte tritt
zurück. Ein Klick auf den Reiter springt zur Kachel.

Eine Kachel bekommt **höchstens einen** Kasten, auch wenn an ihr mehreres
gleichzeitig anders ist; beschriftet wird die wichtigste Klasse, der Rest steht
als `+n` daneben und vollständig im Änderungsfenster.

| Klasse | Wofür |
|---|---|
| Neu | Kachel gibt es seit dem letzten Commit |
| Entfernt | Kachel ist weg — der Kasten steht gestrichelt an ihrem alten Platz |
| Inhalt | Der Zustand des Moduls ist ein anderer (mit Angabe, um wie viel er wuchs) |
| Titel | Umbenannt, alt → neu |
| Größe / Verschoben | Geometrie |
| Darstellung | Farbe, ein-/ausgeklappt |
| Pfeil | Pfeil oder Bündel neu, weg oder anders — Marke in der Mitte zwischen beiden Enden |
| 3D-Modell / Tafel | Modell geändert, Tafel umbenannt, Rastermaß |

Nicht verfolgt werden Kamera, Stapelhöhe (`z`) und die Anzeigeschalter des
Rasters. Das wäre Rauschen: Jeder Klick hebt ein Fenster nach vorn.

### Das Änderungsfenster

Zählt auf, was offen ist, fasst es in einem Satz zusammen — und ist die
Stelle, an der ein Commit entsteht: Titel, Beschreibung, **Urheber**
(Mensch oder KI). Darunter steht der Commit-Verlauf; jeder Eintrag lässt sich
aufklappen und zeigt die Liste, die zu ihm geführt hat.

Aus einem Skript heraus geht dasselbe:

```js
GD.aenderungen.stand()                                  // { punkte, zahlen, satz }
GD.aenderungen.festschreiben({ titel: '…', wer: 'ki' }) // Commit setzen
GD.aenderungen.sichtSetzen(true)                        // Änderungssicht an
```

Und ohne Browser — für Umbauskripte in `boards/`, die eine Tafel von außen
verändern:

```
node tools/festschreiben.mjs boards/feldherr-funktionsweise.gamedesk.json --zeigen
node tools/festschreiben.mjs boards/… --titel "Abschnitte umgebaut" --wer ki
```

### Was in der Datei landet

Gespeichert wird kein zweites Dokument, sondern ein **Abzug**: je Kachel Lage,
Größe, Titel und eine Prüfsumme des Inhalts, rund 200 Byte — für eine Tafel mit
40 Kacheln etwa 8 KB. Vollständig gehalten wird nur der Abzug des jüngsten
Commits; ältere Commits behalten ihre fertige Änderungsliste. Damit lässt sich
„was ist seither passiert" und „was steckte in Commit X" beantworten, aber
nicht „zeig mir alles seit vorletzter Woche".

Tafeln ohne diesen Block (alle bisherigen) stehen auf *noch nichts
festgeschrieben*; bis zum ersten Commit gilt alles als unverändert.

## Projekte — der Bibliotheksordner

GameDesk kann einen Ordner auf der Platte als **Projektliste** führen: welche
Tafeln es gibt, wann sie zuletzt geändert wurden und was darin steckt. Der
Ordner wird unter **⚙ Einstellungen → Projektordner** festgelegt, die Liste
steht unter **🗀 Projekte** (`Strg`+`P`).

Dort: öffnen, umbenennen, kopieren, löschen, neues Projekt anlegen und „aktuelles
Board hier ablegen". Ein geöffnetes Projekt bleibt mit seiner Datei **verknüpft** —
der Speichern-Knopf trägt dann einen grünen Punkt und schreibt direkt dorthin.

Zwei Wege zum Ordner, je nachdem wie GameDesk läuft:

| Zugriff | Wann | Eigenschaften |
|---|---|---|
| **GameDesk-Server** | Start über `GameDesk starten.bat` bzw. `tools/serve.mjs` | Pfad wird frei eingetippt, in `tools/bibliothek.json` gemerkt und gilt beim nächsten Start wieder — ohne Nachfrage |
| **Ordnerdialog des Browsers** | Chrome oder Edge über http/https | Echter Ordnerdialog, der Ordner darf überall liegen. Wird gemerkt; nach einem Browser-Neustart fragt Chrome einmal nach der Erlaubnis |

Beim Aufruf über `file://` steht keiner von beiden zur Verfügung — dann bleibt
der Weg über „Öffnen…" und „Speichern" als Datei.

**Sicherheit:** Der Server lauscht nur auf `127.0.0.1`. Der Ordner wird einmal
gesetzt; alle Datei-Aufrufe nennen danach nur noch Namen **innerhalb** dieses
Ordners. Pfade mit `..`, Laufwerksbuchstaben oder Wildcards werden abgewiesen —
geprüft mit `../../x.json`, `..\..\x.json` und `C:\Windows\x.json`.

### Speichern
Das Board wird laufend im Browser gespeichert (`localStorage`). Der fasst pro
Herkunft rund **5 MB** — Bilder, Ton und Video liegen deshalb nicht im Board,
sondern im Medienlager (siehe unten). **„Speichern" (`Strg`+`S`)** schreibt in
die verknüpfte Projektdatei; ist keine verknüpft,
legt es sie im Bibliotheksordner an; gibt es keinen, lädt es eine
`.gamedesk.json` herunter. „Öffnen" (`Strg`+`O`) lädt eine Datei von außen; eine
`.json` lässt sich auch einfach auf das Board ziehen.

In den Einstellungen lässt sich **„Automatisch in die Datei"** einschalten: Dann
landet jede Änderung wenige Sekunden später auch in der Projektdatei. Standard
ist aus — Schreiben auf die Platte soll nicht bei jedem Mausziehen passieren.

## Mitgelieferte Tafeln

Unter `boards/` liegen zwei fertige Tafeln, die mit „Öffnen…" geladen werden:

| Datei | Inhalt |
|---|---|
| `feldherr-funktionsweise.gamedesk.json` | Das Echtzeitspiel **Feldherr** aus dem Brauweg-Repo, in **acht Themenflächen**: Ziel des Spieles · Visual Inspiration and Vision Board · Map & Umwelt Design · Charaktere Fähigkeiten und Karten · Menüstruktur & Design · Visual Design Game · Funcional Deep Dive Card Mechanics · Technische Umsetzung. Die Flächen liegen zweidimensional nebeneinander und laufen unten alle in die Technik — 109 Fenster, 30 Rahmen, 40 Pfeile, 8 3D-Modelle |
| `brauweg-funktionsweise.gamedesk.json` | Die **ganze Plattform** Brauweg: Client, Server, Spielmodule, Daten, Betrieb, Grundsätze, der Weg einer Aktion und die bekannten Widersprüche — mit einer Projekt-Kachel, die nach Feldherr führt. Zugleich die **Visual-Building-Tafel** des Repos, siehe `docs/TAFEL.md` |

> **Bei `feldherr-funktionsweise.gamedesk.json` ist die JSON-Datei die
> Quelle**, nicht `boards/_erzeuger-feldherr.mjs`. Sie ist seit ihrer
> Erzeugung von Hand weitergewachsen; ein Erzeuger-Lauf würde alles Spätere
> überschreiben. Umbauten laufen dort als Skript **auf** der JSON — Vorbild:
> `boards/_umbau-feldherr-struktur.mjs`. Die 3D-Modelle der Umweltblöcke legt
> `boards/_umweltbloecke-modelle.mjs` an.
>
> **Für `brauweg-funktionsweise.gamedesk.json` gilt seit dem 05.09.2026 das
> Gegenteil: der Erzeuger ist die Quelle** (`boards/_erzeuger-brauweg.mjs`).
> Grund ist ihre zweite Aufgabe — sie ist die Tafel, die der Orchestrator
> jedem Auftrag mitgibt, und muss deshalb dem Code hinterherwachsen. Von Hand
> lässt sich das nicht durchhalten: Am 05.09. nannte sie noch drei spielbare
> Spiele — es waren zehn. Von Hand hinzugefügt war bis dahin genau eine Kachel, die
> Projekt-Vorschau auf Feldherr; der Erzeuger baut sie jetzt selbst aus der
> Nachbardatei. Das Änderungsdatum darin kommt aus dem letzten Commit der
> Nachbardatei (`git log -1 --format=%ct`), nicht aus ihrer Dateizeit: Die
> setzen Klonen und Auschecken auf jedem Rechner neu, und die eingecheckte
> Tafel galt dadurch überall als geändert. Wer im Editor etwas ergänzt, trägt
> es in den Erzeuger nach — sonst ist es beim nächsten Lauf weg.

Das Muster einer Themenfläche, an dem sich weitere orientieren:

| Ebene | Farbe | Beispiel |
|---|---|---|
| Fläche | eigene Farbe, eigener Bereich | `Charaktere Fähigkeiten und Karten` |
| Gruppe darin | neutral grau | `Engineer`, `Alle anderen Karten` |
| Baustein | neutral grau | `Schwert` — darin 2D aus dem Spiel, 3D-Modell, Werte |

Zwei Regeln halten das lesbar: Verschachtelte Rahmen sind **immer** neutral
(`#94a3b8`) und erben den Bereich ihrer Fläche, und ein Rahmen ohne Untertitel
bekommt ein flacheres Kopfband als einer mit.

## Module

### Rahmen — Bereiche gruppieren
Ein großer, getönter Bereich hinter den Fenstern, mit Titel und Untertitel. Er
**fängt keine Mausklicks**: Über seiner Fläche bleibt das Board verschieb- und
aufziehbar. Angefasst wird er an der Titelleiste — dabei wandern alle Fenster
mit, die vollständig in ihm liegen. „Um den Inhalt legen" passt ihn an das an,
was gerade darin steht.

### Quelltext — Codeausschnitt mit Herkunft
Zum Dokumentieren, nicht zum Ausführen (dafür gibt es die Sandbox). Zeigt den
Dateipfad, Zeilennummern ab einer wählbaren Startzeile und hebt einzelne Zeilen
hervor. Leichte Einfärbung für Kommentare, Zeichenketten, Schlüsselwörter und
Zahlen; Knöpfe zum Kopieren von Code und Pfad, Stift zum Bearbeiten.

### Wireframe — Seitenlayouts skizzieren
Werkzeuge: Auswahl (`V`), Rechteck (`R`), Ellipse (`O`), Linie (`L`), Text (`T`),
Bild (`I`).

- **Form**: Eckenradius, Füllung als Farbe oder 2-Stopp-Verlauf mit Winkel,
  Kontur mit Stärke und Strichart
- **Effekte**: Deckkraft, Schlagschatten (Versatz, Weichheit, Farbe, Deckkraft),
  Weichzeichner
- **Text in Objekten**: Doppelklick auf ein Objekt. Größe, Schriftart, Stärke,
  kursiv/unterstrichen, Farbe, horizontale und vertikale Ausrichtung,
  Zeilenhöhe, Innenabstand, automatischer Zeilenumbruch, „Höhe an Text anpassen"
- **Bilder**: über das Bild-Werkzeug einfügen, Zuschnitt einpassen/füllend/verzerrt
- **Führungslinien**: aus dem Lineal oben oder links herausziehen. Objekte rasten
  an Führungslinien, Artboard-Kanten, Artboard-Mitte, an Kanten und Mitten
  anderer Objekte und am Raster ein (pinke Hilfslinie zeigt an, woran)
- **Bausteine**: fertige Button-, Eingabefeld-, Karten-, Kopfzeilen-,
  Listen- und Textblöcke aus dem Aufklappmenü
- **Ausrichten/Verteilen** bei Mehrfachauswahl, Ebenen (`[` / `]`), Sperren,
  Drehen (Griff über dem Objekt, `Umschalt` rastet auf 15°)
- **Export**: SVG (verlustfrei) und PNG @2x

Artboard-Formate: A4 quer, Desktop 1280, Full HD, Tablet, Handy, Quadrat oder frei.

### Notiz — Text im Notizstil
Überschriften H1–H3, Fließtext, Zitat, Code, Aufzählung, nummerierte Liste,
Aufgabenliste zum Abhaken, fett/kursiv/unterstrichen/durchgestrichen,
Textfarbe, Markierung, Ausrichtung, Links. Grundschriftgröße pro Fenster
einstellbar; Export als Textdatei.

### 3D-Modell — Formen bauen, beleuchten, speichern
Grundkörper: Würfel, Quader, Ebene, Dreieck (Prisma), Pyramide, Zylinder, Kegel,
Kugel, Torus. Jede Form hat Position, Drehung und **Größe pro Achse** sowie
Formparameter:

- **Kanten rund** — echte Verrundung, nicht nur ein Shading-Trick: beim Quader
  laufen alle zwölf Kanten und acht Ecken rund, beim Zylinder die Ränder, beim
  Kegel und der Pyramide zusätzlich die Spitze. „Feinheit" steuert, wie glatt.
- **Segmente / Ringe / Dicke** für runde Körper
- **Material**: Farbe, Rauheit, Metallisch, Deckkraft
- **Leuchten**: Eigenfarbe + Stärke (selbstleuchtendes Material)
- **Licht-Objekte** mit Farbe, Stärke und Reichweite

#### Sonne

Die Sonne ist ein eigenes, anfassbares Objekt: der Stern im Bild lässt sich
ziehen, ebenso steht sie in der Objektliste (oder mit `L` auswählen). Ohne
Zusatztaste läuft sie auf einer **Kugelbahn** um den Nullpunkt — der Abstand
bleibt, Richtung und Höhe ändern sich. `Strg`, `Alt` und `Strg`+`Alt` sperren
wie überall auf eine Achse, `Umschalt` schaltet das Einrasten aus.

Im Inspector gibt es dieselbe Position zusätzlich als **Richtung / Höhe /
Abstand** in Grad, dazu Farbe, Stärke, Schatten an/aus und Schattenhärte. Die
Sonne scheint immer zum Nullpunkt; ihre Position legt also die Einstrahlung
fest. Ambiente, Bodenfarbe und Rasterweite stehen weiter unter „Licht &
Umgebung".

#### Texturen

Bild laden oder eingebautes Muster nehmen (Kachel, Raster, Streifen, Rauschen,
Ziegel, Punkte). Danach entscheidet die **Projektion**, wie das Bild aufs Objekt
kommt:

| Modus | Wirkung |
|---|---|
| **Netz-UV** | folgt der Netzkoordinate der Form. Wiederholung in U und V, Schnellwahl 1× / 2× / 4× / 8×, dazu Drehung in Grad. |
| **Box (dreiachsig)** | projiziert von drei Achsen und blendet nach Flächenneigung. **Kachelgröße als Weltmaß** — die Kachel bleibt quadratisch, egal wie die Form gestreckt wird. Der richtige Modus für sich wiederholende Muster. |
| **Ebene von oben** | eine Projektion von oben, gut für Böden und Landschaften. |

Dazu Versatz in U und V sowie eine Deckkraft, die die Textur mit der Grundfarbe
mischt. Muster aus der Palette schalten gleich auf „Box" mit 0,5 Einheiten
Kachelgröße.

Der Unterschied in Zahlen: auf einem 2,2-fach gestreckten Quader misst eine
Kachel bei Netz-UV 30 × 6 px (Verhältnis 5:1, sichtbar verzerrt), bei der
Box-Projektion 2,9 × 2,9 px — also exakt quadratisch.

**Maus und Tasten**

| Eingabe | Wirkung |
|---|---|
| Ziehen auf leerer Fläche | Kamera um die Szene drehen |
| Mittlere / rechte Taste | Kamera schwenken |
| Mausrad | Abstand (Fenster muss ausgewählt sein) |
| Objekt ziehen | Bewegen in der Bodenebene (XZ) |
| Sonne ziehen | Kugelbahn um den Nullpunkt (`L` wählt sie aus) |
| `Strg` | nur Y-Achse (hoch/runter) |
| `Alt` | nur X-Achse |
| `Strg`+`Alt` | nur Z-Achse |
| `Umschalt` | Einrasten aus |
| `G` / `R` / `S` | Bewegen / Drehen / Skalieren |
| `F` | alles einpassen |

Das Einrasten hat einen eigenen Abstand (Standard 0,25), dazu Winkelschritt für
Drehungen und Schrittweite fürs Skalieren — alles im Inspector einstellbar.
Gesperrte Achsen bleiben beim Einrasten exakt stehen.

**Modell speichern.** „Als Modell speichern" legt die Szene in der
Modell-Bibliothek des Boards ab. Von dort aus:

- als **3D-Ansicht** aufs Board legen (Kachel),
- in einem **anderen 3D-Fenster als eine Form einfügen** — der Verweis lässt
  sich als Ganzes bewegen, drehen und skalieren; Änderungen am Original wirken
  überall,
- aus der **Code-Sandbox** auslesen (siehe unten).

### 3D-Ansicht — Modell als Kachel
Zeigt ein gespeichertes Modell. Ziehen dreht es, Mausrad ändert den Abstand, der
Schalter oben rechts (oder der Inspector) schaltet eine langsame Kamerafahrt um
das Objekt ein und aus; das Tempo ist einstellbar. Doppelklick öffnet das Modell
zum Bearbeiten. Die Auflösung lässt sich für viele Kacheln auf „normal" lassen.

### Bild / Video / Ton — Referenzen, Moodboard, Audio
Dateien hineinziehen, einfügen (`Strg`+`V`) oder aus einer Adresse laden.
Mehrere Medien pro Fenster mit Vorschaustreifen und Bildunterschrift.

- **Bild**: Darstellung einpassen/füllend/verzerrt/Original, Hintergrundfarbe
- **Video**: Bedienelemente, Schleife, Stumm, Autostart, Lautstärke
- **Audio (mp3, wav, ogg, m4a, flac)**: die **Wellenform ist der Inhalt der
  Kachel** und nimmt allen Platz, den Name und Bedienleiste übriglassen.
  Klicken springt an die Stelle, Play/Pause, Zeitanzeige, Schleife und
  Lautstärke; `Leertaste` startet und stoppt, wenn das Fenster ausgewählt ist.
  Auch die **Vorschauleiste** zeigt bei Tondateien die Wellenform statt einer
  Note — mehrere Aufnahmen nebeneinander sind so zu unterscheiden

  Die Spitzenwerte werden einmal je Datei aus dem dekodierten Ton gerechnet
  (220 Stützstellen, im Arbeitsspeicher gehalten, nicht im Board). Solange das
  läuft, steht eine blasse Platzhalter-Welle da; geht es nicht — fremde Adresse
  ohne CORS, unbekanntes Format —, **sagt die Kachel das hin** („Wellenform
  nicht lesbar") statt eine leere Linie zu zeigen.

  Die eingebaute Abspielleiste des Browsers steht bewusst nicht daneben: Zwei
  Leisten übereinander haben die Wellenform plattgedrückt. „Volle Leiste"
  ergänzt Schleife und Lautstärke, ohne sie bleiben Knopf und Zeit.

Die Bytes einer Datei liegen im **Medienlager** (`js/core/depot.js`), nicht im
Board: Dort steht nur `depot:<Kennung>`. Beim Speichern in eine Datei werden sie
wieder ausgeschrieben, eine exportierte `.json` bleibt also vollständig. Grenze
64 MB pro Datei.

### Projekt — eine andere Tafel als Kachel

Zeigt, **dass** es ein zweites Projekt gibt, ohne dessen Innenleben auf dieser
Tafel auszubreiten: Name, Dateiname, Anzahl Fenster/Pfeile/Modelle, die
Modul-Aufteilung, das Änderungsdatum und eine kleine Vorschau, die die Fenster
der anderen Tafel als Rechtecke zeichnet — Rahmen blass im Hintergrund, Kacheln
in der Farbe ihres Moduls.

Die Datei wird im Inspector aus dem Bibliotheksordner gewählt; „Auffrischen"
liest sie neu ein. Alles Angezeigte liegt im Zustand der Kachel, damit auch
ohne Ordnerzugriff etwas dasteht — über `file://` etwa oder wenn die Tafel
weitergegeben wurde.

**„Öffnen"** (oder Doppelklick auf die Vorschau) geht in die andere Tafel
hinein. In der Werkzeugleiste erscheint dann **„← Zurück"** und führt wieder
heraus; das geht mehrere Ebenen tief. Vor jedem Wechsel wird die aktuelle Tafel
in ihre eigene Datei geschrieben — sonst stünde beim Zurückkommen der Stand von
zuletzt gespeichert da.

In `brauweg-funktionsweise.gamedesk.json` sitzt so eine Kachel im Bereich
*Spielmodule* und führt nach Feldherr.

### Code-Sandbox — kleine Features vorführen
HTML-, CSS- und JS-Tab, Vorschau daneben (Trennlinie verschiebbar), Konsole
darunter. `Strg`+`Enter` oder „Ausführen"; optional automatischer Neustart beim
Tippen. Vorlagen: Minimal, Canvas-Animation, UI-Interaktion. Export als
eigenständige `.html`.

Der Code läuft in einem `sandbox="allow-scripts"`-iframe ohne Zugriff auf das
Board. `console.log/warn/error`, Laufzeitfehler und abgelehnte Promises werden in
die Konsole gespiegelt.

**Zugriff auf die 3D-Modelle.** Im Sandbox-Code steht `GameDesk` bereit:

```js
GameDesk.models                  // [{ id, name, updated, nodes: [...] }]
GameDesk.getModel('Turm')        // Beschreibung: Formen, Transformationen, Material
await GameDesk.geometry('Turm')  // fertiges Netz, siehe unten
```

`geometry()` liefert ein Promise auf das gebackene Modell — alle Formen zu
einem Netz zusammengefasst, in Modellkoordinaten:

```js
{
  id, name,
  position: Float32Array,   // x,y,z je Ecke
  normal:   Float32Array,
  uv:       Float32Array,
  index:    Uint32Array,    // Dreiecke
  groups:   [{ start, count, name, shape, color, opacity, emissive, emissiveStrength }],
  lights:   [{ pos, color, intensity, range }],
  vertices, triangles
}
```

Die Vorlage „3D-Modell verwenden" zeichnet damit ein rotierendes Modell auf ein
2D-Canvas. Texturbilder werden aus Größengründen nicht mit übergeben (nur
`material.hasTexture`).

### Worker — Schnittstelle zum Worker-Modul im Broweg

Der bro-server aus dem Broweg-Projekt verteilt Aufgaben an **Worker-PCs**: Jeder
Worker hängt per WebSocket am Gateway (`/worker`), meldet Herzschläge und nimmt
Aufträge entgegen; Ergebnis, Verbrauch und Commit-Hash laufen zurück
(`bro-server/src/lib/worker-gateway.ts`).

Die Kachel ist die Gegenstelle auf der Tafel. Sie zeigt je Worker Zustand
(online · arbeitet · offline · Kontingent aufgebraucht), Fähigkeiten, erledigte
Aufgaben, verbrauchte Token und den letzten Herzschlag — darunter die letzten
Aufgaben mit Status, Repo und Commit. Über den Inspector lässt sich ein Worker
anlegen (der Klartext-Token erscheint **genau einmal**) oder widerrufen, und
„Aufgabe geben…" legt eine Aufgabe an, die der Server sofort einem freien
Worker zuteilt.

Der Weg dorthin läuft über den GameDesk-Server, nicht direkt:

```
Kachel ──► GameDesk-Server ──► bro-server
        api/broweg/ruf      /workers, /tasks
```

Direkt ginge es nicht — der bro-server schickt keine CORS-Köpfe und hängt seine
Sitzung an ein Cookie, das ein fremder Ursprung nicht mitschicken darf. Über die
Brücke ist alles dieselbe Herkunft. Dabei gilt:

* Das **Sitzungs-Cookie bleibt im Arbeitsspeicher** des GameDesk-Servers. Nach
  einem Neustart meldet man sich neu an. Auf die Platte geht nur die Adresse
  des Servers (`tools/broweg.json`) — nie E-Mail, nie Passwort, nie das Cookie.
* Weitergereicht werden **ausschließlich** `/health`, `/auth/session`,
  `/workers*` und `/tasks*` (Liste `ERLAUBT` in `tools/serve.mjs`). Die Brücke
  ist kein offener Weiterleiter.
* Über `file://` gibt es keinen Server und damit keine Brücke — die Kachel zeigt
  dann, was sie zuletzt gesehen hat.

Adresse des bro-servers und Anmeldung stehen im Inspector; der Abfragetakt
(Vorgabe 15 s, 0 schaltet ab) ebenso. Im unsichtbaren Tab wird nicht gefragt.

## Schrift

Drei Familien, lokal in `fonts/`, alle unter der SIL Open Font License — kein
fremder Server, damit GameDesk ohne Netz und über `file://` gleich aussieht:
**Inter** für Oberfläche und Fließtext, **Space Grotesk** für Überschriften,
Marke, Fenster- und Rahmentitel, **JetBrains Mono** für Quelltext, Pfade und
Dateinamen. Nur die latin-Untermenge, zusammen rund 370 kB.

Vier Regeln halten das Bild ruhig:

1. Jede Abschnitts-Überschrift — über der Palette, im Inspector, im
   Kontextmenü, im Dialog — wird gleich gesetzt (10,5 px, Versalien, gesperrt).
2. Zahlen, die untereinander stehen, bekommen Tabellenziffern; im Fließtext
   bleiben sie proportional.
3. **Die Laufweite gehört zur Größe, nicht zur Schriftart.** Große Schrift
   steht von allein zu weit auseinander und wird enger gestellt (Überschriften
   −0,022 em), kleine Zahlenschrift bekommt etwas Luft (+0,006 em). Der
   Zeilenabstand läuft gegenläufig: eng bei großer, weit bei kleiner Schrift.
   Ein fester Wert für alles ist irgendwo falsch.
4. **Jede Schrift hält Mindestabstand.** 14 px zu jeder Kante, an der sie
   steht — als `--schrift-luft` in `css/app.css`. Nur Messchrome (die Lineale
   der Wireframes) und Chips (Pfeilbeschriftung, Bildzähler) dürfen auf
   `--schrift-luft-eng` (6 px); Lesetext nie.

## Abstände und Bewegung

Alle Abstände kommen aus einer Leiter in `:root` — `--luft-1` (4 px) bis
`--luft-6` (28 px). Wer eine Zahl direkt ins Blatt schreibt, hat sich nicht
entschieden. `--schrift-luft` ist Stufe 4 und der Mindestabstand für Schrift.

Bewegung läuft über drei Zeiten und eine Kurve:

| Marke | Wert | Wofür |
|---|---|---|
| `--zeit-druck` | 120 ms | Knopfdruck, Hover-Farbe |
| `--zeit-klein` | 160 ms | kleine Einblendungen |
| `--zeit-gross` | 220 ms | Meldungen, Überlagerungen |
| `--aus` | `cubic-bezier(.23,1,.32,1)` | alles, was auf eine Eingabe antwortet |

Drei Grundsätze dahinter: Rückmeldung kommt **beim Herunterdrücken**
(`:active { transform: scale(.97) }`), nicht beim Loslassen. Bewegt wird nur
`transform` und `opacity` — beides läuft am Layout vorbei. Und Vergrößern beim
Überfahren steht hinter `@media (hover: hover) and (pointer: fine)`, sonst
zuckt die Fläche beim Tippen unter dem Finger. `prefers-reduced-motion` nimmt
alle Wege und Größenwechsel heraus und lässt Farbe und Deckkraft stehen.

## Ein eigenes Modul hinzufügen

Zwei Schritte: Datei in `js/modules/` anlegen, `<script>`-Tag in `index.html`
ergänzen. Das Fenster drumherum (Verschieben, Größe, Pfeile, Speichern,
Historie) kommt automatisch.

```js
GD.modules.register({
  id: 'timeline',
  label: 'Zeitstrahl',
  icon: '⏱',
  description: 'Ablauf einer Mission',
  accent: '#57c98a',
  defaultSize: { w: 500, h: 260 },

  create(ctx) {
    const state = Object.assign({ items: [] }, ctx.state || {});
    const el = GD.util.el('div', { class: 'tl-root' });
    // … Oberfläche bauen, bei Änderungen ctx.changed() / ctx.commit('…') rufen

    return {
      el,
      getState: () => state,          // wird gespeichert und exportiert
      setState: (s) => { /* nach Rückgängig/Laden */ },
      onResize: (w, h) => {},         // optional
      onTitle: (text) => {},          // optional: Titel wurde geändert (auch beim Tippen)
      headerTools: () => [],          // optional: Buttons in der Titelleiste
      inspector: (host) => {},        // optional: Felder im rechten Bereich
      onKey: (ev) => false,           // optional: true = Taste verbraucht
      destroy: () => {}               // optional
    };
  }
});
```

`ctx` bietet: `id`, `state`, `win.setTitle/setSize/get/select`, `changed()`
(Autospeichern), `commit(label)` (Eintrag in die Rückgängig-Historie),
`refreshInspector()`, `toast(text, kind)`.

Ein Board mit einem noch nicht geladenen Modultyp geht nicht verloren: Das
Fenster zeigt einen Platzhalter und behält seinen Zustand.

## Aufbau

```
index.html
css/fonts.css        @font-face für die drei Familien in fonts/
css/app.css          Rahmen, Board, Fenster, Pfeile, Inspector
css/modules.css      Styles der Module
js/core/util.js      DOM-/SVG-Helfer, Drag, Textumbruch, Dateien
js/core/registry.js  Modul-Registry
js/core/store.js     Dokument, Historie, localStorage, Import/Export
js/core/depot.js     Medienlager: Bytes in IndexedDB, im Board nur ein Verweis
js/core/board.js     Kamera: Verschieben, Zoomen, Raster
js/core/windows.js   Fenster: Erzeugen, Bewegen, Einrasten, Auswahl
js/core/connections.js  Pfeile im Weltraum, Beschriftungen im Bildschirmraum
js/core/minimap.js   Übersichtskarte
js/core/geom3d.js    3D-Grundkörper (Querschnitt × Profil, verrundbar) + Cache
js/core/gl3d.js      gemeinsamer WebGL2-Renderer, Schattenkarte, Strahlentreffer
js/core/models.js    Modell-Bibliothek, Auflösen von Verweisen, Backen
js/core/library.js   Projektordner: auflisten, öffnen, sichern, umbenennen
js/core/layout.js    Automatisches Layout: Höhen messen, entwirren, Rahmen,
                     Bereichs-Taxonomie, Prüfbericht
js/core/vergleich.js Abzug einer Tafel + Vergleich zweier Stände (auch in Node)
js/core/aenderungen.js  Commits, offene Änderungen, Änderungssicht auf dem Brett
js/core/suche.js     „Springen zu …" — Volltext über die Tafel, Kamera fährt mit
js/core/ui.js        Palette, Werkzeugleiste, Inspector, Kontextmenü, Tasten,
                     Dialoge „Projekte" und „Einstellungen"
js/core/app.js       Start, Undo/Redo, Datei-Drop, Startboard
js/core/schnittstelle.js  GD.hilfe / GD.zustand / GD.pruefe — der Einstieg
                     für Konsole, Skripte und Automaten
js/modules/*.js      Rahmen, Wireframe, Notiz, Quelltext, Medien,
                     3D-Modell, 3D-Ansicht, Sandbox, Projekt, Worker
fonts/*.woff2        Inter, Space Grotesk, JetBrains Mono (OFL, latin, ~370 kB)
tools/serve.mjs      Dateiserver (ohne Cache) + Projektordner-API + Broweg-Brücke
tools/festschreiben.mjs  Commit ohne Browser (für Umbauskripte)
tools/bibliothek.json  gemerkter Projektordner (legt der Server selbst an)
tools/broweg.json    Adresse des bro-servers (legt der Server selbst an)
boards/*.json        Vorgabe-Projektordner mit fertigen Tafeln
```

Alles sind klassische `<script>`-Dateien ohne Module-Import, damit `index.html`
auch direkt per Doppelklick (`file://`) funktioniert.

### Warum es flüssig läuft — vier Regeln, die man leicht bricht

Eine große Tafel lief einmal mit acht Bildern in der Sekunde. Nicht, weil zu
viel gezeichnet wurde, sondern weil an vier Stellen **Messen und Schreiben
verschränkt** waren. Der Browser rechnet das Layout neu, sobald jemand nach
etwas fragt, das davon abhängt — und wer zwischen zwei Schreibvorgängen fragt,
löst diese Rechnung jedes Mal neu aus. Auf der Feldherr-Tafel kostet ein
solcher Lauf **4,3 ms**; ein Bild hat 16.

Wer hier Hand anlegt, sollte die vier Regeln kennen:

1. **Nie `getComputedStyle` in einer Schleife.** Werte aus `:root` holt man
   über `U.blatt(name, vorgabe)` / `U.blattText(...)` — die merken sich das
   Ergebnis und werfen es beim Themenwechsel weg. `frame.js` las fünfmal je
   Rahmen direkt aus dem Blatt; das allein waren 110–145 ms je Zoomschritt.
2. **Nie `getBoundingClientRect` auf dem Brett.** Dafür gibt es
   `GD.board.rect()`; ein `ResizeObserver` hält den Wert frisch.
   `screenToWorld()` und alles darüber laufen darüber.
3. **Erst rechnen, dann schreiben.** `connections.render()` berechnet ALLE
   Wege, bevor der erste Pfad ins DOM geht — weil ein Pfeil, der an einer
   Wireframe-Form hängt, deren Lage messen lässt (`getScreenCTM`).
   Beschriftungen laufen aus demselben Grund in drei Durchgängen: beschriften,
   alle Breiten messen, alle Lagen setzen.
4. **Knoten stehen lassen, nur Geändertes schreiben.** Pfeile, Bündelstränge
   und Fenstergeometrie werden abgeglichen, nicht neu gebaut. `setzeAttr()`
   in `connections.js` und die `merk`-Objekte in `windows.js` sorgen dafür,
   dass ein unveränderter Wert gar nicht erst ins Blatt geht.

Dazu zwei billige Unterscheidungen, die viel sparen: **Schwenken ist nicht
Zoomen.** Beim Schwenken ändert sich an Pfaden, Griffen und Rahmenüberschriften
nichts — sie liegen im Weltraum und werden von der Board-Transformation
mitgeschoben. `connections.js` und `windows.js` prüfen deshalb den Maßstab und
führen beim reinen Schwenken nur die Bildschirm-Ebene nach (Beschriftungen,
Sprechblasen). Und: **`GD.store.getWindow()` geht über ein Verzeichnis**, nicht
über `Array.find` — der Griff sitzt in den heißesten Schleifen.

Gemessen auf den mitgelieferten Tafeln (Feldherr: 117 Kacheln, 40 Pfeile,
3 Bündel):

| | vorher | nachher |
|---|---|---|
| Pfeilebene zeichnen (93 Kacheln / 52 Pfeile) | 120 ms | 0,5 ms |
| Zoomschritt | 138 ms | 0,5 ms |
| Schwenkbild | 120 ms | ≈ 0 ms |
| Pfeilebene zeichnen (Feldherr, mit Bündeln) | — | 2,7 ms |

### Bedienung aus der Konsole — für Skripte und Automaten

Menschen bedienen GameDesk mit der Maus. Umbauskripte und Sitzungen mit einem
Sprachmodell bedienen es über die Konsole. Drei Aufrufe sind der Einstieg —
sie behaupten nichts, sondern antworten über den **echten** Stand:

| Aufruf | Antwort |
|---|---|
| `GD.hilfe()` | Was es gibt, in Kurzform ins Protokoll |
| `GD.hilfe('notes')` | Größe, Farbe und die **Form von `state`** dieses Moduls |
| `GD.zustand()` | Kompakter Abzug: Ansicht, Zahlen je Modultyp, Inhaltsrechteck |
| `GD.zustand({kacheln:true, pfeile:true})` | zusätzlich jede Kachel und jeder Pfeil |
| `GD.pruefe()` | Layoutregeln **plus** NaN-Geometrie, Pfeile ins Leere, doppelte Kennungen |

`GD.hilfe('notes')` liest die `state`-Form von einer echten Kachel dieses Typs
ab; liegt keine auf der Tafel, legt es kurz eine an und nimmt sie samt Verlauf
wieder zurück. Eine abgeschriebene Liste wäre beim ersten Umbau veraltet.

**Falsche Zahlen brechen jetzt ab, statt still zu wirken.** Der häufigste
Fehlgriff war `GD.board.setView({x, y, scale})` statt dreier Zahlen: Daraus
wurde `view.x = NaN`, die Ansicht war fort, und der NaN landete beim nächsten
Autospeichern in der Datei — der Fehler tauchte Stunden später an ganz anderer
Stelle auf. `setView` nimmt die Objektform inzwischen an und weist alles andere
mit einer Meldung zurück; `windows.setGeometry` und `windows.add` prüfen ihre
Zahlen ebenso.

### Wie 3D hier funktioniert

Kein three.js, keine Abhängigkeit — der Renderer sind ~700 Zeilen WebGL2.

- **Ein einziger GL-Kontext** für das ganze Board. Jede Kachel lässt in einen
  versteckten Puffer zeichnen und kopiert das Bild per `drawImage` in ihr
  eigenes 2D-Canvas. Browser erlauben nur rund 16 Kontexte — so sind beliebig
  viele 3D-Fenster möglich.
- **Geometrie wird geteilt.** Ein Netz wird über (Form + Parameter) gecacht;
  hundert gleiche Würfel belegen ein Netz und einen GPU-Puffer. Ein Grundkörper
  hat typisch 300–1300 Dreiecke.
- **Gezeichnet wird nur bei Bedarf.** Kacheln außerhalb des Sichtfelds pausieren
  (IntersectionObserver), im Hintergrundtab läuft keine Animation, die
  Kamerafahrt begnügt sich mit 30 Bildern/s, und die Auflösung folgt dem
  Board-Zoom (gedeckelt).
- **Verrundung entsteht in der Geometrie**, nicht im Shader: ein geschlossener
  Querschnitt (Kreis / verrundetes n-Eck) wird entlang eines Profils
  (verrundetes Rechteck bzw. Dreieck) rotiert.
