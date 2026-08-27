# Mememory: das Heim, die Sammlung und die Kühlung

Stand **27. August 2026**. Beschreibt die Umbauten am Menü (drei Seiten zum
Wischen), die Sammlungsseite, die Sperre nach einem geworfenen Meme, das
Schließen eines verlassenen KI-Tisches und das Banner in der Spielauswahl.

Vorher: `docs/MEMEMORY-ECKEN.md` (Ecken-HUD und Sammeln),
`docs/MEMEMORY-MEHRSPIELER.md` (zwei bis vier Spieler),
`docs/MEMEMORY-VORSCHLAGSKASTEN.md` (eigene Memes einreichen).

---

## 1. Drei Seiten statt Knöpfe am Rand

Bis zum 27. August saßen im Menü drei runde Knöpfe am Bildschirmrand:
Lautsprecher unten rechts, Briefkasten und Sammlung unten links. Jeder
öffnete ein Blatt über dem Menü. Das trägt genau so lange, wie es drei
Knöpfe bleiben.

Jetzt liegt das Menü auf einem **Streifen aus drei Seiten**:

```
     Sammlung            M E M E M O R Y            Mehr
   (wischen nach        Online-Match · KI        (Vorschlagskasten,
    rechts)             Zahnrad oben rechts        Freunde, …)

                     ‹      ⌂      ›          <- die Leiste unten
```

Gewischt wird mit dem Finger nach rechts, um die Sammlung zu holen — dieselbe
Richtung wie überall sonst am Telefon: Der Finger zieht den Inhalt mit, und
was links liegt, kommt dabei ins Bild.

Wer das nicht weiß, findet es über die **Leiste unten**. Sie trägt drei
Zeichen: außen zwei Winkel (`‹` und `›`, dort geht es weiter), in der Mitte ein
Haus (dort ist das Hauptmenü). Gelb ist die Seite, auf der man steht, die
anderen beiden sind grau. Jedes Zeichen ist ein Knopf und führt auf seine
Seite. Die Fläche eines Knopfes ist 44 × 40 px — die Untergrenze, die Apple und
Google für einen Daumen nennen; vorher waren es 8-px-Punkte, die man nur
zufällig traf.

An den Rändern der Menüseite standen kurzzeitig zwei Laschen (`‹ Sammlung`,
`Mehr ›`). Sie sind wieder heraus: Zwei Hinweise auf dieselbe Sache sind einer
zu viel, und die Laschen lagen über dem Brett statt daneben.

**Gebaut als Rollfläche mit Rastpunkten** (`scroll-snap-type: x mandatory`)
und ausdrücklich **nicht** mit eigener Fingerrechnung. Schwung, Widerstand am
Rand und Rückfederung kommen so vom Gerät und fühlen sich an wie überall
sonst; nachgebaut wären es zweihundert Zeilen `touchmove` und am Ende ein
Wischen, das anders ist als jedes andere auf dem Bildschirm.

### Die zwei Fallen dabei

**Die Startseite ist die MITTE.** Eine Rollfläche steht beim Aufbau links.
Sie lässt sich erst mittig stellen, wenn ihre Breite feststeht — und die
steht bei einem gerade entstehenden Blatt nicht immer schon. `Heim.tsx` setzt
deshalb so lange nach, bis es einmal geklappt hat (ein `ResizeObserver`
wartet auf die erste Breite größer null), und nicht ein einziges Mal auf gut
Glück. Nachgemessen: `scrollLeft` steht nach dem Aufbau auf genau einer
Seitenbreite, auch nach einem Wechsel von 1280 auf 375 Pixel.

**Fenster gehören nicht in den Streifen.** Der Vorschlagskasten und die
Einstellungen liegen als `position: fixed` daneben. Was mitwischt, ist kein
Fenster mehr.

`overscroll-behavior-x: contain` steht auf dem Streifen, weil sonst der Wisch
nach rechts auf der ersten Seite die Zurück-Geste des Browsers auslöst — man
wäre aus dem Spiel heraus statt in der Sammlung.

---

## 2. Die Sammlungsseite

Oben die drei Gurtfächer (was im Spiel fliegt), darunter der Bestand, nach
Sammlungen gruppiert.

| | |
| --- | --- |
| Gruppen heute | **Aus dem Vorschlagskasten** (eingesendete Motive), **Grundstock** (der feste Katalog) |
| Je Reihe | vier auf einem 375-px-Telefon, höchstens fünf auf einem breiten Schirm |
| Kachel | quadratisch, `object-fit: contain` — jedes Meme ist GANZ zu sehen |
| Noch nicht gefunden | dunkles Feld mit `?` |

**Was noch fehlt, bekommt kein Bild.** Nicht das verschleierte, sondern gar
keines. Zwei Gründe, der zweite ist der wichtigere: Ein Filter ist Zierde,
die Datei lädt trotzdem — ein frisches Konto zöge über hundert Bilder, um sie
unkenntlich zu machen. Und was im Blatt steht, sieht jeder mit geöffneter
Entwicklerkonsole.

