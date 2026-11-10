import { aktiveSprache } from '../../i18n';

/**
 * Eine Zahl im Format der aktiven Sprache, für die Lücken in `tf`/`tn`.
 *
 * Bis zur Übersetzung (Projekt „BroweGGames Language") stand Golf überall
 * mit roher Zahl im Text. Für Lochzahlen ist das gleich, für alles ab 1000
 * nicht: „1.000" heißt im Englischen „1,000". Hier und nicht je Aufrufer,
 * damit eine Zahl am ganzen Golfbildschirm gleich aussieht.
 */
export function zahl(n: number): string {
  return n.toLocaleString(aktiveSprache());
}
