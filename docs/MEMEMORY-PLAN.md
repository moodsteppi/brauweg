# Mememory — Bauplan und Stand

Memory-Duell auf Brauweg: 5×8 Karten, zwei Spieler, Online-Match-Suche,
KI-generierte Meme-Bilder. Dieses Dokument ist der Arbeitszettel des
Ralph-Loops: **Statusblock zuerst lesen, dann die offene Stufe bauen,
danach den Statusblock nachführen.**

Begleitdokument: `docs/MEMEMORY-TICKETS.md` — dort kommt jede Reibungsstelle
hinein, auf die ein KI-System beim Bauen in diesem Repo stößt.

---

## Statusblock

| Stufe | Was | Stand |
| --- | --- | --- |
| 0 | Vorbereitung, Dokumente, Werkzeugpruefung | **fertig** |
| 1 | Bilder erzeugen (40 Motive, 3 Tischdecken, Banner) | **fertig** |
| 2 | Spielmodul `packages/game-mememory` + 31 Tests | **fertig** |
| 3 | Server: GameId, Registry, zod-Enum, i18n, Aktiv-Zaehler | **fertig** |
| 4 | Client: Bildschirm, Menue, Match-Suche, Brett | **fertig** |
| 5 | Klang (Web Audio, opt-in) | **fertig** |
| 6 | Oertlicher Zwei-Geraete-Test | **fertig** |
| 7 | Commit + Push auf `staging` | **fertig** (a7951d6, 39e007f) |

Letzte Sitzungsnotiz (22.08.2026): Eine volle Partie ueber zwanzig Paare bis
zum Abschlussblatt gespielt — zwei angemeldete Sitzungen auf zwei Urspruengen
(`localhost:3000` und `127.0.0.1:3000` haben getrennte Cookie-Toepfe).
Endstand 4:16, alle vierzig Karten vergeben, Tischdecke am Ende neutral.
Gefunden und behoben: die globale `main`-Regel schrumpfte das Brett (T-05),
die vorweggenommene Kartendrehung blieb haengen (T-08), und der Aktiv-Zaehler
stand im Wartebereich still.

**Nicht geprueft: das Aussehen.** Im Sitzungsbrowser laesst sich kein
Bildschirmfoto machen (T-09). Belegt sind Aufbau, Masse, Farben und
Verhalten — nicht der Auftritt und nicht, dass die Umdreh-Bewegung
tatsaechlich laeuft.

---

## Anforderungen (unverhandelbar, vom Nutzer)

1. Gitter **4×6 = 24 Karten**, jedes Bild genau **zweimal**.
   *(Bis zum 22.8. 5×8. Geändert auf Wunsch des Nutzers: Die Bilder sollen
   besser zu erkennen sein. Warum dafür eine SPALTE weichen musste und
   nicht zwei Zeilen, steht in `docs/MEMEMORY-TICKETS.md`, T-17.)*
2. Zwei gleiche Bilder nacheinander → bleiben offen, **ein Punkt**, Spieler
   ist **weiter dran**.
3. Aufgedeckte Karten tragen die **Randfarbe des Besitzers** (Blau/Rot).
4. Punkte: **eigene unten rechts**, gegnerische **oben** — je in Teamfarbe.
5. Spiel steht in der Spielauswahl von Brauweg.
6. Hauptmenü beim Öffnen:
   - Knopf mittig: **„Online Match suchen… (N)"**, N = gerade aktive
     Spieler *in diesem Spiel*.
   - Knopf oben links, **unterhalb der Apple-Notch**: Zurück.
   - **Name festlegen** über Knopf 1: abgerundetes Rechteck, Tippen öffnet
     die Tastatur.
   - Unten rechts: **Lautsprecher-Symbol**, rot durchgestrichen = aus
     (Vorgabe), opt-in.
7. Namen im Spiel: Gegner oben (Notch beachten), man selbst unten.
8. Beide Geräte sehen **dieselbe Anordnung**.
9. Echtzeit, **animiertes Umdrehen**, Tischdecke in der Farbe dessen, der
   dran ist.
10. Hintergrund: KI-Bild, Holztisch + Tischdecke in weiß/blau/rot.
11. Eigenes Design für die **Kartenrückseite**.
12. **Mehr Motive erzeugen als ein Match braucht** (Durchwechseln).
    *(43 Motive für 12 Paare. Seit 23.8. sind 13 davon die Originalbilder
    des Nutzers statt meiner KI-Fassungen — Herkunft und was daran offen
    ist: `docs/ASSETS-MEMEMORY.md`, Kapitel 7.)*
13. Flüssig: Animation örtlich, an den Server geht nur die Wahl; verkleinerte
    Bilder vorladen; **keine langen Ladephasen**.
14. Klang-Demo: Meme-Töne beim Umdrehen, Jubel beim Punkt/Sieg. Geringste
    Priorität.