**Die Gruppen sind schon der Aufbau für viele.** Ein Pack ist später eine
weitere Zeile in `gruppen()` in `SammlungSeite.tsx`, kein Umbau: Die Seite
kennt nur „Titel plus Liste". Eine leere Gruppe fällt heraus.

**Gespeichert wird von selbst.** Kein Knopf „Auswahl merken" mehr: Ein
Zeitgeber sammelt die Tipps und schickt 550 ms nach dem letzten. Der Grund für
den Knopf gilt weiter — Auswählen ist ein Suchvorgang, und eine Anfrage je
Tipp wären ein Dutzend für eine Entscheidung —, nur löst ihn der Zeitgeber
besser: Nachgemessen wurden vier Tipps zu **einer** Anfrage. Beim Verlassen der
Seite geht ein noch offener Stand sofort raus, sonst verlöre ihn genau der,
der ihn zuletzt gesetzt und dann weitergewischt hat.

**Der Client bekommt den Katalog vom Server.** `/api/mememory/motive` reicht
seit dem 27. August auch `grund` durch — den festen Katalog des Spielmoduls.
Der Client führt ihn ausdrücklich nicht selbst: Er kennt keine Spielregeln
(siehe `game-mememory/src/regeln.ts`), und eine zweite Abschrift der 88
Kennungen wäre die Abschrift, die ausläuft. Der Server darf das Modul kennen;
er führt ohnehin die Modulliste.

---

## 3. Die Seite „Mehr" und das Zahnrad

