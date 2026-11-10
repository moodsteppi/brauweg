# BroRemote: Artillerie-Spiel (Entwurf)

Stand: 10. November 2026. Entwurf auf Wunsch von Emil (Team-Raum `bd262430`,
Freigabe `bce9c207`). Noch kein Code. Dieses Dokument ist Karte 1 von drei;
die Schnittliste für Karte 2 und 3 steht in Abschnitt 8.

Übernommen wird nur das **Genre** (Artillerie im Wechsel auf zerstörbarem
Gelände). Namen, Waffen, Figuren, Texte und Werte sind eigene Erfindungen;
aus ShellShock Live oder einem anderen Spiel stammt nichts davon. Wer später
etwas ergänzt, prüft neue Namen genauso.

Belege zum Ist-Stand stehen als `Datei:Zeile` in Klammern. Gemeint ist der
Stand des Zweigs zum Zeitpunkt des Entwurfs (`485d33f4`).

---

## 0. Ausgangslage: was BroRemote heute kann

* BroRemote hat genau ein Spiel. Die Spielauswahl ist eine einzige, fest
  verdrahtete Spielkarte (`packages/client/src/broremote/BroRemote.tsx:178-180`);
  der Zustand dafür ist ein Wahrheitswert, kein Spielname
  (`BroRemote.tsx:33`). Titel und Hinweise nennen „Bro Building Battle“
  wörtlich (`BroRemote.tsx:184`, `:211`, `:216`).
* Der Raumkern kennt nur das Bauspiel: `Layout` ist `'bauen' | 'auswahl'`
  (`packages/broremote-kern/src/index.ts:8`), `Taste` nur `drehen`, `fallen`,
  `bestaetigen` (`index.ts:9`), die Privatnachricht trägt nur `bau`
  (`index.ts:21-22`), die Raumsicht nur `baumodus` und eine Bau-Partie
  (`index.ts:24-28`). Der Hostbefehl `spielen` setzt das Layout fest auf
  `'bauen'` (`index.ts:226-229`).
* Unbekannte Aktionen und Privatfelder fallen im Kern heraus: `aktionLesen`
  lässt nur bekannte Arten je Layout durch (`index.ts:65-78`), `privatLesen`
  gibt nur bekannte Felder weiter (`index.ts:103-106`). Ein neues Spiel
  **muss** deshalb den Kern erweitern, sonst kommt keine seiner Nachrichten an.
* Der Kern läuft an zwei Stellen identisch: im Relay
  (`packages/server/src/realtime/broremote.ts:5`, `:72`) und im gebündelten
  iOS-Gastgeber (`packages/client/src/broremote/transport.ts:187-196`). Die
  native iOS-Schicht prüft nur die Größe (8192 Byte,
  `apps/ios/Brauweg/BroRemoteNetz.swift:31`, `:50`, `:132`), nicht den
  Inhalt — eine Kernänderung braucht also **keine** Swift-Änderung.
* Der Relay rechnet keinen Spielzustand (`broremote.ts:7`); sein Takt von
  200 ms dient nur Zeitüberschreitungen und Raumende (`broremote.ts:31-39`).
  Eingaben leitet der Kern sofort an den Gastgeber weiter (`index.ts:247-252`).
* Eingaben tragen `folge` (muss steigen) und `abschnitt` (muss passen),
  sonst verwirft der Kern sie (`index.ts:247`). Je Leitung sind höchstens
  80 Nachrichten pro Sekunde erlaubt (`index.ts:195-196`). Größte Nachricht:
  8192 Zeichen (`index.ts:7`, `:44`).
* Gehaltene Eingaben wiederholt das Handy alle 150 ms
  (`packages/client/src/broremote/Controller.tsx:73-76`); nach 600 ms ohne
  Auffrischung setzt der Kern sie zurück (`index.ts:6`, `:278`). Loslassen,
  Fokusverlust und Hintergrund setzen sofort zurück (`Controller.tsx:43-50`,
  `:69-71`).
* Gerechnet wird ausschließlich im Gastgeberfenster
  (`docs/BROREMOTE.md:128-131`). Die Bühne läuft in einem `setTimeout`-Takt von
  33 ms (`packages/client/src/broremote/building/BauArena.tsx:81`), darin feste
  Physikschritte von 1/60 s mit höchstens sechs Nachholschritten
  (`BauArena.tsx:60`, `packages/building-kern/src/index.ts:40`), gezeichnet
  wird mit höchstens 30 Hz (`BauArena.tsx:62`), der Handystatus geht mit 4 Hz
  hinaus (`BauArena.tsx:68-76`).
* Gemessene Verzögerung Druck → Bild: Median 50 ms, p95 72 ms, davon rund
  22–39 ms Warten auf den Takt des Gastgebers (`docs/BROREMOTE.md:184-187`).
* Fehlt ein Controller oder die Hostverbindung, pausiert die Runde
  (`BauArena.tsx:32-33`, `docs/BRO-BUILDING-BATTLE.md:216-219`). Revanche führt
  in dieselbe Lobby, alle bestätigen neu, der Start bringt neue Partie und
  neuen Seed (`index.ts:229`, `:231-233`, `docs/BRO-BUILDING-BATTLE.md:39-41`).

Der Rahmen (Lobby, QR, Wiederverbindung, Pause, Revanche) trägt also schon.
Neu sind: eine Spielwahl im Kern, eigene Aktionen und Privatfelder, ein
eigenes Regelpaket und eine eigene Bühne.

---

## 1. Name

