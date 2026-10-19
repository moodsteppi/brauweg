# Erster Werbetest — Testplan (100 €)

Stand 19.10.2026. Projekt „Brauweg erster Werbetest“. Getestet wird **Ad 2
„Drei Städte, eine Runde“** (`ad-2/konzept.md`, Abschnitt 9.7: Asset
`73c7aeb0`, 28 s, 9:16, mit KI-Kennzeichen). Ad 1 bleibt die Probe und läuft
nicht mit.

Die Frage, die der Test beantworten soll, lautet: **Welcher Kanal bringt
Menschen, die wirklich eine Runde spielen, und was kostet einer davon?**
Klicks und Aufrufe allein beantworten sie nicht. Sie stehen zwar im
Werbekonto, aber gezählt wird bei uns (`packages/server/src/herkunft.ts`).

---

## 1. Bevor es losgeht (alle Punkte erfüllt, sonst kein Start)

| # | Was | Stand 19.10.2026 | Wer |
|---|---|---|---|
| 1 | **Die Messung ist in der Produktion.** `?q=` (#307) liegt nur auf `staging`. Auf `www.brauweg-spielen.de` antwortet `/api/herkunft/auswertung` mit **404**. Ohne Release laufen alle Klicks ins Leere, und es gibt keine Möglichkeit, sie nachträglich zuzuordnen. | fehlt | Release `staging` → `main` |
| 2 | **`HERKUNFT_SCHLUESSEL` gesetzt** (mindestens 20 Zeichen, sonst bleibt die Auswertung zu, `config.ts`), in der Produktion und im bro-server | offen | Mensch mit Railway-Zugang |
| 3 | **Ad 2 freigegeben.** Robin sieht Asset `73c7aeb0` an. Ausgespielt wird nur dieses Asset, **nie** den Handschnitt `530610d1` (ohne KI-Kennzeichen). | offen | Robin |
| 4 | **Datenschutzerklärung prüfen.** `rechtliches/datenschutz.html` sagt „keine Werbung, kein Tracking“. Seit #307 merkt sich ein Gastkonto aber, über welchen Werbelink es entstanden ist (`account.herkunft`). Das sollte dort stehen, bevor bezahlte Anzeigen auf die Seite führen. | offen | Robin |
| 5 | **Werbekonten mit Zahlungsmittel:** Meta-Werbekonto mit dem Instagram-Profil von Brauweg, TikTok-Werbekonto | ungeprüft | Robin |
| 6 | **Probelauf** nach Abschnitt 5 grün | — | wer startet |

---

## 2. Kanäle und Aufteilung der 100 €

| Kanal | Kennung | Budget | Wie |
|---|---|---|---|
| Instagram (Meta) | `insta-ad2` | **50 €** | Anzeige mit Ziel „Traffic“ (Link-Klicks), nur Platzierungen **Reels und Stories** (9:16, für sie ist der Schnitt gebaut), Tagesbudget 7 € |
| TikTok | `tiktok-ad2` | **40 €** | Anzeige mit Ziel „Traffic“, Tagesbudget 6 € (zur Mindestgrenze siehe unten) |
| Bekannte | `bekannte-ad2` | **0 €** | Video und Link als Nachricht an 10–15 Menschen, dazu die Feedback-Runde (Abschnitt 6) |
| Reserve | — | **10 €** | geht ab Tag 4 an den Kanal, der dann weniger je Gastkonto kostet (Abschnitt 4) |

**Warum fast halbe-halbe:** Der Test soll die beiden Kanäle vergleichen.
Ein Kanal mit 20 € liefert bei üblichen Klickpreisen zu wenige Besuche, um
überhaupt etwas zu zeigen. Instagram bekommt etwas mehr, weil die Zielgruppe
(25–55) dort breiter vertreten ist als auf TikTok.

**TikTok-Mindestbudget vor dem Start prüfen.** Im TikTok Ads Manager gilt
je Anzeigengruppe ein Mindest-Tagesbudget, zuletzt rund 20 €. Damit wären 40 €
schon nach zwei Tagen weg. Liegt die Grenze noch so hoch, gibt es zwei Wege:
(a) „Promote“ aus der TikTok-App auf ein Video im Brauweg-Profil, das geht
mit kleineren Tagesbeträgen und ebenfalls mit Link zur Webseite, oder
(b) zwei Tage à 20 € im Ads Manager, dann aber im Vergleich ausdrücklich
vermerken, dass TikTok kürzer lief. **Vorschlag: (a).** Nur so läuft TikTok
genauso lange wie Instagram.

**Die Bekannten kosten nichts und zählen getrennt.** Sie messen nicht den
Kanal, sondern ob jemand, der das Video von einem Freund bekommt, bis zur
ersten Runde durchkommt. Ihre Zahlen nie mit denen der bezahlten Kanäle
zusammenrechnen.

---

## 3. Zielgruppe, Laufzeit, Links

**Zielgruppe** (aus `ad-2/konzept.md`, Abschnitt 1):

- **Alter 25–55**, auf TikTok die Altersgruppen 25–34, 35–44, 45–54 (feiner
  lässt TikTok nicht wählen)
- **Deutschland**, Sprache Deutsch
- **Interessen:** Kartenspiele, Doppelkopf, Skat, Brett- und
  Gesellschaftsspiele, Spieleabende. Schlägt Meta eine „Advantage+“-Zielgruppe
  vor, **ausschalten**: Sonst wählt Meta selbst aus, und der Vergleich mit
  TikTok vergleicht zwei Algorithmen, nicht zwei Kanäle.
- Geschlecht: alle

**Laufzeit: 7 Tage, Donnerstag bis Mittwoch.** Die Ad erzählt vom Sonntag um
19:00, also muss ein Wochenende in der Laufzeit liegen. Ein Start am
Donnerstag gibt beiden Kanälen zwei Tage zum Einlaufen, bevor das Wochenende
kommt. Frühester Termin: der erste Donnerstag, an dem Abschnitt 1 erfüllt ist.
Beide bezahlten Kanäle starten **am selben Tag zur selben Stunde**.

**Links** (immer ohne `www`, die Domain antwortet direkt mit 200 und lässt
`?q=` stehen):

| Kanal | Link |
|---|---|
| Instagram | `https://brauweg-spielen.de/?q=insta-ad2` |
| TikTok | `https://brauweg-spielen.de/?q=tiktok-ad2` |
| Bekannte | `https://brauweg-spielen.de/?q=bekannte-ad2` |
| Probelauf | `https://brauweg-spielen.de/?q=probe-ad2` |

**Warum `-ad2` angehängt ist:** Die Summen bleiben bestehen
(`herkunft_zaehler` wächst nur). Ein späterer Test mit Ad 1 oder Drehbuch A
bekommt `insta-ad3` usw. und mischt sich nicht in diese Zahlen. Erlaubt sind
Kleinbuchstaben, Ziffern, `-` und `_`, höchstens 40 Zeichen. Eine andere
Kennung wird **still verworfen**, deshalb die Links genau so einsetzen.

**KI-Kennzeichnung:** Im Video steht „KI-generiert“ eingebrannt. Zusätzlich
beim Anlegen den Schalter der Plattform für KI-erzeugte Inhalte setzen (bei
Meta „KI-Info“, bei TikTok „KI-generierte Inhalte“).

---

## 4. Messen und entscheiden

**Abruf** (vom bro-server oder mit dem Schlüssel aus Abschnitt 1; der
Schlüssel gehört nie in eine Datei im Repo):

```bash
curl -s -H "x-herkunft-schluessel: $HERKUNFT_SCHLUESSEL" \
  "https://brauweg-spielen.de/api/herkunft/auswertung?von=JJJJ-MM-TT&bis=JJJJ-MM-TT"
```

Die Antwort enthält je Kennung die Summen und jeden Tag einzeln. Gezählt
werden Kalendertage in Berlin.

**Je Kanal, täglich um dieselbe Uhrzeit, in eine Tabelle:**

| Quelle | Zahl |
|---|---|
| Werbekonto | Ausgabe, Impressionen, Link-Klicks |
| `besuche` | Seitenaufrufe mit Kennung |
| `gastkonten` | daraus entstandene Gastkonten |
| `runden` | zu Ende gespielte Runden dieser Konten (je Konto gezählt) |
| `partien` | beendete Partien dieser Konten |

**Die eine Zahl, an der entschieden wird: Kosten je Gastkonto mit
mindestens einer Runde.** Weil `runden` eine Summe ist und keine Zahl von
Konten, gilt hilfsweise: Ausgabe ÷ `gastkonten`, und daneben `runden` ÷
`gastkonten`, also wie viel ein Geworbener spielt.

**Schwellen** (vorab gesetzt, damit man hinterher nicht nach Gefühl urteilt;
sie sind geschätzt, nicht aus Erfahrung):

| Kosten je Gastkonto | Bedeutung |
|---|---|
| unter 2 € | Kanal trägt, beim nächsten Test mehr Geld |
| 2–5 € | brauchbar, Ad oder Zielgruppe verbessern |
| über 5 € | Kanal trägt in dieser Form nicht |

**Prüfpunkte:**

- **Nach 24 h:** Hat jeder bezahlte Kanal Klicks, aber `besuche` bleibt 0,
  ist der Link kaputt. Anzeige anhalten und den Link prüfen, statt
  weiterzuzahlen.
- **Tag 4 (Sonntagabend nach dem ersten Wochenende):** Die 10 € Reserve gehen
  an den Kanal mit den niedrigeren Kosten je Gastkonto. Liegen beide über
  5 €, bleibt die Reserve liegen.
- **Tag 7:** Anzeigen enden, Abschlussabruf, Ergebnis in Abschnitt 7.
- **Tag 14:** ein zweiter Abruf. Kommen die Geworbenen wieder? Wächst
  `runden` nach dem Ende der Anzeigen weiter, sind es Spieler. Wenn nicht,
  waren es nur Neugierige.

**Was die Zahlen nicht sehen** (beim Lesen mitdenken):

- **Klick ≠ Besuch.** Lädt jemand die Seite im Browser der App neu, bevor
  er ein Gastkonto anlegt, geht die Kennung verloren (gewollt: kein Cookie,
  kein Speicher, `client/src/herkunft.ts`). Die Lücke zwischen Link-Klicks
  und `besuche` ist deshalb kein Fehler, solange `besuche` nicht 0 ist.
- **Nur Gastkonten.** Wer sich gleich mit Google oder Apple anmeldet oder
  schon ein Konto hat, zählt als Besuch, aber nicht als Gastkonto, und seine
  Runden zählen nicht. Das trifft vor allem die Bekannten. Ihre `runden` sind
  deshalb eine Untergrenze.
- **Wer die App später installiert**, kommt ohne Kennung an.

---

## 5. Probelauf (vor dem Start, in der Produktion)

1. `https://brauweg-spielen.de/?q=probe-ad2` am Handy **im Browser von
   Instagram** öffnen (Link per Direktnachricht an sich selbst), dann
   dasselbe in TikTok.
2. Adresszeile prüfen: `?q=` ist verschwunden.
3. Als Gast spielen, eine Runde Doppelkopf gegen Bots zu Ende spielen.
4. Auswertung mit `kennung=probe-ad2` abrufen: `besuche` 2, `gastkonten` 2,
   `runden` mindestens 1.

Der Probelauf benutzt eine eigene Kennung, damit die Kanalzahlen bei 0
beginnen.

---

## 6. Feedback-Runde mit Bekannten

**Wer:** 10–15 Menschen aus dem eigenen Umfeld, möglichst aus der
Zielgruppe (25–55, kennen Doppelkopf oder Skat). Nicht nur das Team.

**Wie:** Das Video (Asset `73c7aeb0`) und der Link `bekannte-ad2` gehen
**in einer Nachricht** raus, am ersten Tag der Laufzeit, **ohne Vorrede**
über die App. Die Fragen kommen erst zwei bis drei Tage später als zweite
Nachricht, damit sich niemand vorher darauf einstellt.

**Die drei Fragen:**

1. **„Worum ging es in dem Video? In einem Satz.“**
   Prüft die Kernbotschaft („Eure Runde gibt es noch, sie spielt jetzt in
   der App, von überall“). Wer „Kartenspiel-App“ sagt, hat das Produkt
   verstanden, aber nicht die Botschaft.
2. **„Hast du draufgeklickt und eine Runde gespielt? Wenn nein: Wo hast du
   aufgehört, und warum?“**
   Findet die Hürde zwischen Klick und erster Runde, die keine Zahl zeigt
   (Anmeldung, Ladezeit, „wusste nicht, wo ich hin soll“).
3. **„Wem würdest du den Link schicken, oder warum niemandem?“**
   Prüft, ob die Ad teilbar ist, wie das Drehbuch annimmt. Ein Name („meiner
   alten Runde aus Münster“) ist ein Ja, ein „vielleicht“ ist ein Nein.

**Festhalten:** Antworten sinngemäß und **ohne Namen** in Abschnitt 7.
Namen und Nachrichten gehören nicht ins Repo.

---

## 7. Ergebnis

*Wird nach Tag 7 und Tag 14 ausgefüllt.*

| Kennung | Ausgabe | Link-Klicks | besuche | gastkonten | runden | partien | € je Gastkonto |
|---|---|---|---|---|---|---|---|
| `insta-ad2` | | | | | | | |
| `tiktok-ad2` | | | | | | | |
| `bekannte-ad2` | 0 € | — | | | | | — |

Feedback (Kurzfassung je Frage):

1. —
2. —
3. —

Entscheidung für den nächsten Test: —
