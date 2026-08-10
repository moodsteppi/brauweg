# Feldherr: Mitschnitt echter Netzpartien

**Wozu.** Feldherr wird auf dem Produktivsystem strittig. In jeder
Testfassung — headless, zwei Browser auf einem Rechner, örtlicher Server —
passiert es nicht. Das ist kein Zufall, sondern die Aussage des Fehlers:
Er hängt an etwas, das nur draußen vorkommt. Fremde Geräte, fremde Browser
(die `sort`-Falle vom 6. August 2026 trennte Safari von Chrome), echte
Funkstrecken, eingefrorene Tabs, ein Deploy mitten in der Partie.

Was sich nicht nachstellen lässt, muss aufgezeichnet werden, während es
passiert. Genau das tut diese Einrichtung: Sie schreibt den Gleichschritt
**beider** Geräte mit und legt ihn auf dem Server ab; ein Werkzeug meldet
sich an, holt ihn und stellt die Läufe gegeneinander.

---

## Erster Fund: der Antriebs-Worker war auf Produktion verboten

Gefunden am 10. August 2026, beim ersten Probelauf dieser Einrichtung —
gegen den **ausgelieferten** Stand, nicht gegen den Entwicklungsserver.

Der Spielkern hält den verdeckten Tab mit einem Web Worker am Leben
(`anbindung-fuss.js`): Dort feuert `requestAnimationFrame` nicht, und ohne
Antrieb steht der Kern still — er rechnet nicht, er pulst nicht, und die
Wissensgrenze der **Gegenseite** wandert nicht mehr. Am Handy passiert das
bei jedem kurzen Blick woandershin.

Der Worker entsteht aus einem Blob. Die Inhaltsrichtlinie des Servers setzte
kein `worker-src`; der Browser fällt dann auf `script-src 'self'` zurück und
blockiert ihn:

```
Creating a worker from 'blob:…' violates the following Content Security
Policy directive: "script-src 'self'". Note that 'worker-src' was not
explicitly set, so 'script-src' is used as a fallback. The action has
been blocked.
```

Das galt auf **jeder** Ausgabe, die den Client über diesen Server ausliefert
(Produktion und Staging), und auf **keiner** Entwicklungsfassung — Vite setzt
gar keine Richtlinie. Genau die Signatur, die der Auftraggeber beschrieben
hat: *„auf dem Produktivsystem strittig, in deinen Testversionen nie."*

Und es fiel nirgends auf: Ein verbotener Worker **wirft beim Erzeugen
nicht**. `new Worker` liefert ein Objekt zurück, das schweigt; der
`try/catch` im Kern lief also nie, und die Ausnahme kam asynchron über
`onerror` ins Leere.

**Behoben** durch `workerSrc: ["'self'", 'blob:']` in `http/app.ts`
(dazu `blob:` in `connect-src` — der GLTF-Lader holt die Texturen aus dem
GLB darüber, weshalb der Ritter in 3D ohne Textur blieb). Ein Test in
`test/diagnose.test.ts` hält beides fest. Nachgewiesen: In einem verdeckten
Tab meldet der Mitschnitt jetzt `antrieb: "worker"` und der Takt läuft
(vorher `antrieb: "keiner"`, Takt 0, kein einziger Puls).

**Ob damit alles erklärt ist, ist offen.** Das Einfrieren allein macht eine
Partie nicht strittig — die Gegenseite wartet dann sichtbar. Gefährlich wird
die Rückkehr: Ein eigener schwebender Zug verfällt nach 4 s, der Pulsdeckel
fällt weg, der gemeldete Stand springt über einen Zug hinweg, den der Server
danach ausliefert — `zugVersatz`. Deshalb bleibt die Aufzeichnung an; erst
die nächsten echten Partien sagen, ob noch etwas anderes darunterliegt.

---

## In drei Zeilen benutzen

```bash
export BRAUWEG_EMAIL=…            # Testkonto (STAFF_EMAILS am Dienst)
export BRAUWEG_PASSWORT=…
node packages/game-feldherr/werkzeug/diagnose-holen.mjs --stunden=24 --nur-strittig
```

Es entstehen zwei Dateien unter `diagnose/`:

* `feldherr-<zeit>.jsonl` — die Rohportionen, eine je Zeile
* `feldherr-<zeit>.md` — der Bericht: **wo** die beiden Läufe
  auseinandergingen, danach die Zeitleiste je Sitz

