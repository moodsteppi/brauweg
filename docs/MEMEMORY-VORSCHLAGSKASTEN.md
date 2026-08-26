# Mememory: Vorschlagskasten

Seit dem **26. August 2026** kommt ein neues Meme ohne Commit ins Spiel.
Vorher war jedes Bild ein Deploy: Datei nach
`packages/client/public/mememory/motive/`, Kennung in `motive.ts`, bauen,
pushen. Das ist der falsche Aufwand für ein Bild, das jemand unterwegs auf
dem Handy findet.

---

## Was es kann

| Wer | Weg | Ergebnis |
| --- | --- | --- |
| Jeder angemeldete Spieler | Briefkasten im Mememory-Menü → **mehrere** Bilder wählen → eines nach dem anderen zuschneiden → **Einreichen** | Die Bilder warten auf Freigabe |
| Aufsicht (Testkonto) | derselbe Knopf, Blatt **Hochladen** | Sofort im Spiel |
| Aufsicht | Blatt **Kasten** | Wartendes ✓ freigeben oder ✕ ablehnen (= löschen) |
| Aufsicht | Blatt **Bestand** | ✎ Name und Zuschnitt ändern · ✕ herausnehmen |

Alles vom Telefon aus, alles ohne Deploy. Der Briefkasten trägt für die
Aufsicht die Zahl der wartenden Vorschläge.

**Voraussetzung in der Produktion:** Die eigene Adresse muss in der
Railway-Variablen `STAFF_EMAILS` stehen. Sie wird beim Serverstart
angewandt (`staff.ts`) — es gibt bewusst keinen Endpunkt, über den sich
jemand das Merkmal selbst geben könnte.

---

## Nachträglich ändern (Bestand)

Jede Kachel im Bestand trägt zwei Knöpfe: **✎** öffnet denselben Zuschneider
wie beim Hochladen, mit Bild und Namen des Motivs; **✕** nimmt es heraus.
Bearbeiten links, Herausnehmen rechts — die zerstörerische Taste sitzt nicht
dort, wo der Daumen beim Blättern ohnehin liegt.

**Die Kennung bleibt beim Ändern.** Eine neue wäre einfacher zu bauen, träfe
aber jeden Tisch, der das Motiv schon in seiner `config` stehen hat: Dort
erschiene danach eine leere Karte. Der Preis dafür ist der Zwischenspeicher
der Browser — unter derselben Adresse liegt jetzt ein anderes Bild. Deshalb
liefert `GET /api/mememory/motive/:kennung` seit dem 26. August mit **ETag**
und `max-age=30, must-revalidate` statt mit fünf Minuten Frist: Der Browser
fragt kurz nach und bekommt meist ein 304 ohne Rumpf — billiger als das Bild
und immer aktuell. Die Marke ist `"<kennung>-<geprueftAm>"`, und `geprueftAm`
wandert bei jeder Änderung mit.

Während zugeschnitten wird, sind die Reiter ausgeblendet: Ein Wechsel mitten
im Zuschnitt würfe die Arbeit weg, und ein Kasten, der zwei Dinge gleichzeitig
anbietet, wird auf einem Telefon zum Ratespiel.

---

## Der Name im Spiel

Wird ein Paar gefunden, blitzt sein Name groß über dem Brett auf: fett,
zentriert, mit dreilagigem Schatten (harter Rand gegen jedes Motiv darunter,
weicher Schlagschatten für Tiefe, goldener Hauch für die Zugehörigkeit).

Die Bewegung — gemessen, nicht geschätzt:

| Zeit | Skalierung | Deckkraft |
| --- | --- | --- |
| 0 ms | 0,30 (klein, leicht tiefer) | 0 |
| 150–225 ms | 1,12 → 1,14 (Überschwingen) | 1 |
| 300–450 ms | 1,03 → 0,98 → 1,01 (einpendeln) | 1 |
| 525–1125 ms | 1,00 (steht) | 1 |
| 1200–1500 ms | 1,18 → 1,30 (wächst weg) | 0,4 → 0 |

