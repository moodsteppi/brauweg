/**
 * Die Fingeranleitung beim ersten Start: tippen, Paternoster, Wagen, erstes
 * Upgrade, erster Meister. Der Schritt folgt aus dem Stand, nicht aus einer
 * gespeicherten Marke — wer schon einen Meister hat, braucht keine Anleitung
 * mehr, auch nicht auf einem neuen Geraet.
 */

import { type ManufakturStand, ausbauLeistbar, meisterLeistbar } from '@brauweg/manufaktur-kern';

export type AnleitungsZiel =
  | { wo: 'presse'; index: 0 }
  | { wo: 'paternoster' }
  | { wo: 'wagen' }
  | { wo: 'schild'; index: 0 }
  | { wo: 'meister'; art: 'versand' | 'paternoster' | 'presse' };

export function anleitungsSchritt(stand: ManufakturStand): AnleitungsZiel | null {
  const meister = stand.pressen.some((p) => p.meister) || stand.paternoster.meister || stand.versand.meister;
  if (meister || stand.manufaktur > 1) return null;
  const { pressen, paternoster, versand } = stand;

  // Noch nichts verkauft: die Kette einmal von Hand.
  if (stand.verdient === 0) {
    if (versand.laeuft || paternoster.laeuft || pressen[0]!.laeuft) return null;
    if (stand.packtisch > 0) return { wo: 'wagen' };
    if (pressen.some((p) => p.kiste > 0)) return { wo: 'paternoster' };
    return { wo: 'presse', index: 0 };
  }
  // Das erste Upgrade, sobald es bezahlbar ist.
  const nochNieAusgebaut = pressen.every((p) => p.stufe === 1) && paternoster.stufe === 1 && versand.stufe === 1;
  if (nochNieAusgebaut && ausbauLeistbar(stand, { art: 'presse', index: 0 })) return { wo: 'schild', index: 0 };
  // Dann der erste Meister — der Versand zuerst, ohne ihn kommt offline nichts an.
  if (meisterLeistbar(stand, { art: 'versand' })) return { wo: 'meister', art: 'versand' };
  if (meisterLeistbar(stand, { art: 'paternoster' })) return { wo: 'meister', art: 'paternoster' };
  if (meisterLeistbar(stand, { art: 'presse', index: 0 })) return { wo: 'meister', art: 'presse' };
  return null;
}
