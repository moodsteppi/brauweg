import { api } from '../../api';
import { bauAbzeichen, type BauErgebnis, type BauModus } from '@brauweg/building-kern';
export type BauEintrag = { partie: string; am: string; name: string; ergebnis: BauErgebnis; muenzen?: number; konto?: string };
const SCHLUESSEL = 'brauweg.building.chronik.v1';
export function chronikLesen(): BauEintrag[] {
  try { const a: unknown = JSON.parse(localStorage.getItem(SCHLUESSEL) ?? '[]'); return Array.isArray(a) ? a.filter(e => e && typeof e.partie === 'string' && typeof e.name === 'string' && typeof e.am === 'string' && e.ergebnis && Number.isFinite(e.ergebnis.hoehe) && ['rennen', 'standfest'].includes(e.ergebnis.modus)).slice(0, 30) : []; } catch { return []; }
}
export function chronikSchreiben(e: BauEintrag): boolean {
  try { localStorage.setItem(SCHLUESSEL, JSON.stringify([e, ...chronikLesen().filter(r => r.partie !== e.partie)].slice(0, 30))); return true; } catch { return false; }
}
/** Start und Abschluss werden einmal pro echter Runde angelegt, nicht pro Render. */
export class BauBuch {
  private readonly start: Promise<{ konto: string } | null>;
  constructor(readonly partie: string, modus: BauModus) {
    this.start = api.bauStart(partie, modus).catch(() => null);
  }
  async speichern(ergebnis: BauErgebnis, name: string): Promise<string> {
    const eintrag: BauEintrag = { partie: this.partie, am: new Date().toISOString(), name, ergebnis };
    const lokal = chronikSchreiben(eintrag);
    const start = await this.start;
    if (!start) return lokal ? 'Auf diesem Gerät gespeichert. Kontomünzen benötigen eine Anmeldung und eine Onlineverbindung beim Rundenstart.' : 'Dein Gerät erlaubt gerade keine Speicherung.';
    eintrag.konto = start.konto; chronikSchreiben(eintrag);
    try {
      const antwort = await api.bauErgebnis(this.partie, ergebnis);
      chronikSchreiben({ ...eintrag, muenzen: antwort.muenzen });
      return `Im Konto gespeichert. +${antwort.muenzen} Münzen${antwort.muenzen === 0 ? ' (Tageslimit oder keine gewertete Runde)' : ''}.`;
    } catch { return 'Lokal gespeichert. Die Kontosynchronisierung kannst du in deinem Baualbum erneut versuchen.'; }
  }
}
export { bauAbzeichen };
