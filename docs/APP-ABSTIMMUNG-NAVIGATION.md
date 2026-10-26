# App: Spielabstimmung, Bilder und Wischen

Stand 26.10.2026.

## Kontogebundene Abstimmung

`game_vote` existiert bereits. Der zusammengesetzte Primärschlüssel aus
`account_id` und `game_id` lässt eine Stimme je Konto und Spiel zu. Mehrere
unterschiedliche Spiele dürfen unterstützt werden. Erneutes Senden ist durch
`onConflictDoNothing` idempotent; es wird keine neue Tabelle benötigt.

`GET /api/games` liefert Gesamtstimmen und `meineStimme` aus der authentifizierten
Sitzung (Cookie oder App-Bearer). Ohne Sitzung ist die Liste weiter lesbar, aber
`meineStimme` immer false. Personalisierte Antworten sind `private, no-store`.
`POST /api/games/:gameId/vote` braucht ein Konto. Die Freigabe der anfragenden
Plattform entscheidet: Ein dort angekündigtes Spiel ist abstimmbar, auch wenn
es auf der anderen Plattform bereits spielbar ist. Aus dem Releaseumfang
entfernte und bereits spielbare Titel bleiben gesperrt.

Die App zeigt Gesamtzahlen, persönliche Markierung, Speichern-Zustand und einen
wiederholbaren Fehlerhinweis. Angegebene Stimmen werden absteigend sortiert.
Doppeltipps werden lokal geblockt, der Datenbankschlüssel bleibt die maßgebliche
Absicherung. Auswertung ist direkt in der Übersicht oder per SQL möglich:

```sql
SELECT game_id, count(*) AS stimmen
FROM game_vote
GROUP BY game_id
ORDER BY stimmen DESC, game_id;
```

## Bilder

Acht neue Bilddateien unter `packages/client/public/hub/bald-*.webp`:
Schafkopf, Rommé, Mau-Mau, Schwimmen, Backgammon, Bauernskat, Stufenrommé und
Drecksau. Mit Imagegen erzeugt, als 512px-WebP optimiert. Die Vorschau bleibt
farbig; existierende Spielbanner werden für bereits implementierte Titel benutzt.
Unbekannte zukünftige Vorschauen behalten das gemeinsame Rückfallbild.

## Navigation und Texte

Ein Wisch nach rechts führt zum nächsten Reiter in der Leiste: in der App
vom Profil zu Spiele, weiter zu Start, Sammlung und Clan. Links geht zurück;
an den Enden kein Sprung. Nur eine eindeutig waagerechte Einfinger-Geste über
mindestens 56px schaltet. Vertikales Scrollen, eigene horizontale Reihen,
Formulare, Schieber, Canvas, Mehrfinger- und abgebrochene Gesten bleiben frei.
Blätter liegen außerhalb des Wischbereichs. Ein anschließender versehentlicher
Klick wird kurz unterdrückt. Bestehende Reiterknöpfe funktionieren weiterhin.

Lange Gedankenstriche wurden in Client-Texten durch kurze Bindestriche ersetzt,
auch bei Sitzspannen und leeren Anzeigen. AST-gestützte Bearbeitung lässt
Kommentare und Syntax unverändert. Bei aus dem Spielmodul abgeleiteten Golf-
Bezeichnungen berücksichtigt der Vertrag nur die gewünschte Textformatierung.

Interaktive Bild-/Abstimmprobe: `/?dev=hub&abstimmung&tab=spiele&iphone`.
Sie verwendet feste Beispieldaten und schreibt keine echten Stimmen.

## TAFEL

Die App unterstützt wieder persistente Stimmen für angekündigte Spiele.
Der Server liefert persönliche Stimmen und plattformbezogene Abstimmfreigabe.
Das Hub hat eine abgegrenzte Wischsteuerung, die eigene Scrollbereiche ausnimmt.
Keine Datenbankmigration und keine Änderung der Spielbarkeit selbst nötig.


## Korrekturen vom 26.10.2026

Nach links wischen öffnet den rechts benachbarten Reiter, nach rechts den linken.
Auch Pro-Subway und Mehrkampf kommen als Vorschauen vom Server und speichern
Stimmen in game_vote. Sie werden nicht zu Tisch-Spielmodulen. Zusammen mit den
17 sichtbaren Spielvorschauen gibt es in der App 19 abstimmbare Ankündigungen.
Die Partykiste bleibt gemäß bestehender App-Inhaltsentscheidung ausgeblendet.
Die Typisierung von game_vote.game_id umfasst nun auch Modi; SQL bleibt TEXT,
daher keine Migration. Browort hat ein eigenes 1200 × 400 WebP-Motiv (50 kB).
Solo-Spiele zeigen beim Nachladen sofort einen schließbaren Ladebildschirm.

TAFEL: Modi gehören zur kontoabhängigen Spielauswahl mit derselben
Stimmen-Speicherung, außerhalb der Tisch-Registry. Wischrichtung folgt der
räumlichen Reiterfolge. Tafelzugang derzeit mit 401 abgewiesen.


## Zieh-Pager statt Sprung (26.10.2026, Nachmittag)

Rückmeldung mit Bildschirmvideo: Das Wischen fühlte sich stockend an. Die
Geste wurde erst beim Loslassen ausgewertet und der Reiter dann hart
getauscht; der Nachbarreiter hing gar nicht am Track und lud nach dem
Sprung erst („Spiele werden geladen…"). Jetzt (`hub-wischen.ts`,
`HubRahmen.tsx`):

- Jeder Reiter hat einen festen Platz im Track (`hb-reiterplatz`); die Seite
  folgt dem Finger 1:1, die Nachbarseite schiebt sich sichtbar mit herein, am
  Rand ohne Nachbarn ein Gummiband.
- Loslassen: Ziel ist, wo die Seite mit ihrem Schwung (Fingertempo × 200 ms)
  hinkäme; ab der halben Breite rastet der Nachbar ein. Das Einrasten
  übernimmt das Fingertempo (160–340 ms), erneutes Anfassen fängt die Seite
  mitten in der Bewegung.
- Nachbarn werden beim Anfassen angehängt, einmal geladene Reiter bleiben
  hängen (`inert`, solange sie nicht offen sind). Der Kopf des Starts zieht im
  Platz des Starts mit, der Abstand zur Statusleiste steht je Platz.
- `touch-action: pan-y pinch-zoom` am Inhalt: Senkrecht rollt der Browser,
  waagerecht der Pager. Bei `prefers-reduced-motion` rastet es ohne Animation ein.
- iOS-Hülle: Die Randgeste von links blättert im Hub nicht und lässt die
  Touches im WebView (`cancelsTouchesInView = false`), also kein Konflikt.


## Webseite gleichgezogen (26.10.2026, Abend)

Abgleich gegen ff3282f: Fast alles oben wirkte schon auf beiden Plattformen
(Abstimmung mit `meineStimme`, Bald-Bilder, Zieh-Pager per Touch, Manufaktur-
und Browort-Bilder, Ladebildschirm). Die einzige neue App-Weiche war
`abstimmModiFuer` (registry.ts): Den Mehrkampf kündigt der Server jetzt auch
der Webseite an, er steht dort wie in der App unter „Kommt bald" mit Stimme.
Die feste „Modi"-Marke bleibt nur, wenn `abstimmung` nicht im Umfang ist.
Pro-Subway bleibt Ankündigung nur in der App, denn auf der Webseite läuft der
Runner schon. Proben: `test/spielfreigabe.test.ts` (Web-Fälle),
`SpieleNeu.web.test.tsx`.
