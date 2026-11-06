import type { Woerterbuch } from '../woerterbuch';

/**
 * Englische Texte, Bereich „brocooked" — Gegenstück zu `de/brocooked.ts`.
 * Knapp gehalten: Die Küche läuft am Handy, und Knöpfe wie Tickets sind schmal.
 */
export default {
  // Küche: Kopfzeile, Rezepttafel, Steuerung
  'brocooked.ui.sekunden': '{n}s',
  'brocooked.ui.runde': 'Round {nr}',
  'brocooked.ui.pause': 'Break',
  'brocooked.ui.kombo': 'Combo ×{faktor}',
  'brocooked.ui.punkte': 'Points',
  'brocooked.ui.rezepte': 'Recipes',
  'brocooked.ui.rezepteZu': 'Close',
  'brocooked.ui.wasHierBestelltWird': 'On the menu here',
  'brocooked.ui.hinweisKueche': 'Slashed mark: chop. Round mark: cook. Nothing goes on the plate raw.',
  'brocooked.ui.laufen': 'Move',
  'brocooked.ui.nehmen': 'Grab',
  'brocooked.ui.arbeiten': 'Work',
  'brocooked.ui.kuecheVerlassen': 'Leave kitchen',

  // Menü
  'brocooked.ui.unter': '1-4 cooks · co-op',
  'brocooked.ui.alleinKochen': 'Cook solo',
  'brocooked.ui.zuZweit': 'Two on this device',
  'brocooked.ui.tischWirdGesucht': 'Finding a table …',
  'brocooked.ui.amTisch': 'At a table (2-4 devices)',
  'brocooked.ui.einleitung': 'Orders come in: you chop, cook, plate up and pass them out. You cook together - one score for everyone.',
  'brocooked.ui.tischFehler': 'Could not open the table. Try again?',
  'brocooked.ui.runden': 'Rounds',
  'brocooked.ui.kuechen': 'Kitchens',
  'brocooked.ui.besteSterne': 'best stars',
  'brocooked.ui.sterneAria': '{n} of 3 stars',
  'brocooked.ui.zumNachlesen': 'Reference',
  'brocooked.ui.rezepteUnter': 'What each kitchen orders',
  'brocooked.ui.tasten': 'On a computer: WASD and Space/E for the first cook, arrow keys and Enter/0 for the second. On a phone, a stick and buttons appear on screen.',
  'brocooked.ui.hinweisRezepte': 'A slashed mark must be chopped, a round mark cooked. Nothing goes on the plate raw.',
  'brocooked.ui.fertig': 'Done',

  // Feierabend
  'brocooked.ui.feierabend': 'Closing time',
  'brocooked.ui.feierabendUnter.eins': 'BroCooked · {n} round',
  'brocooked.ui.feierabendUnter.mehr': 'BroCooked · {n} rounds',
  'brocooked.ui.zurueckInsMenue': 'Back to menu',
  'brocooked.ui.nochEinmal': 'Play again',
  'brocooked.ui.endpunkte': 'points',

  // Gruppe am Tisch
  'brocooked.ui.kuecheFuelltSich': 'Kitchen filling up',
  'brocooked.ui.besetzt': '{besetzt} of {gesamt} spots taken',
  'brocooked.ui.tischVerlassen': 'Leave table',
  'brocooked.ui.jetztAnfangen': 'Start now',
  'brocooked.ui.hilfskochDazu': 'Add helper',
  'brocooked.ui.gruppeText': 'Start whenever you like - empty spots are dropped. Want an extra pair of hands? Add a helper cook first.',
  'brocooked.ui.koeche': 'Cooks',
  'brocooked.ui.frei': 'free',
  'brocooked.ui.hilfskoch': 'Helper cook',

  // Rezeptzeile und Rezeptkarte
  'brocooked.ui.marke': '{zutat}, {zustand}',
  'brocooked.ui.ohneGaren': 'no cooking',

  // Gerichte
  'brocooked.ui.rezept.salat': 'Mixed salad',
  'brocooked.ui.rezept.salat-gross': 'Big salad',
  'brocooked.ui.rezept.suppe': 'Onion soup',
  'brocooked.ui.rezept.burger': 'Burger',
  'brocooked.ui.rezept.sushi': 'Sushi',
  'brocooked.ui.rezept.pommes': 'Cheesy fries',

  // Zutaten
  'brocooked.ui.zutat.tomate': 'Tomato',
  'brocooked.ui.zutat.zwiebel': 'Onion',
  'brocooked.ui.zutat.salat': 'Lettuce',
  'brocooked.ui.zutat.fleisch': 'Meat',
  'brocooked.ui.zutat.fisch': 'Fish',
  'brocooked.ui.zutat.reis': 'Rice',
  'brocooked.ui.zutat.teig': 'Dough',
  'brocooked.ui.zutat.kaese': 'Cheese',
  'brocooked.ui.zutat.kartoffel': 'Potato',

  // Zustände
  'brocooked.ui.zustand.roh': 'raw',
  'brocooked.ui.zustand.geschnitten': 'chopped',
  'brocooked.ui.zustand.gart': 'cooking',
  'brocooked.ui.zustand.gar': 'cooked',
  'brocooked.ui.zustand.verkohlt': 'burnt',

  // Wo gegart wird
  'brocooked.ui.wo.topf': 'in the pot',
  'brocooked.ui.wo.pfanne': 'in the pan',
  'brocooked.ui.wo.fritteuse': 'in the fryer',

  // Küchen
  'brocooked.ui.kueche.wiese': 'Garden kitchen',
  'brocooked.ui.kueche.kantine': 'Works canteen',
  'brocooked.ui.kueche.insel': 'Island kitchen',
  'brocooked.ui.kueche.brandwache': 'Fire station',

  // Englische Anfangsbuchstaben, je Station eindeutig: Chop, Pot, Skillet,
  // Fryer, Dishes, Wash, Out (Durchreiche), X (Tonne wie im Deutschen)
  'brocooked.ui.kuerzel.brett': 'C',
  'brocooked.ui.kuerzel.topf': 'P',
  'brocooked.ui.kuerzel.pfanne': 'S',
  'brocooked.ui.kuerzel.fritteuse': 'F',
  'brocooked.ui.kuerzel.tellerstapel': 'D',
  'brocooked.ui.kuerzel.spuele': 'W',
  'brocooked.ui.kuerzel.durchreiche': 'O',
  'brocooked.ui.kuerzel.tonne': 'X',
} satisfies Woerterbuch;
