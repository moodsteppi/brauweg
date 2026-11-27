import { useEffect, useRef, useState } from 'react';

import { t } from '../i18n';
import '@fontsource/lilita-one';
import './startbildschirm.css';

/** Das neue Logo entsteht aus vier eigenständigen Tieren und dem Schriftzug. Die fertige
 * Marke bleibt beim Laden an derselben Stelle; kein Wechsel zum alten Ladebild.
 * Fortschritt zählt weiterhin echte Ressourcen und den ersten Kontoabruf.
 */
/** Was der Start gleich braucht; alles davon zählt in die Prozentzahl. */
const BILDER = [
  '/hub/broweggames-vertikal-dunkel.webp',
  '/hub/broweggames-horizontal-dunkel.webp',
  '/hub/start-tiere.webp',
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
/** Kurzer Aufbau der Marke; Laden läuft währenddessen parallel. */
const LOGO_DAUER = 2450;

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
  const [logoFehlt, setLogoFehlt] = useState(false);

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
    if (phase === 'weg' || anzeige >= echt) return;
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

  return (
    <main className={`start-logo${phase !== 'logo' ? ' start-laden' : ''}${phase === 'weg' ? ' is-weg' : ''}${wenigerBewegung ? ' ist-ruhig' : ''}`}
      aria-label={t('startbild.wirdGestartet')} aria-busy={phase !== 'weg'}>
      <span className="start-logo-schein" aria-hidden="true" />
      <div className="start-marke">
        {logoFehlt ? <strong className="start-marke-ersatz">Browe<em>GG</em>ames</strong> : <>
          <img className="start-marke-ganz" src="/hub/broweggames-vertikal-dunkel.webp" alt="BroweGGames" draggable={false} onError={() => setLogoFehlt(true)} />
          <div className="start-tiere" aria-hidden="true">
            {['lila', 'giraffe', 'orange', 'tuerkis'].map(tier =>
              <span key={tier} className={`start-tier tier-${tier}`} />)}
          </div>
          <span className="start-verschmelzung" aria-hidden="true" />
          <img className="start-marke-schrift" src="/hub/broweggames-vertikal-dunkel.webp" alt="" aria-hidden="true" draggable={false} />
        </>}
      </div>
      {phase !== 'logo' && <div className="start-status">
        <div className="start-laden-leiste" role="progressbar" aria-label={t('startbild.laedt')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={anzeige}>
          <span className="start-laden-fuellung" style={{ width: `${anzeige}%` }} />
        </div>
        <span className="start-status-text">{anzeige === 100 ? 'Bereit für deine nächste Runde' : 'Deine Spiele werden vorbereitet'}<b>{anzeige} %</b></span>
      </div>}
    </main>
  );
}
