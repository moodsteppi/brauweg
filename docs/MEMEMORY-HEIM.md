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
   ‹ Sammlung          M E M E M O R Y          Mehr ›
   (wischen nach       Online-Match · KI        (Vorschlagskasten,
    rechts)            Zahnrad oben rechts       Freunde, …)
```

Gewischt wird mit dem Finger nach rechts, um die Sammlung zu holen — dieselbe
Richtung wie überall sonst am Telefon: Der Finger zieht den Inhalt mit, und
was links liegt, kommt dabei ins Bild. Wer das nicht weiß, findet es
trotzdem: An beiden Rändern der Menüseite steht eine schmale Lasche
(`‹ Sammlung`, `Mehr ›`), und die tut beim Tippen dasselbe wie der Wisch.
Unten zeigen drei Punkte, wo man ist; sie sind zugleich Knöpfe.

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
Zurück-Knopf. Dahinter liegt heute die Lautstärke. Der Lautsprecher unten
rechts ist damit weg: Ein Schalter am Rand trägt genau eine Einstellung;
sobald die zweite kommt, braucht es ohnehin eine Stelle, an der man nachsieht.

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

Jetzt hängen dort **echte Bilder aus dem Vorschlagskasten** — dieselben, die
im Spiel auf den Karten liegen. Nur hochgeladene, ausdrücklich keine
Grundmotive: Die 88 aus dem Katalog sind gezeichnet und gerechnet; das Banner
soll zeigen, was die Leute selbst eingeschickt haben.

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

**Fällt der Abruf aus oder ist noch nichts eingereicht, bleibt es beim
gemalten Banner.** Eine leere rote Fläche sieht nach Fehler aus, das
Stillleben nach Absicht.

---

## 7. Zeichen sitzen jetzt mittig

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
mit `Kreuz`, `PfeilLinks` und `Note` — alle um (12, 12) gebaut und damit
mittig per Konstruktion. Die Größe kommt in `em` und richtet sich nach der
Schrift des Knopfes, damit jeder Knopf so groß bleibt wie vorher.

**Für neue Zeichen gilt daraus:** Ein Symbol im Knopf ist ein Pfad, kein
Buchstabe. Und wer einen Umriss von Hand schreibt, misst ihn nach — von den
drei Zeichen, die an diesem Tag neu entstanden (Zahnrad, Absperrbock,
Briefkasten), saßen **alle drei** daneben, zwischen 4,2 % und 6,3 %.

---

## Dateien

| Datei | Was |
| --- | --- |
| `client/src/minispiele/mememory/Heim.tsx` | Streifen aus drei Seiten, Laschen, Punkte |
| `client/src/minispiele/mememory/SammlungSeite.tsx` | Gurt und Bestand nach Gruppen |
| `client/src/minispiele/mememory/MehrSeite.tsx` | Baustellenhinweis, Vorschlagskasten, Freunde |
| `client/src/minispiele/mememory/Einstellungsfenster.tsx` | Lautstärke |
| `client/src/minispiele/mememory/Banner.tsx` | Banner der Spielauswahl |
| `client/src/zeichen.tsx` | Kreuz, Pfeil, Note |
| `server/src/tables/service.ts` | `verlasseKiTisch` |
| `server/src/runtime/party.ts` | `verwirf` |
| `server/test/ki-tisch-verlassen.test.ts` | vier Fälle |