Entschieden: **BroTanks** (Emil, Team-Raum `62958838`: „kannst du die aufgabe BroTanks nennen“; vorher `2fbbfbc0`: „Bro Shell Shock (BroTanks)“). Die Tabelle darunter bleibt als Geschichte der Namenssuche stehen.

| Vorschlag | Gedanke |
| --- | --- |
| **Bro Ballistik Battle** | **Arbeitsname.** Steht als Geschwister neben „Bro Building Battle“: gleicher Anfang, gleicher Klang, in der Spielauswahl sofort als Familie erkennbar. Kurz genug für die Spielkarte. |
| Schollenschuss | Die Bros stehen auf einer Eisscholle über dem Meer; jeder Treffer frisst ein Stück davon weg. Beschreibt das zerstörbare Gelände. |
| Hangpolter | Lautmalerisch, verspielt, deutsch. Betont das Rollen, Rutschen und Herabpoltern nach Einschlägen. |

Das Spiel heißt **BroTanks**, im Code `brotanks`.

---

## 2. Spielablauf

### Aufstellung

* **2 bis 4 Bros**, je ein Handy. Die Lobby lässt heute 1–4 Sitze zu
  (`index.ts:174`); für dieses Spiel verlangt `spielen` mindestens zwei
  verbundene, bereite Spieler. Allein gibt es (später) ein Zielschießen, siehe
  „Nicht in der ersten Fassung“.
* Eine **Eisinsel** über dem Meer, 64 m breit, mit Hügeln, Senken und einem
  verschneiten Kamm. Das Gelände entsteht aus dem Seed: Alle Geräte, alle
  Tests, jede Revanche mit demselben Seed sehen dieselbe Insel.
* Startplätze verteilen sich gleichmäßig über die Insel, jeder auf einer kurz
  eingeebneten Stelle. **Welcher Bro wo steht und wer zuerst schießt, mischt
  der Seed**, nicht die Sitzreihenfolge — dieselbe Haltung wie in der
  Bau-Rangfolge (`packages/building-kern/src/index.ts:63`).

### Ein Zug

1. **Zielen (20 s):** Der Bro am Zug darf ein kleines Stück fahren (Treibstoff
   für rund 5 m), Winkel und Stärke einstellen und eine Waffe wählen.
2. **Feuer:** Ein Druck am Handy. Danach ist das Handy für diesen Zug still.
3. **Flug:** Das Geschoss fliegt mit Schwerkraft und Wind. Der Flug wird beim
   Feuern einmal vollständig vorausberechnet (der Wind ändert sich während
   eines Schusses nicht) und dann nur noch abgespielt — reproduzierbar und
   ohne Abweichung zwischen Rechnung und Bild.
4. **Einschlag:** Krater ins Gelände, Schaden nach Abstand zum Mittelpunkt,
   Bros ohne Boden unter sich rutschen bzw. fallen nach.
5. **Nachlauf (1 s):** Schadenszahlen, Rauch, dann der nächste Bro.

Läuft die Zielzeit ab, **verfällt der Zug** (kein Schuss, keine Munition
verbraucht). Ein Schuss, den niemand ausgelöst hat, wäre bei einer wackligen
Verbindung eine böse Überraschung — der eigene Bro könnte sich selbst treffen.

### Flugbahn und Wind

* Startgeschwindigkeit `v = staerke × 0,3 m/s` (Stärke 0–100, also bis 30 m/s),
  Schwerkraft 9,81 m/s², Wind als waagrechte Beschleunigung
  `wind × 0,25 m/s²` (Wind −10 … +10).
* Der **Wind wechselt vor jedem Zug**, aus einem eigenen Zufallsstrom des
  Seeds (wie `itemZufall` im Bauspiel, `building-kern/src/index.ts:12-16`).
  So verändert kein Schuss die spätere Windfolge.
* Integration mit festem Schritt 1/60 s, wie die Bauphysik
  (`building-kern/src/index.ts:40`). Alle Zahlen sind Startwerte; Karte 2
  legt sie als `REGELN` an, damit eine Feinabstimmung eine Zeile ist.
* Die Zielhilfe auf dem großen Bildschirm zeigt nur Rohrrichtung und eine
  Stärkemarke, **nicht** die Bahn. Das Treffen bleibt Können.

### Lebenspunkte, Schaden, Ausscheiden

* Jeder Bro hat **100 Lebenspunkte**.
* Schaden fällt vom Einschlag nach außen linear ab; der eigene Bro nimmt den
  halben Schaden.
* **Fallschaden:** Verliert ein Bro den Boden, fällt er nach. Fallhöhe über
  2 m kostet 5 LP je Meter.
* **Meer:** Wer ins Wasser fällt (Insel weggeschossen, über den Rand
  geschoben), scheidet sofort aus.
* Ausgeschiedene Bros werden in der Zugfolge übersprungen; ihr Handy zeigt
  „Du schaust zu“ und den Spielstand.

### Rundenende

* **Sieg:** Der letzte Bro mit Lebenspunkten.
* **Flut:** Ab der sechsten Runde (eine Runde = jeder lebende Bro einmal am
  Zug) steigt das Meer je Runde um 0,5 m. Das beendet jede Partie in
  absehbarer Zeit, ohne dass eine Uhr das letzte Wort hat.
* **Grenze:** Nach zwölf Runden entscheidet die Rangfolge: Lebenspunkte, dann
  verursachter Schaden. **Ein Gleichstand bleibt ein Gleichstand**, wie im
  Bauspiel (`docs/BRO-BUILDING-BATTLE.md:23`).
* Gleichzeitiges Ausscheiden der letzten Bros (z. B. beide durch denselben
  Einschlag) ist ein Gleichstand, kein erfundener Sieg — dieselbe Regel, die
  ein Bautest ausdrücklich prüft
  (`packages/client/src/broremote/building/partie.test.ts:82`).

