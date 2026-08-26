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
| Jeder angemeldete Spieler | Briefkasten im Mememory-Menü → Bild wählen → selbst zuschneiden → **Einreichen** | Das Bild wartet auf Freigabe |
| Aufsicht (Testkonto) | derselbe Knopf, Blatt **Hochladen** | Sofort im Spiel |
| Aufsicht | Blatt **Kasten** | Wartendes ✓ freigeben oder ✕ ablehnen (= löschen) |
| Aufsicht | Blatt **Bestand** | Ein freigegebenes Bild wieder herausnehmen |

Alles vom Telefon aus, alles ohne Deploy. Der Briefkasten trägt für die
Aufsicht die Zahl der wartenden Vorschläge.

**Voraussetzung in der Produktion:** Die eigene Adresse muss in der
Railway-Variablen `STAFF_EMAILS` stehen. Sie wird beim Serverstart
angewandt (`staff.ts`) — es gibt bewusst keinen Endpunkt, über den sich
jemand das Merkmal selbst geben könnte.

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
| Tests | `packages/server/test/memes.test.ts` (12), `packages/game-mememory/test/zusatz.test.ts` (8) |

### Endpunkte

| Methode | Pfad | Wer |
| --- | --- | --- |
| GET | `/api/mememory/motive` | alle (nur Kennungen) |
| GET | `/api/mememory/motive/:kennung` | alle (nur freigegebene) |
| POST | `/api/mememory/vorschlaege` | angemeldet (`direkt` wirkt nur bei der Aufsicht) |
| GET | `/api/mememory/vorschlaege` | Aufsicht |
| GET | `/api/mememory/vorschlaege/anzahl` | Aufsicht |
| POST | `/api/mememory/vorschlaege/:kennung/freigeben` | Aufsicht |
| DELETE | `/api/mememory/motive/:kennung` | Aufsicht |

---

## Grenzen

- **60 000 Zeichen** je Bild (~45 kB). Der Client verkleinert auf 320 px, der
  Riegel im Server steht für den Fall, dass jemand den Browser umgeht.
- **Fünf offene Vorschläge** je Konto. Ohne diese Zahl schüttet ein Einzelner
  den Kasten in einer Minute zu.
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
