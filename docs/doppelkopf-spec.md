# Doppelkopf-App — Spezifikation v0.2

Grundlage für die Implementierung mit Claude Code. Diese Datei beschreibt das
Zielsystem fachlich. Technologiewahl ist noch offen und am Ende als offener
Punkt vermerkt.

---

## 1. Projektziel

Eine Doppelkopf-App mit dem Alleinstellungsmerkmal **vollständig frei
konfigurierbarer Regelsätze**. Bestehende Apps (insbesondere Doppelkopfpalast)
bieten nur eine begrenzte Auswahl fest verdrahteter Optionen. Hier soll der
Tischersteller jede Regelvariante einzeln schalten können.

Gespielt wird primär mit echten Mitspielern. Bots sind ausdrücklich ein
Notbehelf, kein Kernfeature.

### Leitprinzip für die Architektur

Die **Regel-Engine ist eine reine Logik-Bibliothek ohne UI und ohne
Netzwerkcode**. Sie ist deterministisch (Seed für das Geben wird
hereingereicht), vollständig unit-testbar und kennt weder Spieler-Accounts noch
Trophäen. Alles andere (Server, Lobby, UI, Rangliste) baut darauf auf.

Begründung: Die Zählweise und die Vorbehalts-Logik sind der fehleranfälligste
Teil des Projekts. Sie müssen isoliert testbar sein, bevor eine Zeile UI
entsteht.

---

## 2. Kern-Datenobjekte

### 2.1 RuleSet

Ein **eigenständiges, versioniertes Objekt**. Nicht als Häkchenliste im
Tisch-Setup modellieren.

- Jeder Tisch speichert eine **Kopie beziehungsweise Referenz auf eine feste
  Version** des RuleSets. Spätere Änderungen am RuleSet dürfen abgeschlossene
  Partien nicht verändern.
- Jeder Account hat ein `lastUsedRuleSet`, das beim Öffnen des Tisch-Dialogs
  vorbelegt wird.
- Ein Verein hat einen `defaultRuleSet`, der für Vereinstische vorbelegt wird.
- **Keine mitgelieferten Presets.** Der Ersteller wählt alle Optionen selbst.

### 2.2 Weitere Objekte

- `Table` — Lobby, Sitzplätze, Zustand, Referenz auf RuleSet-Version
- `Party` (Partie) — Folge von Runden, Punktestand, Bock-Fenster,
  Pflichtsolo-Status
- `Round` (Runde) — Kartenverteilung, Vorbehalte, Ansagen, Stiche, Abrechnung
- `Trick` (Stich) — vier Karten, Gewinner, Augen
- `Account` — Trophäen, Statistik, Vereinszugehörigkeit

**Wichtig:** Währung und Matchmaking (Einsatz, Topf, Mindest-Sterne,
Mindest-Treue im Referenz-Screenshot) sind **kein Teil des RuleSets**. Strikt
trennen, sonst hängt die Regel-Logik später an einem Monetarisierungssystem.

---

## 3. Regelsatz-Optionen

Alle Optionen sind einzeln vom Ersteller schaltbar.

### 3.1 Blatt

| Option | Werte |
|---|---|
| Blatt | 48 Karten (mit Neunen) **oder** 40 Karten (Scharfer Doko) |

Kartenwerte: Ass 11, Zehn 10, König 4, Dame 3, Bube 2, Neun 0.
Gesamtsumme 240 Augen in beiden Varianten.

### 3.2 Trumpf und Grundvarianten

| Option | Beschreibung |
|---|---|
| Zweite Dulle sticht Erste | Bei zwei Herz-Zehnen im selben Stich gewinnt die zweite |
| Entschärfte Dullen | Die Herz-Zehn verliert den Trumpfstatus. Im Herz-Solo rutscht sie auf ihren Farbplatz zwischen Ass und König |
| Schweinchen | Beide Karo-Ass auf einer Hand werden höchster Trumpf |
| Superschweine | Derselbe Spieler hält zusätzlich das niedrigste Trumpfpaar (Neunen, bei Scharfem Doko Könige). Dieses steht **über** den Schweinchen, der Spieler hält damit die vier höchsten Karten |