### Revanche

Genau der vorhandene Weg: Ergebnis → „Revanche vorbereiten“ → Host schickt
`lobby` (`index.ts:231-233`), alle bestätigen „Bereit“, der nächste Start
erzeugt neue Partiekennung und neuen Seed (`index.ts:229`) — also neue Insel,
neue Startplätze, neuer erster Schütze. Nichts davon ist neu zu bauen.

### Gleichzeitig zielen oder reihum? — **Reihum.**

| | Gleichzeitig (alle zielen, Salve auf Zeichen) | Reihum (einer zielt, alle schauen) |
| --- | --- | --- |
| Wartezeit | Kurz, alle sind dauernd beschäftigt. | Bis zu 3 Züge à ≤ 26 s, also knapp 1:20 bei vier Bros. |
| Großer Bildschirm | Vier Zielhilfen und vier Geschosse auf einmal; Einschläge sind kaum zuzuordnen. | Ein Schuss, alle Augen darauf. Lachen, Stöhnen, Jubeln — das ist das Partyspiel. |
| Gelände | Vier Krater gleichzeitig verändern den Boden unter fremden Bahnen; die Reihenfolge der Auflösung entscheidet Treffer, und sie muss fair festgelegt werden. | Jeder Schuss sieht den Stand nach dem vorigen. Keine Auflösungsregel nötig. |
| Wind | Ein Wind für alle oder je Bro — beides schwer zu lesen. | Ein Wind je Zug, groß sichtbar. |
| Verzögerung am Handy | Die Salve braucht eine **gemeinsame Abgabefrist**. Wer kurz vor Schluss drückt, verliert mit einer schwankenden Leitung (p95 72 ms, kurze Aussetzer bis zur 600-ms-Rücksetzung) den Schuss. Ungleich, und genau dort, wo man es merkt. | Es gibt keine Frist im Sekundenbruchteil. Winkel und Stärke gehen als **feste Werte** über die Leitung (Abschnitt 3); eine verspätete Nachricht kommt etwas später an, verfälscht aber nichts. Der Feuerdruck trägt die gezeigten Werte selbst mit. |
| Rechenlast Gastgeber | Bis zu vier Flüge und Kraterfolgen je Takt. | Ein Flug, vorausberechnet. |
| Pausen bei Ausfall | Ein fehlendes Handy hält alle auf. | Fehlt der Bro am Zug, pausiert die Zielzeit wie heute die Runde (`BauArena.tsx:32-33`); fehlt ein anderer, läuft der Zug weiter. |

**Gewählt: reihum.** Der Ausschlag gibt die Verzögerung: Beim gleichzeitigen
Zielen fällt die Leitungsschwankung genau auf die Abgabefrist und damit auf
die Fairness; reihum gibt es keine solche Frist, und die gemessenen 50–72 ms
(`docs/BROREMOTE.md:184-187`) sieht beim Zielen niemand. Dazu kommt der
Bildschirm: Ein Artilleriespiel lebt davon, dass alle denselben Schuss
verfolgen.

Gegen die Wartezeit: kurze Zielzeit (20 s), schneller Flug (höchstens 5 s
Anzeige, danach wird beschleunigt abgespielt), und das wartende Handy zeigt
„Du bist in 2 Zügen dran“, Wind und Lebenspunkte und lässt die **Waffe schon
vorwählen** (nur am Handy gemerkt, geht mit dem ersten Zielwert des eigenen
Zugs hinaus).

---

## 3. Handysteuerung

Das Handy bleibt eine Fernbedienung ohne eigene Regeln. Es zeigt, was der
Gastgeber als Privatnachricht schickt, und sendet Absichten.

### Aufbau (Hochformat, 390 px)

```
┌───────────────────────────────┐
│ Du bist dran · 14 s   ♥ 82    │  Kopf: Zugzeit, LP, Wind  ⟶ 3
├───────────────────────────────┤
│        Winkel  62°            │
│   [ − ]  ════◉═════  [ + ]    │  Winkel: Ziehleiste + Feintasten
│        Stärke  71             │
│   [ − ]  ═══════◉══  [ + ]    │  Stärke: Ziehleiste + Feintasten
├───────────────────────────────┤
│  ◀ Fahren        Fahren ▶     │  zwei große Haltetasten, Tank ▮▮▮▯
├───────────────────────────────┤
│  Waffe: ◂ Heringsfächer 3× ▸  │  Waffenwahl (Wischen oder Pfeile)
├───────────────────────────────┤
│        [   F E U E R   ]      │  große Taste, Haptik
└───────────────────────────────┘
```

### Was welche Nachricht wird

