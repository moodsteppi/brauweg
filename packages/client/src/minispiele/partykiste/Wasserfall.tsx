import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { FARBZEICHEN, istRoteKarte, type PartyKarte } from './sicht';
import './wasserfall.css';

/**
 * Wasserfall — die Einlage, wenn im Königsbecher das Ass gezogen wird
 * (Emile, 13.10.2026: „mach eine Animation, 3D oder so").
 *
 * Das Ass heißt „Wasserfall": Alle kassieren. Statt einer Karte unter
 * vielen stürzt dann ein Wasserfall über den ganzen Bildschirm — in
 * räumlicher Tiefe (CSS-3D, `perspective`), mit der Karte, die sich im
 * Fallen überschlägt, Gischt, Nebel und dem Wort, das Buchstabe für
 * Buchstabe ins Becken fällt.
 *
 * CSS statt WebGL: Die Einlage dauert drei Sekunden, und ein eigener
 * WebGL-Kontext dafür kostete mehr (Laden, Speicher, „Context Lost" am
 * Handy — CLAUDE.md) als er bringt. Bewegt wird nur `transform` und
 * `opacity`.
 *
 * Gezeigt wird genau einmal je gezogenem Ass: Der Aufrufer gibt eine
 * `kennung` mit, die sich nur beim nächsten Zug ändert (CLAUDE.md: Effekte
 * an einen Schlüssel, nicht an ein Objekt — sonst spielte jeder Serverfunk
 * die Einlage neu). Ein Tipp schließt sie früher.
 *
 * Per Portal an `body`: Am Tisch setzt die Szenen-Regel jedes direkte Kind
 * auf `position: relative` (szenen.css), und ein Vorfahr mit `transform`
 * oder `backdrop-filter` machte aus `fixed` einen Streifen in seinem Kasten.
 * So steht die Einlage immer über dem ganzen Bildschirm.
 */

const DAUER_MS = 3600;
const WORT = 'WASSERFALL';

export function Wasserfall({
  kennung,
  karte,
  getroffen,
}: {
  kennung: string | null;
  /** Das gezogene Ass — mit seiner echten Farbe. */
  karte: PartyKarte | null;
  getroffen: string;
}): React.JSX.Element | null {
  const [sichtbar, setSichtbar] = useState<string | null>(null);

  useEffect(() => {
    if (!kennung) return;
    setSichtbar(kennung);
    const t = setTimeout(() => setSichtbar((jetzt) => (jetzt === kennung ? null : jetzt)), DAUER_MS);
    return () => clearTimeout(t);
  }, [kennung]);

  if (!sichtbar || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="wf"
      role="dialog"
      aria-label={`Wasserfall! ${getroffen}`}
      onClick={() => setSichtbar(null)}
    >
      <div className="wf-buehne">
        {/* Felskante oben, über die das Wasser stürzt. */}
        <div className="wf-kante" />
        {/* Der Fall selbst: zwei Wasserschichten in verschiedener Tiefe,
            die eine schneller als die andere — daher der Raumeindruck. */}
        <div className="wf-fall is-hinten">
          <span className="wf-stroemung" />
        </div>
        <div className="wf-fall is-vorne">
          <span className="wf-stroemung" />
        </div>
      </div>

      {/* Vor dem Wasser, in eigener Ebene: Läge das in derselben 3D-Bühne
          wie der Fall, sortierte der Browser es dahinter, und Ass, Gischt
          und Becken verschwänden im Wasser. */}
      <div className="wf-vorn">
        {/* Becken unten mit Wellenringen. */}
        <div className="wf-becken">
          {[0, 1, 2].map((i) => (
            <span key={i} className="wf-ring" style={{ '--i': i } as React.CSSProperties} />
          ))}
        </div>
        {/* Gischt: Tropfen, die im Bogen aus dem Becken springen. */}
        <div className="wf-gischt">
          {Array.from({ length: 18 }, (_, i) => (
            <span
              key={i}
              className="wf-tropfen"
              style={{ '--i': i, '--dx': `${((i * 53) % 220) - 110}px`, '--h': `${60 + ((i * 37) % 90)}px` } as React.CSSProperties}
            />
          ))}
        </div>
        <span className="wf-nebel" />
        <span className="wf-nebel is-zwei" />
      </div>

      {/* Das Ass stürzt mit dem Wasser und überschlägt sich dabei. */}
      <div className="wf-kartenraum">
        <div className="wf-karte">
          <div className="wf-karte-innen">
            <div className="wf-karte-vorne" data-rot={karte && istRoteKarte(karte) ? '' : undefined}>
              <span>A</span>
              <span className="wf-karte-farbe">{karte ? (FARBZEICHEN[karte.farbe] ?? '♠') : '♠'}</span>
            </div>
            <div className="wf-karte-hinten" />
          </div>
        </div>
      </div>

      <p className="wf-wort" aria-hidden="true">
        {WORT.split('').map((b, i) => (
          <span key={i} style={{ '--i': i } as React.CSSProperties}>
            {b}
          </span>
        ))}
      </p>
      <p className="wf-text">{getroffen}</p>
    </div>,
    document.body,
  );
}
