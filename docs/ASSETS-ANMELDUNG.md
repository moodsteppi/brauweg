# Bildbestellung: Anmeldung und Mails

Seit der Mailversand steht, ist die Anmeldung die Eingangstür: Jeder aus dem
Verein sieht sie als Erstes, noch vor dem Hub. Und sie ist der einzige
Bildschirm der App, für den es **überhaupt keine Gestaltung** gibt — kein
einziges CSS zu `.auth`, nur die nackten Browser-Vorgaben und eine graue
Box. Dahinter liegt die gemalte Weltkarte. Der Bruch ist maximal.

Dasselbe gilt für die zwei Mails (Adresse bestätigen, Passwort
zurücksetzen). Sie bestehen aus reinem Text, weil die Schnittstelle bisher
nur ein `text`-Feld kennt.

**Bestellt werden nur zwei Bilder.** Alles andere ist schon da und wird
wiederverwendet:

| Vorhanden | Wofür in der Anmeldung |
| --- | --- |
| `logo.png` | Der Brauweg-Schriftzug über dem Formular |
| `menue-blatt.webp` | Der Grund des Anmeldeformulars |
| `menue-feld.webp` | E-Mail, Passwort, Name, Einladungscode, Geburtstag |
| `menue-knopf-gruen.webp` | „Anmelden" und „Konto anlegen" |
| `menue-knopf-holz.webp` | Der Wechsel zwischen Anmelden und Registrieren |

---

## Für alle Bilder verbindlich

**Format**
- PNG mit **echtem Alphakanal** wo freigestellt, sonst PNG ohne Alpha.
- Farbraum sRGB.
- Geliefert wird in voller Auflösung nach `packages/client/art/`. Die
  Auslieferungsfassung als WebP erzeuge ich daraus — **Originale gehören
  nicht nach `public/`**. So sind schon einmal 13,9 MB mitgeliefert und
  ausgeliefert worden.

**Echte Transparenz — der häufigste Fehler**
Kein Schachbrett-Muster und keine weiße Fläche als „Transparenz". Probe:
auf knallroten Grund legen, sichtbar wird nur, was sichtbar sein soll,
ohne hellen Saum. Dreimal passiert.

**Was NICHT ins Bild gehört**
- **Keine Schrift** — mit einer begründeten Ausnahme beim Mailkopf, siehe
  dort. Auf dem Hintergrund der Anmeldung steht kein einziger Buchstabe:
  Der Schriftzug kommt als eigenes Bild darüber und muss frei skalierbar
  bleiben.
- **Keine Bedienelemente**, keine Knöpfe, keine Eingabefelder, kein
  Handyrahmen, kein Mauszeiger.
- **Kein Alkohol**: keine Krüge, Fässer, Hopfen. Auch nicht am Wirtshaus.
- **Keine Menschen mit erkennbaren Gesichtern.** Der Pinguin ist die
  Figur dieser Welt.

**Ton und Stil**
Wie `weltkarte.png`, `bg-clan.webp` und `bg-spieltisch.png`: gemalt, warm,
satt, freundlich. Handyspiel, kein Fotorealismus, kein Comic-Umriss.

---

## 1 — `bg-anmeldung.png`

**Wozu:** Der Hintergrund des Anmelde- und Registrierbildschirms. Trägt
darüber den Schriftzug und ein Formular von etwa 340 × 420 px.

**Format:** PNG, **1024 × 1536** (Hochkant 2:3), kein Alpha nötig.

**Motiv:** Das Wirtshaus von außen, am frühen Abend. Warmes Licht fällt aus
den Fenstern auf den Weg davor, die Tür steht einen Spalt offen. Die
Stimmung ist „komm rein, es ist schon jemand da" — nicht „geschlossene
Gesellschaft". Oben Dämmerhimmel, unten der Weg, der zur Tür führt.