| Bedienung | Art der Eingabe | Warum so |
| --- | --- | --- |
| **Fahren** links/rechts halten | `steuerung` mit `x = −1/1`, `y = 0`, `tasten: []` — genau wie heute (`Controller.tsx:35-42`, `:102-112`) | Fahren ist eine **Dauerbewegung**. Hier passt das vorhandene Muster: alle 150 ms wiederholt (`Controller.tsx:73-76`), nach 600 ms ohne Auffrischung hält der Bro an (`index.ts:278`). Eine abgerissene Leitung lässt den Bro also nicht ins Meer fahren — das ist hier ausdrücklich gewollt. Treibstoff begrenzt die Strecke. |
| **Winkel / Stärke** ziehen | `zielen` mit **festen Werten** `{ winkel: 0…180, staerke: 0…100, waffe: 0…7 }` | Zielen ist **kein** Halten, sondern ein Wert. Als gehaltene Richtung würde jeder verlorene oder verspätete 150-ms-Takt den Winkel verfälschen, und die 600-ms-Rücksetzung würde mitten im Zielen anhalten. Ein fester Wert ist gegen beides unempfindlich: Die letzte Nachricht gewinnt, eine doppelte schadet nicht, `folge` sortiert alte aus (`index.ts:247`). |
| **− / +** halten | Am Handy: 1° bzw. 1 Stärkepunkt je 150 ms, nach 600 ms Halten 3 je 150 ms. Über die Leitung geht wieder nur `zielen` mit dem neuen Wert. | Dieselbe 150-ms-Taktung wie heute, aber **am Handy** gezählt. So entsteht kein Wettlauf zwischen Handytakt und Gastgebertakt. |
| **Waffe** wählen | im selben `zielen` | Eine Nachrichtenart weniger; die Waffe gehört zum Zielbild. |
| **Feuer** | `feuer` mit `{ zug, winkel, staerke, waffe }` | Der Druck trägt **genau die Werte, die das Handy zeigt**. Auch wenn das letzte `zielen` unterwegs verloren ging, fliegt der Schuss, den der Bro gesehen hat. `zug` macht den Schuss einmalig: Ein doppelter oder verspäteter Druck findet keinen passenden Zug mehr — dasselbe Muster wie die Itemnummer im Bauspiel (`index.ts:18`, `docs/BRO-BUILDING-BATTLE.md:92-94`). |
| Loslassen, Fokusverlust, Hintergrund | `reset` wie heute (`Controller.tsx:43-50`, `:69-71`) | Stoppt nur das Fahren. Winkel, Stärke und Waffe bleiben stehen. |

**Senderate:** `zielen` geht höchstens alle 150 ms hinaus, und nur bei einer
Änderung — also höchstens rund sieben Nachrichten pro Sekunde, weit unter der
Grenze von 80 (`index.ts:195-196`). Ziehen sammelt am Handy und schickt den
letzten Stand im nächsten 150-ms-Fenster.

**Wem gehört der Wert?** Während des eigenen Zugs dem **Handy** (es zeigt
sofort, was der Finger tut, ohne auf den Gastgeber zu warten). Zwischen den
Zügen dem **Gastgeber**: Er merkt sich je Bro den letzten Winkel, die letzte
Stärke und Waffe und schickt sie mit; das Handy übernimmt sie, sobald `amZug`
wahr wird. So beginnt jeder Zug dort, wo der letzte aufgehört hat.

**Sperren:** Ist der Bro nicht am Zug, sind Fahren, Zielen und Feuer
ausgegraut; die Waffenvorwahl bleibt bedienbar. Tastatur fürs Solotraining
bzw. Tests: ← → fahren, ↑ ↓ Winkel, Bild↑/Bild↓ Stärke, Q/E Waffe,
Leertaste Feuer — wie heute über `keydown`/`keyup` am Fenster
(`Controller.tsx:51-72`). Haptik wie heute (`Controller.tsx:14`), beim
eigenen Zugbeginn und beim Feuer.

---

## 4. Gastgeberbildschirm

Anders als das Bauspiel (eine Bahn je Spieler, `BauArena.tsx:98-108`) gibt es
**eine gemeinsame Bühne**, 16:9, die ganze Insel im Bild.

* **Kopfzeile** wie die Werkzeugleiste des Bauspiels (`BauArena.tsx:94-96`):
  Spielname, Runde „3 / 12“, Ton, Pause, Große Bühne. Dieselben Knöpfe,
  dieselben Klassen.
* **Zugleiste** links oben: Porträts in Zugfolge, der Bro am Zug vorn und
  vergrößert, Ausgeschiedene grau. Je Porträt Name, Spielerfarbe
  (`index.ts:111`) und Lebensbalken.
* **Windfahne** oben in der Mitte: ein Wimpel, der in Windrichtung weht, mit
  Zahl und Pfeil; der Wimpel wird mit der Stärke länger.
* **Zielzeit** als schrumpfender Ring um das Porträt des Bros am Zug; ab 5 s
  pulsiert er.
* **Bühne:** Himmel, Meer, Insel, Bros. Über jedem Bro ein kleiner
  Lebensbalken, über dem Bro am Zug ein Pfeil in seiner Farbe. Rohrrichtung
  und eine Stärkemarke folgen den `zielen`-Werten des Handys.
* **Flug:** Das Geschoss zieht eine kurze, ausblendende Spur. Die Kamera bleibt
  ruhig auf der ganzen Insel — keine Verfolgungsfahrt, die einem Teil des
  Raums schlecht wird. Verlässt das Geschoss oben das Bild, zeigt ein kleiner
  Pfeil am Rand, wo es ist.
* **Einschlag:** Funken wie die Absturzfunken des Bauspiels
  (`BauArena.tsx:104`), aufsteigende Schadenszahl in der Farbe des Getroffenen,
  ein kurzes Wackeln (abgeschaltet bei reduzierter Bewegung, wie heute
  `BauArena.tsx:49`).
* **Pause:** derselbe Überzug wie im Bauspiel (`BauArena.tsx:109`): „Warte auf
  Lina“, „Gastgeberfenster im Hintergrund“, „Verbindung wird
  wiederhergestellt“. Es pausiert nur, wenn der Bro am Zug oder der Gastgeber
  fehlt.
* **Ergebnis:** Sieger mit Funken (`BauArena.tsx:106`), Rangliste mit LP und
  Schaden, „Revanche vorbereiten“ und „Zur Lobby“.
* **Fuß:** „Handys zielen. Dieser Bildschirm zeigt die Insel.“

---

## 5. Waffen

