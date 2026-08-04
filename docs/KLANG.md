# Klang

Töne und Musik. Diese Datei sagt, **woher jeder Klang kommt**, was
er kosten darf und ab wann Musik nicht mehr ins Repo gehört.

Gebaut: 5. August 2026. Code: `packages/client/src/klang.ts` (das System),
`packages/client/src/tisch/klangtisch.ts` (was am Spieltisch klingt),
`packages/client/src/screens/Einstellungen.tsx` (die Regler).

---

## Herkunft und Lizenz

**Alles steht unter CC0** — gemeinfrei, für kommerzielle Nutzung frei,
**keine Namensnennung verpflichtend**. Bei den Kenney-Paketen liegt der
Lizenztext bei; bei den Musikstücken wurde die Lizenz auf jeder einzelnen
Seite nachgesehen, nicht der Sammlung geglaubt, in der sie stehen.

### Töne — Kenney

| Paket | Woher | Lizenz | Was daraus wurde |
|---|---|---|---|
| Casino Audio | <https://kenney.nl/assets/casino-audio> | CC0 | Karten legen, geben, mischen, Stich einziehen, Kauf, Truhe |
| Interface Sounds | <https://kenney.nl/assets/interface-sounds> | CC0 | Dran, Ansage, Zuruf, Rundenende, Fehler, Tipp, Blatt auf/zu, Schalter, das ganze Paket „Glas" |
| Music Jingles | <https://kenney.nl/assets/music-jingles> | CC0 | Stufenaufstieg, Sieg, Niederlage |

### Musik — OpenGameArt

| Datei | Stück | Urheber | Woher | Lizenz |
|---|---|---|---|---|
| `musik-stube.mp3` | Wirtsstube (*Tavern*) | yd | <https://opengameart.org/content/tavern-0> | CC0 |
| `musik-wiese.mp3` | Wiesenlied (*Meadow Thoughts*) | Écrivain | <https://opengameart.org/content/meadow-thoughts> | CC0 |
| `musik-traeume.mp3` | Traumfeld (*The Field Of Dreams*) | pauliuw | <https://opengameart.org/content/the-field-of-dreams> | CC0 |
| `musik-dorf.mp3` | Dorfruinen (*Village Ruins*) | isaiah658 | <https://opengameart.org/content/village-ruins> | CC0 |

Lizenzhinweis: <https://creativecommons.org/publicdomain/zero/1.0/>

> Kenney und isaiah658 schreiben beide, ein Hinweis sei nett, aber nicht
> erforderlich. Wenn im Impressum ohnehin Platz ist, kostet ein Dank nichts.