Weitere Schalter: `--ziel=https://staging.brauweg-spielen.de`,
`--tisch=<uuid>`, `--ordner=…`, `--schluessel=…`.

---

## Wie es aufgebaut ist

```
Gerät A ─┐                                   ┌─ POST /api/diagnose/feldherr
         ├─ aufzeichnung.ts (Ringpuffer) ────┤
Gerät B ─┘                                   └─ feldherr_diagnose (jsonb)
                                                        │
                            diagnose-holen.mjs ─────────┘  (Anmeldung + Abruf)
                                                        │
                                        diagnose/*.jsonl + *.md
```

**Client** (`packages/client/src/aufzeichnung.ts`). Ein Ringpuffer, der
nichts tut, solange keine Partie läuft. `FeldherrTisch.tsx` startet ihn mit
dem Kern und füttert ihn; `useTable.ts` trägt die Verbindungsereignisse bei.
Gesendet wird alle 20 Sekunden — und **sofort** bei Gleichlaufverlust, beim
Partieende, beim Verdecken des Tabs und beim Verlassen der Seite (dann per
`sendBeacon`, weil ein `fetch` beim Entladen abgebrochen wird).

**Kern** (`quelle/teile/anbindung-fuss.js`). Neu ist `netzStand()` — ein
reines Lesefenster auf Takt, Wissensgrenze, Zielstand, schwebende Züge und
die Prüfsummen beider Seiten. Und `aufStrittig` reicht jetzt mehr durch: bei
`probe` die **fremde** Summe, bei `zugVersatz` den Zug, der zu spät kam,
samt Wissensgrenze. Ohne diese Werte steht im Bericht nur „strittig".

**Server** (`src/diagnose.ts`, Tabelle `feldherr_diagnose`). Nimmt Portionen
entgegen und legt sie als `jsonb` ab — ungeprüft, mit Absicht: Ein Schema
über den Inhalt hieße, dass jeder neue Verdacht erst eine Migration braucht,
während der Fehler weiter unbeobachtet auftritt. Begrenzt wird über Größe
(`BODY_LIMIT`), Rate und eine Kappe je Sitz. Nach 14 Tagen verfallen die
Zeilen.

**Warum Datenbank und nicht Datei:** Auf Railway ist das Dateisystem
flüchtig. Der nächste Deploy wischt es — und genau dann will man nachsehen.
Die Datei entsteht auf dem Entwicklungsrechner, wenn das Werkzeug sie holt.

---

## Was mitgeschrieben wird

| Art | Wann | Inhalt |
|---|---|---|
| `start` | Kernstart, auch jede Selbstheilung | Laufnummer |
| `spur` | jede Sekunde | Takt, Gegnerstand, Wissensgrenze, Ziel, schwebende Züge, Rest-ms, Phase |
| `probe` | je 40er-Taktgrenze | eigene **und** fremde Prüfsumme, Ungleich-Marke |
| `melde` | eigener Befehl raus | geplanter Takt, Art, Feld |
| `zug` | Zug vom Server rein | Stelle in der Liste, Sitz, Takt, Art, Feld, eigener Stand |
| `gleichlauf-verloren` | `aufStrittig` | Grund, Takt, beide Summen, Heilungszähler |
| `meldeErgebnis` / `ausgang` | Partieende | eigene Meldung, Urteil des Servers, beide Meldungen |
| `ws-*`, `wachhund`, `abgleich` | Verbindung | Abbruch, Wartezeit, abgelehnte Aktion, nachgereichte Züge |
| `stockt`, `tab` | Zustandswechsel | Takt steht / Tab verdeckt |
| `fehler`, `warnung` | immer | Fehlercode, Text, Herkunft, Aufrufkette |

Dazu je Sendung ein Kopf: Saatkorn, Feldgröße, Held, Protokollfassung,
**Bündelkennung** (`index-C5dCIAYC.js` — zwei verschiedene Hashes heißen:
zwei verschiedene Spielfassungen gegeneinander) und Gerätedaten (User-Agent,
Bildschirm, Kerne, Zeitzone).

Was **nicht** mitgeschrieben wird: Spielinhalte über die Züge hinaus, Namen,
Chat, Adressen. Was gespielt wurde, steht ohnehin in der Zugliste des
Servers; der Mitschnitt beschreibt eine Partie, keinen Menschen.

---

## Was der Bericht beantwortet

Der Bericht stellt die Sitze nebeneinander und nennt die **erste**
Abweichung — in dieser Reihenfolge, weil jede spätere aus der früheren
folgen kann:

