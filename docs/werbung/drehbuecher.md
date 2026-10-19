# Brauweg-Ads — vier Drehbücher (A–D)

Stand 19.10.2026. Robin hat alle vier Drehbücher für gültig erklärt.
**B „Drei Städte, eine Runde" wird als Ad 2 umgesetzt**
(`docs/werbung/ad-2/konzept.md`); A, C und D liegen für später bereit.
Ad 1 („Dir fehlt der Vierte?", `docs/werbung/ad-1/konzept.md`) bleibt die
Probe und ist nicht Teil dieser Reihe.

Die Geschichte heißt bei keinem der vier „es fehlt der Vierte". Das hat Ad 1
schon erzählt. Diese Reihe soll ausgestrahlt werden und verweist aufs Web.

Quelle: die Vorlage an Robin, abgelegt im gemeinsamen Gedächtnis als Eintrag
`0918e8bb` („Brauweg-Ad: vier Drehbücher"). Die Tabellen unten sind derselbe
Inhalt, nur in Szenen aufgeteilt. Zielgruppe und der Absatz „Warum es taugt"
sind dazugekommen.

---

## Was für alle vier gilt

- **Format:** 9:16 hochkant, 25–30 s, ohne Ton verständlich (Einblendungen
  tragen die Geschichte, Musik und Geräusche sind Zugabe).
- **Nur Version 1.0:** Doppelkopf, Skat, Partykiste
  (`docs/store/PRUEFHINWEISE.md`). Alles andere steht in der App auf „Bald" und
  kommt nicht vor.
- **Kein Alkohol:** keine Gläser mit Bier oder Wein, keine Flaschen, keine
  Kneipe. In der Partykiste ist der Trinkspiel-Schalter nie im Bild.
- **Keine Marken und Logos im Bild:** auch keine Handys mit erkennbarem
  Herstellerlogo und keine Spielkarten mit Aufdruck eines Herstellers.
- **App-Szenen sind echte Bildschirmaufnahmen**, keine KI-Bilder eines
  Bildschirms. Werkzeug: `werkzeug/store/clips.mjs` (gegen staging, 1080 × 1920).
- **Erzeugt wird nach dem Verfahren** in bro-server
  `docs/creatives/ki-ads-verfahren.md`, mit den Lehren aus Ad 1, Abschnitt 9:
  realer Handy-Look statt Filmstill, jede Videoszene mit einer konkreten
  Handlung, Prompts aus einer Datei statt über die Kommandozeile, und kein
  Schwarzbild im Schnitt.

### Gemeinsame Endkarte

Drei Zeilen, deutsch, im Schnitt gesetzt (nicht im KI-Bild):

> **Brauweg · Doppelkopf · Skat · Partykiste**
> Jetzt im Browser spielen: **brauweg-spielen.de**
> App bald im App Store und bei Google Play

**Kein Store-Badge.** Das Apple- und das Google-Play-Abzeichen darf man erst
zeigen, wenn die App dort erschienen ist. Vorher steht der Satz nur als Text da.

---

## A — „12 Minuten Mittagspause" (Skat online mit Kollegen)

| Zeit | Bild | Einblendung |
|---|---|---|
| 0–2 s | Eine Hand stellt einen Kaffeebecher ab, auf dem Monitor steht 12:00 | Zwölf Minuten Pause. |
| 2–5 s | Bild in drei Teilen: Büro, Küche im Homeoffice, Lieferwagen — alle drei ziehen das Handy | — |
| 5–9 s | **App:** Tisch erstellen, zwei treten bei | Tisch auf. Kollegen rein. |
| 9–14 s | **App:** Reizen, „18 sagen"; dazwischen grinst der Fahrer | — |
| 14–19 s | Der Kollege im Homeoffice schlägt auf den Tisch, die Katze springt weg | Grand Hand. Natürlich. |
| 19–24 s | Monitor 12:11, alle legen das Handy weg und tun beschäftigt | Eine Runde geht immer. |
| 24–28 s | Endkarte | (siehe oben) |

- **Stärke:** Alltag, witzig, trägt die Kernbotschaft „online mit Freunden"
  ohne Erklärung.
- **Zielgruppe:** Berufstätige zwischen 25 und 45, die Skat können und in der
  Pause sonst allein am Handy sitzen.
- **KI-Risiko:** das Bild mit drei Orten. Drei Orte und drei Personen in
  *einem* Bild gelingen selten. Besser drei Einzelbilder, die erst im Schnitt
  geteilt werden. Dazu die Katze: Tiere in Bewegung verformt Kling gern.

**Warum es taugt:** Jeder kennt die kurze Pause, in der nichts passiert. Die
Pointe am Ende (12:11, alle tun beschäftigt) braucht kein Wort und macht die
Ad teilbar. „Tisch auf. Kollegen rein." zeigt in vier Sekunden, wie leicht der
Einstieg ist. Zugleich zeigt es den eigentlichen Nutzen: Man spielt
miteinander, obwohl man nicht am selben Ort ist.

---

## B — „Drei Städte, eine Runde" (die alte Doppelkopf-Runde) — **wird Ad 2**

| Zeit | Bild | Einblendung |
|---|---|---|
| 0–3 s | Ein altes, vergilbtes Foto: vier Freunde am Küchentisch mit Karten | Früher: jeden Sonntag. |
| 3–7 s | Schnelle Wechsel: Umzugskarton, Bahnsteig, leerer Küchentisch | Dann kam das Leben. |
| 7–11 s | Heute: drei Wohnzimmer (Hamburg, Köln, Leipzig), drei Sofas, die Handys in der Hand, Sonntag 19:00 | Heute: immer noch Sonntag. |
| 11–17 s | **App:** Doppelkopf, vier Spieler, ein Stich wird eingezogen | Doppelkopf. Wie früher. Nur weiter weg. |
| 17–23 s | Die Reaktionen gleichzeitig in drei Wohnzimmern: Lachen, Kopfschütteln, Faust | — |
| 23–28 s | Endkarte | (siehe oben) |

- **Stärke:** Gefühl, lässt sich gut teilen. Fast jeder hatte so eine Runde,
  die mit den Jahren auseinandergezogen ist.
- **Zielgruppe:** 25–55, mit fester Runde von früher (Schule, Studium, WG),
  heute über mehrere Städte verteilt.
- **KI-Risiko:** dieselben Gesichter über viele Jahre. Das alte Foto muss
  dieselben vier Menschen zeigen wie die Wohnzimmer von heute. Dagegen hilft
  je Figur ein Ankerbild mit Charakterbogen, einmal jung und einmal heute.

**Warum es taugt:** Die Geschichte erzählt keinen Mangel, sie erzählt eine
Treue. Die Runde gibt es noch, nur der Tisch ist jetzt die App. Der Satz
„Wie früher. Nur weiter weg." ist die ganze Kernbotschaft und funktioniert
ohne Ton. Die drei Reaktionen zur selben Sekunde in drei Städten zeigen den
Nutzen, ohne dass ein Bildschirm erklärt werden muss.

> Hinweis zur Umsetzung: Im Drehbuch steht „drei Handys". Vier Freunde in
> drei Städten heißt aber, dass in einer Stadt zwei sitzen, und jeder Sitz
> braucht ein eigenes Gerät. Ad 2 zeigt deshalb vier Handys, siehe
> `ad-2/konzept.md`, Abschnitt 4.

---

## C — „Opa, du bist dran" (Skat zwischen den Generationen)

| Zeit | Bild | Einblendung |
|---|---|---|
| 0–2 s | Ein Studentenzimmer bei Nacht, auf dem Handy die Nachricht „Opa: Bist du da?" | — (die Nachricht ist das Bild) |
| 2–6 s | Opa im Sessel, mit Lesebrille, das Handy in beiden Händen | — |
| 6–12 s | **App:** Skat, Opa reizt hoch | Er reizt seit 1974. |
| 12–17 s | Der Enkel stöhnt, Opa grinst still | — |
| 17–22 s | **App:** gewonnen; Opa schickt einen Daumen hoch | Opa gewinnt. Wie immer. |
| 22–28 s | Endkarte | (siehe oben) |

- **Stärke:** sympathisch, die Pointe ist klar. Es gibt nur zwei Figuren,
  deshalb lässt sich C am leichtesten realistisch erzeugen.
- **Zielgruppe:** breit, 20–70. Die Enkel sehen die Ad, die Großeltern sind
  der Grund, sie zu teilen.
- **KI-Risiko:** gering. Zu achten ist auf die Nachricht im Bild, denn KI-Bilder
  setzen lesbaren Text schlecht. Die Nachricht wird deshalb im Schnitt
  eingesetzt. Außerdem muss der Daumen hoch ein Zeichen der App sein oder als
  Einblendung kommen, kein Bild eines fremden Messengers.

**Warum es taugt:** Die Ad dreht ein Vorurteil um. Der Alte ist nicht derjenige,
dem man das Handy erklären muss, sondern der, der gewinnt. „Er reizt seit 1974"
verbindet die Erfahrung mit dem Spiel, ohne eine Regel zu erklären. Mit zwei
Gesichtern und zwei Orten ist C außerdem die günstigste der vier Ads.

---

## D — „Der Abend braucht noch was" (Partykiste)

| Zeit | Bild | Einblendung |
|---|---|---|
| 0–2 s | Wohnzimmer, fünf Leute starren gelangweilt jeder auf sein eigenes Handy | Der Abend braucht noch was. |
| 2–5 s | Eine steht auf und hält ihr Handy hoch | — |
| 5–10 s | **App:** Partykiste, eine alkoholfreie Kategorie; der Trinkspiel-Schalter ist NICHT im Bild | Partykiste. Ein Handy, alle dabei. |
| 10–18 s | Das Handy wandert reihum, Pantomime, alle prusten | — |
| 18–23 s | Weite Einstellung: der ganze Raum lacht, keiner schaut auf sein eigenes Handy | — |
| 23–28 s | Endkarte | (siehe oben) |

- **Stärke:** viel Energie, spricht eine jüngere Zielgruppe an.
- **Zielgruppe:** 18–35, Freundeskreise und WGs, Abende zu Hause.
- **KI-Risiko:** fünf Personen in einem Bild, Handys, die von Hand zu Hand
  gehen, und der Alkohol-Schalter. Die vorhandene Aufnahme
  `10-partykiste-start` zeigt den Schalter im Menü (Ad 1, Abschnitt 3). Für D
  braucht es eine eigene Aufnahme, die erst nach dem Menü beginnt.

**Warum es taugt:** D dreht den Vorwurf um, das Handy mache einsam. Am Anfang
sitzt jeder für sich, am Ende spielen alle zusammen mit einem einzigen Gerät.
Dieser Bogen ist in jeder Sekunde zu sehen, und die Partykiste ist das einzige
Spiel der 1.0, das ihn erzählen kann. D ist die teuerste und riskanteste der
vier Ads und kommt deshalb sinnvoll erst, wenn B und C gelaufen sind.
