import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „brocooked": was die Bildschirme von BroCooked
 * zeigen — Menü, Gruppe, Küche, Feierabend, Rezepte —, dazu die Kürzel, die
 * der Zeichner auf die Stationen schreibt.
 *
 * Platzhalter in geschweiften Klammern füllt `tz` (minispiele/brocooked/text.ts).
 * Einzahl und Mehrzahl stehen als eigene Schlüssel (`.eins` / `.mehr`): Wie
 * eine Sprache zählt, entscheidet die Sprache, nicht der Bildschirm.
 *
 * Eine Zeile je Schlüssel — packages/server/test/woerterbuch.ts liest diese
 * Datei per Regex.
 */
export default {
  // Küche: Kopfzeile, Rezepttafel, Steuerung
  'brocooked.ui.sekunden': '{n}s',
  'brocooked.ui.runde': 'Runde {nr}',
  'brocooked.ui.pause': 'Pause',
  'brocooked.ui.kombo': 'Kombo ×{faktor}',
  'brocooked.ui.punkte': 'Punkte',
  'brocooked.ui.rezepte': 'Rezepte',
  'brocooked.ui.rezepteZu': 'Zu',
  'brocooked.ui.wasHierBestelltWird': 'Was hier bestellt wird',
  'brocooked.ui.hinweisKueche': 'Marke mit Schnitt: schneiden. Runde Marke: garen. Roh kommt nichts auf den Teller.',
  'brocooked.ui.laufen': 'Laufen',
  'brocooked.ui.nehmen': 'Nehmen',
  'brocooked.ui.arbeiten': 'Arbeiten',
  'brocooked.ui.kuecheVerlassen': 'Küche verlassen',

  // Menü
  'brocooked.ui.unter': '1-4 Köche · miteinander',
  'brocooked.ui.alleinKochen': 'Allein kochen',
  'brocooked.ui.zuZweit': 'Zu zweit an diesem Gerät',
  'brocooked.ui.tischWirdGesucht': 'Tisch wird gesucht …',
  'brocooked.ui.amTisch': 'Am Tisch (2-4 Geräte)',
  'brocooked.ui.einleitung': 'Bestellungen kommen herein, ihr schneidet, kocht, richtet an und gebt durch. Gekocht wird miteinander: Es gibt eine Punktzahl für alle.',
  'brocooked.ui.tischFehler': 'Der Tisch ließ sich nicht öffnen. Noch einmal versuchen?',
  'brocooked.ui.runden': 'Runden',
  'brocooked.ui.kuechen': 'Küchen',
  'brocooked.ui.besteSterne': 'beste Sterne',
  'brocooked.ui.sterneAria': '{n} von 3 Sternen',
  'brocooked.ui.zumNachlesen': 'Zum Nachlesen',
  'brocooked.ui.rezepteUnter': 'Was in welcher Küche bestellt wird',
  'brocooked.ui.tasten': 'Am Rechner: WASD und Leertaste/E für den ersten Koch, Pfeiltasten und Enter/Null für den zweiten. Am Handy erscheinen Stick und Knöpfe auf dem Bild.',
  'brocooked.ui.hinweisRezepte': 'Eine Marke mit Schnitt muss geschnitten werden, eine runde Marke gegart. Roh kommt nichts auf den Teller.',
  'brocooked.ui.fertig': 'Fertig',

  // Feierabend
  'brocooked.ui.feierabend': 'Feierabend',
  'brocooked.ui.feierabendUnter.eins': 'BroCooked · {n} Runde',
  'brocooked.ui.feierabendUnter.mehr': 'BroCooked · {n} Runden',
  'brocooked.ui.zurueckInsMenue': 'Zurück ins Menü',
  'brocooked.ui.nochEinmal': 'Noch einmal',
  'brocooked.ui.endpunkte': 'Punkte',

  // Gruppe am Tisch
  'brocooked.ui.kuecheFuelltSich': 'Küche füllt sich',
  'brocooked.ui.besetzt': '{besetzt} von {gesamt} Plätzen besetzt',
  'brocooked.ui.tischVerlassen': 'Tisch verlassen',
  'brocooked.ui.jetztAnfangen': 'Jetzt anfangen',
  'brocooked.ui.hilfskochDazu': 'Hilfskoch dazu',
  'brocooked.ui.gruppeText': 'Ihr könnt jederzeit loslegen - leere Plätze fallen dann weg. Wer eine Hand mehr in der Küche will, setzt vorher einen Hilfskoch dazu.',
  'brocooked.ui.koeche': 'Köche',
  'brocooked.ui.frei': 'frei',
  'brocooked.ui.hilfskoch': 'Hilfskoch',

  // Rezeptzeile und Rezeptkarte
  'brocooked.ui.marke': '{zutat}, {zustand}',
  'brocooked.ui.ohneGaren': 'ohne Garen',

  // Gerichte (Kennungen aus rezepte.ts)
  'brocooked.ui.rezept.salat': 'Bunter Salat',
  'brocooked.ui.rezept.salat-gross': 'Großer Salat',
  'brocooked.ui.rezept.suppe': 'Zwiebelsuppe',
  'brocooked.ui.rezept.burger': 'Burger',
  'brocooked.ui.rezept.sushi': 'Sushi',
  'brocooked.ui.rezept.pommes': 'Pommes mit Käse',

  // Zutaten
  'brocooked.ui.zutat.tomate': 'Tomate',
  'brocooked.ui.zutat.zwiebel': 'Zwiebel',
  'brocooked.ui.zutat.salat': 'Salat',
  'brocooked.ui.zutat.fleisch': 'Fleisch',
  'brocooked.ui.zutat.fisch': 'Fisch',
  'brocooked.ui.zutat.reis': 'Reis',
  'brocooked.ui.zutat.teig': 'Teig',
  'brocooked.ui.zutat.kaese': 'Käse',
  'brocooked.ui.zutat.kartoffel': 'Kartoffel',

  // Zustände, wie man sie vorliest
  'brocooked.ui.zustand.roh': 'roh',
  'brocooked.ui.zustand.geschnitten': 'geschnitten',
  'brocooked.ui.zustand.gart': 'gart gerade',
  'brocooked.ui.zustand.gar': 'gegart',
  'brocooked.ui.zustand.verkohlt': 'verkohlt',

  // Wo gegart wird — als ganze Wendung, nie aus Artikel und Name gesetzt (daraus wurde „im Pfanne")
  'brocooked.ui.wo.topf': 'im Topf',
  'brocooked.ui.wo.pfanne': 'in der Pfanne',
  'brocooked.ui.wo.fritteuse': 'in der Fritteuse',

  // Küchen (Kennungen aus kuechen.ts)
  'brocooked.ui.kueche.wiese': 'Gartenküche',
  'brocooked.ui.kueche.kantine': 'Werkskantine',
  'brocooked.ui.kueche.insel': 'Inselküche',
  'brocooked.ui.kueche.brandwache': 'Brandwache',

  // Ein Buchstabe je Station auf der Leinwand (zeichnen.ts) — im Deutschen genau die Zeichen des Küchengitters
  'brocooked.ui.kuerzel.brett': 'B',
  'brocooked.ui.kuerzel.topf': 'P',
  'brocooked.ui.kuerzel.pfanne': 'F',
  'brocooked.ui.kuerzel.fritteuse': 'G',
  'brocooked.ui.kuerzel.tellerstapel': 'T',
  'brocooked.ui.kuerzel.spuele': 'S',
  'brocooked.ui.kuerzel.durchreiche': 'D',
  'brocooked.ui.kuerzel.tonne': 'X',
} satisfies Woerterbuch;