Alle Bros starten mit **derselben Kiste** — dieselbe Fairness wie die gleiche
Bauteilfolge im Bauspiel (`docs/BRO-BUILDING-BATTLE.md:24`). Keine Käufe,
keine Kisten aus dem Himmel in der ersten Fassung.

| # | Name | Vorrat | Wirkung | Bild (gezeichnet) |
| --- | --- | --- | --- | --- |
| 0 | **Schneekugel** | ∞ | Kleiner Krater (r 1,2 m), bis 25 Schaden. Die Grundwaffe. | weiße Kugel mit blauem Glanzpunkt |
| 1 | **Heringsfächer** | 3 | Teilt sich am höchsten Punkt in drei Fische, die leicht auseinanderfächern. Je 12 Schaden, kleine Krater. | drei silberne Fischumrisse |
| 2 | **Polterfass** | 2 | Landet, rollt den Hang hinab (höchstens 3 s), dann großer Krater (r 2,5 m), bis 35 Schaden. Bleibt es in einer Mulde liegen, zündet es dort. | Holzfass mit Messingreifen (Werkstattholz wie `zeichnen.ts:20-33`) |
| 3 | **Hüpfeis** | 2 | Springt zweimal vom Boden ab, jeder Aufprall macht eine kleine Delle, erst der dritte explodiert (bis 20 Schaden). | Eiswürfel mit Kreuzglanz (wie die Eiskachel, `zeichnen.ts:35-37`) |
| 4 | **Meißelbolzen** | 1 | Bohrt sich 4 m ins Gelände und explodiert dort. Trifft Bros, die sich hinter einem Kamm verschanzt haben; macht Tunnel, durch die andere fallen können. | spitzer Metallbolzen mit Kupferband |
| 5 | **Schneewehe** | 2 | Schadet niemandem und **baut** einen Hügel (3 m breit, 1,5 m hoch) an der Einschlagstelle. Deckung oder Rampe. | weiße Wolke aus drei Kreisen |
| 6 | **Korkenknall** | 1 | Wenig Schaden (8), stößt aber jeden Bro im Umkreis von 3 m kräftig weg — Richtung Meer, wenn man gut zielt. | Sektkorken mit Drahtkörbchen |
| 7 | **Lichterkette** | 1 | Fliegt normal; über dem Einschlagpunkt fallen danach fünf Funken nacheinander von links nach rechts senkrecht herab, je 10 Schaden. | Kette aus fünf gelben Lämpchen |

Grenzen für Karte 2: Ein Schuss erzeugt höchstens 8 Teilgeschosse und
höchstens 10 Einschläge; ein Flug dauert höchstens 12 s Spielzeit (danach
verpufft er). Das hält die Rechnung je Schuss klein und begrenzt.

---

## 6. Datenmodell, Nachrichten, Takt

### Wer rechnet

**Der Gastgeber**, wie im Bauspiel (`docs/BROREMOTE.md:128-131`): im
Browserfenster bzw. im gebündelten Client der iOS-App
(`transport.ts:187-196`). Der Relay bleibt ein Vermittler ohne Spielzustand
(`broremote.ts:7`). Das Handy rechnet nichts außer der eigenen
Zielwert-Anzeige.

Anders als das Bauspiel braucht dieses Spiel **keine Physikbibliothek**: Das
Gelände ist ein Höhenprofil, die Flugbahn eine Formel mit festem Schritt.
Darum kann die ganze Partie als reine Funktion in einem eigenen Paket liegen
(`packages/brotanks-kern`) und unter `node --test` laufen — ohne WASM, ohne
Browser. Das Bauspiel muss seine Physik im Client halten
(`partie.ts:1`, `:6-7`, Rapier), dieses nicht.

### Takt

* Gastgeberschleife wie `BauArena.tsx:56-81`: `setTimeout` mit 33 ms, darin
  feste Schritte von 1/60 s, höchstens sechs Nachholschritte, im Hintergrund
  1 s, in Ruhe/Pause 250 ms.
* Zeichnen höchstens 30 Hz; das Gelände wird nur nach einem Einschlag neu in
  ein Puffer-Canvas gezeichnet, nicht in jedem Bild.
* Privatnachricht an jedes Handy alle 250 ms (wie `BauArena.tsx:68`) **und
  sofort** bei Zugwechsel, Einschlag und Ende — damit „Du bist dran“ nicht
  bis zu 250 ms zu spät kommt.
* Relay-Takt 200 ms bleibt unverändert (`broremote.ts:31-39`).

### Partie (im Gastgeber, nie über die Leitung)

```ts
type Waffe = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
type ArtiBro = {
  id: string; name: string; farbe: string;
  x: number; y: number;          // Fußpunkt in m; y folgt dem Gelände
  lp: number;                    // 0…100
  tank: number;                  // 0…100 Treibstoff im aktuellen Zug
  winkel: number; staerke: number; waffe: Waffe; // zuletzt gezielt
  munition: number[];            // je Waffe, −1 = unbegrenzt
  schaden: number;               // verursacht, für die Rangfolge
  raus: boolean; aufgegeben: boolean;
};
type ArtiPhase = 'countdown' | 'zielen' | 'flug' | 'nachlauf' | 'ende';
type ArtiPartie = {
  seed: number;
  gelaende: Float32Array;        // 512 Spalten à 0,125 m, Höhe in m
  meer: number;                  // Wasserspiegel, steigt ab Runde 6
  bros: ArtiBro[];
  reihe: string[];               // Zugfolge aus dem Seed
  zugNummer: number;             // steigt, 1…10000
  amZug: string;
  wind: number;                  // −10…10
  runde: number;                 // 1…12
  phase: ArtiPhase; rest: number;// Restzeit der Phase in s
  flug?: Flugbahn;               // vorausberechnet beim Feuern
  zufall: { wind: () => number; gelaende: () => number };
};
```