**Animiert werden ausschließlich `transform` und `opacity`.** Das ist keine
Stilfrage: Nur diese beiden laufen im Compositor, also ohne Neuberechnung des
Layouts. Alles andere (`font-size`, `top`, `width`) ruckelt auf einem Telefon
sichtbar — gerade während das Brett gleichzeitig Karten dreht. Das
Überschwingen (1,14 → 0,98 → 1,00) ist der Unterschied zwischen
„eingeblendet" und „gelandet".

Die Schicht liegt über dem Brett, nimmt aber keine Tipper an
(`pointer-events: none`): Die Schaupause dauert nur 650 ms, und in der Zeit
darf man weiter auf Karten zielen. Wer Bewegung abbestellt hat
(`prefers-reduced-motion`), bekommt denselben Namen ohne Sprung.

**Namen haben nur die hochgeladenen Motive.** Die 88 Grundmotive heißen
nirgends anders als in ihrer Kennung, und eine aus `dj-katze` gebastelte
Beschriftung wäre geraten, nicht benannt — dort bleibt es still. `namen`
kommt öffentlich mit `GET /api/mememory/motive`, weil beide Seiten am Tisch
es anzeigen.

---

## Sammlung und Emote-Gurt

**Wer ein Motiv in einer Partie aufdeckt, hat es gesammelt.** Im Menü sitzt
neben dem Briefkasten ein zweiter Knopf (drei gestapelte Karten): Dort steht,
was zusammengekommen ist, und dort wählt man **bis zu drei** aus. Die
ersetzen am Tisch den Emoji-Knopf — statt eines wandernden Zeichens stehen
drei Memes bereit, und ein Tipp wirft eines über den Tisch.

Gesammelt wird alles, was auf dem Brett auftaucht: die 88 Grundmotive
genauso wie die hochgeladenen.

**Gemeldet wird vom Client, und das ist Absicht.** Wer eine Karte aufdeckt,
weiß es dort; der Server müsste sonst in den Spielzustand sehen, und das ist
die Grenze, die diese Plattform nicht überschreitet. Der Preis ist bekannt:
Mit der Entwicklerkonsole lässt sich eine Sammlung zusammenlügen. Sie ist
Schmuck — kein Preis, kein Handel, kein Vorteil im Spiel —, und wer sich
selbst Bilder in eine Liste schreibt, betrügt niemanden außer sich. Gemeldet
wird gebündelt mit 1,2 s Verzögerung; sonst fiele bei jedem Tipp eine
Anfrage an.

**Der Gurt wird serverseitig geprüft:** Hineinwählen lässt sich nur, was auch
gesammelt ist. Das ist die eine Stelle, an der die Sammlung wirklich etwas
bedeutet. Gespeichert wird beim Tippen auf „Auswahl merken", nicht bei jedem
Antippen — Auswählen ist ein Suchvorgang, und ein Dutzend Anfragen für eine
Entscheidung sieht man auf einer Mobilfunkleitung.

Beim Setzen wird **erst geräumt, dann gesetzt**. Sonst stolpert die zweite
Zuweisung über den eindeutigen Teilindex, sobald zwei Motive die Plätze
tauschen — ein Test sichert genau diesen Fall.

### Ein Meme als Reaktion

Der Reaktionskanal trug bisher nur eine **Zahl** (Platz im Zeichenvorrat des
Clients), und der Kommentar dazu lautete: „Aus einer Zahl lässt sich niemand
beleidigen." Für ein Meme braucht es eine Zeichenkette — das Feld `motiv`.
Der Grundsatz hält trotzdem:

- Geprüft wird die **Form** (`^[a-z0-9][a-z0-9-]{0,39}$`); Freitext kommt gar
  nicht erst durch das Gateway.
- Das Bild dahinter liefert der Server **nur aus, wenn es freigegeben ist**
  (`bildVon` filtert auf `frei`). Ein wartender oder erfundener Vorschlag
  erreicht die Gegenseite also nicht als Bild, sondern gar nicht.
- Keine Datenbankabfrage je Tipp: Bei vier Reaktionen je Sekunde wäre das
  nicht vertretbar, und die Auslieferung prüft ohnehin.

