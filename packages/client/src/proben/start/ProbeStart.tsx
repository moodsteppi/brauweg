import { useEffect, useState } from 'react';
import { Startbildschirm } from '../../screens/Startbildschirm';

/**
 * Probe: der Startbildschirm, nur im Dev-Server (`/?dev=start`).
 *
 * Das Konto gilt nach 1,5 s als geladen (wie ein langsamer erster Abruf);
 * danach beginnt der Durchlauf von vorn, damit man ihn mehrfach sieht.
 * `&halt=laden` bleibt beim Ladebild stehen (für Bildschirmfotos).
 */
export function ProbeStart(): React.JSX.Element {
  const halt = new URLSearchParams(window.location.search).get('halt');
  const [runde, setRunde] = useState(0);
  const [geladen, setGeladen] = useState(false);
  useEffect(() => {
    setGeladen(false);
    if (halt === 'laden') return;
    const zeit = window.setTimeout(() => setGeladen(true), 1500);
    return () => window.clearTimeout(zeit);
  }, [runde, halt]);
  return (
    <Startbildschirm
      key={runde}
      geladen={geladen}
      onFertig={() => window.setTimeout(() => setRunde((r) => r + 1), 1200)}
    />
  );
}