Die Partie hat dieselbe Schnittstelle wie `BauPartie`
(`partie.ts:29`, `:51`, `:65`, `:168`, `:254`): `eingabe(id, aktion)`,
`schritt()`, `neutralisieren()`, `sicht()`, `aufgeben(id)`. Dazu
`privatFuer(id)`.

Reine Funktionen daneben, jede einzeln geprüft: `inselAusSeed(seed)`,
`flugBerechnen(start, winkel, staerke, wind, waffe, gelaende)`,
`kraterSchlagen(gelaende, x, r)`, `huegelSetzen(gelaende, x, b, h)`,
`schadenBei(einschlag, bros)`, `nachrutschen(bros, gelaende)`,
`rangfolge(bros)`.

### Neue Kernfelder (`packages/broremote-kern/src/index.ts`)

```ts
export type Spiel = 'building' | 'brotanks';
export type Layout = 'bauen' | 'auswahl' | 'zielen';             // heute :8
export type Aktion = …                                            // heute :14-20
  | { art: 'zielen'; winkel: number; staerke: number; waffe: number }
  | { art: 'feuer'; zug: number; winkel: number; staerke: number; waffe: number };
export type ArtiPrivat = {
  phase: 'countdown' | 'zielen' | 'flug' | 'nachlauf' | 'pause' | 'ende';
  amZug: boolean; zug: number; rest: number;     // rest 0…20
  inZuegen: number;                              // 0 = jetzt, 0…3
  winkel: number; staerke: number; waffe: number;
  munition: number[];                            // 8 Einträge, −1…3
  lp: number; tank: number; wind: number;
  runde: number; platz: number;
  raus: boolean; gewonnen: boolean;
};
export type Privat = { …; bau?: BauPrivat; arti?: ArtiPrivat };  // heute :22
export type RaumSicht = { …; spiel: Spiel;                        // heute :24-28
  partie?: { id: string; seed: number; spiel: Spiel; modus?: 'rennen' | 'standfest' } };
```

Prüfung im Kern, im Stil des Vorhandenen:

* `aktionLesen` (`index.ts:65-78`): `zielen` und `feuer` nur bei Layout
  `zielen`; `winkel` ganz 0…180, `staerke` ganz 0…100, `waffe` ganz 0…7,
  `zug` ganz 1…10000. `steuerung` im Layout `zielen`: `y` muss 0 sein,
  `tasten` leer (die Liste erlaubter Tasten je Layout, `index.ts:71`, wird
  um `zielen: []` ergänzt).
* `privatLesen` (`index.ts:79-107`): `arti` mit genau den Feldern oben,
  `munition` genau 8 ganze Zahlen −1…3, alle anderen Bereiche wie
  angegeben. Weitergegeben werden nur diese Felder (`index.ts:103-106`).
  Größe: rund 300 Zeichen, weit unter 8192.
* Neuer Hostbefehl `spielwahl { spiel }` nur in der Lobby; er hebt wie der
  Moduswechsel den Bereitstatus auf (`index.ts:223-225`), damit niemand
  unbemerkt im anderen Spiel landet.
* `spielen` (`index.ts:226-229`): Layout aus dem Spiel (`bauen` bzw.
  `zielen`), `partie.spiel` gesetzt; für `brotanks` mindestens zwei
  Sitze, sonst Fehler „Für BroTanks braucht ihr mindestens zwei
  Handys.“
* Version bleibt `1` (`index.ts:2`): Alle Erweiterungen sind neue, optionale
  Felder und Arten. Ein altes Handy bekommt im Bauspiel nichts anderes als
  heute.

### Nachrichtenfluss

```
Handy ──eingabe{abschnitt, folge, aktion}──▶ Relay/LAN-Kern ──eingabe{spieler,…}──▶ Gastgeber
                                             (prüft folge, abschnitt, Layout, Rate)
Gastgeber ──privat{spieler, abschnitt, daten:{arti}}──▶ Kern ──privat{daten}──▶ nur dieses Handy
Gastgeber ──spielwahl / spielen / lobby──▶ Kern ──raum{sicht}──▶ alle
```

Der Gastgeber nimmt `zielen` und `feuer` **nur vom Bro am Zug** und nur in
Phase `zielen`; `feuer` nur mit `zug === zugNummer`. Alles andere wird still
verworfen — die Eingabe kommt dank `folge` nie zweimal, und ein veralteter
Schuss hat keinen Zug mehr. Fahren (`steuerung`) gilt nur in Phase `zielen`
und verbraucht Tank.

Nach einem Wiederverbinden stellt der Kern die letzte Privatnachricht erneut
zu (`index.ts:189`); das Handy übernimmt daraus Winkel, Stärke und Waffe. Ein
neu geladenes Gastgeberfenster verliert die Partie und führt zur Lobby
zurück — wie heute (`BroRemote.tsx:100-106`,
`docs/BRO-BUILDING-BATTLE.md:220-223`). Gespeichert wird nichts.

### Belohnungen

Keine in der ersten Fassung: keine Münzen, kein Album, keine Migration.
BroRemote-Räume sind Gast-Räume (`docs/BROREMOTE.md:27-28`). Ob später
Münzen wie im Bauspiel kommen (`docs/BRO-BUILDING-BATTLE.md:131-150`), ist eine
eigene Entscheidung.

---

## 7. Bildliste (gezeichnet im Code)