Die **Originale** (die entpackten `.ogg` samt Lizenztexten) gehören ins
Archivrepo [`moodsteppi/brauweg-art`](https://github.com/moodsteppi/brauweg-art)
unter `klang/`, nicht ins Hauptrepo — dieselbe Regel wie bei den Bildern.

> **Drei Dateien sind nach Gehör zu prüfen:** `sieg.mp3`, `niederlage.mp3` und
> `stufe.mp3` kommen aus den Jingle-Paketen, und in keinem Dateinamen steht,
> welcher Jingle nach Sieg klingt und welcher nach Niederlage. Ausgewählt
> wurde nach Länge und Instrument, nicht nach Gehör. Tauschen heißt: eine
> Datei desselben Namens hinlegen, sonst nichts.

---

## Was es gibt

23 Klänge und vier Musikstücke.

```
public/klang/           23 Dateien   123 kB   Grundsatz
public/klang/glas/       8 Dateien    19 kB   gekauftes Paket
public/klang/musik-*     4 Dateien  5162 kB   Hintergrundmusik
```

Die Töne sind zusammen leichter als zwei Kartenbilder. Die Musik ist der
schwere Teil und damit auch der, den man im Blick behalten muss — siehe die
Grenze weiter unten.

**`stube` ist kostenlos**, aus demselben Grund wie die zwei freien Zurufe: Ein
Spiel, in dem nur zahlende Gäste Musik haben, ist für alle anderen ein stummes
Spiel. Es ist zugleich das kürzeste Stück (62 s) — wer nichts kauft, hört es
am häufigsten, und deshalb ist es das unaufdringlichste.

**Mehrere Dateien je Anlass sind Absicht.** Beim Kartenlegen gibt es drei
Varianten, und das System würfelt. In einer Doppelkopfpartie fällt vierzigmal
eine Karte; derselbe Klick fällt spätestens beim zwanzigsten Mal auf.

**Ein Paket muss nicht vollständig sein.** Was darin fehlt, kommt aus dem
Grundsatz. Deshalb sind acht Dateien ein ganzes Paket. Ohne diesen Rückfall
müsste jedes Paket 23 Dateien mitbringen — und dann entstünde nie ein zweites.

---

## Werkzeug

Wie bei den Bildern liegt der Wandler **außerhalb** beider Repos, weil auf
diesem Mac nichts davon installiert ist: kein `ffmpeg`, kein `lame`, kein
`sox`. Apples `afconvert` kann kein MP3 schreiben.

```bash
node ~/klangwerkzeug/wandeln.mjs <quelle> <ziel.mp3> [sfx|musik]
```

```bash
node ~/klangwerkzeug/wandeln.mjs --pruefe packages/client/public/klang
```

Das Werkzeug (`ffmpeg-static`) prüft selbst und bricht ab, statt Unsinn
abzulegen:

- **Zwei Durchgänge, nicht einer.** Durchgang eins misst den Spitzenwert,
  Durchgang zwei hebt ihn auf −1 dBFS. Die Klänge kommen aus verschiedenen
  Paketen und sind unterschiedlich ausgesteuert; ohne Angleichung ist der
  Klick doppelt so laut wie die Karte, und man dreht am Regler statt zu
  spielen. Auf −1 und nicht auf 0, weil der MP3-Wandler überschießen kann und
  ein übersteuerter Klick knackt.
- **Praktisch stumme Dateien werden abgelehnt.** Nirgends über −60 dB heißt
  fast immer: falsches Paket erwischt.
- **Budget je Art.** `sfx` 40 kB und 4 s, `musik` 2,6 MB und 4 min. Darüber
  gibt es eine Warnung.
- **Mono für Klänge, Stereo für Musik.** Ein Kartenklick hat keine Bühne;
  Stereo verdoppelt die Datei für nichts.

**Warum MP3 und nicht das kleinere Opus:** Safari spielt kein Ogg. Und Safari
ist kein Randfall — dort läuft die Beta.

---

## Musik

Vier Stücke, alle CC0 von OpenGameArt, zusammen 5,2 MB. Ausgesucht nach dem,
was zu einem Kartenabend passt: Harfe, ruhig, ohne Gesang und ohne Bogen, der
irgendwo hin will. Wer sie tauschen möchte, legt eine Datei desselben Namens
hin.

Ein neues Stück ist eine Zeile und eine Datei:

```
musik('stube', 400)        →  public/klang/musik-stube.mp3
```

**Kenney hat keine Schleifen**, nur Jingles, und FreePD ist inzwischen
dauerhaft geschlossen — die Suche führt also nicht dorthin zurück.
OpenGameArt hat eine CC0-Sammlung unter
<https://opengameart.org/content/cc0-music-0>; sie ist nutzergepflegt,
**deshalb die Lizenz immer auf der Einzelseite nachsehen** und nicht der
Sammlung glauben.

### Ab wann Musik nicht mehr ins Repo gehört

Beschlossen ist: **je Biom eine Schleife, dazu je Spiel eigene.** Das sind
sechs plus zwei, und damit kippt die Rechnung.

| Umfang | Größe | Wo |
|---|---|---|
| 1–2 Stücke | bis 3 MB | Repo, `public/klang/` |
| **3–4 Stücke** | **bis 6 MB** | **Repo — hier stehen wir gerade, bei 5,2 MB** |
| ab 5 Stücken | 8 MB und mehr | eigener Ort |

**Das nächste Stück ist also das, bei dem der Umzug ansteht.** Nicht später.

Der Grund ist derselbe wie bei den Bildern: Railway lädt bei jedem Deploy das
ganze Repo. 8 MB Musik, die kein Build anfasst und die die meisten Spieler nie
laden, kosten bei jedem einzelnen Deploy Zeit.

**Der Umzug ist vorbereitet und kostet keine Codeänderung.** In `klang.ts`
steht

```ts
const MUSIK_BASIS = (import.meta.env.VITE_KLANG_BASIS as string | undefined) ?? '';
```

Steht die Variable nicht, kommt Musik vom eigenen Ursprung. Zeigt sie auf
einen Ablageort, kommt sie von dort. Zwei Bedingungen an den Ort:

1. **HTTPS**, sonst blockt der Browser die Seite.
2. Die Musik läuft über ein einfaches `<audio>`-Element und **nicht** über die
   Web-Audio-Schnittstelle — genau deshalb braucht sie keine CORS-Kopfzeilen.
   Das war die Entscheidung, die den Umzug billig macht.

Töne bleiben immer beim eigenen Ursprung: 123 kB sind kein Auslagerungsfall,
und sie müssen sofort da sein.

---

## Warum Spotify weiterläuft

Das ist eine Zeile, und sie steht in `meldeTonsitzungAn()`:

```ts
navigator.audioSession.type = 'ambient';
```

Ohne sie stuft iOS eine Seite, die Ton abspielt, als `playback` ein und
**hält alles andere an** — man startet eine Partie, und die Musik im
Hintergrund ist weg. `ambient` heißt: Wir mischen uns unter, wir verdrängen
nichts.

Der Preis steht auch in den Einstellungen, weil man es sonst für kaputt hält:
**Am iPhone schaltet der Klingelschalter uns mit stumm.** Das ist die richtige
Seite des Tauschs.

Dazu kommt: Beim Wegschalten der Seite wird der AudioContext angehalten und
die Musik pausiert. Ein laufender Kontext hält auf Android den Tonfokus fest —
wer die Seite in den Hintergrund schiebt und weiterhört, soll uns nicht mehr
im Weg haben.

---

## Vibration — bewusst wieder ausgebaut

Es gab sie kurz, am 5. August, und sie ist am selben Tag wieder herausgeflogen.
Der Grund: **Android kann `navigator.vibrate()`, das iPhone nicht.** Safari
kennt die Schnittstelle schlicht nicht, weder am Handy noch am Rechner, und
es gibt keinen Ersatzweg. Ein Schalter, den die Hälfte der Beta-Geräte nur
abgeblendet zu sehen bekommt, ist eine Einstellung, die Fragen aufwirft statt
etwas einzustellen.

Wer sie zurückholen will, braucht drei Dinge: ein Feld `vibration` in
`Einstellungen`, ein `vibriere()` neben `spiele()`, und Aufrufe in
`tisch/klangtisch.ts` bei „am Zug" und „abgelehnt" — mehr wäre Zappeln.

## Wo etwas dazukommt

**Ein neuer Klang:** Datei nach `public/klang/`, Zeile in `DATEIEN` in
`klang.ts`, Aufruf `spiele('name')` an der passenden Stelle. Klingt es an
beiden Tischen, gehört der Aufruf nach `tisch/klangtisch.ts` und nicht in
`Table.tsx` — sonst hat der Zauberer ihn nicht.

**Ein neues Paket:** Ordner `public/klang/<name>/` mit den Dateien, die es
ersetzt. Eintrag `klang('<name>', preis)` in `tischware.ts`, Name in
`PAKET_NAMEN` in `klang.ts`. Der Rest fällt auf den Grundsatz zurück.

**Ein neues Musikstück:** Datei `public/klang/musik-<name>.mp3`, Eintrag
`musik('<name>', preis)` in `tischware.ts`. Beim Überschreiten der Grenze oben
zuerst den Ablageort einrichten.

---

## Offen

- **Der Umzug der Musik steht als Nächstes an** — siehe die Grenze oben. Beim
  fünften Stück, nicht danach.
- **`sieg`, `niederlage`, `stufe`** einmal anhören und gegebenenfalls tauschen.
  In keinem Dateinamen steht, welcher Jingle nach Sieg klingt.
- **Klangpakete und Musik haben keine Grafik.** Im Shop steht deshalb ein
  Zeichen (♪ und ♫) statt eines Bildes — bewusst, nicht vergessen: Ein `<img>`
  auf eine Datei, die es nicht gibt, wäre ein weißer Kasten. Sobald
  `icon-klang.webp` und `icon-musik.webp` gemalt sind, ist es je eine Zeile in
  `GameSelect.tsx`.
- **Die Auswahl steht am Gerät, nicht am Konto.** Lautstärke ist eine
  Eigenschaft des Kopfhörers und des Raums; wer abends leise spielt, will
  morgens in der Bahn nicht dieselbe Zahl. Musikstück und Klangpaket stehen aus
  demselben Grund daneben — und weil beides nur zu hören und nie zu sehen ist,
  geht es keinen Mitspieler etwas an. **Gekauft** wird trotzdem am Server,
  sonst wäre der Kauf keiner. Wer das Gerät wechselt, behält den Besitz und
  wählt einmal neu.
- **Die Stücke sind keine echten Schleifen.** Sie laufen mit `loop` und setzen
  am Ende neu an; MP3 hat vorn und hinten etwas Stille vom Wandler, also ist
  die Naht hörbar. Bei einem Stück, das eine Minute läuft, fällt das selten
  auf — bei einem kurzen Motiv würde es. Wer das loswerden will, braucht
  entschlüsselte Puffer statt `<audio>` und zahlt es mit Arbeitsspeicher.
