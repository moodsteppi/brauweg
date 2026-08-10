/**
 * Der Bot.
 *
 * Er soll wie ein solider Skatspieler wirken, der nichts verschenkt, aber
 * auch nichts riskiert: Er reizt nur mit einem tragfaehigen Blatt, spielt
 * dann ein Farbspiel (Grand und Null ueberlaesst er dem Menschen, weil beide
 * eine Einschaetzung verlangen, die er nicht sicher treffen kann), und beim
 * Stich haelt er zusammen mit dem zweiten Gegen-Spieler gegen den
 * Alleinspieler.
 *
 * Wie beim Doppelkopf gilt: Der Bot sieht ausschliesslich die gefilterte
 * Spielersicht (PlayerView), nie den vollen Rundenzustand. Damit ist
 * bauartbedingt ausgeschlossen, dass er fremde Karten kennt.
 */

import { type Card, type Suit, SUITS, augen, isJack } from './cards.js';
import { type GameType, isTrump, winningIndex } from './order.js';
import { grundwert } from './spielwert.js';
import type { PlayerView } from './round.js';
import type { PartyAction } from './party.js';

/** Laengste Trumpffarbe der Hand (Buben zaehlen fuer jede Farbe mit). */
function besteFarbe(hand: readonly Card[]): Suit {
  const jacks = hand.filter(isJack).length;
  const proFarbe: Record<Suit, number> = { C: 0, S: 0, H: 0, D: 0 };
  for (const c of hand) if (!isJack(c)) proFarbe[c.suit]++;
  let beste: Suit = 'C';
  let laenge = -1;
  // Gleichstand entscheidet der hoehere Grundwert (Kreuz vor Karo).
  for (const s of SUITS) {
    const len = jacks + proFarbe[s];
    if (len > laenge) {
      laenge = len;
      beste = s;
    }
  }
  return beste;
}

function farbGameType(hand: readonly Card[]): GameType {
  return { kind: 'suit', trump: besteFarbe(hand) };
}

/**
 * Hoechster Reizwert, den der Bot mit dieser Hand zu vertreten bereit ist.
 * Grob: Grundwert der besten Farbe mal geschaetzte Spielstufe. Unter fuenf
 * Truempfen reizt er gar nicht — ein zu kurzes Blatt verliert zu oft.
 */
function reizObergrenze(hand: readonly Card[]): number {
  const jacks = hand.filter(isJack).length;
  const trumpf = besteFarbe(hand);
  const laenge = jacks + hand.filter((c) => !isJack(c) && c.suit === trumpf).length;
  if (laenge < 5) return 0;

  const base = grundwert({ kind: 'suit', trump: trumpf });
  // Spitzen aus der Hand schaetzen (der Skat ist noch unbekannt): fuehrende
  // Serie der Buben, die man hat bzw. nicht hat.
  const hatKreuzBube = hand.some((c) => c.suit === 'C' && isJack(c));
  let sp = 0;
  for (const s of SUITS) {
    const hat = hand.some((c) => c.suit === s && isJack(c));
    if (hat === hatKreuzBube) sp++;
    else break;
  }
  return base * (sp + 1);
}

/** Kartenwahl beim Stich. */
function chooseCard(view: PlayerView): Card {
  const legal = view.legal;
  if (legal.length === 1) return legal[0]!;
  const gt = view.gameType!;
  const trickKarten = view.trick.map((p) => p.card);

  if (trickKarten.length === 0) {
    // Ausspielen: niedrigste Augen, und Trumpf schonen (Fehl vor Trumpf).
    return [...legal].sort((a, b) => {
      const t = Number(isTrump(a, gt)) - Number(isTrump(b, gt));
      if (t !== 0) return t;
      return augen(a) - augen(b);
    })[0]!;
  }

  const bestIdx = winningIndex(trickKarten, gt);
  const gewinnerSitz = view.trick[bestIdx]!.seat;
  const declarer = view.declarer;
  const binGegner = declarer !== null && view.seat !== declarer;
  const partnerFuehrt =
    binGegner && gewinnerSitz !== declarer && gewinnerSitz !== view.seat;
  const letzter = view.trick.length === 2; // zu dritt: der Dritte ist der Letzte

  // Der Mit-Gegner haelt den Stich und keiner kommt mehr: Augen drauflegen.
  if (partnerFuehrt && letzter) {
    return [...legal].sort((a, b) => augen(b) - augen(a))[0]!;
  }

  const gewinnende = legal.filter(
    (c) => winningIndex([...trickKarten, c], gt) === trickKarten.length,
  );
  if (gewinnende.length > 0 && !partnerFuehrt) {
    // Knapp stechen: wenigste Augen hergeben, Trumpf zuletzt.
    return [...gewinnende].sort((a, b) => {
      const v = augen(a) - augen(b);
      if (v !== 0) return v;
      return Number(isTrump(a, gt)) - Number(isTrump(b, gt));
    })[0]!;
  }

  // Nicht gewinnbar oder Partner fuehrt (aber noch wer dahinter): billig abwerfen.
  return [...legal].sort((a, b) => augen(a) - augen(b))[0]!;
}