Alles mit Canvas 2D, im Stil von `zeichnen.ts`: dunkles Nachtblau als Grund
(`#111c2b`, `zeichnen.ts:21`), Verläufe mit Glanzkante (`zeichnen.ts:22-29`),
goldene Akzente (`#ffd67a`, `zeichnen.ts:69-73`), Nunito-Schrift
(`zeichnen.ts:62`), Spielerfarben aus dem Kern (`index.ts:111`). Wiederholte
Teile werden **einmal gerastert** und wiederverwendet wie die Bausteinkacheln
(`zeichnen.ts:13-42`); Pixeldichte höchstens 1,5 (`zeichnen.ts:47`).
**Keine erzeugten Bilder, keine neuen WebP-Dateien** in der ersten Fassung.

| Teil | Zeichnung | Zwischenspeicher |
| --- | --- | --- |
| Himmel | senkrechter Verlauf Nachtblau → Petrol, ein paar Sterne, ein schwaches Polarlichtband | einmal je Bühnengröße |
| Meer | zwei Wellenlinien mit leichtem Versatz, Schaum oben; steigt mit der Flut | Wellenmuster einmal |
| Insel | Höhenprofil als Pfad: oben 0,4 m Schneekruste (hell mit Glanz), darunter Eis (Petrol) und Fels (Schiefer), Kraterränder mit dunklem Saum | Muster einmal, Inselbild neu **nur nach Einschlag** |
| Bro | Pinguin aus Kreisen und Ellipsen (Bauch weiß, Rücken in Nachtblau, Schal in Spielerfarbe), sitzt in einem kleinen gezeichneten Panzer in Spielerfarbe (Wanne, zwei Ketten, Turm) | je Farbe einmal |
| Panzerrohr | kurzes Messingrohr am Turm, dreht sich mit `winkel` | gezeichnet je Bild (zwei Rechtecke) |
| Lebensbalken | abgerundeter Balken, Spielerfarbe auf Dunkel, Zahl daneben | — |
| Am-Zug-Pfeil | goldene Raute wie die Zielmarken (`zeichnen.ts:73`) | — |
| Zielhilfe | gestrichelter Strahl in Rohrrichtung (wie die Ziellinie, `zeichnen.ts:71`), Länge = Stärke | — |
| Windfahne | Mast, Wimpel als Bezierfläche, Pfeil und Zahl | — |
| Geschosse | je Waffe eine kleine Zeichnung, siehe Tabelle in Abschnitt 5 | je Waffe einmal |
| Spur | 12 letzte Punkte, ausblendend | — |
| Einschlag | Ring, der sich weitet, Funken ✦ ◆ ✧ (Zeichen wie `BauArena.tsx:104`), Schneestaub | — |
| Schadenszahl | aufsteigend, Spielerfarbe des Getroffenen, dunkler Umriss | — |
| Schneewehe | drei weiße Kreise, wachsen in 0,4 s auf | — |
| Ausgeschieden | Rettungsring auf dem Wasser bzw. umgekippter Panzer | — |
| Zugring | Kreisbogen um das Porträt, Gold → Rot | — |
| Handy: Waffensymbole | dieselben acht Zeichnungen als kleine SVG-Pfade in `BroIcon.tsx` (eigene Symbole statt Emoji, `BroIcon.tsx:1-2`) | — |
| Handy: neue Symbole | `winkel`, `staerke`, `feuer`, `wind`, `tank` | — |

Spielkarte in der Auswahl (`BroRemote.tsx:179`): Motiv ebenfalls gezeichnet —
die Insel mit zwei Bros und einer Flugbahn als kleines SVG, statt der
Bau-Bilder (`BroRemote.tsx:280-281`). Eine spätere Illustration wird bestellt,
nicht beschrieben (CLAUDE.md, Regel 5) — als eigene `docs/ASSETS-…`-Datei.

---

## 8. Schnittliste

### Karte 2 — Regeln und Logik, mit Tests (keine Oberfläche)

Ergebnis: Eine Partie lässt sich ohne Browser von Anfang bis Ende spielen,
der Raumkern trägt die neuen Nachrichten.

