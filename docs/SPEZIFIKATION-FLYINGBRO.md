# Flying Bro — Spezifikation

Stand 06.11.2026 (Worker, Projekt #18 „Rider Modus hinzufügen", Stufe 1,
Aufgabe 1). **Arbeitstitel** — der Name ist offen (siehe letzter Abschnitt).

Ein Physik-Wurfspiel für eine Person im Hub: Die drei Bros aus dem Logo
werden mit einer Schleuder auf Bauwerke geschossen, in denen sich Giraffen
verschanzt haben. Fällt jede Giraffe um, ist das Level geschafft. Allein
gespielt, im Web **und** in der App, eigene Währung, Sterne geben
Trophäen, und ein paar Hub-Münzen gibt es — gekappt wie beim Runner.

Vorbilder im Repo: `docs/SPEZIFIKATION-KARTENMANUFAKTUR.md` (Aufbau,
Wirtschaft getrennt vom Hub), `docs/PRO-SUBWAY.md` (Solo-Spiel mit
Münzkappen, `packages/server/src/runner.ts`).

## Abgrenzung: was wir NICHT übernehmen

Das Genre (Schleuder, Bauwerk, Einsturz) ist frei, das Aussehen und die
Namen eines bekannten Vorbilds nicht. Deshalb gilt für Bilder, Texte und
Fähigkeiten verbindlich:

- **Keine Vögel und keine Schweine.** Geschossen werden Pinguine (die drei
  aus dem Logo, `packages/client/public/icon-512.png`), getroffen werden
  Giraffen — die vierte Figur des Logos.
- **Keine Astgabel-Schleuder.** Unsere Schleuder ist ein Gummiband zwischen
  zwei gestapelten Kartenkisten (passt zur Kartenplattform).
- **Keine Fähigkeit des Vorbilds:** kein Aufteilen in drei, kein Explodieren,
  kein Ei-Abwurf, kein Bumerang, kein gerader Beschleunigungsstoß. Unsere drei
  stehen unten und sind aus dem Pinguinsein abgeleitet (Bauch rutschen,
  gleiten, gefrieren).
- **Giraffen sind keine Bösewichte.** Sie platzen nicht und verschwinden
  nicht in Rauch: Eine getroffene Giraffe fällt um, setzt sich beleidigt
  auf und trottet aus dem Bild. Gundi aus den TikTok-Folgen
  (`docs/werbung/tiktok-serien/figuren.md`) ist **nicht** dabei — sie ist
  die ehrliche Freundin, nicht die Zielscheibe.
- Keine Namen, Schriftzüge oder Klänge des Vorbilds, auch nicht abgewandelt.

## Spielablauf

```
Levelwahl ─► Aufbau (Bauwerk steht, Kamera schwenkt einmal drüber)
          ─► Zielen ─► Schuss ─► Flug (Fähigkeit antippen) ─► Einsturz
          ─► Ruhe? ──nein──► warten (höchstens 6 s)
                 └─ja─► Giraffen übrig? ──ja, Bros übrig──► nächster Bro ─► Zielen
                                         ├─ja, keine Bros──► verloren
                                         └─nein───────────► Levelende: Wertung
```

1. **Schleuder.** Steht links, Abschusspunkt 1,2 m über dem Boden. Der
   nächste Bro sitzt im Band, die übrigen warten sichtbar daneben in der
   Reihenfolge aus dem Level.
2. **Zielen.** Ziehen irgendwo auf der linken Bildhälfte (nicht nur am Bro —
   auf 390 px ist der Bro 10 px groß). Zugweg bis 2,4 m in Weltmaßen, Winkel
   frei. Die Vorschau zeigt die ersten **0,6 s** der Flugbahn als Punkte;
   das Hilfsmittel „Fernrohr" verlängert sie auf 1,5 s. Loslassen unter
   0,3 m Zugweg bricht ab (kein Versehensschuss).
3. **Schuss.** Abschussgeschwindigkeit = Zugweg / 2,4 × Höchsttempo des Bros
   (Tabelle unten). Die Kamera folgt dem Bro und zoomt so weit heraus, dass
   Bro und Bauwerk im Bild sind.
4. **Fähigkeit.** Ein Tipp während des Flugs löst sie aus, genau einmal je
   Bro. Nach dem ersten Kontakt mit irgendetwas geht sie nicht mehr
   (Ausnahme Malve, siehe unten).
5. **Einsturz.** Bauteile nehmen Schaden aus Kontaktimpulsen (Abschnitt
   Bauteile), zerbrechen bei 0 Haltbarkeit und geben Punkte. Giraffen fallen
   um (Abschnitt Giraffen).
6. **Ruhe.** Der nächste Zug beginnt, wenn alle Körper schlafen **oder**
   6 s nach dem Schuss vergangen sind — je nachdem, was zuerst kommt. Der
   Bro bekommt Roll- und Lineardämpfung (0,8 / 0,3), sonst rollt er auf
   flachem Boden ewig und nichts schläft je ein (im Messaufbau war genau das
   der Fall, siehe Physik).
