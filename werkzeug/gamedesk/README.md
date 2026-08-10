> **Im Brauweg-Repo unter `werkzeug/gamedesk/`.** GameDesk ist ein
> Entwurfswerkzeug, kein Teil der Auslieferung: Es wird nicht gebaut, nicht
> vom Server ausgeliefert und ist über keine Adresse erreichbar. Starten
> lokal mit `node werkzeug/gamedesk/tools/serve.mjs 5190`.

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

### Fenster
Verschieben an der Titelleiste, Größe an allen acht Rändern. Beim Verschieben
rasten Kanten und Mittelachsen an den anderen Fenstern ein (pinke Hilfslinien);
`Alt` schaltet das Einrasten kurz aus. **Ein Klick auf den Titel** benennt um —
Ziehen an derselben Stelle verschiebt weiter, entschieden wird beim Loslassen.
Doppelklick auf die freie Leiste klappt ein.

Ein Rahmen wandert samt seiner Kacheln nach vorn bzw. nach hinten; verdecken
kann er sie nie, er liegt in einem eigenen, tieferen Stapelband.

### Pfeile
Beim Überfahren eines Fensters erscheinen vier Anschlusspunkte. Von einem Punkt
auf ein anderes Fenster ziehen erzeugt einen Pfeil. Doppelklick auf den Pfeil
oder auf seine Beschriftung öffnet die Texteingabe; die Beschriftung lässt sich
am Pfeil entlangziehen.

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
Das Board wird laufend im Browser gespeichert (`localStorage`). **„Speichern"
(`Strg`+`S`)** schreibt in die verknüpfte Projektdatei; ist keine verknüpft,
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
| `brauweg-funktionsweise.gamedesk.json` | Die **ganze Plattform** Brauweg: Client, Server, Spielmodule, Daten, Betrieb, Grundsätze und der Weg einer Aktion — mit einer Projekt-Kachel, die nach Feldherr führt |

> **Die JSON-Datei ist die Quelle**, nicht `boards/_erzeuger-*.mjs`. Die Tafeln
> sind seit ihrer Erzeugung von Hand weitergewachsen; ein Erzeuger-Lauf würde
> alles Spätere überschreiben. Umbauten laufen als Skript **auf** der JSON —
> Vorbild: `boards/_umbau-feldherr-struktur.mjs`. Die 3D-Modelle der
> Umweltblöcke legt `boards/_umweltbloecke-modelle.mjs` an.

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

Medien werden als Data-URL im Board gespeichert — dadurch bleibt eine
exportierte `.json` vollständig, große Dateien blähen sie aber auf (Grenze 24 MB
pro Datei).

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
js/core/ui.js        Palette, Werkzeugleiste, Inspector, Kontextmenü, Tasten,
                     Dialoge „Projekte" und „Einstellungen"
js/core/app.js       Start, Undo/Redo, Datei-Drop, Startboard
js/modules/*.js      Rahmen, Wireframe, Notiz, Quelltext, Medien,
                     3D-Modell, 3D-Ansicht, Sandbox, Projekt
fonts/*.woff2        Inter, Space Grotesk, JetBrains Mono (OFL, latin, ~370 kB)
tools/serve.mjs      Dateiserver (ohne Cache) + Projektordner-API
tools/bibliothek.json  gemerkter Projektordner (legt der Server selbst an)
boards/*.json        Vorgabe-Projektordner mit fertigen Tafeln
```

Alles sind klassische `<script>`-Dateien ohne Module-Import, damit `index.html`
auch direkt per Doppelklick (`file://`) funktioniert.

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
