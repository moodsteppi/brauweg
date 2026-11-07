import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * Sprachprobe des Zauberer-Tisches (Projekt „BroweGGames Language").
 *
 * Die Probe `i18n/i18n.test.ts` sieht nur die Wörterbücher: Steht dort ein
 * englischer Text, ist sie grün — auch wenn der Tisch den Satz noch fest auf
 * Deutsch zeichnet. Diese Probe rendert deshalb den ECHTEN Tisch mit den
 * Fällen des Schaukastens auf Englisch und sucht darin jeden deutschen Text
 * der Zauberer-Bereiche, in Schrift wie in `aria-label` und `title`.
 */

vi.mock('../api', () => ({
  api: {
    shop: () => Promise.resolve({ tischware: [] }),
    pauseTable: () => Promise.resolve(),
    resumeTable: () => Promise.resolve(),
  },
}));

import { deckForGame } from '../decks';
import { setzeSprachwahl, t } from '../i18n';
import deZauberer from '../i18n/de/zauberer';
import deKarten from '../i18n/de/karten-zauberer';
import enZauberer from '../i18n/en/zauberer';
import enKarten from '../i18n/en/karten-zauberer';
import { FAELLE, GESCHICHTE, SITZE, verbindungFuer } from '../proben/zauberer/faelle';
import { Punktetafel, Rundenblatt, ZaubererTisch } from './WizardTable';

const nichts = (): void => undefined;
const nameOf = (seat: number): string => SITZE[seat]?.displayName ?? `Bot ${seat + 1}`;
const sitze = SITZE.map((s) => s.seat);

/**
 * Alles, was ein Mensch oder ein Vorleser am Tisch zu lesen bekommt — ohne
 * das, was eine ANDERE Übersetzungsaufgabe trägt: den Stichstapel aus den
 * gemeinsamen Bausteinen (`tisch/index.tsx`, „N Stiche gewonnen") und die
 * Phasennamen aus dem Bereich „tisch" (`phase.*`). Die stehen bis dahin auf
 * Deutsch da, und das ist nicht der Fehler, den diese Probe sucht.
 */
function lesbar(wurzel: HTMLElement): string {
  const kopie = wurzel.cloneNode(true) as HTMLElement;
  // Die Tischmitte zeigt nur den Phasennamen (`phase.*`).
  for (const el of kopie.querySelectorAll('.doko-stiche, .doko-trick-hint')) el.remove();
  const attribute = [...kopie.querySelectorAll('[aria-label], [title]')].flatMap((el) => [
    el.getAttribute('aria-label') ?? '',
    el.getAttribute('title') ?? '',
  ]);
  let text = [kopie.textContent ?? '', ...attribute].join('\n');
  // Die Rundenzeile nennt die Phase mitten im Satz.
  for (const phase of ['trump', 'bidding']) text = text.split(t(`phase.${phase}`)).join(' ');
  return text;
}

function tischIn(fall: string): HTMLElement {
  const { container } = render(
    <>
      <ZaubererTisch
        tableId="probe"
        deck={deckForGame('wizard', null)}
        szene="stube"
        onShowProfile={nichts}
        onLeave={nichts}
        verbindung={verbindungFuer(fall)}
      />
      {fall === 'runde' && (
        <Rundenblatt runde={GESCHICHTE[3]!} seats={sitze} nameOf={nameOf} onClose={nichts} />
      )}
      {fall === 'tafel' && (
        <Punktetafel
          history={GESCHICHTE}
          seats={sitze}
          scores={{ 0: 1, 1: 2, 2: 3, 3: 4 }}
          nameOf={nameOf}
          onClose={nichts}
        />
      )}
    </>,
  );
  return container;
}

/**
 * Jeder deutsche Text der Zauberer-Bereiche als Muster für den GANZEN Text:
 * Zahl-Platzhalter werden zu Zahlen, die übrigen (Name, Liste, Farbe) zu
 * beliebigem Text. Ganze Wörter, damit „Stich" nicht in „Sticht" anschlägt.
 * Texte, die im Englischen gleich lauten („Rd."), fallen heraus.
 */
const ZAHLEN = new Set(['n', 'nr', 'gesamt', 'summe']);
const DEUTSCH = [
  ...Object.entries(deZauberer).map(([k, v]) => [v, enZauberer[k as keyof typeof enZauberer]]),
  ...Object.entries(deKarten).map(([k, v]) => [v, enKarten[k as keyof typeof enKarten]]),
]
  .filter(([deutsch, englisch]) => deutsch !== englisch)
  .map(([deutsch]) => {
    const muster = deutsch!
      .split(/(\{\w+\})/)
      .map((teil) => {
        const platz = /^\{(\w+)\}$/.exec(teil);
        if (platz) return ZAHLEN.has(platz[1]!) ? '-?\\d+' : '.+?';
        return teil.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('');
    return { deutsch: deutsch!, muster: new RegExp(`(?<![\\p{L}\\d])${muster}(?![\\p{L}])`, 'u') };
  });

function deutscheReste(text: string): string[] {
  return DEUTSCH.filter(({ muster }) => muster.test(text)).map(({ deutsch }) => deutsch);
}

afterEach(() => setzeSprachwahl('de'));

describe('Zauberer-Tisch auf Englisch', () => {
  it.each(FAELLE)('%s: kein deutscher Text der Zauberer-Bereiche', (fall) => {
    setzeSprachwahl('en');
    const text = lesbar(tischIn(fall));
    expect(deutscheReste(text)).toEqual([]);
  });

  it('nennt die Marke nirgends', () => {
    setzeSprachwahl('en');
    for (const fall of FAELLE) expect(lesbar(tischIn(fall))).not.toMatch(/wizard|jester/i);
  });

  it('setzt Zahlen an die Stelle, die die Sprache verlangt', () => {
    setzeSprachwahl('en');
    const text = lesbar(tischIn('gebot'));
    expect(text).toContain('Round 5 / 15');
    expect(text).toContain('How many tricks will you take?');
    expect(text).toContain('Bids so far: Jonas 1 · Bot 3 2, total 3 of 5');
    expect(lesbar(tischIn('spiel'))).toContain('Bid 2 · 1 trick · 1 to go');
  });
});

describe('Zauberer-Tisch auf Deutsch', () => {
  it('behält den bisherigen Wortlaut', () => {
    setzeSprachwahl('de');
    const text = lesbar(tischIn('gebot'));
    expect(text).toContain('Runde 5 / 15');
    expect(text).toContain('Wie viele Stiche machst du?');
    expect(text).toContain('Bisher angesagt: Jonas 1 · Bot 3 2, Summe 3 von 5');
    // „Ansagen" selbst nimmt `lesbar` heraus (Bereich „tisch").
    expect(text).toContain('5 Karten · ♥ · ');
    expect(lesbar(tischIn('spiel'))).toContain('Gebot 2 · 1 Stich · noch 1');
  });
});
