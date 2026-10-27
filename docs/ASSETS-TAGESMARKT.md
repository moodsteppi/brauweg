# Persönlicher Tages-Shop

Auftrag 27.10.2026: drei verdeckte Sonderangebote (gewöhnlich, selten, episch),
zehn reguläre Angebote, 25 Gratis-Münzen und vorhandene Tages-Holztruhe.
Wechsel je Kalendertag Europe/Berlin, auch bei Sommer-/Winterzeit. Daten und
Aufdeckstatus je Konto in tagesmarkt. Rabatte 15/25/35 Prozent; regulär je drei
Doppelkopf/Skat/BroChess plus ein allgemeines Stück, soweit noch nicht besessen.

Grafikauftrag: freundlicher Pinguin-Händler an einem nächtlichen Marktstand,
drei versiegelte dunkelblaue Geschenkbeutel mit Gold, blauem und violettem
Licht, warme Laternen, navy/gold, Spielzeug-3D wie die vorhandenen Spielbanner.
Breites Motiv; zentrale Figuren; untere 25 Prozent ruhig für Oberflächentext.
Keine Schrift, Preise, Zahlen, Logos, Wasserzeichen oder Schachbrett-Transparenz.
Auslieferung WebP 1200 × 600, Original ins separate brauweg-art-Archiv.

TAFEL: Hub-Shop ersetzt Profilreiter, Profil über Kopf des Starts. Sammlung
wählt nur Besitz aus und verweist für fremde Inhalte zum Tages-Shop. Angebote,
Aufdecken, Preis und Kauf werden serverseitig geprüft. Keine Echtgeldkäufe.

## Umsetzung und Ablage

- Banner: `packages/client/public/hub/shop-tagesmarkt.webp`, 1200 × 600, rund 132 kB.
- Original: separates lokales Archiv `brauweg-art/hub/tagesmarkt/original.png`.
- Datenbank: Tabelle `tagesmarkt`, Schlüssel `(account_id, tag)`. JSONB enthält
  die festen Tagesplätze, Preise und Aufdeckstatus; `muenzen_geholt` den Bonus.
  Migration `0039_tagesmarkt.sql`. Kein zusätzlicher Zeitplan nötig: Der Server
  ermittelt bei jedem Abruf den Berliner Kalendertag.
- Aufdecken verrät vorher weder Artikel noch Preis und kauft nichts. Kauf und
  Guthaben laufen gemeinsam in einer Transaktion, der Server bestimmt den Preis.
- Die Tages-Holztruhe nutzt die vorhandene Truhenfunktion und denselben Anspruch,
  daher gibt es durch den Shop keinen zweiten täglichen Truhenbonus.
- BroChess-Pinguin: regulär 1.600 Münzen. Alte Auswahl ohne Besitz fällt auf
  klassische Figuren zurück; bereits erworbener Besitz bleibt erhalten.
- Sammlung: pro Spiel Blätter/Figuren, Tisch und gegebenenfalls Rückseiten.
  Gesperrte Designs führen zum Shop; erspielbare Manufaktur-Designs erklären
  weiterhin ihre Herkunft. BroChess zeigt jetzt auch den gewählten Tisch.
- Eigene Stücke werden beim Erstellen der Tagesauswahl ausgelassen. Sind nicht
  genug passende Stücke übrig, zeigt der betreffende Platz keinen Ersatzkauf an.
  Musik, Klänge, Emotes und Inhalts-Pakete behalten ihre bisherigen Kaufwege.
- Profil ist ausschließlich vom Startkopf aus erreichbar; unten steht der Shop.

## Prüfung

Vollständiger Projektbuild erfolgreich. Client: 181 Dateien, 1.986 Tests grün.
Server: 104 Tests für Tagesmarkt, Währung/HTTP, Shop, Tischware, App-Umfang und
Trophäenpfad grün, einschließlich Konkurrenz und Berliner Zeitumstellung.
Darstellung in der lokalen iPhone-Vorschau geprüft. Noch kein TestFlight-Upload
und kein Produktions-Deploy für diese Änderung.

TAFEL-Pflege war nicht möglich: vorhandener Zugang antwortete mit HTTP 401.
Dieser Übergabezettel hält Auftrag, Umsetzung, Grafik und Prüfung als Ersatz fest.
