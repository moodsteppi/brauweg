# Klang

Töne, Musik und Vibration. Diese Datei sagt, **woher jeder Klang kommt**, was
er kosten darf und ab wann Musik nicht mehr ins Repo gehört.

Gebaut: 5. August 2026. Code: `packages/client/src/klang.ts` (das System),
`packages/client/src/tisch/klangtisch.ts` (was am Spieltisch klingt),
`packages/client/src/screens/Einstellungen.tsx` (die Regler).

---

## Herkunft und Lizenz

Alles Vorhandene stammt von **Kenney** und steht unter **CC0** — gemeinfrei,
für kommerzielle Nutzung frei, **keine Namensnennung verpflichtend**. Die
Lizenztexte liegen jedem Paket bei; Kenney schreibt dazu wörtlich, ein Hinweis
sei nett, aber nicht erforderlich.

| Paket | Woher | Lizenz | Was daraus wurde |
|---|---|---|---|
| Casino Audio | <https://kenney.nl/assets/casino-audio> | CC0 | Karten legen, geben, mischen, Stich einziehen, Kauf, Truhe |
| Interface Sounds | <https://kenney.nl/assets/interface-sounds> | CC0 | Dran, Ansage, Zuruf, Rundenende, Fehler, Tipp, Blatt auf/zu, Schalter, das ganze Paket „Glas" |
| Music Jingles | <https://kenney.nl/assets/music-jingles> | CC0 | Stufenaufstieg, Sieg, Niederlage |

Lizenzhinweis: <https://creativecommons.org/publicdomain/zero/1.0/>

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

23 Klänge, **123 kB zusammen** — weniger als zwei Kartenbilder. Dazu ein
zweites Klangpaket „Glas" mit 8 Dateien und 19 kB.

```
public/klang/           23 Dateien   123 kB   Grundsatz
public/klang/glas/       8 Dateien    19 kB   gekauftes Paket
```

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

## Musik: was fehlt und wo sie hingehört

**Es gibt noch kein einziges Musikstück.** Kenney hat keine Schleifen, nur
Jingles, und FreePD ist inzwischen dauerhaft geschlossen. Der Katalog in
`packages/server/src/tischware.ts` ist bei `musik` deshalb bewusst leer — aus
demselben Grund, aus dem die Kartenblätter dort lange leer standen: **Ein
gekauftes Stück, das nicht spielt, ist schlimmer als eines, das man noch nicht
kaufen kann.**

Der Weg ist eine Zeile je Stück und eine Datei:

```
musik('stube', 400)        →  public/klang/musik-stube.mp3
```

Welches Stück am Tisch läuft, ist Geschmack. Das sollte gehört und nicht
zugeteilt werden.

### Ab wann Musik nicht mehr ins Repo gehört

Beschlossen ist: **je Biom eine Schleife, dazu je Spiel eigene.** Das sind
sechs plus zwei, und damit kippt die Rechnung.

| Umfang | Größe | Wo |
|---|---|---|
| 1–2 Schleifen | bis 3 MB | Repo, `public/klang/` |
| 3–4 Schleifen | bis 6 MB | Repo, noch vertretbar |
| **ab 5 Schleifen** | **8 MB und mehr** | **eigener Ort** |

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

## Vibration

`navigator.vibrate()`. **Android kann es, das iPhone nicht** — Safari kennt
die Schnittstelle schlicht nicht, weder am Handy noch am Rechner, und es gibt
keinen Ersatzweg.

Der Schalter steht trotzdem in den Einstellungen, aber abgeblendet und mit
einem Satz dazu. Ein Schalter, der nichts tut, ist ärgerlicher als einer, der
erklärt, warum er nichts tut.

Vibriert wird an genau zwei Stellen: **wenn man am Zug ist** und **wenn der
Server eine Aktion ablehnt**. Beides sind Momente, in denen man gerade
woanders hinsieht. Mehr wäre Zappeln.

---

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

- **Musik gibt es noch nicht.** Quelle finden, Stücke aussuchen, dann Katalog
  und Ablageort.
- **`sieg`, `niederlage`, `stufe`** einmal anhören und gegebenenfalls tauschen.
- **Klangpakete und Musik haben keine Grafik.** Im Shop steht deshalb ein
  Zeichen (♪ und ♫) statt eines Bildes — bewusst, nicht vergessen: Ein `<img>`
  auf eine Datei, die es nicht gibt, wäre ein weißer Kasten. Sobald
  `icon-klang.webp` und `icon-musik.webp` gemalt sind, ist es je eine Zeile in
  `GameSelect.tsx`.
- **Die Auswahl steht am Gerät, nicht am Konto.** Lautstärke ist eine
  Eigenschaft des Kopfhörers und des Raums; wer abends leise spielt, will
  morgens in der Bahn nicht dieselbe Zahl. Paket und Musikstück stehen aus
  demselben Grund daneben — und weil beides nur zu hören und nie zu sehen ist,
  geht es keinen Mitspieler etwas an. **Gekauft** wird trotzdem am Server,
  sonst wäre der Kauf keiner. Wer das Gerät wechselt, behält den Besitz und
  stellt einmal neu ein.
