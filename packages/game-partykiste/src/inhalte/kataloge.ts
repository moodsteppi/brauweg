/**
 * Die Kataloge nach Namen — fuer alles, was einen Eintrag von aussen nur als
 * `katalog` + `kennung` kennt: die Meldung „Passt nicht" (Server,
 * `/api/partykiste/meldung`) und ihre Liste fuer die Aufsicht.
 *
 * Seit dem 27.09.2026. Die Namen sind `INHALTS_KATALOGE` aus sicht.ts, also
 * dieselben, die in `gezeigt` stehen; ein Record ueber sie, damit ein neuer
 * Katalog hier nicht vergessen wird (der Bau bricht sonst).
 */

import type { InhaltsKatalog } from '../sicht.js';
import { ENTWEDER_ODER } from './entweder.js';
import { IDENTITAETEN } from './identitaeten.js';
import { IMPOSTER_WOERTER } from './imposter.js';
import { KATEGORIEN } from './kategorien.js';
import { KOENIGSBECHER_KARTEN } from './koenigsbecher.js';
import { MEHRHEITSFRAGEN } from './mehrheit.js';
import { NIEMALS_SPRUECHE } from './niemals.js';
import { QUIZ_FRAGEN } from './quiz.js';
import { REGELKARTEN } from './regelkarten.js';
import { SCHAETZ_FRAGEN } from './schaetzen.js';
import { AUFGABEN } from './wahrheitpflicht.js';
import { WER_EHER_SPRUECHE } from './wereher.js';
import { ZEHN_SEKUNDEN } from './zehnsekunden.js';

/** Ein Eintrag irgendeines Katalogs — Kennung, Haerte, und woraus man ihn wiedererkennt. */
interface Beliebig {
  readonly id: string;
  readonly haerte?: 1 | 2 | 3;
}

const KATALOGE: Readonly<Record<InhaltsKatalog, readonly Beliebig[]>> = {
  imposter: IMPOSTER_WOERTER,
  quiz: QUIZ_FRAGEN,
  identitaeten: IDENTITAETEN,
  niemals: NIEMALS_SPRUECHE,
  wereher: WER_EHER_SPRUECHE,
  schaetzen: SCHAETZ_FRAGEN,
  entweder: ENTWEDER_ODER,
  wahrheitpflicht: AUFGABEN,
  kategorien: KATEGORIEN,
  mehrheit: MEHRHEITSFRAGEN,
  regelkarten: REGELKARTEN,
  zehnsekunden: ZEHN_SEKUNDEN,
  koenigsbecher: KOENIGSBECHER_KARTEN,
};

/** Der Eintrag zu Katalog und Kennung — oder null. */
function eintrag(katalog: string, kennung: string): Beliebig | null {
  const liste = (KATALOGE as Readonly<Record<string, readonly Beliebig[] | undefined>>)[katalog];
  return liste?.find((e) => e.id === kennung) ?? null;
}

/** Gibt es diesen Eintrag? Eine Meldung auf eine erfundene Kennung waere Rauschen in der Liste. */
export function gibtInhalt(katalog: string, kennung: string): boolean {
  return eintrag(katalog, kennung) !== null;
}

/**
 * Was der Eintrag zeigt und wie hart er eingestuft ist — fuer die Liste der
 * Aufsicht, die sonst nur Kennungen saehe. Gelesen aus dem Katalog, nicht
 * aus der Meldung: Wer „zu zahm" meldet, will die Stufe von HEUTE sehen.
 */
export function inhaltKurz(katalog: string, kennung: string): { readonly text: string; readonly haerte: 1 | 2 | 3 } | null {
  const e = eintrag(katalog, kennung) as (Beliebig & Record<string, unknown>) | null;
  if (!e) return null;
  const feld = (name: string): string | null => (typeof e[name] === 'string' ? (e[name] as string) : null);
  const a = feld('a');
  const b = feld('b');
  const titel = feld('titel');
  const text =
    feld('frage') ??
    (a && b ? `${a} oder ${b}` : null) ??
    (titel && feld('text') ? `${titel}: ${feld('text')}` : null) ??
    feld('wort') ??
    feld('name') ??
    feld('text') ??
    kennung;
  return { text, haerte: e.haerte ?? 1 };
}

/**
 * Die Gruende fuer „Passt nicht" — Robins Liste vom 27.09.2026. Die Kennungen
 * stehen in `partykiste_meldung.grund` und aendern sich nie; neue kommen
 * hinten dazu. Die Beschriftung macht der Client (PasstNicht.tsx), der
 * Vertrag haelt beide Listen deckungsgleich.
 *
 *   sinnlos    ergibt keinen Sinn
 *   zu-zahm    zu zahm fuer die Stufe
 *   zu-hart    zu hart fuer die Stufe
 *   unbekannt  kennt keiner
 *   falsch     falsch (Quizantwort, Schaetzzahl, Hinweis …)
 *   sonstiges  sonstiges — dann hilft der Freitext
 */
export const PASST_NICHT_GRUENDE = ['sinnlos', 'zu-zahm', 'zu-hart', 'unbekannt', 'falsch', 'sonstiges'] as const;
export type PasstNichtGrund = (typeof PASST_NICHT_GRUENDE)[number];