7. **Levelende.** Sobald die letzte Giraffe umgefallen ist, wartet das Spiel
   noch bis zur Ruhe (Punkte für nachfallende Teile zählen mit), dann gibt
   jeder nicht verschossene Bro **3 000 Punkte**. Danach die Wertung mit
   Sternen und den Knöpfen „Nochmal", „Weiter" und „Levelwahl".

Ein Level dauert im Ziel 40–90 s. „Nochmal" geht jederzeit über den
Pausenknopf und kostet nichts.

## Die drei Bros

Die drei Pinguine aus dem Logo. Zwei haben schon einen Namen
(`docs/werbung/tiktok-serien/figuren.md`), der dritte nicht.

| | Pelle | Malve | türkiser Bro (Name offen) |
| --- | --- | --- | --- |
| Farbe | rot-orange, Steuerkreuz auf der Flosse | lila, runde Brille | türkis, Spielknöpfe auf der Flosse |
| Rolle | Grund-Bro, kommt in jedem Level | Weite und Glas | Stein |
| Radius | 0,30 m | 0,27 m | 0,30 m |
| Dichte (Masse) | 2,0 (0,57 kg) | 1,6 (0,37 kg) | 2,4 (0,68 kg) |
| Höchsttempo | 22 m/s | 24 m/s | 20 m/s |
| Fähigkeit | **Bauchrutscher** | **Gleitflug** | **Eisblock** |
| stark gegen | Holz, Pfosten am Boden | Glas, weit hinten | Stein |

- **Bauchrutscher (Pelle).** Tipp: Er legt sich flach (Form wird eine Kapsel
  0,7 × 0,3 m). Beim ersten Bodenkontakt behält er 90 % seines Tempos statt
  abzuprallen und rutscht mit Reibung 0,02 bis zu 3 s weiter. Er räumt so
  die Pfosten unten weg, auf denen ein Bauwerk steht. Schaden an Holz ×1,5.
- **Gleitflug (Malve).** Tippen **und halten**: Flossen auf, Schwerkraft
  ×0,3, Luftwiderstand 0,4 — eine flache, lange Bahn über die vordere Wand
  hinweg. Loslassen beendet den Gleitflug, höchstens 2,5 s. Als einzige geht
  ihre Fähigkeit auch nach einem Streifkontakt noch, solange sie nicht lag.
  Schaden an Glas ×2.
- **Eisblock (türkis).** Tipp: Er gefriert zu einem Würfel 0,6 × 0,6 m,
  Masse ×3, Abprall 0. Schaden an Stein ×2,5; an Glas nur ×0,5 (er rutscht
  ab, statt zu schneiden).

Der Schaden eines Bros ohne Fähigkeit ist an allen Stoffen ×1. Freigeschaltet
werden Malve ab Welt 1 Level 6 und der türkise Bro ab Welt 2 Level 1; davor
kommt er in keiner Reihenfolge vor. **Welcher Bro kommt, legt das Level
fest** — der Spieler wählt nicht, sonst wäre jedes Level mit drei
Eisblöcken zu lösen.

## Bauteile: Holz, Stein, Glas

Jedes Bauteil ist ein Quader, ein Dreieck oder ein Kreis. Maße in Metern,
Dichte in kg/m² (2D). Die Stoffwerte sind für alle Bauteile eines Stoffs
gleich — Abwechslung kommt aus der Form, nicht aus Ausnahmen.

| Stoff | Dichte | Reibung | Abprall | Haltbarkeit | Punkte beim Bruch | Bruchbild |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Glas | 0,9 | 0,2 | 0,15 | 20 | 100 | Scherben, 3 Stufen Risse |
| Holz | 0,7 | 0,6 | 0,10 | 60 | 200 | Splitter, 3 Stufen Risse |
| Stein | 2,2 | 0,8 | 0,05 | 160 | 400 | Brocken, 3 Stufen Risse |

**Schaden** je Kontakt = max(0, Normalimpuls − 2) × 10 × Faktor des Bros
(Tabelle oben; 1 für Bauteil gegen Bauteil). Die Schwelle 2 sorgt dafür,
dass ein ruhig liegender Stapel sich nicht selbst zerreibt. Jeder Treffer
über 5 Schaden gibt 10 Punkte, auch wenn das Teil hält — sonst zählt ein
Schuss, der alles verschiebt, aber nichts bricht, null.

Die Risse kommen als drei Bildstufen je Stoff und Form (bei 66 %, 33 %,
0 %), nicht als Physik — ein Bruch zerlegt den Körper nicht, er verschwindet
und spawnt 4–6 Splitter ohne Kollision (nur Zierde).

## Giraffen

Drei Größen. Eine Giraffe ist **ein** Körper aus zwei Formen: Rumpf
(Kapsel) und Hals mit Kopf (schmaler Quader). Der Hals macht sie
kopflastig — eine große Giraffe kippt schon bei einem Stoß gegen den Kopf,
ist aber am Rumpf schwer zu treffen.