/**
 * Naechste Aktion des Bots, oder null, wenn er gerade nicht handeln muss.
 */
export function botAction(view: PlayerView): PartyAction | null {
  // Zwischenpause: nicht gruebeln, "Weiter" tippen.
  if (view.phase === 'vorbei' && view.result !== null) {
    return { type: 'weiter' };
  }
  if (!view.isMyTurn) return null;

  switch (view.phase) {
    case 'reizen': {
      const grenze = reizObergrenze(view.hand);
      if (view.reiz.rolle === 'vh') {
        // Vorhand darf zu 18 annehmen. Bei einer brauchbaren Hand nimmt der Bot
        // an; bei einer schwachen laesst er den Ramsch laufen — sofern der Tisch
        // ihn spielt. Ist Ramsch aus, nimmt er trotzdem an, sonst wuerde ewig neu
        // gegeben (an einem reinen Bottisch dreht das sonst endlos).
        return grenze >= 18 || !view.ramschAn
          ? { type: 'reizWeiter' }
          : { type: 'reizWeg' };
      }
      if (view.reiz.rolle === 'sager') {
        const gebot = view.reiz.gebot;
        return gebot !== null && gebot <= grenze
          ? { type: 'reizWeiter' }
          : { type: 'reizWeg' };
      }
      // Hoerer: den aktuellen Wert halten, solange er tragbar ist.
      return view.reiz.wert <= grenze ? { type: 'reizWeiter' } : { type: 'reizWeg' };
    }

    case 'schieben': {
      // Schieberamsch: aufnehmen und die zwei augenreichsten Karten
      // weiterschieben. Blind schieben verdoppelt den Ramsch — das ist eine
      // Wette, die der Bot nicht eingeht.
      if (!view.schiebenAufgenommen) return { type: 'schiebenNehmen' };
      const weg = [...view.hand].sort((a, b) => augen(b) - augen(a)).slice(0, 2);
      return { type: 'schieben', cards: weg.map((c) => c.id) };
    }

    case 'skat':
      // Immer aufnehmen: mehr Information, und der Bot sagt ohnehin kein
      // Handspiel an (das waere eine Einschaetzung, die er sich nicht zutraut).
      return { type: 'skatNehmen' };

    case 'druecken': {
      const gt = farbGameType(view.hand);
      // Die beiden augenaermsten Nicht-Truempfe druecken; Truempfe bleiben.
      const weg = [...view.hand]
        .filter((c) => !isTrump(c, gt))
        .sort((a, b) => augen(a) - augen(b))
        .slice(0, 2);
      // Sicherheitsnetz, falls einmal fast alles Trumpf ist.
      while (weg.length < 2) {
        const naechste = view.hand.find((c) => !weg.includes(c));
        if (!naechste) break;
        weg.push(naechste);
      }
      return { type: 'druecken', cards: weg.map((c) => c.id) };
    }

    case 'ansage':
      // Farbspiel, nie Grand oder Saechsische Spitze — beide verlangen eine
      // Einschaetzung, die der Bot nicht sicher treffen kann. Patrouillen sagt
      // er dagegen an: Was er hat, zeigt er, und beide Buben einer Couleur
      // sprechen ohnehin fuer ein tragfaehiges Blatt.
      return {
        type: 'ansage',
        spiel: besteFarbe(view.hand),
        patrouillen: view.meinePatrouillen,
      };

    case 'stich':
      // Kontra, Re und Hirsch sagt der Bot nie: jede Stufe verdoppelt den
      // Einsatz und ist eine Einschaetzung, die er nicht treffen kann.
      return { type: 'karte', cardId: chooseCard(view).id };

    default:
      return null;
  }
}
