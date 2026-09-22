# Bestleistung je Inhalt

Seit dem 22.09.2026. Anlass: Robins Entscheidung G6, zuerst eine Bestenliste
je Golf-Bahn. Der Unterbau ist spielunkundig und nimmt jede Kennung. Die
Golf-Seite (welche Bahnkennungen es gibt, wer sie meldet) steht unter
„Golf: Bestleistung je Bahn".

## Was die Tabelle ist

`bestleistung` (Migration `0027_bestleistung.sql`, Drizzle `schema.ts`) hält
**eine Zeile je Konto, Spiel und Inhalt**, also `(account_id, game_id,
inhalt_id)`. „Inhalt“ ist ein Stück eines Spiels: eine Golf-Bahn, später ein
Kurs oder ein Fragenpaket. Die Zeile trägt die beste Zahl (`wert`), die
Richtung (`richtung`: `hoch` oder `tief`), die Partie, aus der sie stammt
(`party_id`, wird beim Aufräumen alter Partien zu NULL), und den Zeitpunkt.

Es ist bewusst **nicht** `account_game_stat`. Dort hängt der Schlüssel am
Spiel, und die Zeile trägt Trophäen. Trophäen entstehen aus der Platzierung
und gelten unabhängig vom Regelsatz. Eine Bestleistung ist eine Spielzahl, die
nur für genau diesen Inhalt etwas bedeutet. Vorbild ist `runner_best`: Eine
Zeile wird nur von einer besseren Zahl überschrieben.

**Die Richtung steht am Datensatz**, weil der Server sie nicht kennen darf:
Bei Golf gewinnt die kleinste Schlagzahl, anderswo die höchste Punktzahl. Das
Modul sagt es bei jeder Meldung mit.

## Wer schreibt

Der Haken hängt in der Partie-Abrechnung der Laufzeit (`recordBestleistungen`
in `packages/server/src/runtime/party.ts`, als letzter Schritt von `finish`
nach den Tagesaufgaben). Er ruft `verbucheBestleistungen` aus
`packages/server/src/bestleistung.ts` auf. Das sammelt die Meldungen ein und
trägt sie über `trageBestleistungEin` ein. Das ist **ein** Befehl (`insert … on
conflict … do update … where besser`), damit zwei gleichzeitig endende Tische
nicht die schlechtere Zahl stehen lassen.

Ob ein Tisch zählt, entscheidet dieselbe Regel wie bei der Rangliste,
`countsForRanking` in `tables/service.ts`: Sitzt ein Gast am Tisch, zählt die
Partie für **niemanden**, und ein Tisch mit `training` zählt auch nicht. Die
Regel wird aufgerufen, nicht abgeschrieben. Sitze ohne Konto (Bots) bekommen
nichts. Fehler werden protokolliert und verschluckt, damit eine kaputte
Meldung kein Partie-Ende zum Hängen bringt.

## Wer liest

- `GET /api/games/:gameId/bestleistungen/:inhaltId` liefert die besten 20,
  den eigenen Platz (auch außerhalb der 20) und die Gesamtzahl. Gleichstand
  teilt den Rang wie `place`, bei gleicher Zahl steht die ältere Leistung
  vorn.
- `GET /api/me/bestleistungen/:gameId` liefert alle eigenen Bestleistungen
  eines Spiels, die jüngste zuerst.

Beide Routen verlangen eine Anmeldung und laufen unter `LIMIT_ALLGEMEIN` wie
die Ranglisten. Eine ungültige Inhaltskennung gibt 400 mit
`error.inhaltUngueltig`, ein unbekanntes Spiel 400 mit `error.invalidInput`.
Die Client-Aufrufe sind `api.bestenliste()` und `api.eigeneBestleistungen()`
in `packages/client/src/api.ts`. Die erste Oberfläche ist der Bahnrekord im
Golf-Zwischenstand (siehe unten).

## Was ein Spiel liefern muss

Ein Feld `bestleistungen` an **einer** von zwei Stellen, oder an beiden:

```ts
// je Sitz im Endstand (Golf: die Schlagzahl je Bahn steht am Ende fest)
standings(state) → [{ seat, points, place, left,
  bestleistungen: [{ inhaltId: 'k01-der-erste-schlag', wert: 3, richtung: 'tief' }] }]

// je abgeschlossenem Abschnitt, dann MIT Sitz (Spiele, die je Runde den Inhalt wechseln)
completedSegments(state) → [{ …,
  bestleistungen: [{ seat: 2, inhaltId: 'quiz-paket-1', wert: 800, richtung: 'hoch' }] }]
```

- `inhaltId`: Buchstabe oder Ziffer vorn, danach auch `.` `_` `:` `-`,
  höchstens 64 Zeichen (`INHALT_ID_MUSTER`). Schreib- und Leseweg prüfen
  gegen dasselbe Muster.
- `wert`: ganze Zahl im int4-Bereich.
- `richtung`: `'tief'`, wenn die kleinste Zahl gewinnt, sonst `'hoch'`.

Was nicht passt, wird still übergangen. Fehlt das Feld, gibt es für das Spiel
keine Bestleistung. Die Form ist in `bestleistung.ts` als Typ
(`Bestleistungsmeldung`) definiert und **noch nicht** in `game-api`. Welle 2
kann sie dorthin ziehen, dann wird das Feld an `PartyStanding` ein
ordentliches optionales Feld statt eines strukturell gelesenen.

## Golf: Bestleistung je Bahn

Seit dem 22.09.2026 meldet Golf je Sitz und Loch `{ inhaltId: <Bahnkennung>,
wert: Schläge, richtung: 'tief' }` im Endstand
(`packages/game-golf/src/bestleistung.ts`). Die Schlagzahl je Loch kannte der
Server vorher nicht — die Physik läuft auf den Geräten, gemeldet wurden nur
Summen und eine Prüfsumme über die Tafel `[loch][sitz]`. Seitdem schickt jedes
Gerät die Tafel als `jeLoch` an der Ergebnismeldung mit. Sie zählt nur, wenn
sie aus der Mehrheitsgruppe stammt, die auch den Platz entschieden hat, ihre
im Modul nachgerechnete Prüfsumme die der Gruppe ist und ihre Zeilensummen die
Schläge des Ausgangs sind. Strittig heißt: keine Bestleistung. Bots und
Ausgestiegene bekommen keine (für Letztere trägt das Gerät ab dem Ausstieg
Strafwerte ein, und welches Loch das war, weiß der Server nicht).

Gast und `training` entscheidet weiter `countsForRanking`, nicht das Modul.
Der Haken für den künftigen Fun-Modus ist `zaehltFuerBestleistung` im Modul:
Mit Wetter und Ereignissen ist es nicht mehr dieselbe Bahn, und die Liste
gehörte sonst dem mit dem besten Wetter.

Am Bildschirm steht nach jedem Loch „Bahnrekord: N (Name) · dein Bestes: M"
(`minispiele/golf/Bahnrekord.tsx`), geholt über `api.bestenliste` einmal je
Bahn und Partie, sobald das Loch beginnt. Ein eigener neuer Rekord leuchtet,
aber nur wenn der Ball gefallen ist und kein Gast am Tisch sitzt.

**Offen:** Ein nicht eingelochtes Loch zählt als Schlaglimit + 1 und geht so
auch in die Bestleistung ein — der Server kennt das Schlaglimit nicht. Es ist
nie besser als ein echtes Ergebnis, kann auf einer frischen Bahn aber für eine
Weile als Rekord stehen. Und die Bestmarke auf der Kachel der Bahnauswahl fehlt,
solange es die Bahnauswahl nicht gibt (Quelle dafür: `api.eigeneBestleistungen('golf')`).

**Offen:** Die Bahnwahl als Tisch-Eigenschaft (S1) und kaufbare Zusatzpakete
(S3) berühren diesen Unterbau nicht. Beide liefern nur andere `inhaltId`. Ob
ein gekauftes Paket eine eigene Liste bekommt oder in eine gemeinsame fällt,
entscheidet die Kennung, die das Modul vergibt.
