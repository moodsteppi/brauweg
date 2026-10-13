/**
 * Eine Mitteilung wurde angetippt — an den Tisch, von dem sie handelt.
 *
 * Die Hülle meldet den Tisch zweimal (iOS: `Huelle.tischSkript`): als
 * Ereignis `brauweg:push-tisch` für den, der schon horcht, und als
 * `window.BRAUWEG_APP.pushTisch` für den, der erst nach der Anmeldung
 * hinsieht — beim Kaltstart aus der Mitteilung ist noch niemand angemeldet,
 * wenn sie ankommt. Abgeholt wird genau einmal: Der Eintrag wird danach
 * gelöscht, sonst spränge die App bei jedem Neuladen wieder an den Tisch.
 *
 * Bis zum 13.10.2026 öffnete das Antippen nur die App (docs/PUSH.md, „Offen").
 *
 * Nicht unter `push/`: App.tsx lädt aus `push/` nur nach (push.test.tsx), und
 * dieses Stück braucht keinen Push-Code, nur das Fenster.
 */

export const TISCH_EREIGNIS = 'brauweg:push-tisch';

type Tisch = { tableId: string; gameId: string };

function gueltig(wert: unknown): wert is Tisch {
  const t = wert as Partial<Tisch> | null;
  return typeof t?.tableId === 'string' && typeof t?.gameId === 'string';
}

/** Ruft `zumTisch` für eine schon abgelegte und jede künftige Mitteilung. */
export function horcheAufAntippen(zumTisch: (tisch: Tisch) => void): () => void {
  const abholen = (): void => {
    const app = typeof window === 'undefined' ? undefined : window.BRAUWEG_APP;
    const tisch = app?.pushTisch;
    if (!app || !gueltig(tisch)) return;
    delete app.pushTisch;
    zumTisch(tisch);
  };
  abholen();
  const beiEreignis = (): void => abholen();
  window.addEventListener(TISCH_EREIGNIS, beiEreignis);
  return () => window.removeEventListener(TISCH_EREIGNIS, beiEreignis);
}