15. Zurück-Knopf auch im laufenden Spiel.
16. **Nur fertige Paare sind blass**, eine gerade umgedrehte Karte nicht.
17. **Reaktionsknopf** unten: Tipp → zufälliges Emoji fliegt vom Knopf nach
    oben, der Knopf pulst kurz; beim Gegner fällt es von oben herein und
    wird dabei größer. Höchstens viermal je Sekunde.

---

## Architekturentscheidungen

**Warum ein echtes `GameModule` und kein reines Browser-Minispiel.**
Feldherr rechnet die Partie auf beiden Geräten im Gleichschritt, weil es eine
Echtzeit-Simulation mit Physik und Timern ist. Memory ist das Gegenteil: Ein
Zug ist ein einziger Klick, und wer welche Karte umdreht, muss der Server
entscheiden — sonst kann ein Gerät seine eigene Punktzahl erfinden. Also
`GameModule` mit `act`, und die Sichtbarkeit entsteht in `viewFor`.

**Verdeckt heißt verdeckt.** `viewFor` schickt für eine verdeckte Karte
**kein** Motiv. Sonst stünde das ganze Spiel im Netzwerkverkehr und jeder mit
geöffneter Entwicklerkonsole gewinnt. Was der Client zum Vorladen braucht,
bekommt er als **sortierte Motivliste** — sie verrät die Menge, nicht die
Lage.

**Zurückdrehen ist eine Schaupause.** Zwei ungleiche Karten bleiben kurz
liegen und drehen sich dann zurück. Genau dafür gibt es `interludeMs` +
`advanceInterlude` in `GameModule`: Das Modul bleibt uhrlos, die Plattform
misst die Zeit. Kein eigener Timer, kein eigener Zustand.

**Match-Suche ohne eigene Warteschlange.** Die Plattform hat keine. Der Bildschirm nutzt die vorhandenen Tisch-Endpunkte:
`GET /tables?game=mememory` → offener Tisch mit freiem Platz? beitreten.
Sonst selbst einen aufmachen und weiter horchen. Gegen das Wettrennen
(beide machen gleichzeitig auf) gilt: Wer einen fremden, älteren Tisch
sieht, verlässt den eigenen und tritt dort bei. Tischkennungen sind
sortierbar → **die kleinere Kennung gewinnt**, das ist ohne Absprache
entscheidbar.

**Aktive Spieler brauchten doch eine neue Schnittstelle.** Der erste Entwurf
wollte sie aus der Tischliste zählen. Das geht nicht: `listTables` liefert nur
Tische im Zustand `waiting`, wer spielt, ist unsichtbar — die Zahl fiele beim
Spielstart auf null. Es gibt deshalb `GET /api/games/:gameId/aktiv`, das
besetzte Plätze an wartenden **und** laufenden Tischen zählt. Die Zeile ist
spielunabhängig: Sie kennt kein Mememory, sie zählt Sitze. Siehe
`docs/MEMEMORY-TICKETS.md`, T-07.

**Name.** Brauweg-Konten haben schon einen Anzeigenamen. Das Feld im Menü
setzt einen **Spitznamen nur für dieses Spiel**, örtlich in
`localStorage` und mit dem ersten Zug an den Tisch gereicht. Kein Eingriff
in die Kontoverwaltung.

---

## Datenmodell (Entwurf)

```
Partie {
  motive: string[]        // 20 gezogene Motivkennungen, sortiert
  feld: number[]          // 40 Plätze -> Index in motive
  besitzer: (0|1|null)[]  // wem der Platz gehört
  offen: number[]         // gerade aufgedeckte Plätze (0..2)
  punkte: [number, number]
  dran: 0|1
  namen: [string, string]
  aufgedeckt: [number, number]  // Zahl der Umdreher je Sitz (Grundlage der XP)
  pause: null | 'treffer' | 'daneben'
}
```

**Kein `gesehen`.** Der Entwurf hatte eine Liste der schon einmal umgedrehten
Karten vorgesehen — öffentliches Wissen, beide haben sie gesehen, und der Bot
könnte damit ordentlich spielen. Sie ist bewusst nicht drin: Im Memory ist das
Sich-Merken das ganze Spiel, und wer die Liste mitschickt, gewinnt jede Partie
mit offener Entwicklerkonsole. Der Preis ist ein Bot, der zufällig zieht — er
springt ohnehin nur ein, wenn jemand seine Zugzeit verstreichen lässt.

`viewFor(seat)` liefert `feld` als `(string|null)[]`: Motivkennung nur für
offene oder besessene Plätze, sonst `null`.

---

## Prüfregeln aus der Repo-Geschichte, die hier gelten

- Vor jedem Commit `git diff --cached --stat | tail -1` lesen (CLAUDE.md
  Regel 7). Mehrere Sitzungen arbeiten im selben Arbeitsbaum.
- `npm run build` **im Wurzelverzeichnis**, sonst meldet `tsc` Felder als
  fehlend, die es gibt.
- Gegen `staging` arbeiten, nie gegen `main`.
- Bilder: nur WebP unter `packages/client/public/`, Dateigröße vor dem
  Einbau ansehen.
- Kein `<img>` auf eine Datei, die es noch nicht gibt.
