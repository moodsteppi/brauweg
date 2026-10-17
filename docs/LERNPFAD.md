# Doppelkopf lernen — Lernpfad und Lernserie

Seit dem 17.10.2026, **nur in der iOS-App** (Emile). Ein Tutorial nach dem
Duolingo-Muster: sieben kurze Lektionen, eine Tagesserie, und nach sieben
Tagen am Stück ein Pinguin-Outfit.

## Was man sieht

- **Start:** Lernkarte unter dem Trophäenweg — Flamme (grau, solange heute
  noch nichts gelernt ist), Tageszahl, sieben Striche bis zum Outfit.
- **Doppelkopf-Seite** (Reiter Spiele): Knopf „Doppelkopf lernen" unter
  „Zum Spiel".
- **Lernpfad** (Vollbild): Serie mit Wochenschutz, Belohnungskarte, sieben
  Stationen. Gesperrt ist, was nach der nächsten offenen Lektion kommt.
- **Lektion:** Fortschrittsbalken, eine Aufgabe je Schritt, unten grün
  („Richtig!" + Merksatz) oder rot („Nicht ganz" + Hinweis, „Nochmal").
- **Lektion 7** ist eine echte Runde am Übungstisch: drei Anfänger-Bots,
  Tipps über der Hand, beim Bedienen sind nicht erlaubte Karten abgedunkelt.
- **Feier** nach Tag sieben: Pinguin mit Doktorhut und Meisterrobe,
  „Gleich anziehen". Kam das Outfit über die Übungsrunde, erscheint die Feier
  beim nächsten Start (einmal je Gerät).
- **Push** „Deine Serie wartet": ab 19 Uhr (Berlin), wenn heute noch nicht
  gelernt wurde und die Serie läuft. Abschaltbar unter Mitteilungen →
  „Lernserie".

## Die Lektionen

| Kennung | Titel | Was geübt wird |
| --- | --- | --- |
| `karten` | Karten & Trumpf | Trumpf erkennen, Dulle, stärkster Trumpf |
| `bedienen` | Bedienen & Stiche | erlaubte Karte, stechen, wer den Stich bekommt |
| `augen` | Augen zählen | Kartenwerte, Stich zählen, 121 |
| `parteien` | Re & Kontra | Kreuz-Damen, eigene Partei, „gesund" |
| `sonderpunkte` | Fuchs, Karlchen, Doppelkopf | Fuchs sichern, 40-Augen-Stich |
| `ansagen` | Ansagen | Frist für Re, „keine 90" = 151 |
| `erste-runde` | Deine erste Runde | eine Runde am Übungstisch |

Hochzeit, Armut und Soli werden nur erwähnt („lernst du am Tisch kennen").

## Wo was steht

| Teil | Ort | Warum dort |
| --- | --- | --- |
| Lektionen und **richtige Antworten** | `packages/game-doppelkopf/src/lernen.ts` | Die Antwort ist eine Regel. Sie wird mit derselben Engine gerechnet wie am Tisch (`legalCards`, `resolveTrick`, `isTrump`, `mindestAugen`, `mayAnnounce`) — der Client bildet keine Regel nach. |
| Serie, Wochenschutz, Outfit, Erinnerung | `packages/server/src/lernpfad.ts` | Kalender (Berlin) und Besitz sind Serversache. |
| Endpunkte | `packages/server/src/http/lernpfad-routen.ts` | `GET /api/lernpfad`, `GET …/lektion/:id`, `POST …/lektion/:id/fertig`, `POST /api/lernpfad/uebung` |
| Übungstisch | `uebung` in den Tischfiltern, `runtime/party.ts` | endet nach der ersten Runde (`endAfterRound`), zählt dann `uebungGespielt` für jeden Menschen am Tisch |
| Tabelle | `drizzle/0034_lernpfad.sql` | eine Zeile je Konto |
| Bildschirme | `packages/client/src/lernen/` | Lernpfad, LektionSpieler, LernKarte, LernTipp, Feier |
| Outfit | `kosmetik.ts` (`LERN_OUTFIT`, Herkunft Geschenk), `pinguin.tsx` (Zeichnung) | gemalte Bilder bestellt in `docs/ASSETS-DOKO-MEISTER.md` |

## Die Serie — Regeln

- Ein **Spieltag** ist eine abgeschlossene Lektion (1–6) oder eine
  abgerechnete Übungsrunde. Mehrere am selben Tag zählen einmal.
- Gestern gespielt → Serie + 1. **Genau ein** Tag verpasst → der
  Wochenschutz überbrückt ihn (Serie + 1, der verpasste Tag zählt nicht mit),
  sofern der letzte Schutz mindestens sieben Tage zurückliegt. Sonst beginnt
  die Serie bei 1.
- Bei **Serie 7** gibt es das Outfit, genau einmal je Konto (`belohnt_am`).
  Die Serie zählt danach weiter.
- Normale Doppelkopf-Partien zählen **nicht** (Emiles Wahl).
- Geprüft in `packages/server/test/lernpfad.test.ts` (Kalenderlagen als reine
  Funktionen, Endpunkte, Outfit, Erinnerung, echte Übungsrunde).

## Offen

- Die Übungsrunde zeigt die Tipps nur auf dem Gerät, das den Tisch geöffnet
  hat (`lernen/uebung.ts`, Merkzettel im Gerät). Der Server weiß es zwar
  (`uebung`), schickt es aber nicht in der Tischnachricht mit.
- Die 3D-Figur im Profil trägt das Outfit nicht — sie hat bisher nur für die
  Wollmütze ein Modell (`docs/ASSETS-3D-ZUBEHOER.md`).
- Website: nicht freigeschaltet; die Schalter hängen an `inApp`
  (`GameSelect.tsx`, `Table.tsx`).