**Modulversion 3.** Ein Client der Version 2 kennt die Nachricht, nicht aber
das Feld — er zeigte das Emoji Nummer 0 und damit etwas anderes, als
geschickt wurde. Der Gateway lässt Motive deshalb erst ab 3 durch; Emojis
gehen weiterhin auch an 2. Dieselbe Lehre wie am 22. August, als Reaktionen
neu waren.

**Ist der Gurt leer, bleibt der Emoji-Knopf.** Ein frisches Konto hat noch
nichts gesammelt; lieber der alte Knopf als gar keine Reaktion.

---

## Der Stapel

Wer in der Galerie steht, hat selten genau ein Meme dabei. Die Auswahl ist
deshalb eine **Warteschlange**: zuschneiden, einreichen, das nächste kommt von
selbst. Oben steht „Bild 2 von 5" samt Perlenreihe, unten stehen
*Überspringen* und *Einreichen*; beim letzten Bild heißt der linke Knopf
*Verwerfen*. Darunter liegt für den Notfall „Dieses und die N übrigen
verwerfen". Am Ende steht eine Bilanz: wie viele eingereicht, wie viele
übersprungen, wie viele nicht lesbar waren.

Zwischen zwei Bildern steht eine **Wartefläche** in der Größe des Rahmens
(„Nächstes Bild wird geöffnet…"). Sie ist kein Schmuck: Solange entpackt wird
— auf einem Telefon bis zu anderthalb Sekunden bei einem 12-MP-Foto — darf es
keinen Rahmen geben. Sonst stünde dort ein Bild, dessen Speicher schon
freigegeben ist, und der erste Wisch darauf würde zeichnen wollen.
`drawImage` wirft auf ein geschlossenes `ImageBitmap`, und aus einem Effekt
heraus nimmt dieser Wurf den ganzen Bildschirm mit. Vor dem Stapel konnte das
nicht passieren: Da standen `close()` und `setBild(null)` immer in derselben
Runde, ohne `await` dazwischen.

Fünf Dinge daran sind wichtiger, als sie aussehen:

1. **Nur das aktuelle Bild ist entpackt.** In der Schlange liegen
   `File`-Verweise, kein Bildspeicher. Zehn Handyfotos gleichzeitig als
   `ImageBitmap` wären dreistellige Megabyte — auf dem Telefon wirft der
   Browser dafür den Tab weg.
2. **Ein unlesbares Bild hält den Stapel nicht an.** Es wird gezählt und
   überholt. Sonst reißt eine einzige HEIC-Datei aus der iOS-Galerie neun
   brauchbare Memes mit sich.
3. **Die Grenze wird vor dem Zuschneiden geprüft, nicht danach.** Ein Spieler
   darf fünf Vorschläge offen haben. Wer acht Bilder wählt und beim vierten
   ein Nein bekommt, hat drei umsonst zurechtgerückt — deshalb sagt
   `GET /api/mememory/eigene` vorher, wie viele noch gehen, und die Auswahl
   wird auf diese Zahl gekürzt (mit Hinweis). Jede Antwort auf ein
   Einreichen führt den Rest mit (`frei`), damit der Stapel nicht nach jedem
   Bild nachfragen muss.
4. **Höchstens 20 Bilder je Durchgang.** Nicht gegen Missbrauch — dagegen
   steht der Riegel im Server —, sondern gegen das Versehen: In der
   iOS-Galerie ist „alle auswählen" ein Griff.
5. **Jeder Durchgang hat eine Laufnummer** (`laufNr`). Wer abbricht, neu
   auswählt oder den Kasten schließt, erhöht sie — und ein noch laufendes
   Entpacken legt sein Ergebnis danach nicht mehr ab, sondern gibt es frei.
   Ohne diese Kennung kam ein gerade verworfener Stapel eine Sekunde später
   von selbst zurück. Der Riegel gegen den Doppeltipp steht daneben in einem
   Ref und nicht im Zustand: Zwei Tipper in derselben Ereignisrunde sehen
   beide noch den alten Zustand, und der zweite zählte sonst in der Bilanz
   mit, ohne etwas zu tun.

Hochgeladen wird weiterhin **eines nach dem anderen** (ein POST je Bild). Ein
Sammel-Endpunkt hätte die Rumpfgrenze von 128 kB gesprengt und im Fehlerfall
die Frage aufgeworfen, was von einem halb angenommenen Stapel gilt.

---

## Die vier Entscheidungen

**1. Bilder in die Datenbank, nicht auf die Platte.**
Railway baut bei jedem Deploy ein frisches Abbild. Was der laufende Dienst
auf die Platte schreibt, ist beim nächsten Push weg — ein hochgeladenes Bild
hätte genau bis zum nächsten Deploy gelebt. Gespeichert wird als data-URL in
einer Textspalte, wie das Profilbild (`account.avatar`), ausgeliefert als
Bytes über `GET /api/mememory/motive/<kennung>`.

**2. Zugeschnitten wird im Browser.**
Ein Meme ist selten quadratisch, und was daran wichtig ist, weiß nur der
Mensch davor: Die Pointe steht oft am Rand. Also ein quadratischer Rahmen zum
Schieben und Zoomen. Nebenbei geht dadurch nie ein 4-MB-Foto über die
Leitung — was den Server erreicht, ist ein Quadrat von 320 px (die
Grundmotive haben 256 px; hier sind es mehr, weil auf einem Meme oft Text
steht).

*Vorschau und Ergebnis sind dieselbe Funktion.* `malen()` zeichnet in die
Vorschau-Leinwand und in die Ausgabe-Leinwand; alle Maße sind Bruchteile der
Seitenlänge. Eine zweite Rechenstrecke für die Vorschau wäre die sichere Art,
ein Bild anders zu speichern, als es angezeigt wurde.

Die Fläche neben einem breiten Bild bekommt die **mittlere Randfarbe** des
Bildes. Ein fester weißer Balken sieht neben einem dunklen Meme aus wie ein
Ladefehler.

**3. Der Topf geht über die Tisch-`config`, nicht über den Server ins Modul.**
Das Spielmodul bleibt rein: kein Netz, keine Datenbank. Der Client hängt die
freigegebenen Kennungen beim Aufmachen eines Tisches als `zusatz` an die
`config`, das Modul legt sie zu seinem festen Katalog.

*Warum `zusatz` (ergänzend) und nicht `katalog` (ersetzend):* Der Client kennt
keine Spielregeln und damit auch die 88 Grundkennungen nicht. Müsste er den
vollständigen Topf schicken, bräuchte er eine zweite Abschrift von `MOTIVE` —
und zwei Abschriften laufen auseinander.

Fehlt das Feld, ist alles wie vorher: Jeder Tisch von vor dem 26. August und
jeder Tisch, den nicht der Mememory-Bildschirm aufmacht, spielt mit dem festen
Katalog. Weil die Liste **im Tisch** steht, ändert sich eine laufende Partie
nicht mehr, wenn nebenbei ein Bild freigegeben oder herausgenommen wird.

**4. Der Vorsatz `hoch-` ersetzt einen Katalogabruf.**
Was mit `hoch-` beginnt, holt der Client über `/api/mememory/motive/<kennung>`,
alles andere aus `public/`. Eine Stelle: `minispiele/mememory/bildpfad.ts`.
Ohne den Vorsatz müsste der Bildschirm erst einen Katalog laden, bevor er die
erste Karte zeichnen kann.

---

## Was wo steht

| Teil | Datei |
| --- | --- |
| Tabelle | `mememory_motiv`, Migration `0019_mememory_motive.sql` |
| Dienst | `packages/server/src/memes.ts` |
| Bildprüfung | `packages/server/src/bilder.ts` (geteilt mit dem Profilbild) |
| Endpunkte | `packages/server/src/http/app.ts`, Abschnitt „Mememory“ |
| Oberfläche | `packages/client/src/minispiele/mememory/Vorschlagskasten.tsx` |
| Bildpfad | `packages/client/src/minispiele/mememory/bildpfad.ts` |
| Feld im Regelsatz | `packages/game-mememory/src/regeln.ts` (`zusatz`) |
| Namensblitz | `packages/client/src/screens/Mememory.tsx` (`namensblitz`), `.mm-namensblitz` in styles.css |
| Sammlung (Server) | `packages/server/src/sammlung.ts`, Migration `0020_mememory_sammlung.sql` |
| Sammlung (Client) | `packages/client/src/minispiele/mememory/Sammlung.tsx` |
| Motiv als Reaktion | `packages/server/src/realtime/gateway.ts` (`MOTIV_AB_MODULVERSION`) |
| Tests | `packages/server/test/memes.test.ts` (19), `sammlung.test.ts` (8), `reaktion-motiv.test.ts` (3), `packages/game-mememory/test/zusatz.test.ts` (8) |

### Endpunkte

| Methode | Pfad | Wer |
| --- | --- | --- |
| GET | `/api/mememory/motive` | alle (nur Kennungen) |
| GET | `/api/mememory/eigene` | angemeldet (eigener Stand: `offen`, `frei`) |
| POST | `/api/mememory/sammlung` | angemeldet (aufgedeckte Motive melden) |
| GET | `/api/mememory/sammlung` | angemeldet (eigene Sammlung samt Gurt) |
| PUT | `/api/mememory/sammlung/gurt` | angemeldet (bis zu drei wählen) |
| GET | `/api/mememory/motive/:kennung` | alle (nur freigegebene) |
| POST | `/api/mememory/vorschlaege` | angemeldet (`direkt` wirkt nur bei der Aufsicht) |
| GET | `/api/mememory/vorschlaege` | Aufsicht |
| GET | `/api/mememory/vorschlaege/anzahl` | Aufsicht |
| POST | `/api/mememory/vorschlaege/:kennung/freigeben` | Aufsicht |
| PATCH | `/api/mememory/motive/:kennung` | Aufsicht (Name und/oder Bild) |
| DELETE | `/api/mememory/motive/:kennung` | Aufsicht |

---

## Grenzen

- **60 000 Zeichen** je Bild (~45 kB). Der Client verkleinert auf 320 px, der
  Riegel im Server steht für den Fall, dass jemand den Browser umgeht.
- **Fünf offene Vorschläge** je Konto (`OFFEN_MAX`). Ohne diese Zahl schüttet
  ein Einzelner den Kasten in einer Minute zu — beim Stapel-Upload erst recht.
  **Die Grenze hängt am Konto (`istStaff`), nicht am Knopf (`direkt`).** Sonst
  widerspräche sie der Auskunft aus `/api/mememory/eigene`, die schon immer
  nach dem Konto geht: Ein Testkonto, das ohne `direkt` einreicht, bekäme ein
  Nein, obwohl ihm dieselbe Anwendung „unbegrenzt" gemeldet hat.
- **20 Bilder je Stapel** im Client (`STAPEL_MAX`).
- **Der Typ in der data-URL wird nicht geglaubt.** Geprüft werden die ersten
  Bytes (`istEchtesBild`): Wer HTML als `image/png` hinterlegt, bekäme es sonst
  unter unserer eigenen Herkunft ausgeliefert — der kurze Weg zu XSS.
- **Abgelehnt heißt gelöscht.** Ein Zustand „abgelehnt“ wäre ein Bilderfriedhof
  aus genau dem Material, das man nicht aufbewahren will.

---

## Nächster Schritt: eigene Packs

Vorbereitet, nicht gebaut. Jede Zeile in `mememory_motiv` hat eine Spalte
`pack`; `NULL` ist der Grundtopf, den alle sehen. Ein eigener Pack braucht
später drei kleine Dinge und keinen Umbau:

1. **Pack-Kennung in die Spalte** — beim Einreichen mitgeben statt `NULL`.
2. **Filter in `freieKennungen(db)`** — heute fest auf `pack IS NULL`.
3. **Andere Liste in `zusatz`** — der Client schickt dann den Pack statt des
   Grundtopfs.

Soll ein Pack den Grundkatalog **ersetzen** statt ergänzen, kommt ein Feld
daneben (`nurZusatz`) und eine Zeile in `erstellePartie`. Sicht, Snapshot und
Bot bleiben unberührt.
