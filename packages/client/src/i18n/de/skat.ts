import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „skat": der Skat-Tisch (`screens/SkatTable.tsx`) —
 * Reizen, Skatwahl, Drücken, Ansage, Spielarten und die Abrechnung einer Gabe.
 * Standen bis zur englischen Fassung fest im Bildschirm; Wortlaut unverändert.
 *
 * Die Farbnamen der Spielarten kommen NICHT von hier, sondern aus
 * `karte.farbe.*` (Bereich „karten"): Ein Kreuzspiel heißt wie die Farbe, und
 * zwei Fassungen desselben Wortes liefen beim ersten Umbenennen auseinander.
 *
 * `skat.erklaerung.*` sind die kurzen Erklärungen der Fachwörter. Im
 * Englischen bleiben Grand, Null, Hand, Schneider, Schwarz und Ouvert stehen,
 * wie sie am Skattisch heißen — die Erklärung sagt, was sie bedeuten.
 */
export default {
  // Spielarten
  'skat.spiel.grand': 'Grand',
  'skat.spiel.saechsisch': 'Sächsische Spitze',
  'skat.spiel.saechsischKurz': 'Sächsische',
  'skat.spiel.null': 'Null',
  'skat.spiel.ramsch': 'Ramsch',
  'skat.spiel.farbe': 'Farbe',
  'skat.patrouille.schwarz': 'Schwarze Patrouille',
  'skat.patrouille.rot': 'Rote Patrouille',

  'skat.erklaerung.farbe': 'Farbspiel: Die Buben und die gewählte Farbe sind Trumpf.',
  'skat.erklaerung.grand': 'Grand: Nur die vier Buben sind Trumpf.',
  'skat.erklaerung.saechsisch':
    'Wie Grand, aber die Ordnung ist gedreht: Karo-Bube ist der höchste Trumpf, die Sieben schlägt das Ass. Grundwert 20.',
  'skat.erklaerung.null': 'Null: Kein Trumpf, und du darfst keinen einzigen Stich bekommen.',
  'skat.erklaerung.hand': 'Hand: ohne den Skat aufzunehmen — das zählt eine Stufe mehr.',
  'skat.erklaerung.zusatz':
    'Schneider: Gegner unter 31 Augen · Schwarz: Gegner ohne Stich · Ouvert: mit offenen Karten.',

  // Kopfleiste
  'skat.zurueck': 'Zurück',
  'skat.gabe': 'Gabe {nummer} / {gesamt}',
  'skat.bock': ' · Bock ×{faktor}',
  'skat.pausiert': 'Pausiert',
  'skat.fortsetzen': 'Fortsetzen',
  'skat.pausieren': 'Pausieren',
  'skat.tischFortsetzen': 'Tisch fortsetzen',
  'skat.tischPausieren': 'Tisch pausieren',
  'skat.letzterStich': 'Letzten Stich ansehen',
  'skat.regeln': 'Tischregeln ansehen',
  'skat.kleiner': 'Karten verkleinern',
  'skat.groesser': 'Karten vergrößern',

  // Laden und Sitze
  'skat.verbinde': 'Verbinde mit dem Tisch…',
  'skat.neueGabe': 'Neue Gabe…',
  'skat.bot': 'Bot {nummer}',
  'skat.geber': 'Geber',
  'skat.spieler': 'Spieler',
  'skat.punkteAugen': '{punkte} Punkte · {augen} Augen',
  'skat.keineKarten': 'Keine Karten auf der Hand.',
  'skat.offen': 'Offen:',

  // Mitte des Tisches
  'skat.gereizt': ' · gereizt bis {wert}',
  'skat.reizen': 'Reizen',
  'skat.reizenStand': 'Reizen · Stand {wert}',
  'skat.kontra': 'Kontra',
  'skat.re': 'Re',
  'skat.hirsch': 'Hirsch',
  'skat.blind': 'Blind ×{faktor}',

  // Was gerade zu tun ist
  'skat.phase.vorbei': 'Abgerechnet',
  'skat.phase.reizenDu': 'Du bist am Reizen',
  'skat.phase.reizen': 'Es wird gereizt',
  'skat.phase.schieben': 'Der Skat wird geschoben',
  'skat.phase.schiebenWeiter': 'Zwei Karten weiterschieben',
  'skat.phase.schiebenWahl': 'Skat aufnehmen oder blind schieben',
  'skat.phase.skatDu': 'Skat aufnehmen oder Hand spielen',
  'skat.phase.skat': 'Der Alleinspieler entscheidet über den Skat',
  'skat.phase.drueckenDu': 'Zwei Karten drücken',
  'skat.phase.druecken': 'Der Alleinspieler drückt',
  'skat.phase.ansageDu': 'Spielart ansagen',
  'skat.phase.ansage': 'Der Alleinspieler sagt an',
  'skat.phase.stichDu': 'Du bist am Zug',
  'skat.phase.stich': 'Mitspieler ist am Zug',

  // Schaltflächen
  'skat.weiter': 'Weiter',
  'skat.skatAufnehmen': 'Skat aufnehmen',
  'skat.blindSchieben': 'Blind schieben (×2)',
  'skat.weiterschieben': 'Weiterschieben',
  'skat.handSpielen': 'Hand spielen',
  'skat.druecken': 'Drücken',
  'skat.zweiGewaehlt': 'Zwei Karten gewählt',
  'skat.fehlen.eins': 'Noch {n} Karte wählen',
  'skat.fehlen.mehr': 'Noch {n} Karten wählen',
  'skat.ansagen': 'Ansagen',

  // Reizen
  'skat.reiz.spielNehmen': 'Spiel nehmen (18)',
  'skat.reiz.halten': '{wert} halten',
  'skat.reiz.sagen': '{wert} sagen',
  'skat.reiz.weg': 'Weg',
  'skat.reiz.rechner': 'Rechner',
  'skat.reiz.hoeher':
    'Höher reizen heißt: auf Hand, Schneider oder Schwarz spielen, oder sich überreizen.',
  'skat.reiz.festerWert': 'fester Wert',
  'skat.reiz.mit': 'mit {spitzen} · ×{grundwert}',
  'skat.reiz.ohne': 'ohne {spitzen} · ×{grundwert}',

  // Zurufe
  'skat.zurufe': 'Zurufe',
  'skat.zurufe.shop': 'Weitere Zurufe gibt es im Shop.',
  'skat.zurufe.ok': 'Alles klar',

  // Abrechnung einer Gabe
  'skat.ergebnis.durchmarsch': 'Durchmarsch von {name}.',
  'skat.ergebnis.augenreichster': 'Der Augenreichste zahlt.',
  'skat.ergebnis.jungfrau': 'Jungfrau: {namen} - ohne einen Stich, das verdoppelt.',
  'skat.ergebnis.blind': 'Blind geschoben: ×{faktor}.',
  'skat.ergebnis.gewonnen': '{name} hat gewonnen',
  'skat.ergebnis.verloren': '{name} hat verloren',
  'skat.ergebnis.ueberreizt': ' (überreizt)',
  'skat.ergebnis.schwarz': ' · schwarz',
  'skat.ergebnis.schneider': ' · Schneider',
  'skat.ergebnis.patrouillen.eins': ' · {n} Patrouille',
  'skat.ergebnis.patrouillen.mehr': ' · {n} Patrouillen',
  'skat.ergebnis.augen': '{augen} Augen, Spielwert {wert}.',
  'skat.gesamtstand': 'Gesamtstand',
} satisfies Woerterbuch;
