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
