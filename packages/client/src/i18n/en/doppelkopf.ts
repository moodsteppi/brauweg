import type { Woerterbuch } from '../woerterbuch';

/**
 * Englische Texte, Bereich „doppelkopf" — Gegenstück zu `de/doppelkopf.ts`.
 *
 * Die Fachwörter bleiben deutsch: Re, Kontra, Hochzeit, Armut, Schweine,
 * Pflichtansage, Pflichtsolo, Feigling, Fuchs, Karlchen, die Solo-Namen.
 * Wo Platz ist (Überschriften, Erklärsätze), steht eine kurze englische
 * Erklärung dabei; auf Knöpfen, Abzeichen und Zurufen über den Sitzen nicht —
 * dort ist das Wort selbst die Auskunft, und die Erklärung steht einen Tipp
 * weiter. Die Absagen (Keine 90 …) sind übersetzt: Sie sagen wörtlich, was
 * sie meinen.
 */
export default {
  'doko.verlassen': 'Leave table',
  'doko.zwischenDenRunden': 'Between rounds',
  'doko.spielartOffen': 'Game type not decided yet',
  'doko.soloVon': '{name} plays solo',
  'doko.uebungsrunde': 'Practice round',
  'doko.runde': 'Round {nummer} / {gesamt}',
  'doko.bock': 'Bock ×{faktor}',
  'doko.pausiert': 'Paused',
  'doko.zuschauer': 'Spectator',
  'doko.tischFortsetzen': 'Resume table',
  'doko.tischPausieren': 'Pause table',
  'doko.fortsetzen': 'Resume',
  'doko.pausieren': 'Pause',
  'doko.letztenStichAnsehen': 'View last trick',
  'doko.kartenKleiner': 'Smaller cards',
  'doko.kartenGroesser': 'Larger cards',

  'doko.letzterStichAn': 'Last trick to {name}',
  'doko.du': 'You',
  'doko.deineKarten': 'Your cards',
  'doko.augen': '{augen} points',
  'doko.aufspiel': 'Leads',
  'doko.keineKarten': 'No cards in hand.',
  'doko.schweine': 'Schweine',
  'doko.schweine.haelt': 'Holds the Schweine (both ♦ aces, top trumps)',
  'doko.botUebernimmt': 'Bot is playing',
  'doko.pause.titel': 'Table paused',
  'doko.pause.text':
    'The turn timer is stopped. Anyone at the table can resume - ideal for club tables played over several evenings.',
  'doko.zuruf.titel': "You don't own this shout yet",
  'doko.zuruf.text':
    'You can buy it with coins in the shop under "Shouts". It is then available at every table.',
  'doko.weiterSpielen': 'Keep playing',

  'doko.partei.re': 'Re',
  'doko.partei.kontra': 'Kontra',
  'doko.team.re': 'Team Re',
  'doko.team.kontra': 'Team Kontra',
  'doko.absage.1': 'No 90',
  'doko.absage.2': 'No 60',
  'doko.absage.3': 'No 30',
  'doko.absage.4': 'Black',
  'doko.angesagt': 'Announced',
  'doko.ansage': 'Announcement',
  'doko.ansagen': 'Announce',
  'doko.parteiAnsagen': 'Call {partei}',

  'doko.aktion.gesund': 'Healthy',
  'doko.aktion.solo': 'Solo: {solo}',
  'doko.aktion.hochzeit': 'Hochzeit',
  'doko.aktion.armut': 'Armut',
  'doko.aktion.schmeissen': 'Throw in',
  'doko.aktion.armutAnnehmen': 'Accept Armut',
  'doko.aktion.armutAblehnen': 'Decline Armut',
  'doko.aktion.truempfeAbgeben': 'Hand over trumps',
  'doko.bestaetigen': 'Confirm',
  'doko.ablehnen': 'Decline',
  'doko.annehmen': 'Accept',
  'doko.zurueck': 'Back',
  'doko.weiter': 'Continue',

  'doko.solo.suitC': 'Kreuz',
  'doko.solo.suitS': 'Pik',
  'doko.solo.suitH': 'Herz',
  'doko.solo.suitD': 'Karo',
  'doko.solo.queens': 'Damen',
  'doko.solo.jacks': 'Buben',
  'doko.solo.fleshless': 'Fleischlos',

  'doko.ruf.gesund': 'Healthy',
  'doko.ruf.gesagt': 'Declared',
  'doko.ruf.solo': 'Solo',
  'doko.ruf.schmeiss': 'I throw in',
  'doko.ruf.armut': 'Armut',
  'doko.ruf.hochzeit': 'Hochzeit',
  'doko.ruf.vorbehalt': 'Reservation',

  'doko.vb.frage': 'Are you healthy?',
  'doko.vb.hinweis':
    'Healthy means no reservation (no solo, Hochzeit, Armut or throw-in). Everyone declares at once; if you say nothing, you count as healthy.',
  'doko.vb.jaGesund': '✓ Yes, healthy',
  'doko.vb.neinVorbehalt': 'No, reservation',
  'doko.vb.titel': 'Your reservation',
  'doko.vb.warum.schmeiss': 'You need enough low cards or enough aces and tens for this.',
  'doko.vb.warum.armut': 'Armut (poverty): only with three trumps or fewer.',
  'doko.vb.warum.hochzeit': 'Hochzeit (marriage): you need both queens of clubs.',
  'doko.vb.farbsolo': 'Farbsolo (suit solo)',
  'doko.vb.pflichtsoloOffen': 'Pflichtsolo (compulsory solo) still open: {wer}',
  'doko.vb.pflichtsoloDu': 'you',
  'doko.vb.pflichtsoloDich': 'It can still be you.',
  'doko.vb.ansagenFrage': 'Announce {wahl}?',
  'doko.vb.soloProbe':
    'Your cards are already sorted as in this solo, as a preview. Back restores them.',
  'doko.vb.wirdAngesagt': 'Announcing…',

  'doko.pflicht.titel': 'Pflichtansage (compulsory call)',
  'doko.pflicht.hochzeit': 'The deciding trick had {augen} points.',
  'doko.pflicht.schweine': 'You hold the Schweine.',
  'doko.pflicht.armut': 'You are playing the Armut.',
  'doko.pflicht.stich': 'The trick had {augen} points.',
  'doko.pflicht.freiwillig': 'The call is expected, but optional.',
  'doko.pflicht.zwingend': 'The call is mandatory.',

  'doko.armut.titel': 'Armut (poverty)',
  'doko.armut.einMitspieler': 'A player',
  'doko.armut.text':
    '{wer} has announced Armut - they hold three trumps or fewer. If you accept, you become their partner: you get their trumps and give back the same number of cards. If you decline, the next player is asked.',
  'doko.armut.zurueckgeben': 'Give back {anzahl} cards',
  'doko.armut.abgeben': 'Hand over {anzahl} cards',
  'doko.karten.wirdUebergeben': 'Handing over …',
  'doko.karten.uebergeben': 'Hand over cards',
  'doko.karten.gewaehlt': '{gewaehlt} of {anzahl} chosen',

  'doko.auswertung': 'Scoring',
  'doko.feigling': 'Feigling (coward).',
  'doko.feigling.text':
    '{partei} had the points but announced too low - the score goes to the other side. Special points stay where they were earned.',
  'doko.kartenpunkte': 'Card points',
  'doko.gesamt': 'Total',
  'doko.zwischenstand': 'Standings',
  'doko.restRunden': 'Rounds left: {anzahl}',
  'doko.warteAufAndere': 'Waiting for the others …',
  'doko.sonder.fuchs': 'Fuchs (fox caught)',
  'doko.sonder.karlchen': 'Karlchen (♣J wins the last trick)',
  'doko.sonder.doppelkopf': 'Doppelkopf (40+ trick)',
  'doko.sonder.charlie': 'Karlchen caught (♣J captured)',
  'doko.sonder.herzdurchlauf': 'Herzdurchlauf (all-hearts trick)',
} satisfies Woerterbuch;
