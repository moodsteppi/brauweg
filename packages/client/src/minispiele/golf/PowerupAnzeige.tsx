import { t } from '../../i18n';
import { POWERUPS, type Powerupart } from './powerup';

/**
 * Das gehaltene Power-up im HUD (Fun-Modus, Teil 2/3, seit dem 23.09.2026).
 *
 * Eine eigene Datei, damit `screens/Golf.tsx` nur eine Einhängezeile bekommt
 * (dieselbe Regel wie bei FunAnsage.tsx). Gerechnet wird hier nichts: Was der
 * eigene Ball hält und was gerade wirkt, steht im HUD-Stand, und der liest es
 * am Ball (`halt`, `wirkung`).
 *
 * Die kurze Rückmeldung beim Einsammeln ist ein CSS-Aufploppen am `key`:
 * Wechselt das Gehaltene, baut React das Schild neu, und die Animation läuft
 * einmal. Unter `prefers-reduced-motion` steht sie still (styles.css,
 * `.gf-pu-*`) — das Schild erscheint dann einfach.
 */

/** Zeichen je Art — Bild, keine Kennung. Dieselben Farben malt der Zeichner. */
export const PU_ZEICHEN: Readonly<Record<Powerupart, string>> = {
  turbo: '⚡',
  magnet: '🧲',
  geist: '👻',
  schild: '🛡️',
};

/** Liest eine Art aus dem HUD-Stand (dort als Zeichenkette, damit er vergleichbar bleibt). */
export function powerupAus(wert: string): Powerupart | null {
  return (POWERUPS as readonly string[]).includes(wert) ? (wert as Powerupart) : null;
}

export function PowerupAnzeige({ halt, wirkung }: { halt: string; wirkung: string }): React.JSX.Element | null {
  const h = powerupAus(halt);
  const w = powerupAus(wirkung);
  if (h === null && w === null) return null;
  return (
    <div className="gf-pu" aria-live="polite">
      {w !== null && (
        <p className="gf-pu-schild" data-golf-pu-wirkt={w} key={`w-${w}`}>
          <span aria-hidden="true">{PU_ZEICHEN[w]}</span>
          <strong>{t(`golf.fun.pu.${w}`)}</strong>
          <em>{t('golf.fun.pu.wirkt')}</em>
        </p>
      )}
      {h !== null && (
        <p className="gf-pu-schild" data-golf-pu={h} key={`h-${h}`} title={t(`golf.fun.pu.${h}Text`)}>
          <span aria-hidden="true">{PU_ZEICHEN[h]}</span>
          <strong>{t(`golf.fun.pu.${h}`)}</strong>
          <em>{t(h === 'schild' ? 'golf.fun.pu.bereit' : 'golf.fun.pu.naechster')}</em>
        </p>
      )}
    </div>
  );
}
