/**
 * Probe `/probe/tafelrunde-neu?fall=…` — die neue Oberflaeche von Tafelrunde
 * mit aufgezeichneten Sichten, ohne Server und ohne Anmeldung.
 *
 * Wofuer: die Sichtprobe bei drei Handygroessen (Umsetzungsplan, Abschnitt 8)
 * und das Ansehen gelieferter Grafik, ohne eine Partie zu spielen. Dieselbe
 * Bauart wie `/probe/ruestkammer` und `/probe/kampf`: Die ECHTEN Bausteine
 * werden eingehaengt, nichts nachgebaut. Die Sichten stammen aus einer
 * echten Bot-Partie (`szene-erzeugen.mjs`).
 *
 * Faelle: einstieg, suche, wartesaal, ladebild, ruesten (Vorgabe), marke
 * (Marke angetippt: Ring und Pop-up), blatt (Einheitenblatt), regeln, kampf,
 * zuschauen (eigener Kampf vorbei, andere laufen noch), ende.
 */

import { useEffect, useMemo } from 'react';

import type { Einheit, TafelrundeSicht } from '../../minispiele/tafelrunde/sicht';
import { EinstiegSeite } from '../../minispiele/tafelrunde/neu/Einstieg';
import { Ladebild } from '../../minispiele/tafelrunde/neu/Ladebild';
import { type Aktion, Spieltisch, type Tischwissen } from '../../minispiele/tafelrunde/neu/Spieltisch';
import { SucheSeite } from '../../minispiele/tafelrunde/neu/Suche';
import { WartesaalSeite } from '../../minispiele/tafelrunde/neu/Wartesaal';
import szene from './szene.json';

const RUEST = szene.ruest as unknown as TafelrundeSicht;
const KAMPF = szene.kampf as unknown as TafelrundeSicht;
const LEGAL = szene.legal as unknown as Aktion[];

const SITZE = [
  { seat: 0, displayName: 'Robin', accountId: 'r', avatarUrl: null, isBot: false },
  { seat: 1, displayName: 'Tom', accountId: 't', avatarUrl: null, isBot: false },
  { seat: 2, displayName: null, accountId: null, avatarUrl: null, isBot: true },
  { seat: 3, displayName: 'Lea', accountId: 'l', avatarUrl: null, isBot: false },
];

export function probeFall(): string {
  return new URLSearchParams(window.location.search).get('fall') ?? 'ruesten';
}

/** Nach dem ersten Bild einen Knopf antippen — fuer Faelle hinter einem Tipp. */
function useTipp(fall: string): void {
  useEffect(() => {
    const uhr = window.setTimeout(() => {
      if (fall === 'marke') {
        (document.querySelector('[aria-pressed]') as HTMLElement | null)?.click();
      }
      if (fall === 'blatt') {
        // Die erste eigene Einheit: Enter ist der Tastaturweg zum Blatt.
        const zelle = document.querySelector('[data-ziel^="brett:"][role="button"]');
        zelle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      }
      if (fall === 'regeln') {
        (document.querySelector('button[aria-label="So spielt man Tafelrunde"], button[aria-label="How to play Tafelrunde"]') as HTMLElement | null)?.click();
      }
    }, 300);
    return () => window.clearTimeout(uhr);
  }, [fall]);
}

export function ProbeTafelrundeNeu(): React.JSX.Element {
  const fall = probeFall();
  useTipp(fall);
  const wissen: Tischwissen = useMemo(
    () => ({
      katalog: Object.fromEntries((RUEST.katalog ?? []).map((e: Einheit) => [e.id, e])),
      synergieTabelle: RUEST.synergieTabelle ?? [],
      stufenwerte: RUEST.stufenwerte ?? {},
      faehigkeiten: RUEST.faehigkeiten ?? {},
    }),
    [],
  );
  const nichts = (): void => {};

  if (fall === 'einstieg') {
    return (
      <EinstiegSeite
        aktiv={23}
        startet={false}
        fehler={null}
        regelwissen={{ katalog: wissen.katalog, faehigkeiten: wissen.faehigkeiten, synergieTabelle: wissen.synergieTabelle }}
        onBack={nichts}
        onSuche={nichts}
        onErstellen={nichts}
        onBeitreten={nichts}
        onBots={nichts}
      />
    );
  }
  if (fall === 'suche') {
    return (
      <SucheSeite
        sekunden={19}
        suchende={5}
        wartende={[
          { id: 'r', name: 'Robin', bildUrl: null },
          { id: 't', name: 'Tom', bildUrl: null },
          { id: 'l', name: 'Lea', bildUrl: null },
          { id: 'm', name: 'Mats', bildUrl: null },
          { id: 'j', name: 'Jule', bildUrl: null },
        ]}
        onAbbrechen={nichts}
      />
    );
  }
  if (fall === 'wartesaal') {
    return (
      <WartesaalSeite
        tischId="probe"
        wartesaal={{ code: 'KX7M9Q', gastgeber: true, botsFuellen: true }}
        sitze={[...SITZE.slice(0, 2), { seat: 2, displayName: null, accountId: null, avatarUrl: null, isBot: false }, { seat: 3, displayName: null, accountId: null, avatarUrl: null, isBot: false }]}
        botStufe="standard"
        botStufen={[
          { id: 'anfaenger', name: 'Sanft' },
          { id: 'standard', name: 'Normal' },
          { id: 'experte', name: 'Hart' },
        ]}
        onBotStufe={nichts}
        onBotsFuellen={nichts}
        onStart={nichts}
        onAbbrechen={nichts}
      />
    );
  }
  if (fall === 'ladebild') return <Ladebild erledigt={7} gesamt={19} onAbbrechen={nichts} />;

  const sicht =
    fall === 'kampf' || fall === 'zuschauen'
      ? KAMPF
      : fall === 'ende'
        ? {
            ...RUEST,
            fertig: true,
            sieger: RUEST.ich,
            phase: 'ende' as const,
            // Die Rangliste so, wie sie nach einem Sieg aussaehe: ich vorn.
            platzierung: [...RUEST.platzierung]
              .sort((a, b) => Number(b.sitz === RUEST.ich) - Number(a.sitz === RUEST.ich))
              .map((p, i) => ({ ...p, platz: i + 1 })),
          }
        : RUEST;
  return (
    <Spieltisch
      /* Eine feste Kennung, damit die Probe einen festen Schauplatz hat;
         `?tisch=` waehlt einen anderen (zum Ansehen aller vier). */
      tischKennung={new URLSearchParams(window.location.search).get('tisch') ?? 'probe-tafelrunde'}
      sicht={sicht}
      wissen={wissen}
      legaleZuege={fall === 'kampf' || fall === 'zuschauen' ? [] : LEGAL}
      revision={1}
      /* `zuschauen`: Die Frist ist JETZT, also springt die Arena ans Ende des
         eigenen Kampfes (`startVersatz`) — die anderen laufen noch. */
      frist={fall === 'zuschauen' ? Date.now() : null}
      rundenfrist={fall === 'kampf' || fall === 'zuschauen' ? null : Date.now() + 42_000}
      sitze={SITZE}
      trophaeen={fall === 'ende' ? [{ seat: RUEST.ich ?? 0, delta: 24 }] : undefined}
      onAktion={nichts}
      onZurueck={nichts}
      onNochmal={nichts}
    />
  );
}
