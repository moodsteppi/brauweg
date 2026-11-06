import type { Woerterbuch } from '../woerterbuch';

/** Englische Texte, Bereich „clan-krieg" — Gegenstück zu `de/clan-krieg.ts`. */
export default {
  'clankrieg.titel': 'Clan war',
  'clankrieg.untertitel': 'Two clans, 48 hours, all games count',
  'clankrieg.zurueckAria': 'Back to clan hall',
  'clankrieg.fehler.laden': "Couldn't load the war status.",
  'clankrieg.fehler.warAlreadyActive': "You're already in a war or have a challenge open.",
  'clankrieg.fehler.warOpponentBusy': 'That clan is already at war.',
  'clankrieg.fehler.warSelfChallenge': "You can't challenge your own clan.",
  'clankrieg.fehler.warRunning': "A war in progress can't be called off.",
  'clankrieg.fehler.notClubAdmin': 'Only leaders and co-leaders can do that.',

  'clankrieg.einClan': 'A clan',
  'clankrieg.einenClan': 'a clan',

  'clankrieg.suche.titel': 'Finding an opponent',
  'clankrieg.suche.text':
    'As soon as another clan is searching too, the war begins. Keep playing as usual in the meantime.',
  'clankrieg.suche.beenden': 'Stop searching',
  'clankrieg.angefragt.titel': 'Challenge sent to {name}',
  'clankrieg.angefragt.text': 'The other clan has to accept. Once they do, the clock starts.',
  'clankrieg.zuruecknehmen': 'Withdraw',
  'clankrieg.fordertHeraus': 'challenges you',
  'clankrieg.annehmen': 'Accept',
  'clankrieg.ablehnen': 'Decline',

  'clankrieg.start.titel': 'No war going on',
  'clankrieg.start.text':
    'Two clans, 48 hours, points from your games. Find an opponent - or challenge a specific clan.',
  'clankrieg.gegnerSuchen': 'Find opponent',
  'clankrieg.herausfordern': 'Challenge a clan',
  'clankrieg.herausfordern.aria': 'Challenge {name}',
  'clankrieg.nurLeitung': 'Only leaders and co-leaders can start a war.',

  'clankrieg.regel.titel': 'How scoring works',
  'clankrieg.regel.platz': '<b>1st place</b> earns 3 points, <b>2nd place</b> earns 1.',
  'clankrieg.regel.hoechstens':
    'Each member counts for <b>up to 10 games</b>. No single player can win the war alone.',
  'clankrieg.regel.menschen':
    'Only games with <b>at least two humans</b> at the table count. No war points against bots.',

  'clankrieg.letzter.titel': 'Last war',
  'clankrieg.letzter.wir': '<b>Won</b> against {name}: {wir} to {gegner}.',
  'clankrieg.letzter.gegner': '<b>Lost</b> against {name}: {wir} to {gegner}.',
  'clankrieg.letzter.gleich': '<b>Draw</b> against {name}: {wir} to {gegner}.',

  'clankrieg.laeuft': 'War on',
  'clankrieg.gegen': 'vs',
  'clankrieg.stand': '{wir} to {gegner}',
  'clankrieg.gepunktet': 'Who scored',
  'clankrieg.keinePunkte': 'No points yet. Play a game - at least two humans at the table.',
  'clankrieg.partien': '{n} of 10 games',

  'clankrieg.keinGegner': 'No other clan found.',
  'clankrieg.mitglieder': '{n}/{max} members',
} satisfies Woerterbuch;
