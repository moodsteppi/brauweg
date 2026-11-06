import type { Woerterbuch } from '../woerterbuch';

/**
 * Englische Texte, Bereich „browort" — Gegenstück zu `de/browort.ts`.
 * Nur das Drumherum: Die Wörter bleiben deutsch, und das sagt
 * `browort.ui.deutschesWortspiel` dem Spieler.
 */
export default {
  'browort.ui.deutschesWortspiel': 'German word game',

  // Browort: Kopf, Laden
  'browort.ui.wortDesTages': 'Word of the day',
  'browort.ui.kopfAria': 'Streak {serie}, {schnitt}',
  'browort.ui.keineVerbindung': 'No connection.',
  'browort.ui.nochmal': 'Retry',
  'browort.ui.einenMoment': 'One moment…',

  // Ergebnis
  'browort.ui.imErstenVersuch': 'First try!',
  'browort.ui.geloestIn': 'Solved in {n} tries',
  'browort.ui.nichtGeschafft': 'Not today',
  'browort.ui.dasWortWar': 'The word was',
  'browort.ui.lohn': '+{muenzen} coins · +{xp} XP',
  'browort.ui.wochenschutz': 'Your weekly shield saved the streak.',

  // Statistik
  'browort.ui.gespielt': 'Played',
  'browort.ui.geloest': 'Solved',
  'browort.ui.serie': 'Streak',
  'browort.ui.beste': 'Best',
  'browort.ui.verteilungAria': 'How often solved in how many tries',
  'browort.ui.morgen': 'A new word tomorrow.',

  // Spielfeld
  'browort.ui.versucheAria': 'Tries',
  'browort.ui.leer': 'empty',
  'browort.ui.feldAria': '{buchstabe}, {farbe}',
  'browort.ui.farbe.g': 'correct',
  'browort.ui.farbe.v': 'in the word, wrong spot',
  'browort.ui.farbe.x': 'not in the word',
  'browort.ui.tastatur': 'Keyboard',
  'browort.ui.raten': 'Guess',
  'browort.ui.loeschen': 'Delete',
  'browort.ui.fuenfBuchstaben': 'Five letters, please.',
  'browort.ui.keineVerbindungNochmal': 'No connection - try again.',
  'browort.ui.keinSchnitt': 'no average yet',
  'browort.ui.schnitt': 'avg. {schnitt} tries',

  // Clanwort
  'browort.ui.clan.frageTitel': '“{wort}” as clan word?',
  'browort.ui.clan.frageText': 'Your clan guesses it today. You sit this one out.',
  'browort.ui.clan.frageJa': 'Set word',
  'browort.ui.clan.heuteImClan': 'Today in the clan',
  'browort.ui.geloestZahl': '{n} solved',
  'browort.ui.clan.inVersuchen.eins': 'in {n} try',
  'browort.ui.clan.inVersuchen.mehr': 'in {n} tries',
  'browort.ui.clan.nichtGeschafft': 'not solved',
  'browort.ui.clan.raetNoch': 'still guessing ({n}/6)',
  'browort.ui.clan.duWaehlst': 'You pick the word today',
  'browort.ui.clan.gewaehltVon': 'Picked today by {name}',
  'browort.ui.clan.vomZufall': 'Picked at random today',
  'browort.ui.clan.fuerDenClan': 'One word for the whole clan',
  'browort.ui.clan.serieAria': 'Clan word streak {n}',
  'browort.ui.clan.ohneClan': 'The clan word is for clans only. Join one or start your own.',
  'browort.ui.clan.sucht': '{name} is picking the word.',
  'browort.ui.clan.jemand': 'Someone',
  'browort.ui.clan.spaetestens': 'Starts at {uhr}:00 at the latest - if nothing comes by then, chance picks.',
  'browort.ui.clan.deinWort': 'Your word for today',
  'browort.ui.clan.zuschauen': 'You are not guessing today - watch how your clan does.',
  'browort.ui.clan.niemand': 'Nobody has guessed yet.',
  'browort.ui.clan.ausgelost': 'You were drawn: type a five-letter word by {uhr}:00.',
  'browort.ui.clan.geloestIn': 'Solved in {n}',

  // Startkarte
  'browort.ui.karte.erledigt': 'Done for today - a new word tomorrow.',
  'browort.ui.karte.wartet': 'Today’s word is waiting, or the flame goes out.',
  'browort.ui.karte.neu': 'Five letters, six tries, a new word every day.',
  'browort.ui.karte.aria.eins': 'Browort. Streak: {n} day, {schnitt}. {unter}',
  'browort.ui.karte.aria.mehr': 'Browort. Streak: {n} days, {schnitt}. {unter}',
  'browort.ui.karte.label': 'Browort · Word of the day',
  'browort.ui.karte.serie.eins': '{n} day streak',
  'browort.ui.karte.serie.mehr': '{n} day streak',
  'browort.ui.karte.heuteGespielt': 'Played today',
  'browort.ui.karte.rate': 'Guess the word',

  // Profil
  'browort.ui.profil.schnitt': 'avg. tries',
  'browort.ui.profil.besteSerie': 'Best streak',
  'browort.ui.profil.erstesWort': 'Guess your first word - your average shows up here.',
} satisfies Woerterbuch;