Schweinchen und Superschwein gelten **automatisch ohne Ansage** und sind ab
Rundenbeginn für alle sichtbar. Beides greift nur, wenn Karo Trumpf ist, also
im Normalspiel und im Karo-Solo.

### 3.3 Sonderpunkte

Alle einzeln aktivierbar:

- **Fuchs gefangen** — Karo-Ass der Gegenpartei gestochen
- **Karlchen** — Kreuz-Bube gewinnt den letzten Stich
- **Doppelkopf** — Stich mit 40 oder mehr Augen
- **Charlie gefangen** — Kreuz-Bube der Gegenpartei im letzten Stich gestochen
- **Sonderpunkt für Herzstich (Herzdurchlauf)** — ein Herz-Fehlstich, in dem
  alle vier Spieler eine Herz-Fehlkarte bedienen (niemand trumpft, niemand ist
  blank)

Hinweis: Bei Scharfem Doko existieren nur vier Herz-Fehlkarten insgesamt, ein
Herzdurchlauf ist dort also höchstens einmal pro Runde möglich.

Schalter `spInSolo` steuert, ob Sonderpunkte auch im Solo gelten.

### 3.4 Vorbehalte

**Solospiele**, einzeln aktivierbar:
- Farbsolo (Kreuz, Pik, Herz, Karo)
- Damensolo
- Bubensolo
- Fleischlos / Knochenmann

**Hochzeit:**
- Die Braut hält beide Kreuz-Damen.
- **Klärung:** Partner wird der erste Spieler, der einen Stich gewinnt, den
  nicht die Braut macht. Frist sind die ersten drei Stiche.
- **Ungeklärt:** Nach Ablauf der Frist wird das Spiel zum Solo, die Braut
  spielt allein.
- **Stille Hochzeit:** Die Braut sagt nichts an und spielt von Anfang an
  allein. Sie wird wie ein Solo gewertet und **erfüllt das Pflichtsolo**, hat
  aber **kein Aufspiel**, weil sie still ist.

**Armut (Trumpfabgabe):**
- Ansagbar mit **höchstens drei Trümpfen**.
- Der Ansager gibt **alle** seine Trümpfe ab. Hat er keinen, gibt er drei
  beliebige Karten seiner Wahl.
- Der annehmende Partner gibt **genauso viele Karten seiner Wahl** zurück.
- Zusatzschalter: *Anzahl der zurückgegebenen Trümpfe wird öffentlich
  angesagt* (an/aus).
- **Annahme:** Es nimmt an, wer zuerst annimmt.
- **Niemand nimmt an:** Es wird neu gegeben.

**Rangfolge der Vorbehalte:**

> Solo → Schmeissen → Armut → Hochzeit.
> Bei gleicher Art entscheidet die Sitzreihenfolge ab Vorhand.

**Solo kommt raus:**
- Bei aktiviertem Schalter spielt der Solist immer aus.
- Ausnahme: Ein **Pflichtsolo hat immer Aufspiel**, unabhängig von diesem
  Schalter.

### 3.5 Schmeissen

Wird als Vorbehalt in der normalen Abfrage angemeldet.

- **Lusche:** die Neun. Bei Scharfem Doko gibt es keine Neunen, dort gilt der
  König. Die Definition wird aus der Blattvariante abgeleitet, genau wie beim
  Superschwein.
- **Volle:** Ass und Zehn.
- Schmeissen bei 5 Luschen (an/aus)
- Schmeissen bei 7 Vollen (an/aus)
- Konsequenz, Ersteller wählt eins von beidem:
  - Neu geben, keine Wertung
  - Neu geben **und** Bockrunde auslösen

### 3.6 Ansagen

**Re und Kontra:** möglich, solange der Spieler höchstens eine eigene Karte
gespielt hat (also bis unmittelbar vor seiner zweiten Karte).

**Absagen:** alle vier vorhanden, gestaffelt jeweils eine Karte später:

| Ansage | Spätestens vor der eigenen Karte Nr. |
|---|---|
| Re / Kontra | 2 |
| keine 90 | 3 |
| keine 60 | 4 |
| keine 30 | 5 |
| schwarz | 6 |

Jede Absage setzt die vorherige Stufe voraus.

**Re gehört der Partei, nicht dem Sitz.** Steht Re, kann der Partner es nicht
noch einmal sagen — wer nachlegen will, nimmt die nächste Stufe. Vorher nahm die
Engine ein zweites Re an: Es stand doppelt in der Anzeige, verdoppelte den
Spielwert aber nur einmal.

### 3.7 Pflichtansage

Mehrere Auslöser, und **jeder hebt die Pflicht um genau eine Stufe.** Gefordert
wird nicht eine feste Ansage, sondern die *nächste offene Stufe der Partei*: Hat
sie nichts gesagt, ist es Re beziehungsweise Kontra, sonst eine Stufe über ihrer
höchsten Absage. Steht die Partei auf schwarz, verfällt eine weitere Pflicht.

Daraus ergibt sich die Kette von selbst, ohne dass irgendwo eine Zahlenfolge
gepflegt werden muss: Hochzeit + Schweine + zwei fette Stiche ergeben Re,
keine 90, keine 60, keine 30.

**Der Bezugsstich:**

- **Normal:** der **erste** Stich.
- **Bei Hochzeit:** der **Klärungsstich** — vorher stehen die Parteien nicht
  fest, und eine Pflicht ohne bekannte Partei wäre nicht zuzuordnen. Weil die
  Klärung bis zum dritten Stich dauern kann, ist die Nummer nicht vorhersagbar.

**Auslöser:**

| Auslöser | Bedingung | Regel |
|---|---|---|
| Bezugsstich | 30 Augen oder mehr | `pflichtansage` |
| Bezugsstich | genau 29 Augen → **moralisch**, Ablehnen möglich | `pflichtansage` |
| Folgestich | der Stich **nach** dem Bezugsstich, ab 30 Augen — nur wenn im Bezugsstich eine Pflicht oder eine *zugestimmte* moralische Ansage zustande kam | `pflichtansageFolge` |
| Hochzeit | die Runde **ist** eine Hochzeit | `pflichtansageHochzeit` |
| Armut | die Runde **ist** eine Armut | `pflichtansageArmut` |
| Schweine | wer sie **hält** — nicht, wer sie spielt | `pflichtansageSchweine` |

**Die Folgeansage ist ein eigener Schalter.** Eine einzelne Pflicht ist eine
Regel, eine Kette eine andere: Wer nur den fetten ersten Stich bestrafen will,
soll nicht ungefragt eine Runde bekommen, in der Re, keine 90 und keine 60
hintereinander erzwungen werden.

**Hochzeit und Armut hängen am tatsächlich gespielten Spieltyp, nicht an der
Ansage.** Beide Regeln dürfen gleichzeitig an sein. Sagt einer Hochzeit und einer
Armut an, wird Armut gespielt (Armut sticht Hochzeit, 3.4) — der
Hochzeit-Ansager spielt seine Hochzeit gar nicht und bekommt deshalb **keine**
Pflicht.

**Nur der Bezugsstich verlängert die Kette.** Armut und Schweine schlagen vor dem
ersten Stich zu und verschieben nichts; die Hochzeit verlängert, weil sie den
Bezugsstich selbst verschiebt. Wer eine moralische Pflicht **ablehnt**, hat
nichts angesagt — dann wird der Folgestich nicht geprüft.

**Verhalten:** Popup mit Bestätigen-Button, der Grund steht dabei („Du hältst die
Schweine", „Der Klärungsstich hatte 34 Augen"). Bei 30 Augen und mehr sowie bei
Hochzeit, Armut und Schweinen ist **Ablehnen ausgegraut**; nur die moralische
Stufe bei 29 Augen lässt sich ablehnen. Mehrere gleichzeitig offene Pflichten
werden **hintereinander** abgefragt, nie zwei Blätter auf einmal.

**Der Schweine-Halter steht dauerhaft am Sitz**, solange `pflichtansageSchweine`
an ist — nicht als kurze Blase. Ohne die Regel bleibt es Geheimwissen und wird
nicht ausgeliefert.