Auf „Mehr" steht ein Baustellenhinweis (Absperrbock, „Im Bau"), darunter eine
Liste: **Vorschlagskasten** (öffnet das bekannte Fenster, mit der Zahl der
wartenden Vorschläge für die Aufsicht) und **Freunde** (abgeschaltet, „bald").

Eine abgeschaltete Zeile und keine fehlende: Ein Platz, den man sieht, sagt
„kommt noch". Eine Zeile, die später auftaucht, sagt niemandem etwas.

Das **Zahnrad** sitzt oben rechts auf der Menüseite, gegenüber dem
Zurück-Knopf. Dahinter liegt heute die Lautstärke — ein Regler, sonst nichts.

Es ist aus acht Zähnen am Rand und einem Kranz gebaut, mit einem **Loch in
der Mitte**, so wie ein Zahnrad eines hat. Zwei Anläufe davor: ein von Hand
geschriebener Umriss (saß 6,3 % zu hoch) und vier durchgehende Balken (lagen
mittig, füllten aber die Mitte aus). Jetzt ist jeder Zahn dasselbe Rechteck,
nur um (12, 12) gedreht — damit kann die Zeichnung gar nicht schief liegen —,
und der Kranz ist ein Ring aus Strichstärke: Das Loch bleibt durchsichtig,
denn dahinter liegt der Knopf und keine bekannte Farbe. Nachgemessen: Kranz
von Radius 4,5 bis 7,7, Zähne von 5,3 bis 10,1 — innerhalb von 4,5 ist nichts.

Der Lautsprecher unten rechts ist damit weg: Ein Schalter am Rand trägt genau
eine Einstellung; sobald die zweite kommt, braucht es ohnehin eine Stelle, an
der man nachsieht.

**Kein getrennter An-Aus-Schalter.** Null ist aus. Zwei Bedienelemente für
dieselbe Frage („höre ich etwas?") sind eine Falle: Ein Regler auf siebzig,
aus dem nichts kommt, weil daneben noch ein Schalter steht, sieht nach kaputt
aus. Der Zug am Regler ist zugleich die Nutzergeste, die der `AudioContext`
braucht — das erledigt `setzeLautstaerke` in `klaenge.ts`. Der alte Schlüssel
`mememory.ton` bleibt daneben stehen, damit niemand nach dem Deploy plötzlich
Ton hat oder verliert.

---

## 4. Die Sperre nach einem geworfenen Meme

Ein Meme je Sekunde und Spieler (`MOTIV_PAUSE_MS`, der Server deckelt
dasselbe). Seit dem 27. August **sieht** man die Sekunde: Ein hellgrauer,
durchscheinender Film legt sich über alle drei Gurtkacheln und wird von einer
Uhr abgeräumt — im Uhrzeigersinn ab zwölf. Ist er weg, geht wieder eines.

Das Meme bleibt darunter erkennbar (`rgba(226, 231, 238, 0.55)`); der Film
sagt „noch nicht", er nimmt das Bild nicht weg.

**Zwei gedrehte Halbscheiben und kein Kegelverlauf.** Ein `conic-gradient` als
Maske ließe sich nur über eine mit `@property` angemeldete Winkelvariable
bewegen; wo die fehlt, bliebe der Film ganz stehen und die Kachel sähe für
immer gesperrt aus. Jede Hälfte ist ein Fenster über der halben Kachel, der
Film darin dreht sich um die Mitte und wandert aus dem Fenster — reines
`transform`, läuft überall und auf dem Compositor. Erst räumt sich die rechte
Hälfte (zwölf bis sechs Uhr), dann die linke.

**Die Uhr steht im `setTimeout`, nicht in der Animation.** Eine CSS-Animation
friert in einem verdeckten Tab ein; ein `setTimeout` wird dort auf eine
Sekunde gedeckelt, kommt aber. Wer das Handy während der Sperre sperrt,
findet die Kacheln danach frei — und nicht unter einem Film, der nie
verschwindet.

**Der Neustart löst sich von selbst:** Der Film entsteht erst beim Wurf und
verschwindet mit ihm, der Knoten ist also jedes Mal neu, und eine
CSS-Animation auf einem neuen Knoten beginnt von vorn. Ein zweiter Wurf käme
während der Sperre ohnehin nicht durch.

Nachgemessen mit von Hand gestellter Uhr (`currentTime`): bei 0 ms beide
Hälften auf 0°, bei 250 ms die rechte auf 90°, bei 500 ms die rechte auf 180°
und die linke noch auf 0°, bei 750 ms die linke auf 90°, bei 1000 ms beide
auf 180°. Nach einer Sekunde ist der Knoten weg; der zweite Wurf bringt eine
Uhr, die wieder bei 0 steht.

---

## 5. Ein verlassener KI-Tisch schließt sich

Wer eine laufende Partie gegen **andere** verlässt, gibt seinen Platz an einen
Bot ab und kann zurückkommen — so überlebt eine Partie eine U-Bahn-Fahrt, und
die Mitspieler stehen nicht vor einem leeren Stuhl.

Gegen die **KI** gibt es niemanden, für den das Weiterlaufen einen Sinn hätte:
Der Tisch bliebe nur als „Weiterspielen" im Menü stehen und böte beim
nächsten Griff genau die Partie an, die der Nutzer eben bewusst abgebrochen
hat. Deshalb schließt `verlasseKiTisch` (in `tables/service.ts`) ihn.

**Maßgeblich ist die Besetzung, nicht die Sichtbarkeit.** Ein Tisch, an dem
genau ein Konto sitzt und sonst nur Bots, ist ein KI-Match — gleich, über
welchen Knopf er entstanden ist. Über `visibility: 'on_request'` zu gehen wäre
schmaler und trügerisch: Dieselbe Einstellung tragen auch Tische, zu denen
jemand einen Freund einlädt.

**Die Partie wird weggeworfen und nicht abgerechnet.** `runtime.verwirf`
stoppt die Timer, nimmt die Partie aus dem Speicher und setzt die Zeile auf
`abandoned` — bewusst nicht `finish`: Dort hängen Trophäen, Erfahrung,
Aufgaben und die Statistik dran, und Aufgeben wäre sonst eine Abkürzung.

Der Client entscheidet dabei nichts. Er ruft beim Verlassen immer
`leaveTable`; bei einem Online-Match antwortet der Server mit einem Konflikt,
und der ist dort genau richtig.

Geprüft in `packages/server/test/ki-tisch-verlassen.test.ts` — vier Fälle,
darunter der wichtigste: **ein Tisch mit einem zweiten Menschen bleibt
stehen.**

---

## 6. Das Banner in der Spielauswahl

Bis zum 27. August lag dort ein gemaltes Stillleben: eine Pinnwand voller
erfundener Tierkarten. Das sah nach Mememory aus, zeigte aber nichts, was es
im Spiel wirklich gibt.

Jetzt hängen dort **genau die Motive, die eine Partie auf die Karten legt** —
gezogen aus dem ganzen Topf: dem festen Katalog UND den freigegebenen
Einsendungen. Fünf Stück, bei jedem Aufschlagen der Spielauswahl andere.

Der erste Anlauf zog nur aus den Einsendungen und ging am Ziel vorbei:
Solange kaum jemand etwas eingereicht hat, zeigte das Banner dieselben zwei
Bilder oder fiel ganz auf das gemalte Stillleben zurück — also auf alles
außer den Memes, um die es geht.

**Zur Herkunft:** Von den 88 Grundmotiven sind laut `docs/ASSETS-MEMEMORY.md`
40 lokal erzeugt (SDXL), 35 von Wikimedia und 13 Vorlagen des Nutzers. Auf dem
Banner können also auch selbst erzeugte landen. Das ist bewusst so: Sie liegen
im Spiel auf den Karten, und genau das soll das Banner zeigen. Soll es nur
Bilder aus dem Vorschlagskasten sein, ist das eine Zeile in `Banner.tsx`.

**Keine neue Datei.** Der Untergrund ist die rote Tischdecke aus dem Spiel
(`decke-rot.webp`, 19 kB, lädt am Tisch ohnehin), die Karten sind die Motive
selbst. Ein bestelltes Bild wäre hier auch gar nicht möglich: Was darauf
liegt, steht erst fest, wenn jemand etwas einreicht.

Zwei gerechnete Zahlen stehen im CSS und sollen dort bleiben:

* **`transform: scale(1.6)` auf der Decke.** Auf dem Bild liegt das Tuch nur
  über den mittleren 70 % der Breite, links und rechts sind dunkle Bretter.
  `cover` allein füllt die Kachel bis zum Bildrand — also mit Holz an beiden
  Seiten. Der Faktor zeigt nur noch 19 % bis 81 %, und die sind ganz Stoff.
  Er gilt, weil die Kachel immer 4 : 1 ist.
* **`inset: 9% 5% 43%` auf der Kartenreihe.** Auf einer 391 × 98 großen Kachel
  beginnt die Schrift des Namens bei 39 px. Mit dieser Aufteilung sind die
  Karten 47 px hoch und enden bei 56 px — die letzten Millimeter verschwinden
  hinter dem oberen, noch durchsichtigen Teil des Namensverlaufs. Genau so
  liegen auf dem gemalten Banner auch die Karten hinter der Schrift.

**Fällt der Abruf aus, bleibt es beim gemalten Banner.** Eine leere rote
Fläche sieht nach Fehler aus, das Stillleben nach Absicht.

### Das Banner spielt sich selbst

Während der Wartezeit wandert ein **Zeiger** über die Karten — die
hervorgehobene hebt sich 5,5 px an, wächst um 9 % und bekommt einen goldenen
Schein. Er springt nie auf die Karte, auf der er schon steht, wird von Sprung
zu Sprung langsamer und bleibt am Ende auf **genau der Karte** stehen, die
danach umgedreht wird. Aus dem Warten wird damit eine Ankündigung: Wer
hinsieht, weiß eine Sekunde vorher, wo etwas passiert.

Das hat eine Folge für den Aufbau: **Was als Nächstes passiert, steht schon
VOR der Wartezeit fest.** Anders könnte der Zeiger nicht darauf zulaufen.
Während des Wartens ändert sich am Stand nichts — es gibt nur diesen einen
Takt —, die Entscheidung ist am Ende also noch gültig.

Dann dreht sich die Karte um, bleibt kurz verdeckt liegen und kommt mit einem
anderen Meme zurück. **In einem von vier Fällen**
ist das andere Meme eines, das schon auf dem Banner liegt: Dann drehen BEIDE
zu, werden nacheinander aufgedeckt — und es gibt Konfetti. Das ist das Spiel
in fünf Sekunden erzählt, ohne ein Wort.

Die Karte ist dabei eine echte Klappkarte: zwei Seiten in einem
`preserve-3d`-Blatt, die Rückseite ist dieselbe `.mm-rueck` wie am Brett
(reines CSS, kein Byte Übertragung). **Getauscht wird, während die Karte
verdeckt liegt** — die Vorderseite trägt `backface-visibility: hidden` und ist
in dieser Zeit unsichtbar.

Drei Dinge daran sind für andere Bildschirme interessant:

1. **Der Takt hängt an einem SCHLÜSSEL, nicht an den Karten.** Ein Effekt mit
   dem Kartenfeld in der Abhängigkeitsliste liefe bei jedem Tausch neu und
   räumte dabei seine eigenen Uhren ab — der Takt bliebe nach dem ersten
   Umdrehen stehen. Der aktuelle Stand kommt deshalb aus einem Ref.
2. **Bei verdecktem Tab passiert nichts.** `setTimeout` wird dort auf eine
   Sekunde gedeckelt und die CSS-Übergänge stehen still; ein Takt, der
   trotzdem weiterliefe, arbeitete nur gegen den Akku. Nebenwirkung beim
   Prüfen: Der Sitzungsbrowser meldet die Seite als `hidden`, dort passiert
   also von selbst gar nichts. Zum Messen muss `document.visibilityState`
   überschrieben werden.
3. **Konfetti nur aus `transform` und `opacity`.** Richtung und Weite kommen
   einmal aus dem Zufall und stehen dann in Stilvariablen; die Bewegung ist
   eine CSS-Animation. Ein Wurf, der bei jedem Bild neu rechnet, kostet die
   Bildrate der ganzen Spielauswahl — und die zeichnet sieben Banner.

Der Zeiger darf ausdrücklich **kein `filter`** auf der Karte benutzen. Ein
Filter macht aus ihr eine eigene Zeichenebene und legt damit das
`preserve-3d` ihres Blattes flach — aus der Umdrehung würde eine Stauchung.
Der goldene Schein sitzt deshalb als Schatten auf der Vorderseite.

**Nachgemessen.** Erst 87 Sekunden mit Zeitstempeln und einer Nummer je
Knoten (um Neuaufbauten auszuschließen): zehn Umdrehungen, Abstände 6,2 bis
10,7 s; je Umdrehung 730 ms zwischen Zudrehen und Tausch (Soll 720); zwei
Paare, dabei 726 ms bis zum ersten Aufdecker, 293 ms bis zum zweiten (Soll
280), 308 ms bis zum Konfetti (Soll 300), 902 ms bis es weg ist (Soll 900).
Die Knotennummern blieben durchgehend dieselben — React baut nichts neu.

Dann mit dem Zeiger, erst 57 Sekunden: **sieben von sieben Umdrehungen** trafen
die Karte, auf der der Zeiger zuletzt stand, und der Schlusshalt war jedes Mal
der längste (664 bis 1200 ms gegen 370 bis 915 ms unterwegs).

Und zuletzt 25 Minuten am Stück, 180 Durchläufe: **53 Paare, also 29,4 %**
(Soll 25 %, bei dieser Zahl an Versuchen 1,4 Standardabweichungen — unauffällig),
53 Konfettiwürfe, also genau einer je Paar, und Abstände von 4,9 bis 12,2 s
bei 8,3 s im Schnitt (rechnerisch 4,7 bis 11,3 s).

Nebenbei aufgefallen: Eine kurze Strecke aus fünfzehn Durchläufen hatte sieben
Paare und sah nach einem Fehler aus. Sie war keiner — nur eine Häufung. Wer
eine Wahrscheinlichkeit prüfen will, braucht mehr als eine Handvoll Proben.

---

## 7. Die Gegnerwahl steht mittig

Im Bildschirm „Online-Match“ stehen die drei Namen jetzt in der Mitte ihres
Kastens statt links am Rand. Die Zahl der offenen Tische sitzt rechts in der
Ecke und rechnet in der Zeile nicht mehr mit (`position: absolute`).

Beides zusammen wäre falsch: Die Zahl ändert sich alle paar Sekunden, und ein
Name, der dabei hin und her rutscht, liest sich wie ein Fehler. Nachgemessen
sitzen alle drei Namen auf 0,0 px zur Kastenmitte.

---

## 8. Zeichen sitzen jetzt mittig

Am 27. August einmal quer durch die App gemessen: für jedes `<svg>` der Kasten
seiner Zeichnung gegen den Kasten der Fläche, für jedes Zeichen-in-einem-Knopf
der Kasten seiner **Tinte** (über `TextMetrics.actualBoundingBox*`) gegen den
Knopf.

**Die gelieferten Bilddateien waren alle in Ordnung** — 29 Zeichen unter
`public/hub/`, alle mittig auf ihrer Fläche. Schief lagen die *gezeichneten*
und die *geschriebenen*:

| Wo | Abweichung | Ursache |
| --- | --- | --- |
| `EdelsteinIcon` (Kopfzeile) | 4,7 % zu tief | Pfad von y 6 bis 29 in einer Box von 0 bis 32 |
| `✕` im Schließknopf | 3,4 px nach rechts (von 34) | Schrift zentriert nach Vorschubbreite, nicht nach Tinte |
| `×` in der Spielauswahl | 2,2 px zu tief | dasselbe |
| `←` im Raus-Knopf | 1,5 px zu tief | dasselbe |
| `♪` / `♫` im Laden | 2,3 px zu tief | dasselbe |

**Ein Schriftzeichen lässt sich mit CSS nicht zentrieren.** Was links und
rechts vom Strich Luft ist, entscheidet die Schrift, und die ist auf jedem
Gerät eine andere. Deshalb gibt es jetzt `packages/client/src/zeichen.tsx`
mit `Kreuz`, `PfeilLinks`, `Note`, `Haus` und `Winkel` — alle um (12, 12)
gebaut und damit mittig per Konstruktion. Nachgemessen sitzen sie alle auf
0,0 %. Die Größe kommt in `em` und richtet sich nach der
Schrift des Knopfes, damit jeder Knopf so groß bleibt wie vorher.

**Für neue Zeichen gilt daraus:** Ein Symbol im Knopf ist ein Pfad, kein
Buchstabe. Und wer einen Umriss von Hand schreibt, misst ihn nach — von den
drei Zeichen, die an diesem Tag neu entstanden (Zahnrad, Absperrbock,
Briefkasten), saßen **alle drei** daneben, zwischen 4,2 % und 6,3 %.

---

## 9. Spielstärke als Regler

Vier Knöpfe nebeneinander brauchten eine Zeile für sich, und mit drei Gegnern
waren das drei Zeilen. Jetzt ist es ein `<input type="range">` mit den vier
Namen darunter — die gewählte groß und golden, die anderen klein und grau.
Die Namen sind zugleich Knöpfe: Wer die Stufe kennt, tippt sie direkt an.

Ein echter Regler und kein Nachbau: Er bringt Pfeiltasten, das Ziehverhalten
des Geräts und die Vorlesehilfe mit. `aria-valuetext` steht ausdrücklich dabei
— ohne ihn liest ein Vorleseprogramm „2“ vor, und die Zahl steht nirgends auf
dem Bildschirm.

`font-size` bleibt aus dem Übergang heraus: Eine Schriftgröße, die überblendet,
rechnet in jedem Bild das Layout der ganzen Zeile neu. Der Sprung ist hier
ohnehin richtig — der Regler rastet, also rastet auch die Beschriftung.

### Der Weg der Stufe an den Bot

Das ist der interessante Teil, und er war nicht offensichtlich.

Der **Regelsatz** eines Tisches wird beim Erstellen festgeschrieben. Wer einen
WARTENDEN Tisch mit Bots auffüllt, kann ihm also keine `botStufen` nachreichen.
Die Tischeinstellung **`botLevel`** dagegen liegt in `gameTable.filters` und
lässt sich bis zum Start ändern — sie ist der einzige Weg, an dem dort noch
etwas ankommt.

Nur: `botAction(view, level)` bekommt die Stufe erst beim ZUG, und da ist es zu
spät. Ein Memory-Bot ist genau so stark wie sein Gedächtnis, und dessen Platz
im Partiezustand entsteht beim **Aufbau** der Partie — danach nie wieder.

Deshalb trägt `CreatePartyOptions` seit dem 27. August zwei weitere Felder:

```
botSeats?: readonly number[]   // welche Plätze ein Bot spielt
botLevel?: BotLevel            // wie stark, laut Tischeinstellung
```

Beide optional, andere Module merken nichts davon. Der Server füllt sie beim
Start aus den Sitzen, die keinen `accountId` haben — genau die, die eine Zeile
weiter dauerhaft Bots werden. Mememory baut daraus seine `botStufen`, **außer**
die `config` nennt schon welche: Im KI-Match hat jeder Gegner seine eigene
Stufe, und eine Tischeinstellung darf sie nicht überschreiben.

Die vier Stufen der Plattform gehen eins zu eins auf die vier des Spiels
(`stufeAusBotLevel`): anfänger–leicht, standard–mittel, experte–schwer,
genie–experte.

**Warum nicht einfach alle Sitze in `botStufen` eintragen:** Wer dort steht,
bekommt in `sichtFuer` die Liste der gesehenen Karten mitgeschickt. Für einen
Bot ist das nötig, für einen Menschen wäre es ein Geschenk. Deshalb genau die
Bot-Sitze und keinen mehr — geprüft in
`packages/server/test/mememory-botstufe.test.ts` (fünf Fälle, darunter „der
Platz des Menschen bekommt keine Stufe“).

---

## 10. Ein Kartenstapel je Punkt

In jeder Ecke liegt jetzt hinter dem Namen ein Stapel: eine Karte je Punkt.
Die Zahl steht weiter daneben — der Stapel ersetzt sie nicht, er macht sie
fühlbar: Man sieht auf einen Blick, wer vorn liegt, ohne zwei Zahlen zu
vergleichen.

Jede weitere Karte zeigt 5 px von sich, gerade genug für den Goldrand. Damit
bleibt auch der größtmögliche Stapel in der Ecke: 16 + 19 × 5 = 111 px gegen
42 % der Brettbreite (144 px auf einem schmalen Telefon). Zwanzig Punkte sind
das Maximum, das es überhaupt gibt (zwanzig Paare zu viert). Nachgemessen:
neun Karten sind 62 px breit.

Rechte Ecken stapeln nach links, linke nach rechts — der Stapel wächst also
immer ins Brett hinein und nie über den Bildschirmrand.

**Nur die neue Karte bewegt sich.** Eine CSS-Animation läuft, wenn ihr Knoten
entsteht; die schon liegenden Karten behalten ihren Schlüssel und damit ihren
Knoten. Ohne diese Eigenschaft zuckte bei jedem Punkt der ganze Stapel.

Zum Bild selbst siehe `docs/ASSETS-MEMEMORY.md`, Abschnitt 6: Am Brett bleibt
die Rückseite CSS, für den Stapel gibt es sie zusätzlich als 3,4-kB-WebP —
gerechnet aus denselben Zahlen, mit `scripts/mememory-karte-zeichnen.py`.

**Der Stapel hat den Puck des Gegners verdeckt.** In den OBEREN Ecken kehrt
`column-reverse` die Reihenfolge um: Der Stapel liegt dort unter dem Namen und
schiebt sich über seinen negativen Abstand in das Puckfach hinein (gemessen
2,5 px von 13). Weil er im Blatt später steht als der Puck, deckte er ihn ab —
beim Gegner also genau den Hinweis, dass er am Zug ist. `.mm-puck-fach` trägt
deshalb `position: relative; z-index: 2`. Nachgemessen mit `elementFromPoint`
im überlappten Streifen: mit der Zeile liegt dort `.mm-puck`, ohne sie ein
`<img>` des Stapels. Über dem BRETT lag der Puck ohnehin — `.mm-ecke` hat
z-index 3, `.mm-mitte` hat 1.

---

## 11. Zufallsgurt und Schlösser

Ein Schalter auf der Sammlungsseite: **„Random Memes"**. Ist er an, zieht jede
Partie drei aus der eigenen Sammlung — außer den Fächern, die man festhält.
Das Schloss ist offen und grau, wenn das Fach frei ist, und geschlossen und
golden, wenn es hält; das Fach trägt dann denselben goldenen Rand.

Die Zeile ist von links nach rechts **Würfel, Name, Schalter**, und der Name
steht **senkrecht mittig** darin. Dass er das nicht tat, war kein Zufall,
sondern eine Erbschaft: Weit oben in `styles.css` steht `label { margin-bottom:
0.75rem }` für die Formulare der Plattform. Ein Flexkasten mittet den
MARGIN-Kasten seiner Kinder, nicht die Schrift — mit zwölf Pixeln Luft unter
dem Wort stand es gemessene **sechs Pixel zu hoch** und legte nebenbei die
Zeilenhöhe auf 28 px fest, obwohl der höchste Teil (der Schalter) 27 misst. Ein
`margin: 0` an `.mm-schalter-name` ist die ganze Behebung; nachgemessen liegt
die Abweichung jetzt bei 0,0 px. Der Würfel ist
das einzige Zeichen in `zeichen.tsx` mit festen Farben statt `currentColor`:
mattes Cremeweiß mit schwarzen Augen. Ein einfarbiger Umriss sähe aus wie ein
leeres Kästchen. Gezeigt wird die **Fünf**, weil sie punktsymmetrisch ist und
das Augenbild damit von selbst mittig sitzt.

**Die Erklärung kommt auf Verlangen.** Wer den Namen gedrückt hält (400 ms),
bekommt einen Satz darüber eingeblendet; beim Loslassen ist er wieder weg. Er
sitzt 30 px über der Zeile — gemessen 49 px über dem Druckpunkt, also über der
Hand, die ihn gerade hält. Als feste Zeile darunter war er länger als das, was
er erklärt, und stand auch für die da, die den Schalter längst kennen.

Zwei Fallen stecken darin, beide sind gelöst:

* **Kein `<label>` um die ganze Zeile mehr.** Beim Loslassen schickt der
  Browser einen Klick auf die Beschriftung, und eine Beschriftung schaltet ihr
  Kästchen — wer sich die Erklärung ansah, hätte nebenbei den Schalter
  umgelegt. Der Klick nach einem langen Druck wird deshalb einmalig
  unterdrückt (`unterdrueckt`, 350 ms).
* **`pointer-events: none` an der Blase.** Sonst käme unter ihr ein
  `pointerleave` an und sie räumte sich selbst weg.

**Schloss und Schalter gibt es nur in diesem Modus.** Ohne Zufall hält der Gurt
ohnehin, was drinsteht — ein Schloss daneben wäre ein Knopf, der nichts tut,
und der ist schlimmer als gar keiner.

| | wo | wann geschrieben |
| --- | --- | --- |
| Schalter | `account.mememory_zufall` | sofort beim Umlegen (eigene Route) |
| Schlösser | `mememory_sammlung.gesperrt` | mit dem Gurt, 550 ms nach dem letzten Tipp |

Zwei getrennte Wege, und das ist Absicht: Beides in einem Aufruf hieße, dass
ein Umlegen des Schalters die halbfertige Auswahl darunter mit festschreibt.

**Der goldene Rand liegt auf einer eigenen Ebene.** Er war zuerst ein
`inset`-Schatten am Fach selbst — und ein Innenschatten zeichnet UNTER die
Kinder seines Kastens. Das Meme füllt das Fach vollständig aus und deckte den
Rand damit zu: sichtbar war er nur auf einem leeren Fach, also genau dort, wo
er nichts bedeutet. Jetzt trägt ihn `.mm-gurt-fach::after`, das letzte Kind.
Belegt sind es 2 px, festgehalten 3 px plus ein Schein nach außen.

**Und genau deshalb braucht das Schloss eine Nummer.** Ein `::after` ist das
letzte Kind — es liegt damit auch über dem Schloss, das in derselben Ecke
sitzt, und schnitt ihm den Rand an. Zu tippen war es weiter (die Ebene trägt
`pointer-events: none`), aber ein angeschnittener Knopf sieht nicht nach Knopf
aus. `.mm-fach-schloss` trägt deshalb `z-index: 2`. Nachgewiesen ohne
Bildschirmfoto: Gibt man der Randebene versuchsweise `pointer-events: auto`,
liefert `elementFromPoint` auf der Schlossmitte mit der Nummer den Knopf, ohne
sie das Fach darunter.

**Das Schloss hängt am FACH, nicht am Motiv.** Wer ein Motiv aus dem Fach
nimmt, nimmt das Schloss mit weg; wer den Gurt neu setzt, räumt alle Schlösser
mit. Eine eigene Tabelle wäre sauberer normalisiert und hier trotzdem falsch:
Der Gurt IST die Spalte `platz`, ein Fach ohne Motiv gibt es nicht.

**Gezogen wird im Client**, einmal beim Betreten eines Tisches. Das ist kein
Versehen: Der Gurt geht ohnehin nie an den Server — ans Brett kommt immer nur
das eine geworfene Motiv (`wirfMotiv` → `sendeReaktion`). Es gäbe also gar
keine Stelle, an der ein Server etwas zu ziehen hätte.

Migration `0023_mememory_zufallsgurt.sql`, zwei Spalten mit Vorgabewert: Ein
Konto von vor dem Deploy hat den Schalter aus und kein Fach gesperrt — genau
der Zustand, den es heute hat. Der Gurt-Aufruf nimmt `gesperrt` weiterhin
optional, damit ein noch laufender Client seinen Gurt setzen kann.

---

## 12. Meme-Töne

Seit dem **28. August 2026** hängt an jedem hochgeladenen Motiv ein Ton von
höchstens **0,8 Sekunden**. Er spielt in dem Moment, in dem das Meme über den
Tisch fliegt — beim eigenen Wurf, beim Wurf der Gegenseite und beim Zwischenruf
der KI.

**Warum gerade dort und nirgends sonst.** Ein Ton beim Aufdecken eines Paares
wäre zwölfmal je Partie, und der Gegner will sich in derselben Zeit Karten
merken. Der Wurf dagegen ist ohnehin schon eine Unterbrechung, gedeckelt auf
eines je Sekunde: Ton und Bild sind dieselbe Geste.

### Der Weg einer Tondatei

| Schritt | Wo | Was |
| --- | --- | --- |
| Auswählen | Bestandseditor | beliebige Datei, die der Browser abspielen kann |
| Schneiden | `tonschnitt.ts` | 0,8 s, Mono, 22050 Hz, 16 Bit → WAV als data-URL |
| Prüfen | `server/src/toene.ts` | Form, Magiebytes, Dauer aus dem WAV-Kopf |
| Ablegen | `mememory_motiv.ton` | dieselbe Zeile wie das Bild |
| Ausliefern | `/api/mememory/motive/:kennung/ton` | mit ETag, wie das Bild |
| Spielen | `klaenge.ts` | über denselben Regler wie alle anderen Töne |

**Geschnitten wird im Browser, wie beim Bild** — und aus demselben Grund: Eine
MP3-Datei vom Telefon wiegt Megabyte, und davon soll nicht einmal eine Sekunde
übrig bleiben. Gemessen: 3 s Stereo mit 44100 Hz gehen als **47 122 Zeichen**
hinaus, der Server legt 35 324 Bytes ab. Das ist die Rechnung 0,8 · 22050 · 2
plus 44 Bytes Kopf, auf das Byte genau.

**Nur WAV wird angenommen.** Nicht aus Bequemlichkeit: Bei WAV steht die Länge
im Kopf, ein MP3 müsste der Server erst dekodieren, um sie zu kennen. Und die
Länge ist der Punkt — die **Dateigröße** ist es ausdrücklich nicht. Zwei
Sekunden mit 8000 Hz sind 43 000 Zeichen und damit weit unter dem Deckel; wer
nur die Größe prüfte, ließe sie durch. Ein Test hält genau diesen Fall fest.

**Vorgeladen, nicht beim Wurf geholt.** Ein Flug dauert 1450 ms; ein Ton, der
danach ankommt, gehört zu einem Bild, das nicht mehr da ist. Geladen wird beim
Betreten des Tisches, und zwar nur das, was auf dem Brett liegt oder im eigenen
Gurt steckt — **und davon nur, was laut Server überhaupt einen Ton hat**
(`toene` in `/api/mememory/motive`). Ohne diese Liste wären es zwei Dutzend
Abrufe je Partie, von denen fast alle mit „nicht gefunden" enden. Gemessen an
einem Tisch mit zwei Gurtmemes, von denen eines einen Ton hat: **genau ein
Abruf**.

**Bei ausgeschaltetem Ton passiert gar nichts** — kein Kontext, kein Abruf,
kein Byte. Nachgemessen: Schalter aus, `ladeMemeToene` aufgerufen, null
Anfragen.

Die 88 Grundmotive können keinen Ton haben. Sie liegen als Dateien im Client
und stehen in keiner Tabelle; `motivTonPfad()` gibt für sie `null` zurück und
erspart den Abruf, der sicher scheitern würde.

**`null` und „kein Feld" sind zwei verschiedene Anweisungen.** Beim Ändern
heißt ein fehlendes `ton` „nicht angefasst" und `ton: null` „weg damit". Wer
das verwechselt, löscht bei jedem Umbenennen den Ton — ein Test hält auch das
fest.

---

## Dateien

| Datei | Was |
| --- | --- |
| `client/src/minispiele/mememory/Heim.tsx` | Streifen aus drei Seiten, Leiste unten |
| `client/src/minispiele/mememory/SammlungSeite.tsx` | Gurt und Bestand nach Gruppen |
| `client/src/minispiele/mememory/MehrSeite.tsx` | Baustellenhinweis, Vorschlagskasten, Freunde |
| `client/src/minispiele/mememory/Einstellungsfenster.tsx` | Lautstärke |
| `client/src/minispiele/mememory/Banner.tsx` | Banner der Spielauswahl, Takt und Konfetti |
| `client/src/zeichen.tsx` | Kreuz, Pfeil, Note, Haus, Winkel, Schloss, Würfel |
| `client/src/minispiele/mememory/Stufenregler.tsx` | Regler samt Stufenkatalog |
| `client/src/minispiele/mememory/tonschnitt.ts` | Tondatei auf 0,8 s Mono-WAV schneiden |
| `client/src/minispiele/mememory/klaenge.ts` | Töne des Spiels, Vorladen und Spielen der Meme-Töne |
| `server/src/toene.ts` | Form, Magiebytes und Dauer eines hochgeladenen Tons |
| `client/src/minispiele/mememory/Ecken.tsx` | Kartenstapel je Punkt |
| `scripts/mememory-karte-zeichnen.py` | erzeugt `karte-ruecken.webp` |
| `server/drizzle/0023_mememory_zufallsgurt.sql` | zwei Spalten |
| `server/test/mememory-botstufe.test.ts` | der Weg der Stufe an den Bot |
| `game-api/src/index.ts` | `botSeats` und `botLevel` in `CreatePartyOptions` |
| `server/src/tables/service.ts` | `verlasseKiTisch` |
| `server/src/runtime/party.ts` | `verwirf` |
| `server/test/ki-tisch-verlassen.test.ts` | vier Fälle |