1. **Verschiedene Saatkörner?** Dann sind es zwei verschiedene Partien.
2. **Verschiedene Bündel?** Ein Gerät hält eine alte Seite offen. Nach
   einem Deploy verbinden alle offenen Geräte neu — mit dem **alten** Bündel
   im Speicher. Genau daran ist der Sicht-Umbau am 9. August 2026 zerbrochen.
3. **Zuglisten Stelle für Stelle.** Eine andere Reihenfolge, ein anderer
   Takt oder ein fehlender Zug an Stelle *i*.
4. **Erste ungleiche Prüfsumme.** Mit der letzten gemeinsamen Grenze
   daneben: Dazwischen liegt der Fehler, und bei 50 ms je Takt sagt der
   Abstand, wie viel Spielzeit man absuchen muss.
5. **Löcher.** Zwei Sorten, und sie bedeuten Verschiedenes:
   * *Loch im Mitschnitt* — eine Sendung ging verloren.
   * *Spur setzt aus* — der Browser hat den Tab eingefroren. Ohne diese
     Auswertung nicht von „es war nichts los" zu unterscheiden.

Meldet nur **ein** Sitz, sagt der Bericht das ausdrücklich: Ein Vergleich
ist dann nicht möglich, und die häufigste Ursache ist ein Gerät mit einer
älteren Fassung ohne Aufzeichnung.

---

## Zugang

Aufnehmen darf jeder Angemeldete — es ist die Messung des eigenen Geräts.
**Lesen** darf nur die Aufsicht, auf zwei Wegen:

* **Testkonto.** Der übliche Weg. Das Merkmal kommt ausschließlich aus
  `STAFF_EMAILS` beim Serverstart (siehe `src/staff.ts`); es gibt bewusst
  keinen Endpunkt, über den man es sich selbst geben könnte. Steht die
  eigene Adresse noch nicht drin, gehört sie an den Dienst — sie wirkt beim
  nächsten Start.
* **`DIAGNOSE_SCHLUESSEL`.** Für den Fall, dass auf einer Ausgabe kein
  Testkonto eingerichtet ist. Mindestens 20 Zeichen, sonst gilt er als
  nicht gesetzt: Ein kurzer Schlüssel sieht nach Schutz aus und ist in
  Minuten durchprobiert. Ohne die Variable ist dieser Weg zu.

Verglichen wird zeitgleich (`timingSafeEqual`). Ein `===` verrät über die
Laufzeit, wie viele Zeichen stimmen.

---

## Endpunkte

| | |
|---|---|
| `POST /api/diagnose/feldherr` | Portion aufnehmen. Antwortet **immer** `ok` — auch wenn die Kappe erreicht ist. Ein Gerät, das ein Nein bekäme, fängt an zu wiederholen und belastet genau die Leitung, auf der die untersuchte Partie läuft. |
| `GET /api/diagnose/feldherr?seit=…&tisch=…&grenze=…` | Zeilen, älteste zuerst. Aufsteigend, weil ein Mitschnitt von vorn gelesen wird — „die letzten N" gäbe das Ende einer Partie ohne ihren Anfang. |
| `GET /api/diagnose/feldherr/tische?stunden=…` | Übersicht: welcher Tisch, wie viele Sitze, wurde Streit gemeldet. Der Einstieg — ohne ihn lädt man Megabyte, um festzustellen, dass nichts passiert ist. |

---

## Fallen

* **Der Mitschnitt darf das Spiel nie stören.** Kein Wurf verlässt
  `aufzeichnung.ts`, `notiere` kostet ohne laufende Aufzeichnung einen
  Vergleich, und nach fünf gescheiterten Sendungen bleibt es still. Eine
  Diagnose, die das Spiel zum Ruckeln bringt, misst sich selbst.
* **Die Aufzeichnung hängt am Tisch, nicht am Kernlauf.** Eine
  Selbstheilung tauscht den Kern aus; ein an den Kernlauf gehängtes Ende
  zerschnitte den Mitschnitt genau an der interessantesten Stelle.
* **Beide Geräte müssen die Fassung mit Aufzeichnung haben.** Sonst gibt es
  nur einen Sitz, und der Vergleich — das eigentliche Werkzeug — entfällt.
* **`MIGRATE_ON_BOOT`** muss am Dienst stehen, sonst legt der Deploy die
  Tabelle nicht an und jede Aufnahme läuft ins Leere. (Die Migrationen 0016
  und 0017 sind so durchgelaufen; die Variable ist gesetzt.)