| | Kalb | Giraffe | Langhals |
| --- | --- | --- | --- |
| Höhe gesamt | 0,6 m | 1,3 m | 2,1 m |
| Rumpf (B × H) | 0,5 × 0,35 m | 0,8 × 0,5 m | 1,0 × 0,6 m |
| Dichte | 0,8 | 0,9 | 1,0 |
| Haltbarkeit | 25 | 60 | 110 |
| Punkte | 2 000 | 3 500 | 5 000 |

**Umgefallen** ist eine Giraffe, sobald eines davon gilt:

- ihre Haltbarkeit ist 0 (Schaden wie bei Bauteilen, Faktor 1),
- sie liegt: Neigung über 70° für mehr als 0,5 s,
- sie ist mehr als 1,5 m tief gefallen (gemessen von der höchsten Lage seit
  dem letzten Ruhezustand).

Dann zählt sie, ihr Körper wird zur Zierde (keine Kollision mehr) und
läuft aus dem Bild. Die Liegeregel ist der Unterschied zum Vorbild: Hier
muss nichts zerplatzen, Umwerfen genügt — darum zählt die Kopflastigkeit.

## Sternregel

- **1 Stern:** Level geschafft (alle Giraffen umgefallen).
- **2 Sterne:** Punkte ≥ `sterne[1]` aus dem Level.
- **3 Sterne:** Punkte ≥ `sterne[2]` **und kein Hilfsmittel benutzt**.

Ein Versuch mit Hilfsmittel endet höchstens mit zwei Sternen, egal wie viele
Punkte. Das ist die eine Regel, die den Shop von den Sternen trennt: Sterne
werden zu Trophäen und über den Trophäenweg zu Truhen und Münzen — ein
gekaufter dritter Stern wäre gekaufter Fortschritt auf dem Hub.

Je Level zählt das **beste** Ergebnis. Sterne gehen nie verloren.

Die Schwellen setzt der Leveleditor so: `sterne[1]` = Punkte, wenn man mit
dem vorletzten Bro fertig wird; `sterne[2]` = Punkte, wenn man mit dem
ersten fertig wird (also ≥ 2 übrige Bros × 3 000 zusätzlich). Beides prüft
die Levelprüfung (unten) gegen eine Musterlösung.

## Levelformat (JSON)

Ein Level ist eine Datei in einem gemeinsamen Kern (`packages/flyingbro-kern/
levels/w1-01.json` — Paket in einer späteren Aufgabe, siehe unten). Server
und Client lesen **dieselbe** Datei: der Client zum Spielen, der Server für
Freischaltung, Höchstpunkte und Sternschwellen.

```json
{
  "fassung": 1,
  "id": "w1-07",
  "welt": 1,
  "nr": 7,
  "titel": "Die Glasveranda",
  "breite": 30,
  "boden": 0,
  "schleuder": { "x": 2.0, "y": 1.2 },
  "bros": ["pelle", "malve", "pelle"],
  "sterne": [0, 18000, 26000],
  "teile": [
    { "stoff": "holz",  "form": "quader",  "x": 16.0, "y": 0.6,  "b": 0.2, "h": 1.2 },
    { "stoff": "holz",  "form": "quader",  "x": 18.0, "y": 0.6,  "b": 0.2, "h": 1.2 },
    { "stoff": "glas",  "form": "quader",  "x": 17.0, "y": 1.3,  "b": 2.4, "h": 0.2 },
    { "stoff": "stein", "form": "dreieck", "x": 17.0, "y": 1.75, "b": 0.8, "h": 0.7 },
    { "stoff": "holz",  "form": "kreis",   "x": 21.0, "y": 0.3,  "r": 0.3, "winkel": 0 }
  ],
  "giraffen": [
    { "groesse": "giraffe", "x": 17.0, "y": 0.0, "blick": "links" },
    { "groesse": "kalb",    "x": 21.6, "y": 0.0, "blick": "links" }
  ],
  "deko": [{ "bild": "busch-1", "x": 25, "y": 0, "ebene": "hinten" }]
}
```

- Maße in **Metern**, y nach oben, `x`/`y` ist der Mittelpunkt (Giraffen:
  Fußpunkt). `winkel` in Grad, Vorgabe 0.
- `sterne[0]` ist immer 0 (geschafft genügt).
- Höchstpunkte rechnet der Kern aus der Datei: alle Teile + alle Giraffen +
  (Anzahl Bros − 1) × 3 000 + ein Zuschlag von 20 % für Trefferpunkte. Mehr
  meldet niemand ehrlich.
- **Levelprüfung** (Test im Kern, läuft in der CI): Jede Datei muss sich
  laden lassen, jedes Teil muss auf etwas stehen (keine Überlappung über
  1 cm), und **5 s ohne Schuss** darf sich nichts mehr als 5 cm bewegen und
  keine Giraffe umfallen — die Probe A aus dem Messaufbau, je Level.
- Startlagen werden **vorgesetzt**: Der Leveleditor lässt das Bauwerk 2 s
  fallen und speichert die gesetzten Lagen. Sonst sackt der Turm beim
  Laden sichtbar zusammen (bis 7 cm bei planck, siehe Messung).

