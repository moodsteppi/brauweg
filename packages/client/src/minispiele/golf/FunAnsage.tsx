import { useEffect, useState } from 'react';

import { t } from '../../i18n';
import {
  type Golfmodus,
  type Lochmodifikatoren,
  ROULETTE,
  type Rouletteart,
  WIND_STAERKEN,
  modifikatorenFuerLoch,
  modusAus,
} from './modifikator';

/**
 * Der Fun-Modus am Bildschirm: die Wahl im Menü, die Ansage vor jedem Loch
 * und das Schild im HUD.
 *
 * Seit dem 23.09.2026, in einer eigenen Datei, damit `screens/Golf.tsx` nur
 * Einhängezeilen bekommt (dieselbe Regel wie bei ParAnzeige.tsx). Gerechnet
 * wird hier nichts: Welcher Modifikator gilt, sagt `modifikatorenFuerLoch` —
 * dieselbe Funktion, die `starteLoch` in der Physik ruft, aus derselben Saat
 * und demselben Lochindex. Eine zweite Rechnung wäre die zweite Wahrheit aus
 * der CLAUDE.md (Tafelrunde).
 */

/** Zeichen je Modifikator — Bild, keine Kennung. */
const ZEICHEN: Record<Rouletteart, string> = {
  wind: '🌬️',
  regen: '🌧️',
  riesenball: '🏐',
  miniball: '🔹',
  gummiwaende: '🪀',
  zeitlupe: '🐌',
  schwerelos: '🪐',
};

/** So lange steht die große Ansage am Lochbeginn. */
const ANSAGE_MS = 3200;
/** So lange dreht die Trommel, bevor sie auf dem Modifikator stehen bleibt. */
const DREH_MS = 1100;
const DREH_TAKT_MS = 90;

function windText(mod: Lochmodifikatoren): string | null {
  if (mod.wind === null) return null;
  const i = WIND_STAERKEN.indexOf(mod.wind.staerke);
  const name = i <= 0 ? 'golf.fun.windLeicht' : i === 1 ? 'golf.fun.windFrisch' : 'golf.fun.windStark';
  return t(name);
}

/**
 * Ein Pfeil in Windrichtung. `atan2` ist hier erlaubt: Das ist Anzeige, nicht
 * Simulation — die Physik bekommt die Richtung als Vektor aus den Tabellen.
 */
function Windpfeil({ mod }: { mod: Lochmodifikatoren }): React.JSX.Element | null {
  if (mod.wind === null) return null;
  const grad = (Math.atan2(mod.wind.ry, mod.wind.rx) * 180) / Math.PI;
  return (
    <span className="gf-fun-pfeil" aria-hidden="true" style={{ transform: `rotate(${grad}deg)` }}>
      ➜
    </span>
  );
}

/**
 * Die Ansage vor jedem Loch, das Schild im HUD und in der Pause der Blick
 * aufs nächste Loch. Im klassischen Modus nichts.
 *
 * Die Ansage hängt am Lochindex, nicht am HUD-Objekt (CLAUDE.md, „React-
 * Effekte an einen Schlüssel hängen"). Wer mitten im Loch neu lädt, sieht sie
 * noch einmal — das ist gewollt: Er weiß sonst nicht, warum sein Ball driftet.
 */