### 3.7a Feigling (Hausregel, `feigling`)

Wer hoch gewinnt, ohne es angesagt zu haben, **verliert stattdessen**. Die Regel
bestraft das Sitzenlassen einer sicheren Hand; ohne sie ist Schweigen bei guten
Karten die risikoloseste Wahl.

Verlangt wird nach den Augen der **Verlierer**partei:

| Verliererpartei | Mindestansage |
|---|---|
| 60 und mehr | keine Pflicht |
| 30 bis 59 | Re / Kontra |
| 1 bis 29 | keine 90 |
| 0 (schwarz) | keine 60 |

Der Abstand ist durchgehend **zwei Stufen** auf der Leiter *nichts 0 · Re 1 ·
keine 90 = 2 · keine 60 = 3 · keine 30 = 4 · schwarz 5*. Ein knapper Sieg
verlangt deshalb nichts, und schwarz verlangt keine 60 statt keine 30.

Wird das verfehlt, **wechselt der Sieg zur Gegenpartei.** Der Spielwert bleibt,
was er ist — er beschreibt die Runde, nicht den Gewinner. Die **Sonderpunkte
bleiben bei dem, der sie erspielt hat:** Ein gefangener Fuchs ist gefangen, auch
wenn die Ansage zu leise war; aus Sicht des neuen Empfängers senken sie den Wert
deshalb, statt mitzuwandern.

`RoundResult.feigling` sagt, dass gedreht wurde. Die Oberfläche **muss** das
benennen: Ein Ergebnis, das dem Augenstand widerspricht, sieht sonst wie ein
Rechenfehler aus.

### 3.8 Bockrunden

- Aktivierbar mit **einzeln schaltbaren Auslösern**. Vorgesehen:
  - Rundenergebnis 0 Punkte (Gleichstand)
  - Re und Kontra wurden beide angesagt
  - (weitere Auslöser optional, zum Beispiel Solo, verlorenes Re)
- Schmeissen kann je nach Konfiguration ebenfalls auslösen (3.5).

**Fenster-Modell (verbindlich):**

> Jeder Auslöser erzeugt ein eigenes Fenster von **vier Runden**, beginnend mit
> der Folgerunde. Der Multiplikator einer Runde ist **2 hoch der Anzahl der auf
> sie überlappenden Fenster.**

Beispiel: Auslöser in Runde 0 erzeugt Fenster für Runden 1–4. Ein weiterer
Auslöser in Runde 1 erzeugt Fenster für Runden 2–5. Ergebnis: Runden 2, 3, 4
mit x4 (Doppelbock), Runde 5 mit x2.

- **Kein Multiplikator-Limit.**
- Bockrunden **verlängern die Partie nicht**. Reicht die verbleibende
  Rundenzahl nicht aus, endet die Partie regulär und der Rest verfällt.

### 3.9 Pflichtsolo

- **Genau ein Pflichtsolo pro Spieler pro Partie.**
- Das **erste** von einem Spieler angesagte Solo ist automatisch sein
  Pflichtsolo, inklusive Aufspiel.
- Jedes **weitere** Solo desselben Spielers ist ein Lustsolo. Aufspiel nur,
  wenn er ohnehin an der Reihe ist oder "Solo kommt raus" aktiviert ist.
- Wer bereits ein Solo gespielt hat, wird **nie vorgeführt**.

**Vorführ-Regel:**

> Zu Beginn einer Runde gilt: Ist die Anzahl der verbleibenden Runden
> (einschließlich der aktuellen) gleich der Anzahl der Spieler mit noch offenem
> Pflichtsolo, wird vorgeführt.

Reihenfolge bei mehreren gleichzeitig Vorgeführten: **nach Sitzreihenfolge ab
Vorhand.**

### 3.10 Zählweise

**Nur klassische Spielpunkte.** Keine DDV-Turnierpunkte.

Additive Posten:

| Posten | Wert |
|---|---|
| Grundwert | 1 |
| Gegen die Alten (Kontra gewinnt) | +1 |
| Verlierer unter 90 / 60 / 30 / schwarz | je +1 |
| Absage keine 90 / 60 / 30 / schwarz | je +1 |
| Sonderpunkt, netto zugunsten des Gewinners | je +1 |

Anschließend multiplikativ, **in dieser Reihenfolge**:

1. **Re angesagt** verdoppelt den Spielwert, **Kontra angesagt** verdoppelt
   erneut. Beide zusammen ergeben x4.
2. **Bock-Multiplikator** der Runde.

Solo: Der Solist erhält den dreifachen Wert, jeder Gegner den einfachen.

**Komplementärregel bei Absagen:** Wer eine Absage macht, muss sie selbst
erfüllen. Die Gegenpartei gewinnt bereits dadurch, dass sie die Absage
verhindert. Sagt Re "keine 90" an, braucht Re 151 Augen, Kontra hingegen nur
90 statt der sonst nötigen 120. Verfehlen beide Parteien ihre eigene Absage,
endet die Runde mit 0 und löst damit gegebenenfalls eine Bockrunde aus.

**Hinweis zur Varianz:** Beide Ansagen (x4) plus Doppelbock (x4) ergeben x16
auf eine einzelne Runde. Da "Re und Kontra angesagt" zugleich ein
Bock-Auslöser ist, verstärkt sich das über die Partie. Für die Rangliste
unkritisch, weil Trophäen an der Platzierung hängen.

---

## 4. Tisch und Lobby

### 4.1 Tischgrößen

- 4er-Tisch (Standard)
- 5er-Tisch, der Geber setzt aus
- 3er-Tisch mit einem Bot

### 4.2 Rundenzahl

Wählbar nur in **Vielfachen der Tischgröße**, damit eine volle Geberrunde
aufgeht.

- 4er-Tisch: 4, 8, 12, 16, …
- 5er-Tisch: 5, 10, 15, …
- 3er-Tisch: 4, 8, 12, … — der Dauerbot sitzt in der Rotation mit, eine volle
  Geberrunde dauert dort also vier Runden

### 4.3 Lobby-Typen

- **Öffentlich** — jeder tritt sofort bei
- **Auf Anfrage** — der Ersteller bestätigt
- **Nur Vereinsmitglieder**

### 4.4 Nachrücker

Wird ein Sitz frei, soll aus der Lobby ein Mensch nachrücken können, bevor ein
Bot einspringt.

---

## 5. Timeout, Verlassen und Bots

### 5.1 Timeout

- Sichtbarer **Balken über 60 Sekunden** pro Zug.
- Läuft der Balken ab: Der Bot spielt eine Karte, **der Spieler bleibt am
  Tisch.**
- Erst nach **drei aufeinanderfolgenden Timeouts** gilt der Spieler als
  ausgestiegen und die Verlassen-Logik greift.

Begründung: Ein einzelner Timeout durch Funkloch oder Türklingel darf keinen
Tisch auflösen.

### 5.2 Verlassen

- Die **laufende Runde wird zu Ende gespielt**, der Bot übernimmt.
- Danach wird **eine weitere Runde** gespielt (Karenz für Rückkehr).
- Kommt der Spieler nicht zurück: **Tisch wird aufgelöst.**
- Ausnahme: Ist noch ein Pflichtsolo des Ausgestiegenen offen, läuft die Partie
  mit Bot bis zum Ende des Pflichtsolo-Zyklus, dann Abrechnung und Auflösung.

### 5.3 Strafe

- **-10 Trophäen** für das Verlassen einer laufenden Partie.
- Zusätzlich wird der Aussteiger **als Letzter gewertet** (Platzierungs-Malus
  kommt obendrauf).
- Die erspielten Spielpunkte werden **dem Account zugeschrieben, nicht dem
  Bot.**
- Trophäen hängen am Account, nicht am Tisch. Ein neuer Tisch setzt nichts
  zurück.
- **Verlassen der Lobby vor Spielstart ist straffrei.**

### 5.4 Bot-Anforderungen

