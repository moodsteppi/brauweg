import { useEffect, useRef, useState } from 'react';
import '@fontsource/lilita-one';
import './startbildschirm.css';

/**
 * Der Start der App (Robin, 26.09.2026, nach dem Vorbild von Supercell und
 * Clash Royale): erst springt das Brauweg-Logo auf dunklem Grund auf, dann
 * kommt das gemalte Ladebild mit dem Logo oben und einer Ladeleiste mit
 * Prozentzahl unten.
 *
 * **Die Zahl ist ehrlich.** Sie zählt, was wirklich geladen wird: das Konto
 * (`geladen`, von App.tsx), die Schriften und die Bilder, die der Start gleich
 * zeigt. Die Anzeige läuft der echten Zahl weich hinterher, aber nie voraus —
 * eine Leiste, die bei 99 % hängen bleibt oder 100 % zeigt, bevor etwas da ist,
 * wäre genau die Art Anzeige, der niemand mehr glaubt.
 *
 * Mit „weniger Bewegung" entfällt das Aufspringen; das Logo steht einfach da.
 */

/** Was der Start gleich braucht; alles davon zählt in die Prozentzahl. */
const BILDER = [
  '/hub/ladebild.webp',
  '/hub/logo.png',
  '/hub/symbol-pokal.webp',
  '/hub/symbol-muenze.webp',
  '/hub/symbol-edelstein.webp',
  '/hub/truhe-holz.webp',
  '/hub/pinguin-marke.webp',
  '/hub/banner-doppelkopf.webp',
  '/hub/banner-skat.webp',
  '/hub/banner-partykiste.webp',
  '/hub/weg-biom-1-heimat.webp',
];
/** Das Konto wiegt so viel wie drei Bilder: Ohne es geht gar nichts. */
const KONTO_GEWICHT = 3;
const SCHRIFT_GEWICHT = 1;
/** So lange steht das Logo allein (ms), bevor das Ladebild kommt. */
const LOGO_DAUER = 1300;

function ladeBild(src: string): Promise<void> {
  return new Promise((fertig) => {
    const bild = new Image();
    // Ein fehlendes Bild hält den Start nicht auf: Es zählt als erledigt.
    bild.onload = () => fertig();
    bild.onerror = () => fertig();
    bild.src = src;
  });
}

export function Startbildschirm({
  geladen,
  onFertig,
}: {
  /** Ist das Konto da (erster Abruf von `/api/me` beendet)? */
  geladen: boolean;
  onFertig: () => void;
}): React.JSX.Element {
  const wenigerBewegung =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [phase, setPhase] = useState<'logo' | 'laden' | 'weg'>('logo');
  const [erledigt, setErledigt] = useState(0);
  const [anzeige, setAnzeige] = useState(0);
  const fertigGemeldet = useRef(false);

  const gesamt = BILDER.length + SCHRIFT_GEWICHT + KONTO_GEWICHT;
  const echt = Math.round(((erledigt + (geladen ? KONTO_GEWICHT : 0)) / gesamt) * 100);

  useEffect(() => {
    let lebt = true;
    const zaehle = (): void => {
      if (lebt) setErledigt((n) => n + 1);
    };
    BILDER.forEach((src) => void ladeBild(src).then(zaehle));
    const schriften = (document as Document & { fonts?: FontFaceSet }).fonts;
    void (schriften ? schriften.ready : Promise.resolve()).then(zaehle);
    const zeit = window.setTimeout(() => lebt && setPhase('laden'), wenigerBewegung ? 400 : LOGO_DAUER);
    return () => {
      lebt = false;
      window.clearTimeout(zeit);
    };
  }, [wenigerBewegung]);

  // Die Anzeige holt die echte Zahl in kleinen Schritten ein, nie darüber.
  useEffect(() => {
    if (phase !== 'laden' || anzeige >= echt) return;
    const schritt = window.setTimeout(() => setAnzeige((a) => Math.min(echt, a + Math.max(1, Math.round((echt - a) / 6)))), 30);
    return () => window.clearTimeout(schritt);
  }, [phase, anzeige, echt]);

  // Bei 100 % kurz stehen lassen, dann ausblenden und die App zeigen. Die
  // Zeitgeber hängen bewusst nicht an `phase`: Der Wechsel auf „weg" darf den
  // Aufruf von onFertig nicht mit abräumen. Aufgeräumt wird nur beim Abbauen.
  const meldeFertig = useRef(onFertig);
  meldeFertig.current = onFertig;
  const zeitgeber = useRef<number[]>([]);
  useEffect(() => () => zeitgeber.current.forEach((z) => window.clearTimeout(z)), []);
  useEffect(() => {
    if (phase !== 'laden' || anzeige < 100 || fertigGemeldet.current) return;
    fertigGemeldet.current = true;
    zeitgeber.current.push(
      window.setTimeout(() => setPhase('weg'), 250),
      window.setTimeout(() => meldeFertig.current(), wenigerBewegung ? 260 : 600),
    );
  }, [phase, anzeige, wenigerBewegung]);

  if (phase === 'logo') {
    return (
      <main className="start-logo" aria-label="Brauweg wird gestartet">
        <span className="start-logo-schein" aria-hidden="true" />
        <img className={`start-logo-bild${wenigerBewegung ? '' : ' is-springt'}`} src="/hub/logo.png" alt="Brauweg" draggable={false} />
      </main>
    );
  }

  return (
    <main className={`start-laden${phase === 'weg' ? ' is-weg' : ''}`} aria-busy={phase !== 'weg'}>
      <img className="start-laden-bild" src="/hub/ladebild.webp" alt="" draggable={false} />
      <img className="start-laden-logo" src="/hub/logo.png" alt="Brauweg" draggable={false} />
      <div className="start-laden-leiste" role="progressbar" aria-label="Brauweg lädt" aria-valuemin={0} aria-valuemax={100} aria-valuenow={anzeige}>
        <span className="start-laden-fuellung" style={{ width: `${anzeige}%` }} />
        <strong>{anzeige} %</strong>
      </div>
    </main>
  );
}
