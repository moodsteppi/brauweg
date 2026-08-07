# Feldherr — Anforderungsliste des Auftraggebers (7. August 2026)

Die Liste kam gemischt; hier ist sie **explizit getrennt** in funktional und
visuell, wie gewünscht. Stand wird hier nachgeführt. Regeländerungen laufen
über die Simulation (`quelle/teile/simulation.js`), Abnahme über
Gleichlauf-Probe, Modultests und Browser-Nachweis.

## Funktional

| Anforderung | Stand |
|---|---|
| Mauern werden durch Verbinden stärker; Leben der Stufe wird auf die Stücke verteilt | **Umgesetzt 7.8. (Modell am 7.8. nachgeschärft).** Gewicht = Karten im Stück, Stufe = Gruppengewicht (1 allein, 2 verbunden, 3 verbunden; 3 Karten gestapelt ebenso 3). Stufen-HP 50/85/160 gehört der Gruppe und wird nach Gewicht verteilt — Stufe-2-Mauer + frische Mauer = Stufe 3 mit 107/53. Jedes Stück fällt einzeln, danach stuft die Gruppe neu ein; Erstattung zählt bezahlte Karten |
| Haupthaus im Wald −20 % erlittener Schaden, mit Anzeige | **Umgesetzt 7.8.** (trefferAuf). Anzeige: Einheitenwerte-Tafel; Marker am Brett folgt mit den 3D-Modellen |
| Angehaltene Einheit bleibt nach Aufwertung angehalten | **Umgesetzt 7.8.** (playCard übernimmt das halt-Flag wie turm) |
| Neustartknopf im Menü (gegen KI) | **Umgesetzt 7.8.** Im Pausenmenü, nur gegen die KI sichtbar |
| Feldgröße fest, Felder rechteckiger (Klick + drehbare 3D-Modelle) | **Umgesetzt 7.8.**: 8 × 12, Zellverhältnis 1,00, keine Auswahl mehr |
| Münze neu: Gewinner wählt die Seite, muss dafür anfangen; Karte vorher um 90° gedreht sichtbar | Offen — Fragen unten |
| Vulkan als eigener Modus mit Ankündigungsfenster (+ Bilder/Animation); weitere Modi danach | Offen — als datengetriebene Modus-Konfiguration geplant (docs/FELDHERR-3D-UMBAU.md) |
| Änderungen an der Karte: Spawnraten und -orte | Offen — Fragen unten |
| Champs (z. B. Merchant, Industrialist) mit Basiseffekten | Offen — berührt das Partie-Setup-Protokoll, eigener Schritt |
| Special Card je Champ, „gewählt“ mit der Klasse | Offen — hängt an den Champs |
| Anpassung der Drehmechanik | Offen — Fragen unten |

## Visuell

| Anforderung | Stand |
|---|---|
| Figuren durch 3D-Modelle ersetzen | **Gerüst läuft** (Buehne3D, Umschalter „3D“); Modelle nach `docs/ASSETS-FELDHERR-3D.md` bestellen, Ritter-GLB braucht Nacharbeit |
| Kamera: fast senkrechte Vogelperspektive | **Entschieden + fest 7.8.**: Neigung 10°, Abstand 17 |
| Mauer-Optik: Holzpfähle → Stein → … | Modelle bestellt (mauer-holz/stein/fest); Platzhalter färbt bereits nach Stufe |
| Mehr Umgebungsblöcke (z. B. Flüsse) | Offen — Flüsse sind auch funktional (unpassierbar?), s. Fragen |
| Seen/Flüsse abgerundet, natürliche Form statt Feldfüllung | Offen — Ufer-Stücke stehen in der zweiten Modell-Lieferung |
| Menü visuell überarbeiten | Offen — mit den Design-Skills, nach dem 3D-Umbau |
| Tutorial mit Bildern und Darstellungen | Offen |
| Button-Alignment (Icons nicht mittig) | Offen — kleiner UI-Fix, jederzeit |

## Gebündelte Fragen an den Auftraggeber

1. **Münz-Seitenwahl:** Gilt sie auch im Netzspiel (dann wandert die Wahl als
   Zug ins Protokoll und die Sitz-Spiegelung hängt daran)? Und heißt
   „muss dafür anfangen“: Der Seitenwähler setzt sein Haupthaus zuerst?
2. **Drehmechanik:** Was genau soll sich ändern — Bedienung des Drehknopfs,
   Drehen nach dem Setzen, oder Drehrichtung/Vorschau?
3. **Spawnraten/-orte:** Welche Werte sind gemeint — Geländehäufigkeit je
   Art, Vulkan-Takt, oder Ressourcenraten?
4. **Flüsse:** Nur Optik oder eigenes Gelände mit Regeln (unpassierbar,
   Brücken)?
5. **Champs:** Wie viele zum Start, und ändern Basiseffekte Zahlenwerte
   (z. B. Merchant +1 Ressource) oder Mechaniken?