Der Bot muss **nicht stark sein, sondern unauffällig einspringen**. Er soll die
Runde nicht zerstören, aber kein Gegner-Ersatz sein.

Festzulegen im Datenmodell:
- Der Bot **darf keine Ansagen tätigen**, wenn er für einen Menschen einspringt.
- Punkte werden dem Account zugeschrieben.
- Empfohlener Ansatz für die Kartenwahl: Determinisierung mit
  Monte-Carlo-Rollouts (plausible Kartenverteilungen ausspielen, beste Karte im
  Mittel wählen). Für die Einspringer-Rolle reicht zunächst auch eine einfache
  regelbasierte Variante.

---

## 6. Trophäen und Ranglisten

### 6.1 Trophäen

- Trophäen werden **aus der Platzierung über die gesamte Partie** berechnet,
  **nicht** aus Spielpunkten.

  Begründung: Andernfalls wird ein Tisch mit Bockrunden und hohem Multiplikator
  zur Trophäen-Farm, und Spieler suchen den varianzreichsten Regelsatz statt der
  besten Gegner.

- Die Verteilung ist **nullsummig**, es entsteht keine Inflation.
- 3er-Tisch: **+6 / 0 / −6**
- 4er-Tisch: **+9 / +3 / −3 / −9**
- 5er-Tisch: **+12 / +6 / 0 / −6 / −12**

Die Werte sind so gewählt, dass die Mittelwertbildung bei Gleichstand immer
ganzzahlig bleibt. Bedingung: Jede zusammenhängende Platzgruppe muss eine
durch ihre Größe teilbare Summe haben.
- **Gleichstand:** Beteiligte erhalten den **Mittelwert** der betroffenen
  Plätze. Das erhält die Nullsumme.

### 6.2 Globale Rangliste

- **Alle Tische zählen gleich**, unabhängig vom Regelsatz. Durch die ordinale
  Platzierungswertung ist der Regelsatz für die Trophäenverteilung ohnehin
  irrelevant.
- **Ausnahme:** 3er-Tische mit Bot zählen **nicht** für die globale Rangliste.
- **Training-Modus:** keine Trophäen, keine Rangliste.

### 6.3 Missbrauchserkennung

Hauptrisiko ist **Absprache zwischen zwei Accounts an einem Tisch**, da
Doppelkopf mit verdeckter Partnerschaft gespielt wird und Platzierungen gezielt
gesteuert werden können.

Erforderlich:
- **Wiederholungs-Erkennung**: Flag, wenn dieselben Accounts überdurchschnittlich
  oft gemeinsam an öffentlichen Tischen sitzen.
- Auswertung von Auffälligkeiten in Ansage- und Abspielverhalten (später).

---

## 7. Vereine

- **Jeder kann einen Verein gründen.**
- Funktionen zum Start:
  - **Vereinseigener Regelsatz** als Vorgabe für Vereinstische
  - **Vereins-Rangliste** über eine Saison
  - **Rollen:** Admin, Mitglied, Gast
- Vereinstische sind der unkritische Ort für Ranglisten, da sich die Mitglieder
  kennen und Absprache dort kein Angriffsvektor ist.

---

## 8. Regelsatz-Validator

Nicht jede Kombination ist widerspruchsfrei. Der Validator prüft **beim
Speichern**, nicht erst zur Laufzeit. Andernfalls entstehen Regelsätze, bei
denen die Engine mitten in der Partie in einen undefinierten Zustand läuft.

Mindestens zu prüfen:

- Rundenzahl ist Vielfaches der Tischgröße
- Superschweine nur zusammen mit Schweinchen
- Absagen nur, wenn Re/Kontra aktiviert
- Mindestens ein Solospiel aktiv, wenn Pflichtsolo aktiviert
- Bock-Auslöser verweisen nur auf aktivierte Mechaniken (zum Beispiel Auslöser
  "Re und Kontra angesagt" setzt aktivierte Ansagen voraus)
- Schmeissen-Konsequenz "Bockrunde auslösen" setzt aktivierte Bockrunden voraus
- Herzdurchlauf bei Scharfem Doko: erlaubt, aber Hinweis anzeigen
- Trainingsmodus schließt Trophäenwertung aus