export function FunAnsage({
  modus,
  saat,
  loch,
  loecher,
  pause,
}: {
  modus: Golfmodus | undefined;
  saat: number;
  loch: number;
  loecher: number;
  pause: boolean;
}): React.JSX.Element | null {
  const fun = modusAus(modus) === 'fun';
  const [ansage, setAnsage] = useState<{ loch: number; dreht: number } | null>(null);

  useEffect(() => {
    if (!fun || pause) return;
    const ruhig =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    setAnsage({ loch, dreht: ruhig ? -1 : 0 });
    const zeitgeber: number[] = [];
    if (!ruhig) {
      for (let n = 1; n * DREH_TAKT_MS < DREH_MS; n += 1) {
        zeitgeber.push(window.setTimeout(() => setAnsage({ loch, dreht: n }), n * DREH_TAKT_MS));
      }
      zeitgeber.push(window.setTimeout(() => setAnsage({ loch, dreht: -1 }), DREH_MS));
    }
    zeitgeber.push(window.setTimeout(() => setAnsage(null), ANSAGE_MS));
    return () => {
      for (const z of zeitgeber) window.clearTimeout(z);
    };
  }, [fun, pause, loch]);

  if (!fun) return null;
  const mod = modifikatorenFuerLoch('fun', saat, loch);
  const art = mod.roulette;
  if (art === null) return null;

  if (pause) {
    if (loch + 1 >= loecher) return null;
    const naechster = modifikatorenFuerLoch('fun', saat, loch + 1);
    if (naechster.roulette === null) return null;
    return (
      <p className="gf-fun-naechstes" data-golf-fun-naechstes={naechster.roulette} aria-live="polite">
        {t('golf.fun.naechstes')}: <span aria-hidden="true">{ZEICHEN[naechster.roulette]}</span>{' '}
        <strong>{t(`golf.fun.${naechster.roulette}`)}</strong>
      </p>
    );
  }

  const zeigeAnsage = ansage !== null && ansage.loch === loch;
  const trommel = zeigeAnsage && ansage.dreht >= 0 ? ROULETTE[(ansage.dreht * 3 + loch) % ROULETTE.length] : art;
  const wind = windText(mod);

  return (
    <>
      <p className="gf-fun-schild" data-golf-fun={art} title={t(`golf.fun.${art}Text`)}>
        <span aria-hidden="true">{ZEICHEN[art]}</span>
        <strong>{t(`golf.fun.${art}`)}</strong>
        {wind !== null && (
          <>
            <Windpfeil mod={mod} />
            <em>{wind}</em>
          </>
        )}
      </p>
      {zeigeAnsage && (
        <div className="gf-fun-ansage" data-dreht={ansage.dreht >= 0 ? '' : undefined} role="status">
          <small>{t('golf.fun.roulette')}</small>
          <span className="gf-fun-zeichen" aria-hidden="true">
            {ZEICHEN[trommel]}
          </span>
          <strong>{t(`golf.fun.${trommel}`)}</strong>
          {ansage.dreht < 0 && (
            <p>
              {t(`golf.fun.${art}Text`)}
              {wind !== null && (
                <>
                  {' '}
                  <Windpfeil mod={mod} /> {wind}
                </>
              )}
            </p>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Die Wahl der Spielart im Menü „Gegen Bots" — zwei Knöpfe wie die
 * Spielstärke daneben.
 */
export function ModusWahl({
  modus,
  onWahl,
}: {
  modus: Golfmodus;
  onWahl: (modus: Golfmodus) => void;
}): React.JSX.Element {
  return (
    <div className="gf-fun-wahl">
      <div className="gf-stufen" role="group" aria-label={t('golf.fun.modus')}>
        {(['klassisch', 'fun'] as const).map((m) => (
          <button
            key={m}
            type="button"
            data-golf-modus={m}
            data-an={modus === m ? '' : undefined}
            aria-pressed={modus === m}
            onClick={() => onWahl(m)}
          >
            {t(`golf.fun.${m}`)}
          </button>
        ))}
      </div>
      <small>{t(modus === 'fun' ? 'golf.fun.funText' : 'golf.fun.klassischText')}</small>
    </div>
  );
}

/**
 * Was die anderen in der Gruppe von der Spielart sehen, die Sitz 0 gewählt
 * hat (seit dem 23.09.2026) — nur im Fun-Modus, klassisch ist der Normalfall.
 */
export function ModusAnzeige({ modus }: { modus: Golfmodus }): React.JSX.Element | null {
  if (modus !== 'fun') return null;
  return (
    <p className="gf-bw-hinweis" data-golf-modus-anzeige={modus}>
      <strong>{t('golf.fun.fun')}</strong> — {t('golf.fun.funText')}
    </p>
  );
}

/**
 * Der Regelsatz mit Spielart: `basis` ist, was die Bahnauswahl liefert
 * (oder `null`, wenn sie nichts gewählt hat). Klassisch ohne Bahnwahl bleibt
 * `undefined` — dann nimmt der Server den Regelsatz des Moduls, wie bisher.
 */
export function regelnMitModus(
  basis: Record<string, unknown> | null,
  modus: Golfmodus,
): Record<string, unknown> | undefined {
  if (modus !== 'fun') return basis ?? undefined;
  return { ...(basis ?? {}), modus: 'fun' };
}

/** Die gemerkte Spielart; gesperrte Seitendaten sind klassisch. */
export function gemerkterModus(schluessel: string): Golfmodus {
  try {
    return modusAus(localStorage.getItem(schluessel));
  } catch {
    return 'klassisch';
  }
}
