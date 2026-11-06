/**
 * Secret Dame am Bildschirm: was auf welchem Feld markiert wird und wie ein
 * Ereignis als Satz lautet.
 *
 * Hier steht KEINE Regel. Welche Figur die geheime Dame ist, ob sie
 * aufgedeckt wurde, wer den König geschlagen hat — das alles kommt fertig
 * aus der Sicht (`secretDame`, packages/game-brochess/src/sicht.ts). Das
 * Modul entscheidet auch, wer was sieht: Die eigene verdeckte Dame steht nur
 * in der Sicht ihres Besitzers (`meine`), darum kann eine Markierung von ihr
 * gar nicht beim Gegner ankommen, egal was diese Datei tut.
 *
 * Eigene Datei statt im Brett, damit die Sätze ohne React geprüft werden.
 */

import { t } from '../../i18n';
import { tf } from '../../i18n/einsetzen';
import type {
  BroChessSicht,
  BroChessWahl,
  BroChessZug,
  Farbe,
  GeheimEreignis,
  SecretDameRegel,
  SecretDameSicht,
} from './sicht';

/**
 * - meineVerdeckt: die eigene geheime Dame, die der Gegner noch nicht kennt
 * - aufgedeckt: eine geheime Dame, die beide kennen
 * - warDame: hier wurde gerade eine verdeckte geheime Dame geschlagen
 * - koenigGeschlagen: hier hat eine verdeckte Dame den König geschlagen (Regel A)
 */
export type Markierung = 'meineVerdeckt' | 'aufgedeckt' | 'warDame' | 'koenigGeschlagen';

/** Schlüsselendung zur Figur; Unbekanntes heißt schlicht „Figur". */
const figurKey = (art: string): string => ('pnbrq'.includes(art) && art.length === 1 ? art : 'x');

/** Die zwei Regeln mit je einem Satz — für die Wahl vor der Partie und die Kopfzeile. */
export function regelText(regel: 'A' | 'B'): { kurz: string; satz: string } {
  return { kurz: t(`brochess.regel.${regel}.kurz`), satz: t(`brochess.regel.${regel}.satz`) };
}

/** Was vor der Partie gewählt wird. Die Regel gilt nur bei Secret Dame. */
export interface Spielart {
  modus: 'normal' | 'secretDame';
  regel: SecretDameRegel;
}

export const NORMALE_SPIELART: Spielart = { modus: 'normal', regel: 'A' };

/**
 * Die Felder für den Regelsatz des Tisches. Normal schickt NICHTS mit — so
 * entsteht derselbe Tisch wie vor dem Modus, und das Modul liest den
 * fehlenden Modus als 'normal' (regeln.ts, `modusVon`).
 */
export function spielartRegeln(s: Spielart): { modus?: 'secretDame'; schachDurchVerdeckte?: SecretDameRegel } {
  return s.modus === 'secretDame' ? { modus: 'secretDame', schachDurchVerdeckte: s.regel } : {};
}

/** Markierungen je Feld. Ein Feld kann zwei tragen (die eigene Dame schlägt die fremde). */
export function markierungen(sicht: BroChessSicht): Record<string, Markierung[]> {
  const sd = sicht.secretDame;
  const aus: Record<string, Markierung[]> = {};
  if (!sd) return aus;
  const setze = (feld: string | null, m: Markierung): void => {
    if (!feld) return;
    const liste = (aus[feld] ??= []);
    if (!liste.includes(m)) liste.push(m);
  };
  for (const dame of [sd.bekannt.w, sd.bekannt.b]) {
    if (dame?.zustand === 'aufgedeckt') setze(dame.feld, 'aufgedeckt');
  }
  if (sd.meine?.zustand === 'verdeckt') setze(sd.meine.feld, 'meineVerdeckt');
  if (sd.meine?.zustand === 'aufgedeckt') setze(sd.meine.feld, 'aufgedeckt');
  const zuletzt = sicht.verlauf.length;
  for (const e of sd.ereignisse) {
    // „War die Dame" nur zum Zug, der sie schlug — danach steht dort ja eine andere Figur.
    if (e.art === 'verdecktGeschlagen' && e.halbzug === zuletzt) setze(e.feld, 'warDame');
    if (e.art === 'koenigGeschlagen') setze(e.feld, 'koenigGeschlagen');
  }
  return aus;
}

