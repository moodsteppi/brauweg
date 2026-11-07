import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „browort": Browort und Clanwort samt Profil —
 * alles außer den Wörtern selbst. Die Startkarte steht nicht hier, sondern
 * unter `startkarte.browort.*` beim Hub (sie gehört zum Start, nicht zum Spiel).
 *
 * Das Spiel bleibt in jeder Sprache deutsch: Wortliste, Tastatur (mit Ä, Ö,
 * Ü) und Lösung stehen nicht hier, sondern auf dem Server bzw. in
 * `browort/tasten.ts`. Übersetzt wird nur, was drumherum steht. Damit ein
 * englischer Spieler nicht rätselt, warum „HAFEN" kein Wort seiner Sprache
 * ist, sagt `browort.ui.deutschesWortspiel` es ihm — gezeigt nur, wenn die
 * Sprache nicht Deutsch ist.
 *
 * Meldungen des Servers (unbekanntes Wort, schon gespielt) stehen im Bereich
 * „fehler" (`error.browort*`).
 *
 * Platzhalter in geschweiften Klammern füllt `tz` (browort/text.ts); Einzahl
 * und Mehrzahl stehen als eigene Schlüssel (`.eins` / `.mehr`).
 * Eine Zeile je Schlüssel — packages/server/test/woerterbuch.ts liest diese
 * Datei per Regex.
 */
export default {
  'browort.ui.deutschesWortspiel': 'Deutsches Wortspiel',

  // Browort: Kopf, Laden
  'browort.ui.wortDesTages': 'Das Wort des Tages',
  'browort.ui.kopfAria': 'Serie {serie}, {schnitt}',
  'browort.ui.keineVerbindung': 'Keine Verbindung.',
  'browort.ui.nochmal': 'Nochmal',
  'browort.ui.einenMoment': 'Einen Moment…',

  // Ergebnis
  'browort.ui.imErstenVersuch': 'Im ersten Versuch!',
  'browort.ui.geloestIn': 'Gelöst in {n} Versuchen',
  'browort.ui.nichtGeschafft': 'Heute nicht geschafft',
  'browort.ui.dasWortWar': 'Das Wort war',
  'browort.ui.lohn': '+{muenzen} Münzen · +{xp} XP',
  'browort.ui.wochenschutz': 'Dein Wochenschutz hat die Serie gerettet.',

  // Statistik
  'browort.ui.gespielt': 'Gespielt',
  'browort.ui.geloest': 'Gelöst',
  'browort.ui.serie': 'Serie',
  'browort.ui.beste': 'Beste',
  'browort.ui.verteilungAria': 'Wie oft mit wie vielen Versuchen gelöst',
  'browort.ui.morgen': 'Morgen gibt es ein neues Wort.',

  // Spielfeld: Raster, Tastatur, Meldungen
  'browort.ui.versucheAria': 'Versuche',
  'browort.ui.leer': 'leer',
  'browort.ui.feldAria': '{buchstabe}, {farbe}',
  'browort.ui.farbe.g': 'richtig',
  'browort.ui.farbe.v': 'im Wort, andere Stelle',
  'browort.ui.farbe.x': 'nicht im Wort',
  'browort.ui.tastatur': 'Tastatur',
  'browort.ui.raten': 'Raten',
  'browort.ui.loeschen': 'Löschen',
  'browort.ui.fuenfBuchstaben': 'Fünf Buchstaben, bitte.',
  'browort.ui.keineVerbindungNochmal': 'Keine Verbindung - nochmal versuchen.',
  'browort.ui.keinSchnitt': 'noch kein Schnitt',
  'browort.ui.schnitt': 'Ø {schnitt} Versuche',

  // Clanwort
  'browort.ui.clan.frageTitel': '„{wort}“ als Clanwort?',
  'browort.ui.clan.frageText': 'Dein Clan rät es heute. Du selbst rätst nicht mit.',
  'browort.ui.clan.frageJa': 'Wort festlegen',
  'browort.ui.clan.heuteImClan': 'Heute im Clan',
  'browort.ui.geloestZahl': '{n} gelöst',
  'browort.ui.clan.inVersuchen.eins': 'in {n} Versuch',
  'browort.ui.clan.inVersuchen.mehr': 'in {n} Versuchen',
  'browort.ui.clan.nichtGeschafft': 'nicht geschafft',
  'browort.ui.clan.raetNoch': 'rät noch ({n}/6)',
  'browort.ui.clan.duWaehlst': 'Heute wählst du das Wort',
  'browort.ui.clan.gewaehltVon': 'Heute gewählt von {name}',
  'browort.ui.clan.vomZufall': 'Heute vom Zufall gewählt',
  'browort.ui.clan.fuerDenClan': 'Ein Wort für den ganzen Clan',
  'browort.ui.clan.serieAria': 'Clanwort-Serie {n}',
  'browort.ui.clan.ohneClan': 'Das Clanwort gibt es nur im Clan. Tritt einem bei oder gründe einen.',
  'browort.ui.clan.sucht': '{name} sucht gerade das Wort aus.',
  'browort.ui.clan.jemand': 'Jemand',
  'browort.ui.clan.spaetestens': 'Spätestens um {uhr} Uhr geht es los - kommt bis dahin nichts, wählt der Zufall.',
  'browort.ui.clan.deinWort': 'Dein Wort für heute',
  'browort.ui.clan.zuschauen': 'Du rätst heute nicht mit - schau zu, wie sich dein Clan schlägt.',
  'browort.ui.clan.niemand': 'Noch hat niemand geraten.',
  'browort.ui.clan.ausgelost': 'Du wurdest ausgelost: Tippe bis {uhr} Uhr ein Wort mit fünf Buchstaben.',
  'browort.ui.clan.geloestIn': 'Gelöst in {n}',


  // Profil
  'browort.ui.profil.schnitt': 'Ø Versuche',
  'browort.ui.profil.besteSerie': 'Beste Serie',
  'browort.ui.profil.erstesWort': 'Rate dein erstes Wort - dann steht hier dein Schnitt.',
} satisfies Woerterbuch;
