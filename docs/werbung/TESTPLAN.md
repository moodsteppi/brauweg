# Erster Werbetest — Testplan (100 €)

Stand 19.10.2026. Projekt „Brauweg erster Werbetest“. Getestet wird **Ad 2
„Drei Städte, eine Runde“** (`ad-2/konzept.md`, Abschnitt 9.7: Asset
`73c7aeb0`, 28 s, 9:16, mit KI-Kennzeichen). Ad 1 bleibt die Probe und läuft
nicht mit.

Die Frage, die der Test beantworten soll, lautet: **Welcher Kanal bringt
Menschen, die wirklich eine Runde spielen, und was kostet einer davon?**
Klicks und Aufrufe allein beantworten sie nicht. Sie stehen zwar im
Werbekonto, aber gezählt wird bei uns (`packages/server/src/herkunft.ts`).

**Entschieden wird ohne Schwelle** (Robin, 19.10.2026): Hauptzahl sind die
**Kosten je gespielter Runde**, Nebenzahl die **Klickrate** (Abschnitt 4).
Angelegt werden die Anzeigen im Tool, gelesen werden die Zahlen im
Creatives-Tab des bro-servers (Abschnitt 3 und 4).

**Kanal- und Kontonamen stehen hier als `<KANAL>`.** Der Name des Profils
wechselt eventuell auf „Broweg-Spielen“. Eingesetzt wird er erst beim
Anlegen, damit dieser Plan keinen Namen festschreibt, den es dann nicht mehr
gibt.

---

## 1. Bevor es losgeht (alle Punkte erfüllt, sonst kein Start)