Umfang zum Start: **3 Welten à 15 Level** = 45 Level, 135 Sterne. Die Welten
folgen den ersten drei Zonen des Trophäenwegs (Heimat, Wiesen, Strand), damit
Kulissen und Töne wiederverwendet werden können.

## Spielwährung: Flugmeilen

Vorschlag: **Flugmeilen** (kurz „Meilen", Zeichen ein kleiner Flügel). Sie
bleiben im Spiel wie die Taler der Kartenmanufaktur und werden **nie** in
Hub-Münzen getauscht, auch nicht umgekehrt. Alternativen für die Wahl:
„Heringe", „Federn".

| Anlass | Meilen |
| --- | ---: |
| Level zum ersten Mal geschafft | 30 |
| je **neuer** Stern (erstmals erreicht) | 10 |
| Level erneut geschafft (die ersten 10 je Tag) | 5 |
| Welt ganz geschafft (alle 15 Level) | 100 |
| Welt mit allen 45 Sternen | 200 |

Ein ganzer Durchlauf ohne Wiederholung bringt 45 × 30 + 135 × 10 + 3 × 100 +
3 × 200 = **3 600 Meilen**. Die Wiederholungsmeilen sind auf 10 je Tag gedeckelt
(50 Meilen), damit niemand Level 1 in Schleife spielt, statt weiterzukommen.

## Shop im Spiel

Kauft nur mit Meilen. **Kein Artikel gibt Sterne, Punkte oder ein
übersprungenes Level.** Wer ein Hilfsmittel einsetzt, spielt den Versuch
mit höchstens zwei Sternen (Sternregel).

**Hilfsmittel** (verbraucht beim Einsatz, je Level höchstens eins von jeder
Sorte):

| Artikel | Wirkung | Preis |
| --- | --- | ---: |
| Fernrohr | Flugbahnvorschau 1,5 s statt 0,6 s, für ein Level | 40 |
| Bauplan | zeigt für ein Level die drei tragenden Teile (Umriss leuchtet) | 60 |
| Ersatz-Pelle | ein zusätzlicher Pelle am Ende der Reihe | 80 |

**Zierde** (dauerhaft, ändert nichts am Spiel):

| Artikel | Stück | Preis | zusammen |
| --- | ---: | ---: | ---: |
| Schleuderband in 6 Farben | 6 | je 400 | 2 400 |
| Flugspur: Funken, Seifenblasen, Schneeflocken | 3 | je 800 | 2 400 |
| Siegerpose der Bros (Tanz, Flossenklatschen) | 2 | je 1 200 | 2 400 |
| Kistenmotiv der Schleuder (3 Kartenrücken) | 3 | je 1 200 | 3 600 |
| **alle Zierde** | 14 | | **10 800** |

Zum Start bekommt jeder 2 Fernrohre und 1 Ersatz-Pelle geschenkt.

**Rechnung, an der die Preise hängen:** Ein Durchlauf bringt 3 600 Meilen
(Abschnitt Flugmeilen), die ganze Zierde kostet 10 800 — genau das
Dreifache. Ein Durchlauf reicht also für **höchstens ein Drittel** der
Zierde, und nur, wer gar keine Hilfsmittel kauft. Die ersten Preise (150 /
250 / 200 / 300, zusammen 2 950) lagen **unter** den Einnahmen eines
Durchlaufs: Alles wäre zu haben gewesen, und nach dem letzten Level hätte es
nichts mehr zu sparen gegeben.

Den Rest (7 200 Meilen) bringen danach nur noch die Wiederholungsmeilen,
höchstens 50 am Tag — das sind **144 Tage**. Das ist bewusst lang und nicht
ausbalanciert: Wer es kürzer will, hebt die Wiederholungskappe (10 Level je
Tag) oder senkt die Kistenmotive, die den größten Posten ausmachen. Wer die
Preise oder die Einnahmen ändert, rechnet diesen Absatz nach (siehe offene
Entscheidung 9).

## Hub-Münzen (gekappt wie beim Runner)

Vorbild: `packages/server/src/runner.ts:19-23` (`RUNNER_MUENZE_WERT`,
`RUNNER_MAX_PRO_LAUF = 20`, `RUNNER_MAX_PRO_TAG = 40`). Dasselbe Prinzip:
**Der Client darf lügen — die Kappen halten den Schaden klein.**

```ts
/** Hub-Münzen je NEU erreichtem Stern. */
export const FLYINGBRO_MUENZEN_JE_STERN = 2;
/** Höchstens so viel aus einer einzelnen Levelmeldung (3 neue Sterne). */
export const FLYINGBRO_MAX_PRO_LEVEL = 6;
/** Höchstens so viel aus Flying Bro je Kalendertag (Berlin), wie der Runner. */
export const FLYINGBRO_MAX_PRO_TAG = 40;
/** Einmalig je Welt, wenn alle 15 Level geschafft sind — außerhalb der Tageskappe. */
export const FLYINGBRO_WELT_MUENZEN = 50;
```

- Münzen gibt es **nur für neue Sterne**, nie fürs Wiederholen — gekappt ist
  damit auch die Lebenssumme: 135 × 2 + 3 × 50 = **420 Münzen** für das ganze
  Spiel. Kommen Welten dazu, wächst sie mit.
- Was über die Tageskappe hinausgeht, verfällt nicht: Die Sterne sind
  gespeichert, die Münzen dafür werden am nächsten Tag beim ersten Melden
  nachgezahlt (Spalte `muenzen_offen`). Sonst bestraft die Kappe den, der an
  einem Abend eine ganze Welt durchspielt.
- Der Weltbonus ist ein Meilenstein wie „neue Manufaktur eröffnet" in der
  Kartenmanufaktur — einmal je Konto und Welt, deshalb ohne Tageskappe.

**Plausibilität beim Melden** (der Server rechnet die Sterne selbst, der
Client meldet nur Punkte):

1. Das Level ist freigeschaltet (Vorgänger geschafft, Welt offen).
2. Punkte ≤ Höchstpunkte des Levels (aus der Datei, siehe Levelformat).
3. Zwischen `start` (der Server gibt beim Levelstart einen Zeitstempel aus)
   und Meldung liegen mindestens 4 s je verschossenem Bro.
4. Die Sterne rechnet der Server aus Punkten, Schwellen und dem Feld
   `hilfsmittel` — der Client meldet keine Sterne.

Das hält ein manipuliertes Gerät nicht auf, deckelt aber, was es holen kann:
höchstens 420 Münzen und 135 Trophäen, und das nicht schneller als 40
Münzen am Tag. Wer mehr will, muss die Physik auf dem Server nachrechnen —
siehe offene Entscheidungen.

## Trophäen über `accountGameStat`

Trophäen entstehen sonst nur aus Platzierungen (`packages/server/src/
trophies.ts`, Nullsumme, ±3 bis ±33). Ein Solospiel hat keine Platzierung.
Vorschlag: **1 Trophäe je Stern**, geschrieben in `account_game_stat` mit
`gameId = 'flyingbro'` und je Zuwachs eine Zeile im `trophy_ledger`.

- Damit zählt Flying Bro automatisch in die Summe des Trophäenwegs
  (`trophaeenSumme`, `packages/server/src/trophaeenweg.ts:64`) und im Kopf
  des Hubs — ohne Änderung dort.
- Trophäen aus Flying Bro **sinken nie** (Sterne gehen nicht verloren) und
  sind auf 135 gedeckelt. Zum Vergleich: Ein Sieg zu viert gibt +9; das ganze
  Spiel entspricht also etwa 15 Siegen am Vierertisch.
- Nötig dafür (spätere Aufgabe): `'flyingbro'` in die Union `GameId`
  (`packages/game-api/src/index.ts:58`) — ohne Spielmodul, wie heute nur
  Kennungen mit Modul darin stehen; ein neuer Wert `solo_stern` im Enum
  `trophy_reason` (Migration von Hand, Nummer auf `origin/staging` prüfen —
  Stand heute endet die Reihe bei `0040_tagesmarkt.sql`); und die Prüfung,
  ob die Ranglisten (`packages/server/src/rankings/service.ts`) eine
  Kennung ohne Modul vertragen. `highestCheckpoint` bleibt 0.

## Kosmetik für den Hauptshop

Die Plätze bleiben die sechs aus `SLOTS` (`packages/server/src/
kosmetik.ts:46`) — **kein neuer Platz**, denn ein neuer Platz ist eine neue
Ebene im Pinguin-SVG (`docs/DESIGN.md`, 240 × 256) und in jedem Bild, das ihn
zeigt. Neue Stücke im `KATALOG` (`kosmetik.ts:109`), Preise im Katalog wie
immer, nie in der Datenbank:

| Kennung | Platz | Preis | Seltenheit | Herkunft |
| --- | --- | ---: | --- | --- |
| `hut-fliegerkappe` | hut | 220 Münzen | selten | shop |
| `brille-fliegerbrille` | brille | 180 Münzen | gewoehnlich | shop |
| `oberteil-fliegerschal` | oberteil | 260 Münzen | selten | shop |
| `aura-kondensstreifen` | aura | 380 Münzen | episch | shop |
| `hand-kartenkiste` | hand | 45 Edelsteine | legendaer | shop |
| `hut-goldhelm` | hut | — | legendaer | geschenk: alle 135 Sterne |

- `hut-goldhelm` ist ein `geschenk` wie der Partyhut: Es gibt genau einen Weg
  hinein (alle Sterne), sonst wäre der Erfolg für 600 Münzen zu haben.
- **Der Bro auf der Schleuder trägt die Kosmetik des Spielers** (Hut,
  Brille, Aura — die drei, die im Flug lesbar sind) als Zierde. Kosmetik
  verändert nie das Spiel: keine größere Hitbox, kein anderes Gewicht.
- Bilder dazu in einer eigenen Bestellung (`docs/ASSETS-FLYINGBRO.md`,
  spätere Aufgabe), Passvorlage aus `docs/ASSETS-PINGUIN.md`.

## Einstieg im Hub und Umfang

Wie die Kartenmanufaktur:

- **Hub:** ein eigener Querknopf im Abschnitt „Allein" in
  `packages/client/src/screens/SpieleNeu.tsx` (heute ab Zeile 384, der
  Manufaktur-Knopf bei 409), gezeigt über `mitFlyingbro`. Text: „Flying Bro —
  Schleuder die Bros, wirf die Giraffen um". Erst mit Bild live schalten
  („Kein `<img>` auf eine Datei, die es noch nicht gibt", CLAUDE.md); bis
  dahin ein gezeichnetes Feld.
- **Umfang:** neue Funktion `'flyingbro'` in `FUNKTIONEN`
  (`packages/server/src/umfang.ts:51`), samt Routen in `FUNKTION_ZU_ROUTE`
  (`http/app.ts`) und der Stelle im Client-`umfang.ts`, an der der Einstieg
  verschwindet. **Staging:** ohne `UMFANG` ist alles an — dort läuft es
  sofort. **App/TestFlight:** zusätzlich `flyingbro` in die `UMFANG`-Zeile
  der Produktion (`docs/APP-RELEASE.md`); gebaut wird iOS auf Toms MacBook
  mit `werkzeug/app/ios-testflight.sh` (APP-RELEASE.md §3).
- **Server:** Routen `GET /api/flyingbro` (Stand: Sterne je Level, Meilen,
  Vorrat, Zierde, offene Münzen), `POST /api/flyingbro/start` (Zeitstempel
  für die Plausibilität), `POST /api/flyingbro/ergebnis` (Punkte, Bros,
  Hilfsmittel → Sterne, Meilen, Münzen, Trophäen in einem Aufruf, wie
  `/api/runner/lauf`), `POST /api/flyingbro/kauf`. Tabellen
  `flyingbro_stand` (eine Zeile je Konto: Meilen, Vorrat, Zierde als JSON,
  `muenzen_offen`) und `flyingbro_level` (Konto, Level, Sterne, Bestpunkte,
  erstmals am), dazu `flyingbro_tag` für die Tageskappe wie `runner_day`.
- **Kern:** `packages/flyingbro-kern` wie `manufaktur-kern`: Levels,
  Sternregel, Höchstpunkte, Preise. Server und Client rechnen dieselben
  Sterne. Die Physik gehört **nicht** in den Kern (Client-Abhängigkeit,
  WASM), bis entschieden ist, ob der Server nachrechnet.
- **Tagesaufgaben:** keine neue zum Start — sie zahlen Hub-Münzen, und
  „Schaffe 3 Level" täglich wäre eine zweite Münzquelle neben der Kappe
  (dieselbe Begründung wie in der Kartenmanufaktur).

## Physik: Vergleich und Empfehlung

Im Client gibt es keine 2D-Physik, nur `three`. Verglichen wurden drei
Bibliotheken in derselben Szene mit **30 Körpern**: 29 Holzblöcke in drei
Bauformen (schlanker Turm aus 8 Würfeln, Pyramide 5-4-3-2-1, zweistöckiges
Gerüst aus Pfosten und Planken) plus ein Geschoss, feste Schrittweite 1/60 s,
Standardwerte jeder Bibliothek, Schlafen an.

**Messweg:** `node werkzeug/physik-messung/messen.mjs` (Quelltext der Bühne
und der drei Adapter daneben). Das Skript installiert die Bibliotheken mit
festen Versionen in einen Ordner **außerhalb** des Repos
(`~/brauweg-physik-messung`), bündelt mit esbuild (minifiziert, gzip -9),
liefert je Bibliothek eine Seite über `127.0.0.1` aus und fährt Chrome 
kopflos über CDP: Ansicht **390 × 844 bei Pixeldichte 3** (Leinwand
1170 × 2532), Touch an, CPU-Drossel 1× und 4×, je drei Läufe, Median. Drei
Proben: **A** 5 s Ruhe ohne Schuss, **B** Schuss in den Turm und 8 s weiter,
**C** dieselbe Szene in Echtzeit mit Zeichnen (Canvas 2D), 6 s.
Gemessen am 06.11.2026 auf dem Worker-Rechner (Windows 11, Chrome, Node 24),
zwei vollständige Durchgänge.

Versionen: planck 1.5.1, matter-js 0.20.0, @dimforge/rapier2d-compat 0.21.0.

### Bündelgröße

| Bibliothek | minifiziert | gzip | Bemerkung |
| --- | ---: | ---: | --- |
| planck | 206 KB | **45 KB** | reines JavaScript, Tree-Shaking spart fast nichts |
| matter-js | 85 KB | **27 KB** | reines JavaScript |
| rapier2d-compat | 3 326 KB | **1 252 KB** | WASM als Base64 im JavaScript |
| rapier2d (.wasm getrennt) | 2 348 KB | 890 KB | nur zum Vergleich, braucht Nachladen der .wasm |
| rapier2d-deterministic-compat | 3 369 KB | 1 264 KB | gleiche API, bitgleich auf allen Geräten (laut Hersteller) |

### Stabilität gestapelter Körper

In beiden Durchgängen und allen sechs Läufen je Bibliothek **gleich** — das
Ergebnis hängt nicht an der Drossel, und im selben Browser ist jede
Bibliothek wiederholbar.

| Bibliothek | Ruhe 5 s: Versatz Turm / Pyramide / Gerüst | gekippt | schläft nach | Schuss: Blöcke bewegt | davon Turm | schläft nach | durchgefallen |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| planck | 7,4 / 6,5 / 5,0 cm | 0 | 1,5 s | 16 / 29 | 8 / 8 | 4,1 s | 0 |
| matter-js | 6,0 / 1,9 / 1,5 cm | 0 | 1,0 s | 6 / 29 | 6 / 8 | 4,3 s | 0 |
| rapier2d | **1,9 / 0,2 / 0,2 cm** | 0 | 0,6 s | 15 / 29 | 7 / 8 | 4,8 s | 0 |

- Keine der drei lässt einen Stapel umkippen. Der Unterschied ist das
  **Einsacken**: planck und matter drücken die Blöcke beim Start bis 7 cm
  ineinander (Durchdringungsspielraum je Kontakt), rapier bleibt unter 2 cm.
  Im Spiel sähe man das als Zucken beim Laden — vermeidbar durch vorgesetzte
  Startlagen (Levelformat), aber bei rapier kaum nötig.
- matter überträgt mit Standardwerten deutlich weniger Wucht (6 statt 15–16
  bewegte Blöcke). Durch Einstellen änderbar — aber genau das wäre
  Abstimmungsarbeit, die die anderen beiden nicht brauchen.
- Durchgehende Kollision (gegen das Durchschießen dünner Glasscheiben) haben
  planck (`bullet`) und rapier (CCD); matter hat keine.

### Rechenzeit und Bildrate

Median aus drei Läufen; wo die beiden Durchgänge verschieden waren, steht
die Spanne. „Arbeit je Bild" = Physik plus Zeichnen auf der 1170 × 2532-
Leinwand, gemessen gegen das Budget von **16,7 ms** eines 60-Hz-Bildschirms.
Die Bilder je Sekunde selbst sagen kopflos wenig: rAF ist dort nicht an 60 Hz
gebunden und lief bei 1× in allen drei Fällen ungebremst mit ~144 Bildern/s.

| Drossel | Bibliothek | Start | Schritt Ø | Schritt p95 | Arbeit je Bild p95 | Arbeit max | Bilder > 20 ms |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1× | planck | 0 ms | 0,09–0,32 ms | 0,3–1,3 ms | 0,7–0,8 ms | 1–2 ms | 0 % |
| 1× | matter-js | 0 ms | 0,07–0,09 ms | 0,3–0,4 ms | 0,3–0,4 ms | 1–2 ms | 0 % |
| 1× | rapier2d | 49–61 ms | 0,31 ms | 0,5 ms | 0,6–0,7 ms | 13–15 ms | 0–0,1 % |
| 4× | planck | 0 ms | 1,8–3,9 ms | 7,3–12,6 ms | 7,7–**15,3** ms | 28–77 ms | 1,1–**13** % |
| 4× | matter-js | 0 ms | 0,8–1,2 ms | 2,5–4,0 ms | 4,6–5,5 ms | 16–24 ms | 0,9–1,6 % |
| 4× | rapier2d | 329–349 ms | 3,1–3,8 ms | 5,4–5,7 ms | 6,3–10,2 ms | 532–1 129 ms¹ | 0,9–5,2 % |

¹ Ein einzelner Ausreißer je Lauf; vermutlich das Nachübersetzen des WASM
in den ersten Schritten (nicht einzeln belegt). Abhilfe im Spiel: während des
Ladebilds eine leere Welt 60 Schritte rechnen lassen.

**Was die Zahlen nicht sind:** Drossel 4× ist eine Annahme für ein
Mittelklasse-Handy, keine Messung an einem Gerät. Kopfloses Chrome zeichnet
ohne Grafikkarte. Die Zahlen taugen zum Vergleich der drei **untereinander**,
nicht als Bildrate auf einem iPhone. Die erste Messung am echten Gerät
gehört in die Stufe, die den Prototyp baut.

### Empfehlung: rapier2d (compat)

**`@dimforge/rapier2d-compat`**, geladen per dynamischem `import()` erst beim
Öffnen von Flying Bro. Gründe, nach Gewicht:

1. **Stabilität.** Drei- bis dreißigmal weniger Einsacken als planck und
   matter. Für ein Spiel, dessen ganzer Reiz das Einstürzen ist, ist ein
   Bauwerk, das schon vor dem Schuss zuckt, ein Fehler, den man sieht.
2. **Gleichmäßige Rechenzeit unter Last.** Im Mittel nicht schneller als
   planck, aber im p95 deutlich ruhiger (5,4–5,7 ms gegen 7,3–12,6 ms je
   Schritt bei 4×); planck lief in einem Durchgang mit 13 % Bildern über
   20 ms. Ruckeln entsteht aus den Spitzen, nicht aus dem Mittel.
3. **Durchgehende Kollision** für schnelle Bros gegen dünnes Glas.
4. **Ein Weg zum Nachrechnen.** Die deterministische Ausgabe hat dieselbe API
   und läuft auch in Node. Wird je entschieden, dass der Server Sterne
   prüft, statt der Kappe zu vertrauen, ist das ein Paketwechsel und kein
   neuer Physikkern.
5. **Läuft in der App ohne Sonderweg.** Die iOS-App ist eine Swift-Hülle
   mit eigenem Schema (`brauweg://app`, `docs/APP-RELEASE.md`). compat
   trägt das WASM im JavaScript — kein Nachladen einer `.wasm`-Datei über das
   eigene Schema, kein MIME-Typ, kein Vite-Plugin.

**Der Preis:** 1,25 MB gzip und 0,3 s Start bei 4×. Für die App ändert das
die Paketgröße von rund 54 MB um gut 3 MB (unkomprimiert), für die Webseite
lädt es nur, wer Flying Bro öffnet — und weniger als die 5,9 MB GLBs von
Pro-Subway. Hält ein Mensch das für das Web zu schwer, ist **planck** der
Rückfall (45 KB, ebenfalls Box2D-Löser, `bullet`); der Adapter im
Messaufbau zeigt, dass die Schnittstelle zwischen Spiel und Physik schmal
genug für den Wechsel ist. **matter-js** scheidet aus: keine durchgehende
Kollision, schwache Trefferwirkung mit Standardwerten, letzte Veröffentlichung
Juni 2024.

**Zeichnen:** Canvas 2D genügt — mit 30 Körpern bleibt die Arbeit je Bild
bei 1× unter 1 ms auf voller Pixeldichte. `three` ist da, aber für flache
Sprites ohne Tiefe ein Umweg.

## Bilder

Erzeugt werden sie in einer eigenen Aufgabe (laut Projekt per ChatGPT auf
dem Worker moodtsndpc), bestellt nach Regel 5 in `docs/ASSETS-FLYINGBRO.md`:
die drei Bros je in Ruhe, Flug, Fähigkeit und Siegerpose; die drei Giraffen
je stehend, getroffen, liegend und weglaufend; je Stoff drei Rissstufen für
Quader, Dreieck, Kreis; die Schleuder aus Kartenkisten; drei
Weltkulissen. In jede Bestellung gehören die drei bekannten Fehler:
Schachbrett statt Alphakanal, eingebrannter Text, Originalauflösung unter
`public/` — und die Abgrenzungsliste oben.

## Offene Entscheidungen (für einen Menschen)

1. **Name.** Arbeitstitel „Flying Bro". Im Auftrag stand „Angry Bro" mit dem
   Zusatz „beim Namen müssen wir nochmal schauen" — „Angry" lehnt sich an
   das Vorbild an; davon rät diese Spezifikation ab.
2. **Name des türkisen Bros.** In `figuren.md` hat nur er keinen Namen;
   „Tjark" ist dort für die Serie entfallen und wäre frei.
3. **Giraffen als Ziel.** Die Giraffe ist eine Logofigur. Passt „Giraffen
   umwerfen" zur Marke, oder sollen die Ziele etwas anderes sein (z. B.
   Pappfiguren von Giraffen auf einem Jahrmarkt)?
4. **Hochformat oder Querformat.** Gemessen ist bei 390 × 844 (Hochformat).
   Bei 30 m Levelbreite ist ein Bro dort rund 10 px groß. Querformat ist im
   Genre üblich, die App ist aber bisher hochkant gebaut.
5. **Server prüft nach oder vertraut der Kappe?** Heute: Kappe und
   Plausibilität wie beim Runner (Schaden höchstens 420 Münzen und 135
   Trophäen je Konto). Nachrechnen hieße: Schusseingaben melden, Server
   simuliert mit rapier-deterministic nach.
6. **Trophäen für ein Solospiel.** 1 Trophäe je Stern, nie sinkend, und das
   bricht die bisherige Regel „Trophäen nur aus Platzierungen"
   (`trophies.ts`). Alternative: keine Trophäen, nur Münzen und Kosmetik.
7. **Web-Ladegröße.** rapier mit 1,25 MB gzip auf der Webseite in Ordnung,
   oder planck (45 KB) mit sichtbarem Einsacken und mehr Ruckeln unter Last?
8. **Freigabe für die App.** Nur Staging, oder auch in die `UMFANG`-Zeile der
   Produktion für TestFlight (braucht Toms MacBook für den Build)?
9. **Zahlen.** Meilen-, Münz- und Shoppreise oben sind ein erster Satz ohne
   Simulation — eine Abstimmung wie bei der Kartenmanufaktur folgt erst mit
   spielbaren Leveln. Festgelegt ist nur das Verhältnis: Die Zierde kostet
   das Dreifache eines Durchlaufs (10 800 gegen 3 600 Meilen). Offen ist, ob
   die 144 Tage für den Rest zu lang sind.