/** Hat eine geheime Dame den König geschlagen? Dann ist das Ende kein gewöhnliches Matt. */
export function koenigsschlag(sd: SecretDameSicht | null): Extract<GeheimEreignis, { art: 'koenigGeschlagen' }> | null {
  const e = sd?.ereignisse.find((x) => x.art === 'koenigGeschlagen');
  return e?.art === 'koenigGeschlagen' ? e : null;
}

/**
 * Ein Ereignis als kurze Meldung, aus Sicht des Betrachters. `nameVon`
 * liefert den Namen zum Besitzer der Dame; der Betrachter selbst heißt „du".
 */
export function meldung(
  e: GeheimEreignis,
  meineFarbe: Farbe | null,
  nameVon: (farbe: Farbe) => string,
): string {
  const meins = meineFarbe === e.farbe;
  const name = nameVon(e.farbe);
  switch (e.art) {
    case 'aufgedeckt': {
      const k = figurKey(e.grundfigur);
      return meins
        ? tf('brochess.meldung.aufgedeckt.meine', { figur: t(`brochess.figurDein.${k}`), feld: e.feld })
        : tf('brochess.meldung.aufgedeckt.fremde', { figur: t(`brochess.figurDer.${k}`), feld: e.feld, name });
    }
    case 'verdecktGeschlagen': {
      const k = figurKey(e.grundfigur);
      return meins
        ? tf('brochess.meldung.geschlagen.meine', { figur: t(`brochess.figurDein.${k}`), feld: e.feld })
        : tf('brochess.meldung.geschlagen.fremde', { figur: t(`brochess.figurDer.${k}`), feld: e.feld, name });
    }
    case 'umgewandelt':
      return meins
        ? tf('brochess.meldung.umgewandelt.meine', { feld: e.feld })
        : tf('brochess.meldung.umgewandelt.fremde', { feld: e.feld, name });
    case 'koenigGeschlagen':
      if (meins) return tf('brochess.meldung.koenig.meine', { feld: e.feld });
      return meineFarbe === null
        ? tf('brochess.meldung.koenig.zuschauer', { feld: e.feld, name })
        : tf('brochess.meldung.koenig.fremde', { feld: e.feld, name });
  }
}

/** Das jüngste Ereignis, wenn es zum letzten Zug gehört — sonst nichts zu melden. */
export function frischesEreignis(sicht: BroChessSicht): GeheimEreignis | null {
  const liste = sicht.secretDame?.ereignisse ?? [];
  const e = liste[liste.length - 1];
  return e && e.halbzug === sicht.verlauf.length ? e : null;
}

/**
 * Die Statuszeile, solange gewählt wird: Wer noch nicht gewählt hat, wird
 * angeleitet, wer fertig ist, wartet. Null, wenn nicht gewählt wird.
 */
export function wahlHinweis(sicht: BroChessSicht, nameVon: (farbe: Farbe) => string): string | null {
  const sd = sicht.secretDame;
  if (!sd?.wahlLaeuft || sicht.ende) return null;
  if (sicht.meineFarbe === null) return t('brochess.wahl.zuschauer');
  if (!sd.gewaehlt[sicht.meineFarbe]) return t('brochess.wahl.anleitung');
  const gegner: Farbe = sicht.meineFarbe === 'w' ? 'b' : 'w';
  return tf('brochess.wahl.warten', { name: nameVon(gegner) });
}

/** `legalActions` getrennt: Züge fürs Brett, Felder für die Wahl der geheimen Dame. */
export function trenneAktionen(aktionen: readonly unknown[]): { zuege: BroChessZug[]; wahl: string[] } {
  const zuege: BroChessZug[] = [];
  const wahl: string[] = [];
  for (const a of aktionen as (BroChessZug | BroChessWahl)[]) {
    if (a.type === 'zug') zuege.push(a);
    else if (a.type === 'wahl') wahl.push(a.feld);
  }
  return { zuege, wahl };
}
