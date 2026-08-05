# Feldherr — Übergabe

Stand: 5. August 2026, aus einer Chat-Sitzung ohne Zugriff auf das Remote.
Alles liegt als Patch bei; der Zweig existiert **nirgends auf GitHub**, nur in
diesen sieben Commits.

**Repo:** https://github.com/moodsteppi/brauweg
**Grundlage:** `origin/staging` bei `abab4dc` („3D-Truhenoeffnung, Ueberlappungen
im Profil weg"). Ist `staging` inzwischen weiter, siehe *Wenn `git am` klemmt*.

---

## 1. Einspielen

```bash
cd brauweg
git fetch origin staging
git checkout -b feldherr origin/staging
git am /pfad/zu/feldherr-komplett.patch
npm run build          # im WURZELVERZEICHNIS, nie --workspace
npm test
```

Dann wie üblich: Zweig pushen, `git pull --no-rebase origin staging`, mergen,
`staging` pushen. **`main` bleibt unangetastet** — dort hängt der Deploy.

### Wenn `git am` klemmt

`git am --3way` nimmt die meisten Verschiebungen. Bei einem Konflikt in
`package-lock.json` genügt `npm install`, dann `git am --continue`. Der einzige
Eingriff in bestehende Dateien ist klein und gut lokalisiert:

| Datei | Änderung |
|---|---|
| `packages/game-api/src/index.ts` | `GameId` um `'feldherr'` |
| `packages/server/src/games/registry.ts` | Modul in `MODULES` |
| `packages/server/package.json` | Abhängigkeit `@brauweg/game-feldherr` |
| `packages/server/test/tables.test.ts` | erwartet drei spielbare Spiele statt zwei |
| `packages/client/src/i18n.ts` | `'game.feldherr'` |
| `packages/client/src/App.tsx` | Weiche vor Lobby und Kartentisch |
| `packages/client/src/screens/GameSelect.tsx` | Kachel |

Alles andere sind neue Dateien.

---

## 2. Was Feldherr ist und warum es anders läuft

Ein Echtzeit-Taktikduell zu zweit auf einem geteilten Brett. **Es ist die erste
Echtzeitgattung im Haus**, und `GameModule` ist zugbasiert und ausdrücklich
uhrlos. Der Befund samt der drei möglichen Wege steht in
[`docs/FELDHERR-PLAN.md`](FELDHERR-PLAN.md) — **das ist die wichtigste Datei
für den Einstieg.**

Gewählt wurde **Weg B, Gleichschritt**: Der Server bleibt Schiedsrichter für
Tisch, Sitze, Start und Ende, die Partie rechnen beide Geräte selbst — aus
einem gemeinsamen Saatkorn und derselben Aktionsliste. Über die Leitung gehen
nur Spieleraktionen, davon hat eine Partie einige Dutzend statt zwanzig
Zuständen je Sekunde.

Daraus folgen zwei Dinge, die man beim Ändern kennen muss:

* **`currentActor` liefert immer null, `legalActions` ist leer.** In Echtzeit
  ist niemand am Zug. Die Partie-Laufzeit darf daraus **keinen Zugtimer**
  ableiten — ein Tisch ohne Aktion ist hier der Normalfall.
* **Der Spielkern muss bitgenau gleich rechnen.** Sein Zufall kommt
  ausschließlich aus `saat()` (mulberry32), nie aus `Math.random()`. Wer das
  aufweicht, bricht jedes Netzspiel — nicht sichtbar, sondern erst daran, dass
  beide einen anderen Sieger haben.

---

## 3. Entscheidungen (vom Auftraggeber, nicht verhandelbar ohne Rückfrage)

1. **Weg B**, Gleichschritt über den vorhandenen Tisch.
2. **Keine Belohnung für örtliche Partien** — weder gegen die KI noch zu zweit
   an einem Gerät. Beides lässt sich beliebig oft herbeiführen; ein Endpunkt,
   den nur der Client füllt, ist eine Münzquelle, und ein Tagesdeckel macht
   daraus nur eine langsamere. *(Ein solcher Endpunkt war schon gebaut und ist
   bewusst wieder entfernt worden — nicht erneut anlegen.)*
3. **Keine Rangliste** vorerst. Damit wird Weg C (Server rechnet mit) nicht
   gebraucht.
4. **Erfahrung nach Dauer mit fallendem Ertrag:** 20 Punkte je Minute für die
   ersten drei, danach halbiert sich jede weitere. 3 min → 60, 5 min → 75, ab
   8 min praktisch nichts mehr. Hinziehen soll sich nicht lohnen.
5. **Tagesaufgaben:** `partie-spielen`, `drei-partien` und `partie-gewinnen`
   zählen mit, die kartenspezifischen nicht. Braucht keine neue Aufgabe und
   keine Migration.
6. **Eigenes Paket** `game-feldherr`, das `GameModule` erfüllt.
7. **Keine Bildbestellung** für die Kachel; die SVG-Zeichnung genügt vorerst.

---

## 4. Was fertig ist

### `packages/game-feldherr` — das Spielmodul

13 Tests, grün. Saatkorn aus `CreatePartyOptions.seed`, Takte zu 50 ms, sechs
Takte Vorlauf für jede Aktion. Beide Geräte melden den Ausgang **getrennt mit
Prüfsumme**; weichen sie ab, ist die Partie strittig und niemand gewinnt.
Aufgeben und Aussteigen geben dem anderen den Sieg — ein Bot-Ersatz geht nicht,
die KI lebt im Spielkern auf den Geräten.

### `packages/client/src/minispiele/feldherr/kern.js` — der Spielkern

**Maschinell erzeugt**, nicht von Hand ändern:

```bash
node packages/game-feldherr/werkzeug/kern-erzeugen.mjs <feldherr.html>
```

Zwei getrennt gepflegte Fassungen liefen unweigerlich auseinander. Das Werkzeug
bricht ab, wenn es seine Ankerstellen in der Quelle nicht findet, statt
stillschweigend Halbes zu liefern.

Die eigenständige Spieldatei (`feldherr.html`, 185 kB, läuft per Doppelklick)
liegt bei und ist die Quelle. Sie trägt ihre eigene Dokumentation im Kopf —
Aufbau, Zustand, Zeichenschichten, die Regeln beim Ändern.

### Der Gleichschritt

Vier Dinge halten beide Geräte zusammen:

1. **Feste Takte von 50 ms** statt Bildzeit. Zwei Geräte haben nie dieselbe
   Bildfolge, und schon die dritte Nachkommastelle trennt beide Läufe.
2. **Eingaben werden gemeldet, nicht ausgeführt** — auch beim Absender. Nur so
   legen beide dieselbe Karte im selben Takt.
3. **Gerechnet wird höchstens bis zum sicheren Takt**, so weit die Züge beider
   Seiten bekannt sind. Rückstand wird mit bis zu zehn Takten je Bild aufgeholt.
4. **Prüfsumme** über Ressourcen und alle Objekte, die mit der Ergebnismeldung
   geht.

### Client

`FeldherrTisch.tsx` mit den drei Modi, angebunden an `useTable`. Weiche in
`App.tsx` vor Lobby und Kartentisch, Kachel in `GameSelect.tsx`,
Übersetzungsschlüssel.

---

## 5. Was offen ist — in dieser Reihenfolge

### a) Netzspiel im Browser ausprobieren **(zuerst)**

**Der Netzmodus ist nie in einem Browser gelaufen.** Er ist aus der
Chat-Umgebung heraus entstanden: übersetzt sauber, Modul getestet, aber zwei
echte Geräte an einem Tisch hat nie jemand gesehen. Erwartbare Stolpersteine:

* Der sichere Takt wird heute nur nachgezogen, wenn eine Nachricht kommt. Tut
  eine Weile niemand etwas, stockt die Partie. Wahrscheinlich braucht es einen
  Takt-Herzschlag oder eine Zeitgrenze.
* Der Münzwurf am Partieanfang läuft im Kern und ist noch **nicht** als Zug
  über die Leitung geführt — beide Geräte würfeln ihn aus demselben Saatkorn,
  aber die *Wahl* (Kopf oder Zahl) muss gemeldet werden. Zugart `muenze` ist im
  Modul und im Kern vorgesehen, aber nicht verdrahtet.
* Abriss und Drehen sind ebenfalls noch nicht als Züge geführt.

### b) Tisch erstellen und beitreten

Die Lobby fragt nach Sitzen und Rundenzahlen. Bei Feldherr sind beide
festgelegt (2 und 1) und sollten gar nicht erst erscheinen. Der Ablauf soll
sein: „Online spielen" → Tisch erstellen oder aus den offenen wählen. Der
Freundesweg besteht schon (`social/service.ts`), es genügt derselbe Filter.

### c) Abgleichprobe während der Partie

Die Prüfsumme geht heute nur mit dem Ergebnis. Alle 40 Takte gesendet, fiele
ein Auseinanderlaufen früher auf statt erst am unterschiedlichen Sieger.

### d) Tagesaufgaben verdrahten (Entscheidung 5)

---

## 6. Fallstricke, die schon Zeit gekostet haben

* **Der Kern war einmal falsch geschnitten:** Das Extraktionsskript traf auf
  `<style>` und `<body>` **im Dokumentationskommentar** der Spieldatei. Stil
  und Hülle enthielten Fließtext. Das Werkzeug entfernt den Kommentar jetzt
  zuerst — beim Ändern nicht wieder ausbauen.
* **Ein Belohnungsendpunkt zahlte auch gegen die KI.** Genau die Lücke, die
  Entscheidung 2 ausschließt. Entfernt.
* **`tables.test.js` wird in engen Containern nach ~100 s per SIGKILL
  abgeräumt**, *nach* dem letzten bestandenen Test. Sieht wie ein Fehlschlag
  aus, ist keiner — auf einer normalen Maschine läuft es durch.
* **React-Effekte an einen Schlüssel hängen, nicht an ein Objekt.** Der Effekt,
  der Züge in den Kern reicht, hängt an der *Anzahl* der Züge. Mit dem
  Sichten-Objekt in der Abhängigkeitsliste liefe er bei jedem Serverfunk neu —
  derselbe Fehler, an dem am Kartentisch schon einmal der Rundenabschluss
  verschwunden ist.
* **Nach Umbauten prüfen, ob jede aufgerufene Kernfunktion noch existiert.**
  Bei der Arbeit an der Spieldatei sind zweimal ganze Funktionsblöcke
  verlorengegangen und erst im Spiel aufgefallen.

---

## 7. Erster Befehl für die neue Sitzung

> Lies `docs/FELDHERR-PLAN.md` und `docs/FELDHERR-UEBERGABE.md`, dann bring das
> Netzspiel zum Laufen: Münzwurf, Abriss und Drehen als Züge führen, den
> sicheren Takt auch ohne eingehende Nachricht nachziehen, und zwei Browser an
> einem Tisch ausprobieren.
