import { FORMEN, REGELN } from '@brauweg/building-kern';
import type { BauPrivat } from '@brauweg/broremote-kern';
import type { BahnSicht, BauSicht } from './partie';

/** Ein Vertrag für Solo und Handy: insbesondere dieselbe echte nächste Form. */
export function bauPrivat(s: BauSicht, b: BahnSicht, pause = false): BauPrivat {
  return {
    form: FORMEN.indexOf(b.naechster), hoehe: Math.round(b.hoehe * 10) / 10, restzeit: s.restzeit,
    phase: s.phase === 'ende' ? 'ende' : pause ? 'pause' : s.phase, countdown: s.countdown,
    platz: b.platz, fertig: b.fertig, gewonnen: s.gewinner.includes(b.id), verbraucht: b.verbraucht,
    spielerzahl: s.bahnen.length, ziele: b.ziele, zielCountdown: b.halten > 0 ? Math.max(1, Math.ceil(REGELN.halten - b.halten)) : 0,
    item: b.item, itemIn: b.itemIn, itemBereit: b.itemBereit, platzierung: b.platzierung,
    anker: b.anker, schwereWartet: b.schwereWartet, eisWartet: b.eisWartet, steinWartet: b.steinWartet,
    gebaut: b.gebaut, verloren: b.verloren, aufgegeben: b.aufgegeben, dauer: s.dauer,
  };
}
