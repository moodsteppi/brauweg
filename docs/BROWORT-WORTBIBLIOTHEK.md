# Browort: 3.000 erlaubte Ratewörter

Die bisherigen 1.710 Wörter bleiben erhalten. 1.290 zusätzliche Wörter stehen in `packages/server/src/browort/woerter-zusatz.ts`. Tageslösungen und ihre Reihenfolge bleiben unverändert; laufende Tagesrätsel ändern sich dadurch nicht. Auch Clanwort verwendet dieselbe Ratebibliothek.

## Herkunft

Quelle: https://github.com/marekventur/spielwoerter
Festgehaltener Stand: `ce82399cc269d02bc70334ab08f3f985cc1d0ddb`, Datei `wordlist_accepted.jsonl`.
Lizenz laut Quellprojekt: CC0 1.0 Universal, beigefügt unter `docs/lizenzen/spielwoerter-CC0.txt`. Übernommen wurden ausschließlich Wortformen, keine Beschreibungen oder Definitionen. Die Quelle kombiniert Wörterbuchbelege und maschinelle Klassifizierung; sie ist keine amtliche Rechtschreibliste.

## Auswahl

- Genau fünf Buchstaben aus A–Z, Ä, Ö, Ü; kein ß, keine Ersetzung durch SS.
- Bereits vorhandene Wörter und Duplikate entfernt.
- Nur Einträge mit übereinstimmender Quellklassifikation (`double-pass-agree`) und mindestens zwei Wörterbuchquellen.
- Nach Anzahl der Wörterbuchquellen und Korpusbelege bevorzugt; alphabetische Reihenfolge als Gleichstandsregel.
- Als veraltet, regional, abwertend, Namen oder Abkürzungen gekennzeichnete Kandidaten ausgefiltert; auffällige Namen, vulgäre Begriffe und problematische Schreibvarianten zusätzlich ausgeschlossen.
- Die Auswahl ist fest eingebaut, alphabetisch sortiert und wird nicht während des Spiels aus dem Internet geladen. Beugungsformen sind als Rateversuch zulässig.

Die Tests sichern exakt 3.000 unterschiedliche erlaubte Wörter, das Zeichenformat und die Annahme eines neu ergänzten Wortes im echten Spielablauf ab.
