import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „regeln-doppelkopf": Regelnamen und Regelsatz-Meldungen —
 * Doppelkopf.
 * Aus dem früheren Bereich „regeln" herausgelöst, Wortlaut unverändert.
 * Wer ihn übersetzt, steht in der Tabelle in `de/index.ts`.
 */
export default {
  // Tischregeln (warum jede Option einen Eintrag braucht: Kopf von
  // `regeln-allgemein.ts`). `training` und `bock` teilt Doppelkopf mit Skat,
  // sie stehen dort.
  'regel.secondDulleBeatsFirst': 'Zweite Dulle sticht Erste',
  'regel.defusedDullen': 'Entschärfte Dullen',
  'regel.schweinchen': 'Schweinchen',
  'regel.superSchweine': 'Superschweine',
  'regel.spFuchsGefangen': 'Fuchs gefangen',
  'regel.spKarlchen': 'Karlchen',
  'regel.spDoppelkopf': 'Doppelkopf-Sonderpunkt',
  'regel.spCharlieGefangen': 'Karlchen gefangen',
  'regel.spHerzdurchlauf': 'Herzdurchlauf',
  'regel.spInSolo': 'Sonderpunkte im Solo',
  'regel.soloLeadsOut': 'Solo kommt raus',
  'regel.hochzeit': 'Hochzeit',
  'regel.stilleHochzeit': 'Stille Hochzeit',
  'regel.armut': 'Armut',
  'regel.armutAnnounceReturnedTrumps': 'Armut: Rücktrümpfe ansagen',
  'regel.schmeiss5Luschen': 'Schmeißen bei 5 Luschen',
  'regel.schmeiss7Volle': 'Schmeißen bei 7 Vollen',
  'regel.countPoints': 'Punkte mitzählen',
  'regel.announcements': 'Re und Kontra',
  'regel.absagen': 'Absagen',
  'regel.pflichtansage': 'Pflichtansage',
  'regel.pflichtansageFolge': 'Pflichtansage: Folgeansage',
  'regel.pflichtansageArmut': 'Pflichtansage: Armut',
  'regel.pflichtansageSchweine': 'Pflichtansage: Schweine',
  'regel.pflichtansageImSolo': 'Pflichtansage: auch im Solo',
  'regel.feigling': 'Feigling im Normalspiel',
  'regel.feiglingSolo': 'Feigling im Solo',
  'regel.pflichtsolo': 'Pflichtsolo',
  'regel.scharf': 'Scharfer Doppelkopf',

  /*
   * Regelsatz-Widersprüche aus dem Validator von Doppelkopf (die von Skat
   * stehen in `regeln-skat.ts`).
   *
   * Die Erklärungen gab es längst — sie stehen als zweites Argument in
   * `err(...)` im jeweiligen Validator. Nur landeten sie nirgends: Der Adapter
   * baut aus dem Code `ruleset.${code}` und lässt den Text fallen. Im
   * Regelsatz-Editor stand deshalb wörtlich "ruleset.PFLICHTANSAGE_NEEDS_ANNOUNCEMENTS"
   * am Feld. Hier sind sie, mit Umlauten.
   *
   * Zwei Codes bedeuten bei Doppelkopf und Skat NICHT dasselbe (TABLE_SIZE,
   * TRAINING) — ein gemeinsames Wörterbuch kann nur einen Text haben, deshalb
   * stehen sie mit neutraler Fassung in `regeln-allgemein.ts`.
   */
  'ruleset.ARMUT_ANNOUNCE': 'Die Ansage der Rückgabe-Trümpfe setzt aktivierte Armut voraus.',
  'ruleset.BOCK_FACTOR': 'Der Bock-Multiplikator muss mindestens 2 betragen.',
  'ruleset.BOCK_TRIGGER_ANNOUNCEMENTS': 'Der Auslöser „Re und Kontra" setzt Ansagen voraus.',
  'ruleset.BOCK_WINDOW': 'Die Länge eines Bock-Fensters muss positiv sein.',
  'ruleset.FEIGLING_NEEDS_ANNOUNCEMENTS': 'Feigling setzt aktivierte Ansagen voraus.',
  'ruleset.HOCHZEIT_CLARIFY': 'Die Klärungsfrist der Hochzeit muss zwischen 1 und 3 Stichen liegen.',
  'ruleset.PFLICHTANSAGE_NEEDS_ANNOUNCEMENTS': 'Pflichtansage setzt aktivierte Ansagen voraus.',
  'ruleset.PFLICHTANSAGE_THRESHOLDS': 'Die Schwellen der Pflichtansage müssen absteigend sein.',
  'ruleset.PFLICHTSOLO_ROUNDS': 'Für ein Pflichtsolo je Spieler reichen die Runden nicht.',
  'ruleset.PFLICHT_ARMUT_NEEDS_ARMUT': 'Der Armut-Auslöser setzt erlaubte Armut voraus.',
  'ruleset.SCHWEINCHEN_SOLO': 'Schweinchen im Solo setzt aktivierte Schweinchen voraus.',
} satisfies Woerterbuch;