| Datei | Was |
| --- | --- |
| `packages/brotanks-kern/package.json` | **neu**, Aufbau wie `packages/building-kern/package.json` (Build mit `werkzeug/dist-raeumen.mjs`, Test mit `node --test`) |
| `packages/brotanks-kern/tsconfig.json` | **neu**, wie `building-kern` |
| `packages/brotanks-kern/src/index.ts` | **neu**: `REGELN`, `WAFFEN` (Name, Vorrat, Kurztext — einzige Quelle für Handy und Bühne, wie `FAHIGKEITEN` in `building-kern/src/index.ts:5-11`), Zufallsströme, Ausfuhr der übrigen Dateien |
| `packages/brotanks-kern/src/gelaende.ts` | **neu**: `inselAusSeed`, `kraterSchlagen`, `huegelSetzen`, `hoeheBei` |
| `packages/brotanks-kern/src/flug.ts` | **neu**: `flugBerechnen` für alle acht Waffen, Grenzen 8 Teilgeschosse / 10 Einschläge / 12 s |
| `packages/brotanks-kern/src/partie.ts` | **neu**: `ArtiPartie` mit `eingabe`, `schritt`, `neutralisieren`, `sicht`, `privatFuer`, `aufgeben`; Zugfolge, Zielzeit, Tank, Fallschaden, Meer, Flut, Rangfolge |
| `packages/brotanks-kern/test/gelaende.test.ts` | **neu**: gleicher Seed → gleiche Insel; Krater senkt nur im Radius; Hügel hebt; Ränder bleiben endlich |
| `packages/brotanks-kern/test/flug.test.ts` | **neu**: ohne Wind symmetrisch; Wind verschiebt in Windrichtung; jede Waffe hält ihre Grenzen; Hüpfeis prallt zweimal ab; Polterfass rollt bergab |
| `packages/brotanks-kern/test/partie.test.ts` | **neu**: Zug nur für den Bro am Zug; doppeltes und veraltetes `feuer` wirkungslos; Zeitablauf verfällt ohne Munitionsverbrauch; Fahren stoppt nach 600 ms ohne Eingabe; Meer = raus; gleichzeitiges letztes Ausscheiden = Gleichstand; Flut ab Runde 6; Partie endet spätestens nach 12 Runden; vier Bot-Bros spielen eine ganze Partie deterministisch zu Ende |
| `packages/broremote-kern/src/index.ts` | `Spiel`, Layout `zielen`, Aktionen `zielen`/`feuer`, `ArtiPrivat` in `Privat`, `aktionLesen`, `privatLesen`, `RaumSicht.spiel`, `partie.spiel`, Hostbefehl `spielwahl`, `spielen` mit Layout je Spiel und Mindestzahl 2 |
| `packages/broremote-kern/test/raum.test.ts` | Spielwahl hebt Bereitstatus auf; `brotanks` startet nicht allein; `zielen`/`feuer` nur im Layout `zielen` und mit gültigen Bereichen; `arti` wird gefiltert und nach Reconnect erneut zugestellt; das Bauspiel verhält sich unverändert |
| `packages/server/test/broremote.test.ts` | ein echter Relay-Durchlauf: `zielen` und `feuer` kommen beim Gastgeber an, `privat.arti` nur beim richtigen Handy |
| `package-lock.json` | Workspace-Eintrag des neuen Pakets (durch `npm install`; nach CLAUDE.md „Dieselbe Meldung, andere Ursache“ ist das nach jedem neuen Paket nötig) |

Nicht in Karte 2: kein Client, kein Swift (siehe Abschnitt 0), keine Migration.

### Karte 3 — Bühne, Controller, Einbindung in die Spielauswahl

Ergebnis: Man kann es spielen. Setzt Karte 2 voraus.

| Datei | Was |
| --- | --- |
| `packages/client/package.json` | Abhängigkeit `@brauweg/brotanks-kern` (neben `building-kern`, `packages/client/package.json:14`) |
| `packages/client/src/broremote/brotanks/TanksArena.tsx` | **neu**: Gastgeberbühne nach dem Muster von `BauArena.tsx` (Takt, Pause, Hintergrund, Ton, Große Bühne, Ergebnis, Aufräumen), Eingaben über den vorhandenen Ref (`BauArena.tsx:55`) |
| `packages/client/src/broremote/brotanks/zeichnen.ts` | **neu**: alle Zeichnungen aus Abschnitt 7, Inselpuffer |
| `packages/client/src/broremote/brotanks/ZielController.tsx` | **neu**: Handysteuerung aus Abschnitt 3. Eigene Datei statt Ausbau von `Controller.tsx`, weil der dortige Zustand ganz am Bauspiel hängt (`Controller.tsx:17-31`); übernommen werden Muster und Klassen (`br-steuertaste`, Mehrfinger-Map, 150-ms-Takt, Reset) |
| `packages/client/src/broremote/brotanks/ZielController.test.tsx` | **neu**: `zielen` höchstens alle 150 ms und nur bei Änderung; `feuer` trägt die gezeigten Werte und die Zugnummer; Fahren sendet `steuerung` und bei Loslassen/Hintergrund `reset`; nicht am Zug alles gesperrt außer Waffenvorwahl; Übernahme der Werte bei Zugbeginn |
| `packages/client/src/broremote/brotanks/brotanks.css` | **neu**: Bühne, Zugleiste, Windfahne, Handylayout bei 390 px |
| `packages/client/src/broremote/BroRemote.tsx` | Spielauswahl mit zweiter Spielkarte (`:178-181`); `spiel` als Spielname statt Wahrheitswert (`:33`); Titel und Hinweise je Spiel (`:184`, `:211`, `:216`); Lobby: Modus nur fürs Bauspiel, `spielwahl` senden (`:231-235`); Arena je Spiel (`:241`); Handy-Teil je Spiel (`:242-249`); Eingabeweiterleitung allgemein statt `bauEingaben` (`:51`, `:116-119`) |
| `packages/client/src/broremote/BroRemote.test.tsx` | zwei Spielkarten; Spielwahl kommt in der Lobby an; Start mit einem Handy zeigt den Hinweis |
| `packages/client/src/broremote/BroIcon.tsx` | neue Symbole aus Abschnitt 7 |
| `docs/BROREMOTE.md` | Abschnitt „Weitere Spiele“, Verweis auf dieses Dokument |

Sichtprobe in Karte 3 ist Pflicht (Spielauswahl, Lobby, Bühne, Handy, je 390
und 1400 px).

### Nicht in der ersten Fassung

Solo-Zielschießen, Bots, Münzen und Album, Kisten aus dem Himmel, Teams,
eigene Musik, gelieferte Illustrationen.

---

## Befunde beim Lesen

* `docs/BRO-BUILDING-BATTLE.md:165` nennt einen „Physiktakt 60 Hz“,
  `docs/BROREMOTE.md:186-187` einen „`setTimeout`-Takt von 33 ms“. Beides
  stimmt: Die Schleife läuft alle 33 ms (`BauArena.tsx:81`) und rechnet darin
  so viele 1/60-s-Schritte, wie angefallen sind (`BauArena.tsx:60`). Wer nur
  eine der beiden Stellen liest, rechnet falsch.
