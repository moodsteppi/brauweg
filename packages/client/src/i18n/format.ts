/**
 * Zahlen, Uhrzeiten und Restdauern in der aktiven Sprache.
 *
 * Bis zur Sprachgrundlage stand an rund sechzig Stellen
 * `toLocaleString('de-DE')`: Wer auf Englisch spielte, las „1.234 Trophäen"
 * — und hielt das für gut eins, denn im Englischen ist der Punkt das Komma.
 * Hier und nicht im Wörterbuch, weil eine Zahl kein Text mit Schlüssel ist,
 * sondern eine Regel (Tausendertrenner, Dezimalzeichen, 12/24 Stunden), die
 * `Intl` je Sprache schon kennt.
 *
 * Spielinhalte (Kartenmanufaktur, Partykiste, Browort …) formatieren weiter
 * selbst; die gehören zur eigenen Schicht „Inhalte je Sprache".
 */

import { geraeteSprachen } from '../laufzeit';
import { aktiveSprache, t } from './index';
import type { Sprache } from './sprachen';

/** Wenn das Gerät zur aktiven Sprache keine Region nennt. */
const GEBIET_VORGABE: Record<Sprache, string> = {
  de: 'de-DE',
  en: 'en-US',
};

/**
 * Das Gebietsschema für `Intl`: die aktive Sprache, in der Region des Geräts.
 *
 * Wer sein Gerät auf `en-GB` stellt und Englisch spielt, bekommt 24 Stunden
 * und britische Schreibweise, wer `de-CH` hat, den Schweizer Tausendertrenner.
 * Passt keine Gerätesprache zur gewählten (Gerät Deutsch, Spiel fest auf
 * Englisch), gilt die Vorgabe der Sprache — nie die Region einer ANDEREN
 * Sprache: `en-DE` gäbe es zwar, aber dann stünde mitten im Englischen das
 * deutsche Komma.
 */
export function gebietsschema(sprache: Sprache, geraet: readonly string[]): string {
  for (const eintrag of geraet) {
    const haupt = eintrag.toLowerCase().split(/[-_]/)[0];
    if (haupt !== sprache || !/[-_]/.test(eintrag)) continue;
    try {
      // Unterstrich (`en_GB`, so liefern es manche Hüllen) versteht Intl nicht.
      const [geprueft] = Intl.getCanonicalLocales(eintrag.replace(/_/g, '-'));
      if (geprueft) return geprueft;
    } catch {
      // Unbrauchbares Kürzel vom Gerät — dann die nächste Zeile oder die Vorgabe.
    }
  }
  return GEBIET_VORGABE[sprache];
}

function aktivesGebiet(): string {
  return gebietsschema(aktiveSprache(), geraeteSprachen());
}

/*
 * Ein Formatierer kostet beim Anlegen spürbar (Locale-Daten laden), und die
 * Trophäenwegseite zeichnet hunderte Zahlen. Darum je Gebiet und Optionen
 * genau einer.
 */
const zahlFormate = new Map<string, Intl.NumberFormat>();
function zahlFormat(gebiet: string, optionen?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const schluessel = `${gebiet}|${optionen ? JSON.stringify(optionen) : ''}`;
  let f = zahlFormate.get(schluessel);
  if (!f) {
    f = new Intl.NumberFormat(gebiet, optionen);
    zahlFormate.set(schluessel, f);
  }
  return f;
}

/** Eine Zahl, wie man sie in der aktiven Sprache schreibt: 1.234 bzw. 1,234. */
export function zahl(n: number, optionen?: Intl.NumberFormatOptions): string {
  return zahlFormat(aktivesGebiet(), optionen).format(n);
}

/**
 * Große Zahlen kurz: 550, 1,5K, 12K, 10M (im Englischen 1.5K).
 *
 * Die Kopfzeile hat wenig Platz; ein siebenstelliger Muenzstand (etwa das
 * Testkonto mit 9.999.999) schiebt sonst Name und Level ineinander. Bis 1000
 * bleibt die Zahl ganz, darueber wird sie mit K und M abgekuerzt - eine
 * Nachkommastelle nur unterhalb von zehn, damit "1,5K" lesbar bleibt, aber
 * "12K" nicht "12,3K" heisst.
 *
 * K und M bleiben in jeder Sprache: `Intl` mit `notation: 'compact'` schriebe
 * im Deutschen „12.345" für zwölftausend (die Kurzform beginnt dort erst bei
 * der Million, „1,2 Mio.") und spränge damit genau an der Stelle aus der
 * Kopfzeile, für die es diese Funktion gibt.
 */
export function kompakteZahl(n: number): string {
  if (n < 1000) return String(n);
  const kurz = (wert: number, zeichen: string): string => {
    // Gerundet wird VOR dem Formatieren, wie bisher: 9,96K wird 10K, nicht 10,0K.
    const gerundet = wert < 10 ? Math.round(wert * 10) / 10 : Math.round(wert);
    return zahl(gerundet, { maximumFractionDigits: 1, useGrouping: false }) + zeichen;
  };
  // Knapp unter einer Million auf M umschalten, sonst rundet 999.999 zu
  // "1000K" statt "1M".
  if (n < 999_950) return kurz(n / 1000, 'K');
  return kurz(n / 1_000_000, 'M');
}

/** Uhrzeit ohne Datum, z.B. im Clan-Chat: 14:05 bzw. 2:05 PM. */
export function uhrzeit(zeitpunkt: string | number | Date): string {
  return new Date(zeitpunkt).toLocaleTimeString(aktivesGebiet(), { hour: '2-digit', minute: '2-digit' });
}

function einheit(wert: number, einheitName: 'day' | 'hour' | 'minute'): string {
  return zahl(wert, { style: 'unit', unit: einheitName, unitDisplay: 'short' });
}

/**
 * Verbleibende Zeit bis `endsAt` als kurzer Satz: „noch 12 Std.", „12 hr left".
 *
 * Die Einheiten liefert `Intl` (`Std.`/`hr`), nur der Rahmen („noch …") steht
 * im Wörterbuch, weil die Wortstellung je Sprache wechselt.
 */
export function restzeit(endsAt: string | null, jetzt: number = Date.now()): string {
  if (!endsAt) return '';
  const ms = new Date(endsAt).getTime() - jetzt;
  if (ms <= 0) return t('format.gleichVorbei');
  const minuten = Math.floor(ms / 60_000);
  const stunden = Math.floor(minuten / 60);
  const dauer =
    minuten < 60
      ? einheit(minuten, 'minute')
      : stunden < 24
        ? einheit(stunden, 'hour')
        : `${einheit(Math.floor(stunden / 24), 'day')} ${einheit(stunden % 24, 'hour')}`;
  return t('format.noch').replace('{dauer}', dauer);
}