| # | Was | Stand 19.10.2026 | Wer |
|---|---|---|---|
| 1 | **Die Messung ist in der Produktion.** `?q=` (#307) liegt nur auf `staging`. Auf `www.brauweg-spielen.de` antwortet `/api/herkunft/auswertung` mit **404**. Ohne Release laufen alle Klicks ins Leere, und es gibt keine Möglichkeit, sie nachträglich zuzuordnen. | fehlt | Release `staging` → `main` |
| 2 | **`HERKUNFT_SCHLUESSEL` gesetzt** (mindestens 20 Zeichen, sonst bleibt die Auswertung zu, `config.ts`), in der Produktion und im bro-server als Dienstzugang `brauweg` (in brotool anzulegen, keine Umgebungsvariable) | offen | Mensch mit Railway-Zugang |
| 3 | **Ad 2 freigegeben.** Robin sieht Asset `73c7aeb0` an und gibt es frei. Ausgespielt wird **nur das freigegebene Video mit KI-Kennzeichen** (Asset `73c7aeb0`), **nie** der Handschnitt `530610d1` (ohne KI-Kennzeichen). | offen | Robin |
| 3a | **KI-Kennzeichen im Video.** Es genügt, dass das ausgespielte Video das KI-Kennzeichen im Bild trägt (Asset `73c7aeb0`; das Tool lässt ohnehin nur gekennzeichnete Videos hinaus). Meta: Ein API-Feld für die KI-Kennzeichnung gibt es nicht, das Label „AI info“ setzt Meta selbst. Beim Einschalten nur ansehen, ob es erscheint, und vermerken — keine Bedingung für den Start. TikTok: Die KI-Selbstauskunft setzt das Tool beim Anlegen selbst. | — | wer einschaltet |
| 4 | **Datenschutzerklärung prüfen.** `rechtliches/datenschutz.html` sagt „keine Werbung, kein Tracking“. Seit #307 merkt sich ein Gastkonto aber, über welchen Werbelink es entstanden ist (`account.herkunft`). Das sollte dort stehen, bevor bezahlte Anzeigen auf die Seite führen. | offen | Robin |
| 5 | **Werbekonten mit Zahlungsmittel:** Meta-Werbekonto mit dem Instagram-Profil `<KANAL>`, TikTok-Werbekonto `<KANAL>`, beide im bro-server angebunden (Meta- und TikTok-Anbindung im Creatives-Tab) | ungeprüft | Robin |
| 6 | **Auswertung im Tool erreichbar.** `GET /creatives/herkunft` und `/creatives/link-kennungen` laufen im bro-server in der Produktion. Stand 19.10.2026 liegen sie erst auf einem Aufgabenzweig des bro-servers, nicht auf dessen `staging`. Die Anlage bei Meta und TikTok (`/creatives/meta`, `/creatives/tiktok`) ist dort schon. | fehlt | Release bro-server |
| 7 | **Probelauf** nach Abschnitt 5 grün | — | wer startet |

---

## 2. Kanäle und Aufteilung der 100 €

| Kanal | Kennung | Budget | Wie |
|---|---|---|---|
| Instagram (Meta) | `insta-ad2` | **50 €** | Anzeige mit Ziel „Traffic“ (Link-Klicks), nur Platzierungen **Reels und Stories** (9:16, für sie ist der Schnitt gebaut), Tagesbudget 7 € |
| TikTok | `tiktok-ad2` | **40 €** | Anzeige mit Ziel „Traffic“, Tagesbudget 6 € (zur Mindestgrenze siehe unten) |
| Bekannte | `bekannte-ad2` | **0 €** | Video und Link als Nachricht an 10–15 Menschen, dazu die Feedback-Runde (Abschnitt 6) |
| Reserve | — | **10 €** | geht ab Tag 4 an den Kanal, der dann weniger je gespielter Runde kostet (Abschnitt 4) |

**Warum fast halbe-halbe:** Der Test soll die beiden Kanäle vergleichen.
Ein Kanal mit 20 € liefert bei üblichen Klickpreisen zu wenige Besuche, um
überhaupt etwas zu zeigen. Instagram bekommt etwas mehr, weil die Zielgruppe
(25–55) dort breiter vertreten ist als auf TikTok.

**TikTok-Mindestbudget vor dem Start prüfen.** Im TikTok Ads Manager gilt
je Anzeigengruppe ein Mindest-Tagesbudget, zuletzt rund 20 €. Damit wären 40 €
schon nach zwei Tagen weg. Liegt die Grenze noch so hoch, gibt es zwei Wege:
(a) „Promote“ aus der TikTok-App auf ein Video im Profil `<KANAL>`, das geht
mit kleineren Tagesbeträgen und ebenfalls mit Link zur Webseite, oder
(b) zwei Tage à 20 € im Ads Manager, dann aber im Vergleich ausdrücklich
vermerken, dass TikTok kürzer lief. **Vorschlag: (a).** Nur so läuft TikTok
genauso lange wie Instagram. Bei (a) legt nicht das Tool die Anzeige an.
Dann wird `tiktok-ad2` wie `bekannte-ad2` von Hand unter
`/creatives/link-kennungen` eingetragen (Abschnitt 3), sonst fehlt TikTok in
der Auswertung, und das KI-Label wird beim Bewerben in der App von Hand
gesetzt.

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

**Anlegen über das Tool** (bro-server, Creatives-Tab), nicht von Hand im
Werbekonto:

| Kanal | Wo | Kennung |
|---|---|---|
| Instagram | `/creatives/meta`, Video Asset `73c7aeb0`, Ziel-Adresse `https://brauweg-spielen.de/` | `insta-ad2` ins Feld Kennung, nicht den Vorschlag des Tools |
| TikTok | `/creatives/tiktok`, Video Asset `73c7aeb0`, Ziel-Adresse `https://brauweg-spielen.de/` | `tiktok-ad2`, ebenso |
| Bekannte | `/creatives/link-kennungen`, **Kennung von Hand** | `bekannte-ad2` |
| Probelauf | `/creatives/link-kennungen`, Kennung von Hand | `probe-ad2` |

Das Tool hängt `?q=<kennung>` selbst an die Ziel-Adresse an. Die Anzeigen
entstehen **pausiert**. Eingeschaltet wird von Hand, im Werbeanzeigenmanager
von Meta bzw. im TikTok Ads Manager, beide zur selben Stunde (siehe
Laufzeit). Eine Kennung gilt nur einmal: Das Tool lehnt eine schon vergebene
ab, auch gegen die Kennungen von Hand.

**KI-Kennzeichnung:** Im Video steht „KI-generiert“ eingebrannt. Das Tool
lädt nur freigegebene Videos mit KI-Kennzeichen hoch und setzt bei TikTok die
KI-Selbstauskunft selbst. Das Kennzeichen im Video genügt. Bei Meta setzt das
Label „AI info“ die Plattform selbst (kein API-Feld); beim Einschalten nur
ansehen, ob es erscheint, und vermerken — es ist keine Bedingung (Abschnitt 1,
Punkt 3a).

---

## 4. Messen und entscheiden

**Abruf: die Auswertung im Creatives-Tab** (bro-server,
`GET /creatives/herkunft`). Sie holt die Summen je Kennung bei brauweg ab
(`/api/herkunft/auswertung`, mit dem Schlüssel aus Abschnitt 1, der nie in
eine Datei im Repo gehört), ordnet sie über die Kennung Anzeige und Kanal zu
und verrechnet sie mit den Kosten. Kosten je Runde und Klickrate stehen dort
fertig, von Hand rechnet sie niemand nach. Gezählt werden Kalendertage in
Berlin.

**Je Kanal, täglich um dieselbe Uhrzeit, aus der Auswertung festhalten:**

| Zahl | Bedeutung |
|---|---|
| Ausgabe, Impressionen, Link-Klicks | aus dem Werbekonto |
| `besuche` | Seitenaufrufe mit Kennung |
| `gastkonten` | daraus entstandene Gastkonten |
| `runden` | zu Ende gespielte Runden dieser Konten (je Konto gezählt) |
| `partien` | beendete Partien dieser Konten |

**Hauptzahl: Kosten je gespielter Runde** = Ausgabe ÷ `runden`. Sie misst,
was der Test wissen will: nicht wer kommt, sondern wer spielt.

**Nebenzahl: Klickrate** = Link-Klicks ÷ Impressionen. Sie sagt, ob die Ad
im Kanal überhaupt angeklickt wird, und trennt damit zwei Fehler: Ist die
Klickrate gut und sind die Kosten je Runde trotzdem hoch, liegt die Hürde
hinter dem Klick (Seite, Anmeldung, erste Runde), nicht in der Ad.

**Zusatz: Kosten je Gastkonto** (Ausgabe ÷ `gastkonten`) steht daneben,
entscheidet aber nicht mit.

**Es gibt keine Schwelle** (Robin, 19.10.2026). Verglichen werden die Kanäle
untereinander. Was eine Runde kosten darf, soll erst dieser Test zeigen,
keine vorab geschätzte Zahl.

**Prüfpunkte:**

- **Nach 24 h:** Hat jeder bezahlte Kanal Klicks, aber `besuche` bleibt 0,
  ist der Link kaputt. Anzeige anhalten und den Link prüfen, statt
  weiterzuzahlen.
- **Tag 4 (Sonntagabend nach dem ersten Wochenende):** Die 10 € Reserve gehen
  an den Kanal mit den niedrigeren Kosten je gespielter Runde, ohne
  Untergrenze.
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
4. In der Auswertung im Creatives-Tab bei `probe-ad2` (vorher von Hand unter
   `/creatives/link-kennungen` eingetragen, Abschnitt 3) nachsehen:
   `besuche` 2, `gastkonten` 2, `runden` mindestens 1.

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

| Kennung | **€ je Runde** | **Klickrate** | Ausgabe | Impressionen | Link-Klicks | besuche | gastkonten | runden | partien | € je Gastkonto |
|---|---|---|---|---|---|---|---|---|---|---|
| `insta-ad2` | | | | | | | | | | |
| `tiktok-ad2` | | | | | | | | | | |
| `bekannte-ad2` | — | — | 0 € | — | — | | | | | — |

Feedback (Kurzfassung je Frage):

1. —
2. —
3. —

Entscheidung für den nächsten Test: —
