# Tafelrunde neu — Umsetzungsplan (One-Shot)

**Stand 27.11.2026, zur Freigabe durch Robin.** Dieses Dokument ersetzt die
Reihenfolge aus `docs/TAFELRUNDE-NEU-PLAN.md`, Abschnitt 8. Die
Zwischenabnahmen entfallen: Robin gibt diesen Plan einmal frei, danach wird
ohne Zwischenstopp bis zur Endabnahme gebaut. Grundlage sind seine Antworten
vom 27.11.2026, unten in Abschnitt 1 festgehalten.

---

## 1. Entschieden

| Thema | Entscheidung |
| --- | --- |
| Figurenweg | lokal und kostenlos: Konzeptbild (codex) → **TripoSG** (Form) → Farbe vorn aus dem Konzeptbild, Rest aus TripoSR → Pinguin-Skelett mit 5 Bewegungen → Blatt (`docs/ASSETS-TAFELRUNDE-NEU.md`) |
| Ansicht | Figur **40°** zur Kamera, Zelle **256 px** |
| Besetzung | **8 Pinguin-Helden und 14 Freunde**, keine Tierart doppelt (Abschnitt 2) |
| Namen | **neu, nach dem Muster Tier + Rolle**. Die Kennungen (`EinheitId`) bleiben, damit nichts Gespeichertes bricht |
| Regelkern | **darf geändert werden**: Fähigkeiten, Markeneffekte, Namen |
| Fähigkeiten | **viele, aber nicht alle** Einheiten; maßvoll statt krass; einige nur passiv; ausbalanciert |
| Marken | je Marke **ein sichtbarer Effekt** statt reiner Zahlen |
| Partiedauer | bleibt bei rund **7–8 Minuten** zu viert |
| Kader | bleibt bei **22** |
| Lesehilfen | Rollen-Symbol am Sockel, Sterne für die Stufe, **Marke antippen → Farbring an allen Trägern und Pop-up** (wer gehört dazu, was bringt welche Stufe) |
| Feld | **gemalt**, Schauplatz **wechselt je Runde**: Burghof (Schnee), Dorfplatz (Sommer), Herbstwald, Vulkan-Ufer |
| Shop | **Porträtkarten** mit Rahmen in Bronze, Silber oder Gold je Kosten |
| Extras | Effekte für Fähigkeiten, Titelbild aus den eigenen Figuren. **Klänge erst nach dem One-Shot**, mit dem Mac (nur Bestellliste) |
| Archiv | Originale nach `brauweg-art`, eigener Zweig `tafelrunde-neu-originale` |
| Abgabe | **ein großer PR** (#429) nach `staging`, alles hinter einem Schalter |
| App-Freigabe | bleibt auf „Bald“; Robin entscheidet nach der Abnahme selbst |
| Parallele Sitzungen | keine. Gebaut wird hier, in neuen Dateien |

## 2. Die 22 Einheiten

Kosten, Rolle und Marken bleiben wie in `katalog.ts`. Neu sind Name, Figur und
Fähigkeit. Die englischen Namen stehen in der Sprachdatei des Clients.

| Kennung | Neuer Name (en) | Figur | Fähigkeit |
| --- | --- | --- | --- |
| **1 Gold** | | | |
| dorfwache | Pinguinwache (Penguin Guard) | Pinguin, Topfhelm, Schwert, Schild | **Schildwall:** 3 s lang +30 Rüstung |
| schildknappe | Geisterschildkröte (Ghost Turtle) | Geister-Schildkröte, Riesenschild | **Panzer einziehen:** 2 s lang halber Schaden |
| astschuetze | Eichhornschütze (Squirrel Archer) | Eichhörnchen, Astbogen | *passiv:* jeder 4. Schuss trifft doppelt |
| steinschleuderer | Pinguinschleuder (Penguin Slinger) | Pinguin, Lederkappe, Schleuder | **Kopfnuss:** Schuss betäubt 0,5 s |
| funkenlehrling | Funkensalamander (Spark Salamander) | Feuersalamander, Funken | **Funkenwurf:** trifft Ziel und einen Nachbarn |
| irrlicht | Laternengeist (Lantern Ghost) | Laternengeist mit Stummelbeinen | – |
| gassendieb | Pinguindieb (Penguin Thief) | Pinguin, flache Kapuze, Dolch | – |
| moosheiler | Igelheiler (Hedgehog Healer) | Igel mit Moos, Kräuterkorb | **Kräuterwolke:** heilt alle Nachbarn |
| **2 Gold** | | | |
| hainwaechterin | Hirschwächterin (Deer Warden) | Hirschkuh in Rinde, Speer | **Speerstoß:** trifft zwei Felder in Linie |
| grimmbart | Kaiserkrieger (Emperor Warrior) | bärtiger Kaiserpinguin, Axt | **Axtwirbel:** Schaden an allen Nachbarn |
| bogenmeisterin | Fuchsschützin (Fox Archer) | Fuchs, Federhut, Langbogen | **Doppelpfeil:** trifft zwei Ziele |
| nachtpfeil | Eulenschütze (Owl Marksman) | Eule, Armbrust | **Zielschuss:** auf den Gegner mit den wenigsten Leben |
| frostweberin | Frostpinguin (Frost Penguin) | Pinguin, Eiskrone, Eisstab | **Frostring:** Nachbar-Gegner 3 s um 30 % langsamer |
| schattenklinge | Waschbärklinge (Raccoon Blade) | Waschbär, zwei Klingen | **Schattensprung:** springt in die hintere Reihe |
| knochenspaeher | Geisterkater (Ghost Cat) | Geisterkater, Knochenmaske | *passiv:* erster Treffer im Kampf doppelt |
| runenpriester | Runenpinguin (Rune Penguin) | Pinguin, Robe, Runentafel | **Runenschild:** schwächster Verbündeter bekommt einen Schild |
| **3 Gold** | | | |
| wurzelriese | Giraffenriese (Giraffe Giant) | Giraffe in Rindenpanzer | **Stampfer:** betäubt Nachbarn 1 s |
| drachenkind | Drachenkind (Dragon Whelp) | kleiner Drache | **Feuerstrahl:** Schaden in einer Linie |
| sturmrufer | Sturmalbatros (Storm Albatross) | Albatros, Sturmstab | **Kettenblitz:** springt auf drei Gegner |
| grabfuerstin | Geisterkönigin (Ghost Queen) | Geisterpinguin-Königin, Stab | **Seelenraub:** Schaden, heilt sich um die Hälfte |
| klingentaenzerin | Wieseltänzerin (Weasel Dancer) | Wiesel, Schärpe, zwei Säbel | **Klingentanz:** drei schnelle Treffer auf Ziel und Nachbarn |
| lichtwahrerin | Lichtpinguin (Light Penguin) | Pinguin, helle Robe, Laterne | **Lichtsegen:** heilt alle Verbündeten ein wenig |

19 Einheiten bekommen eine Fähigkeit (16 aktiv, 3 passiv), 2 bekommen keine
(Laternengeist, Pinguindieb). Aktive Fähigkeiten laden **Mana** aus eigenen
Treffern und erlittenem Schaden und lösen bei vollem Balken aus, wie im Genre
üblich. Mit jedem Stern wird die Fähigkeit stärker (Zahl, nicht Art).
**Alle Zahlen oben sind Startwerte.** Endgültig werden sie im Bot-Turnier
(`werkzeug/turnier.mjs`). Ziel ist, dass keine Einheit und keine Marke aus dem
Rahmen der heutigen Siegquoten fällt.

## 3. Die sieben Markeneffekte

Schwellen bleiben 2 / 3 / 5. Der Effekt wird mit jeder Schwelle stärker.

| Marke | Effekt (sichtbar im Kampf) |
| --- | --- |
| Krieger | **Kampfgeist:** unter 50 % Leben mehr Angriff (Glühen) |
| Wächter | **Schutzschild** zu Kampfbeginn für alle Wächter (Schildblase) |
| Naturwesen | **Wachstum:** heilen sich laufend ein wenig (Blätter) |
| Elementar | **Aufgeladen:** starten mit Mana, Fähigkeiten zünden früher (Funkeln) |
| Untot | **Wiederkehr:** der erste fallende Untote steht mit einem Teil seiner Leben wieder auf (Geisterschimmer) |
| Drache | **Glut:** Treffer setzen Brand, Schaden über Zeit (Flammen) |
| Meuchler | **Hinterhalt:** springen zu Kampfbeginn in die hintere Reihe (Rauch) |

Am Feld: Marke in der Leiste antippen → alle Träger bekommen den Farbring der
Marke, dazu ein Pop-up mit allen Einheiten der Marke (vorhandene hervorgehoben)
und der Wirkung je Schwelle.

## 4. Grafik

Alles kostenlos, alles lokal, alles nach `docs/ASSETS-TAFELRUNDE-NEU.md`
(Stilbibel, Alpha auf Rot prüfen, Größe ansehen, Originale ins Archiv).

| Was | Menge | Weg | Ziel unter `public/tafelrunde/neu/` |
| --- | --- | --- | --- |
| Figurenblätter | 22 (3 neu gerendert, Pinguindieb mit flacher Kapuze neu) | Figurenweg | `figuren/<kennung>.webp`, 256 px |
| Schauplätze | 4 | codex, hochkant, Hex-Felder **nicht** eingemalt (der Code legt sie darüber) | `feld/<schauplatz>.webp` |
| Kartenrahmen | 3 (Bronze, Silber, Gold) | codex | `karten/rahmen-<stufe>.webp` |
| Zeichen | 5 Rollen, 7 Marken, Stern, Gold, Leben | codex | `zeichen/*.webp` |
| Effekte | rund 10 (Schild, Heilwolke, Funken, Feuer, Blitz, Frost, Rauch, Blätter, Geisterschimmer, Betäubung) | codex als Einzelbild, **im Code animiert** (Größe, Drehung, Ausblenden) | `effekte/*.webp` |
| Titelbild | 1 | Gruppenbild aus den eigenen 3D-Figuren (Blender) vor einem Schauplatz | `titel.webp` |
| Klänge | – | **nur Bestellliste** in `docs/ASSETS-TAFELRUNDE-NEU.md`, erzeugt später am Mac | – |

Geladen wird nach Bedarf: nur die Figuren, die im Laden, auf Bank, Brett oder
im Kampf stehen, und nur der Schauplatz der laufenden Runde.

**Wie lange:** Eine Figur braucht rund 4 Minuten (Konzept plus Rechenzeit).
Die Serie läuft im Hintergrund, während der Code entsteht.

## 5. Regelkern (`packages/game-tafelrunde`)

1. **Namen** in `katalog.ts` und beiden Sprachdateien. Die Kennungen bleiben.
2. **Mana und Fähigkeiten** in `kampf.ts`, an der Stelle, die der Kopf der
   Datei dafür vorsieht. Neue Ereignisse im Kampfbericht (`faehigkeit`,
   `effekt`), damit der Bildschirm sie zeigen kann.
3. **Markeneffekte** in `synergien.ts` statt der reinen Zahlenboni. Die
   `wirkung`-Texte werden neu geschrieben.
4. **Bot**: Der Bot bewertet Fähigkeiten und Markeneffekte mit
   (`bot.ts`, `heerStaerke`).
5. **Sicht**: Mana, Fähigkeit und Markenwirkung gehen in die Sicht, nicht als
   Rechnung in den Client. Der Sichtvertrag wird nachgezogen.
6. **Gleichgewicht**: Bot-Turnier nach jeder Stufe. Messbericht als
   `docs/TAFELRUNDE-FAEHIGKEITEN.md`.
7. **Das alte Tafelrunde muss weiter laufen.** Es bekommt dieselben Regeln.
   Die neuen Ereignisse muss es ignorieren können, ohne abzustürzen. Das wird
   im Test geprüft.

## 6. Server

- **Suche zeigt, wer da ist:** Die Antwort von `GET /api/suche/:gameId`
  enthält zusätzlich die Wartenden mit Anzeigename und Bild. Die Suchtests
  von Farbduell, Eiland und Mememory laufen mit.
- Einladen über `POST /api/tables/:tableId/einladen` (#419) wird eingebunden,
  nicht neu gebaut.

## 7. Bildschirme (Client, hochkant, Web und iOS)

Neu unter `packages/client/src/minispiele/tafelrunde/neu/`, in Bausteinen
statt einer großen Datei. Erreichbar über einen **Schalter** (Parameter, wie
beim neuen Hub #277). Bis zur Abnahme bleibt das heutige Tafelrunde der
Standard. Deutsch und Englisch von Anfang an, Gestaltung nach
`docs/DESIGN.md`, Grün bleibt die Farbe des Spiels.

| Bildschirm | Inhalt |
| --- | --- |
| Einstieg | Titelbild, Schnellsuche, Tisch erstellen oder beitreten, Regeln |
| Suche | Restzeit, die **Gefundenen mit Bild und Namen**, wie sie einlaufen |
| Wartesaal | Plätze, Code, **Einladen**, Link teilen, Bot-Stufe, Start |
| Ladebild | Fortschritt, solange Figuren und Schauplatz laden |
| Rüstphase | gemaltes Feld mit Hex-Raster, Bank (9), **Shop mit Porträtkarten**, Gold, Level, Restzeit, Markenleiste mit Pop-up, Mitspieler mit Leben. Laden und Bank unten in Daumenreichweite. Ziehen ist die Hauptgeste, Antippen und Ziel antippen geht auch |
| Einheitenblatt | Figur groß, Werte, Fähigkeit, Marken, Verkaufen |
| Kampf | Arena hochkant, Figuren mit Lebensbalken, **Manabalken**, Sternen, Fähigkeits- und Markeneffekten |
| Rundenende | Sieg oder Niederlage, verlorene Leben, Zwischenstand |
| Abschluss | Platzierung, Trophäen, noch einmal |
| Regelblatt | Regeln, Fähigkeiten und Marken zum Nachlesen |

## 8. Prüfen

- Regelkern: bestehende 156+ Tests grün, dazu neue Tests für jede Fähigkeit
  und jeden Markeneffekt; Bot-Turnier als Messbericht.
- Server: Suchtests aller Spiele.
- Client: Bausteintests, Sichtvertrag, Test „altes Tafelrunde übersteht neue
  Ereignisse“.
- `npm run build` und `npm test` im Wurzelverzeichnis, erst nach Commit und
  Push (`CLAUDE.md`).
- **Sichtprobe** des neuen Bildschirms bei drei Handygrößen (Bildschirmfotos
  in den PR).
- Bilder: Alpha auf Rot, Dateigrößen, nichts in Originalauflösung unter
  `public/`.

## 9. Reihenfolge

Die Figurenserie läuft von Anfang an im Hintergrund (Grafikkarte und codex),
der Rest nacheinander:

1. Figurenserie starten (19 neue Konzeptbilder, dann Form, Farbe, Rig, Blatt).
2. Regelkern: Namen, Mana, Fähigkeiten, Markeneffekte, Bot, Sicht, Turnier.
3. Server: Feld „Wartende“ in der Suche.
4. Grafik: Schauplätze, Rahmen, Zeichen, Effekte, Titelbild.
5. Client: neuer Bildschirm hinter dem Schalter, alle zehn Bildschirme.
6. Einbau der fertigen Figuren, Tests, Sichtprobe, Doku, Tafel-Notiz,
   Originale ins Archiv.
7. **Endabnahme:** Pop-up an Robin mit Link zur Vorschau und zum PR. Gemergt
   wird nicht ohne ihn.

## 10. Risiken

- **Tiere auf dem Pinguin-Skelett.** Giraffe (langer Hals), Hirschkuh (lange
  Beine) und Drache (Schwanz, Flügel) sind die heikelsten Figuren. Gegenmittel:
  chibi-artige Proportionen im Konzeptbild; Hals, Schwanz und Flügel hängen
  dann an Kopf bzw. Körper. Hält eine Figur trotzdem nicht, wird sie neu
  gezeichnet und nicht hingenommen.
- **Gleichgewicht.** Fähigkeiten verschieben alles. Deshalb das Bot-Turnier
  nach jeder Stufe und maßvolle Startwerte.
- **Umfang.** Das ist ein großer Umbau, gerechnet in vielen Stunden, nicht in
  einer. Der Zweig wird nach jedem Schritt gepusht, damit nichts verloren
  geht.
- **Das alte Tafelrunde** bekommt die neuen Regeln mit. Es muss weiter
  spielbar bleiben (Abschnitt 5, Punkt 7).

## 11. Nach dem One-Shot

- Klänge für Fähigkeiten und Markeneffekte, am Mac (Bestellliste liegt bei).
- Schalter umlegen, altes Tafelrunde entfernen (nach Robins Abnahme).
- Freischalten in der App (`FREIGABE`), wenn Robin will.