**Freihalte-Zone — das Wichtigste an diesem Bild:** Die **mittleren 60 % der
Höhe** (25 % bis 85 %) müssen ruhig und eher dunkel sein. Dort liegt das
Formular, und darauf steht heller Text. Kein Fenster, keine Laterne, kein
heller Fleck in diesem Band. Das Motiv lebt oben (Himmel, Dach, Giebel) und
ganz unten (Weg, Schwelle).

**Beschnitt:** Auf hohen Handys bleiben verlässlich die mittleren 70 % der
Breite sichtbar (15 % bis 85 %). Die Tür gehört in diesen Streifen.

**Abnahme:** Ein weißer Textblock über der Bildmitte ist auf ganzer Breite
lesbar, ohne dass man das Bild abdunkeln muss.

---

## 2 — `mail-kopf.png`

**Wozu:** Der Kopf der beiden Mails (Adresse bestätigen, Passwort
zurücksetzen). Eine einzige Grafik ganz oben, darunter kommt Text.

**Format:** PNG, **1200 × 400**, kein Alpha (Mailprogramme rendern
Transparenz unzuverlässig, ein weißer Rest wäre sichtbar). Wird auf 600 px
Breite angezeigt, die doppelte Auflösung ist für scharfe Darstellung.

**Motiv:** Ein Querformat-Ausschnitt derselben Welt: Wirtshausschild oder
Giebel, warmes Licht, der Pinguin klein am Rand. Ruhig, keine Hektik.

**Ausnahme zur Schrift-Regel — hier ausdrücklich erwünscht:** In dieses
Bild **gehört der Brauweg-Schriftzug hinein**, gemalt wie auf `logo.png`.
Grund: In einer E-Mail lassen sich nicht zuverlässig zwei Bilder
übereinanderlegen, und ein separater Schriftzug würde bei vielen
Mailprogrammen verrutschen. Deshalb ein Bild, das für sich steht.

**Wichtig zu wissen:** Viele Mailprogramme laden Bilder erst nach
Bestätigung. Die Mail muss **auch ohne dieses Bild vollständig verständlich
sein** — das löse ich in der Mail selbst, mit einer Textüberschrift und
einem `alt`-Text. Es darf deshalb **keine Information nur im Bild stehen**:
kein Link, kein Code, keine Anweisung, keine Frist.

**Abnahme:** Auf 600 px Breite ist der Schriftzug klar lesbar, und das Bild
wirkt auf weißem wie auf dunklem Grund richtig — Mailprogramme setzen den
Hintergrund unterschiedlich, und viele erzwingen einen Dunkelmodus.

---

## Danach — was ich damit mache

**Anmeldung.** Der Hintergrund kommt hinter das Formular, der Schriftzug
darüber. Formular, Felder und Knöpfe bekommen den gemalten Satz von oben —
dafür sind keine neuen Bilder nötig, nur die Klassen aus `styles.css`.

**Mails.** Die Schnittstelle `Mail` kennt bisher nur `text`. Ich ergänze ein
optionales `html`-Feld, das der `ResendMailer` mitschickt; der
`ConsoleMailer` protokolliert weiterhin den Textteil, damit der Link im
Railway-Log lesbar bleibt, solange kein Schlüssel gesetzt ist. Jede Mail
geht dann in beiden Fassungen hinaus — das ist ohnehin die Erwartung von
Spamfiltern, und wer reinen Text bevorzugt, bekommt weiter reinen Text.

**Bis die Bilder da sind** wird der Rest schon gebaut: Formular, Felder und
Knöpfe im gemalten Stil, und die HTML-Mails mit Textüberschrift. Beides
funktioniert ohne die zwei neuen Bilder — der Hintergrund bleibt so lange
der vorhandene dunkle Verlauf, der Mailkopf entfällt ersatzlos. **Keine
Platzhalter unter den Zielnamen**: Ein leerer oder weiß gefüllter
Platzhalter ist schon zweimal live gegangen.