---

## 9. Spielablauf (Engine)

1. **Geben** — deterministisch aus Seed, 12 beziehungsweise 10 Karten pro
   Spieler
2. **Schmeiss-Prüfung** — falls aktiviert, Angebot an berechtigte Spieler
3. **Vorbehaltsabfrage** — in Sitzreihenfolge ab Vorhand
4. **Vorführ-Prüfung Pflichtsolo** — vor der Vorbehaltsabfrage
5. **Vorbehalts-Auflösung** — Rangfolge der Vorbehalte festlegen (offen, siehe
   Abschnitt 12)
6. **Parteibildung** — Kreuz-Damen, beziehungsweise Solo, Hochzeit, Armut
7. **Stiche** — 12 beziehungsweise 10 Stiche, Bedienzwang
8. **Ansagen** — parallel zum Stichverlauf, Fristen nach 3.6
9. **Pflichtansage-Prüfung** — nach erstem Stich beziehungsweise Klärungsstich
10. **Abrechnung** — Augen, Ansagen, Sonderpunkte, Bock-Multiplikator
11. **Bock-Auslöser prüfen** und Fenster registrieren
12. **Partie-Ende** — Platzierung ermitteln, Trophäen verteilen

---

## 10. Empfohlene Umsetzungsreihenfolge

1. **Regel-Engine als reine Bibliothek** ohne UI, ohne Netzwerk, vollständig
   unit-getestet
2. **RuleSet-Objekt plus Validator**
3. **Abrechnung** mit umfangreicher Testfall-Sammlung
4. **Bot** in der Einspringer-Variante
5. **Server und Persistenz**, Tisch- und Partie-Zustand
6. **UI**
7. **Trophäen, Ranglisten, Vereine**
8. **Missbrauchserkennung**

---

## 11. Teststrategie

Die **Zählweise ist tückischer als die Kartenlogik**. Ansagen, Absagen,
Sonderpunkte, Bock-Multiplikatoren und Solo-Abrechnung greifen ineinander.

Empfehlung: **Echte Vereinsabende als Testfälle erfassen** — vollständige
Runden mit Kartenverteilung, Ansagen und dem am Tisch ermittelten Ergebnis.
Diese Sammlung als Regressionstest gegen die Engine laufen lassen, bevor UI
entsteht.

Zusätzlich:
- Property-Tests: Augensumme immer 240, Trophäensumme pro Partie immer 0
- Fuzzing über zufällige RuleSets gegen den Validator

---

## 12. Offene Punkte

Das Regelwerk ist vollständig festgelegt. Offen sind nur noch Punkte außerhalb
der Regel-Engine:

1. **Saison-Länge** für Vereinsranglisten
2. **Trophäen-Untergrenze** — kann ein Account ins Minus rutschen
3. **Client-Stack** — die Engine ist TypeScript, der Client noch offen

Entschieden und umgesetzt: Währungssystem entfällt in v1, der Dauerbot am
3er-Tisch schuldet kein Pflichtsolo, die stille Hochzeit erfüllt das
Pflichtsolo.

---

## 13. Stand der Umsetzung

Die Regel-Engine ist als TypeScript-Bibliothek umgesetzt und getestet
(72 Tests). Umgesetzt sind: Blattvarianten, Trumpfordnung für alle sieben
Spielarten, Schweinchen und Superschwein, entschärfte Dullen, Bedienzwang,
Stichauswertung, Sonderpunkte, Ansagen und Absagen mit Komplementärregel,
Bock-Fenster, Pflichtsolo mit Vorführ-Regel, Pflichtansage, Vorbehalts-Rangfolge,
Hochzeit, Armut, Schmeissen, Trophäen und der Regelsatz-Validator.

Ebenfalls umgesetzt: die Rundenablauf-Maschine mit Sichtbarkeitsfilter (M1)
und die Partie-Maschine mit Geberrotation, Pflichtsolo-Zyklus und
Bock-Verwaltung (M2). Stand: 89 Tests.

Nicht umgesetzt: Bot, Server, Persistenz und UI.
