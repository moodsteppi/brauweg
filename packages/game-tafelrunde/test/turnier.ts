/**
 * Das Monokultur-Turnier: jede Einheit gegen jede ihrer Kostenstufe, drei
 * Kopien je Seite.
 *
 * ANLASS: Am 05.09.2026 ist mit einem WEGWERF-Turnier gemessen worden, dass
 * Moosheiler, Runenpriester und Lichtwahrerin null ihrer Kaempfe gewinnen —
 * in jeder Kostenstufe die letzte Zeile (docs/spiele/auto-battler-konzept.md,
 * fuenfte Messung, Punkt 5). Der Befund hat die Beistand-Wirkung ausgeloest,
 * und beim naechsten Eingriff an einer Rolle wird er wieder gebraucht. Ein
 * Werkzeug, das man wegwirft, muss beim naechsten Mal neu gebaut werden — und
 * dann misst es etwas anderes, ohne dass es jemandem auffaellt.
 *
 * WAS ES MISST UND WAS NICHT. Es misst die EINHEIT im Kampf, nicht im Spiel:
 * kein Laden, kein Gold, kein Verschmelzen, kein Bot. Genau darin liegt sein
 * Wert neben messen.ts — dort haengt jede Zahl daran, ob der Bot die Einheit
 * ueberhaupt kauft, und eine Einheit, die niemand kauft, hat keine Siegquote.
 * Der Moosheiler stand in der fuenften Messung bei 74 Antritten und war damit
 * "zu duenn"; hier tritt er garantiert gleich oft an wie jeder andere.
 *
 * Umgekehrt sagt das Turnier NICHTS ueber Ausgewogenheit im Spiel: Drei
 * Kopien derselben Einheit sind kein Brett, das jemand bauen wuerde, und die
 * Marken stehen hier immer auf ihrer eigenen Schwelle. Wer das eine mit dem
 * anderen begruendet, begruendet nichts. Beide Zahlen gehoeren nebeneinander,
 * so wie es in der Doku steht.
 *
 * DETERMINISMUS: keine Uhr, kein `Math.random`, kein Zustand zwischen zwei
 * Kaempfen. Die Saat jedes Kampfes entsteht aus Saatbasis, Paarung und
 * laufender Nummer; derselbe Aufruf liefert dieselbe Tabelle (game-api,
 * Grundsatz 1).
 */

import {
  BRETT_FELDER,
  BRETT_REIHEN,
  BRETT_SPALTEN,
  type Brettseite,
  type EinheitId,
  KOSTENSTUFEN,
  type Kampfregler,
  type Kosten,
  type Rolle,
  STANDARD_REGLER,
  type Stufe,
  einheit,
  einheitenMitKosten,
  platzNummer,
  simuliereKampf,
} from '../src/index.js';

// ---------------------------------------------------------------------------
// Die Aufstellung
// ---------------------------------------------------------------------------

/**
 * Wie viele Kopien je Seite antreten, wenn niemand etwas anderes sagt.
 *
 * Drei, weil das die Zahl aus der Messung vom 05.09.2026 ist und weil sie zur
 * Sache passt: Ein Beistand heilt Verbuendete, mit EINER Einheit je Seite
 * gaebe es keine. Bei drei stehen zwei Gefaehrten zur Verfuegung — die
 * kleinste Zahl, bei der eine Rolle, die auf andere wirkt, ueberhaupt wirken
 * kann.
 *
 * EINSTELLBAR IST SIE TROTZDEM (`kopien`), und zwar aus einem Grund, der
 * genau den Beistand betrifft: Der Wert einer Rolle, die auf ANDERE wirkt,
 * haengt daran, wie viele andere da sind. Wer den Heilfaktor an drei Plaetzen
 * einstellt und das Spiel dann mit neun spielt, hat die falsche Zahl gemessen.
 */
export const KOPIEN = 3;

/**
 * Wie viele Einheiten hoechstens in eine Brettreihe passen.
 *
 * Der Deckel steht hier und nicht beim Aufrufer, weil eine vierte Kopie in
 * einer fuenf Felder breiten Reihe noch geht und eine sechste nicht mehr —
 * dann schriebe `stelleAuf` ueber den Rand der Reihe hinaus und legte
 * Einheiten auf die Felder der Nachbarreihe.
 */
export const KOPIEN_HOECHSTZAHL = BRETT_SPALTEN;

/**
 * Wo die Kopien stehen: Reichweite 1 nach vorn, alles andere nach hinten.
 *
 * Das ist die Regel, nach der auch der Bot stellt (`platzStrafe` in bot.ts:
 * Wache und Meuchler in die vorderste Reihe, Schuetze, Magier und Beistand in
 * die hinterste). Sie wird hier NICHT aus bot.ts geholt, sondern nachgebildet
 * — mit Absicht: Das Turnier soll den KATALOG messen und nicht den Bot, sonst
 * verschoebe jede Aenderung an der Bot-Stellung die Tabelle, ohne dass sich
 * an einer Einheit etwas geaendert haette. Gemessen wird nach `reichweite`
 * und nicht nach `rolle`, weil die Stellung eine Frage des Abstands ist.
 *
 * Zentriert, weil ein Sechseckfeld in der Mitte sechs Nachbarn hat und am
 * Rand vier: Am Rand haette eine Rolle, die auf Nachbarn wirkt, weniger
 * Reichweite, und das waere ein Ergebnis der Aufstellung und keines der
 * Einheit.
 */
function stelleAuf(einheiten: readonly EinheitId[], stufe: Stufe): Brettseite {
  const brett: ({ id: EinheitId; stufe: Stufe } | null)[] = new Array(BRETT_FELDER).fill(null);
  const reiheVon = (id: EinheitId) => (einheit(id).reichweite === 1 ? 0 : BRETT_REIHEN - 1);
  for (const reihe of new Set(einheiten.map(reiheVon))) {
    const dieseReihe = einheiten.filter((id) => reiheVon(id) === reihe);
    if (dieseReihe.length > KOPIEN_HOECHSTZAHL) {
      throw new Error(`${dieseReihe.length} Einheiten passen nicht in eine Brettreihe`);
    }
    // Mittig: bei fuenf Spalten und drei Kopien sind das die Spalten 1, 2, 3.
    const erste = Math.floor((BRETT_SPALTEN - dieseReihe.length) / 2);
    dieseReihe.forEach((id, i) => {
      brett[platzNummer(reihe, erste + i)] = { id, stufe };
    });
  }
  return brett;
}

/** So viele Kopien derselben Einheit — die Monokultur. */
function monokultur(id: EinheitId, stufe: Stufe, kopien: number): Brettseite {
  return stelleAuf(new Array(kopien).fill(id), stufe);
}

// ---------------------------------------------------------------------------
// Was herauskommt
// ---------------------------------------------------------------------------

/** Eine Zeile der Tabelle: eine Einheit ueber alle ihre Kaempfe. */
export interface Turnierzeile {
  readonly id: EinheitId;
  readonly name: string;
  readonly kosten: Kosten;
  readonly rolle: Rolle;
  readonly kaempfe: number;
  readonly siege: number;
  /** Kaempfe ohne Sieger. Zaehlen weder als Sieg noch als Niederlage. */
  readonly unentschieden: number;
  /** Kaempfe, die an der Hoechstdauer abgeschnitten wurden. */
  readonly anDerUhr: number;
  /** Anteil der Siege an allen Kaempfen. `null`, wenn keiner stattfand. */
  readonly quote: number | null;
}

/** Eine Kostenstufe mit ihren Zeilen, absteigend nach Quote. */
export interface Turnierstufe {
  readonly kosten: Kosten;
  readonly kaempfe: number;
  readonly zeilen: readonly Turnierzeile[];
  /** Mittlere Kampfdauer in Millisekunden — die Zahl, die ein Heil-Eingriff bewegt. */
  readonly dauerSchnittMs: number;
  readonly anDerUhrAnteil: number;
}

export interface Turnierbefund {
  readonly stufen: readonly Turnierstufe[];
  readonly kaempfe: number;
}

export interface Turnieroptionen {
  /** Wie viele Saaten je Paarung. Jede Saat wuerfelt den Erstzieher neu. */
  readonly saaten?: number;
  /** Einheiten je Seite, siehe `KOPIEN`. Hoechstens `KOPIEN_HOECHSTZAHL`. */
  readonly kopien?: number;
  readonly saatBasis?: string;
  readonly stufe?: Stufe;
  readonly regler?: Kampfregler;
}

// ---------------------------------------------------------------------------
// Der Lauf
// ---------------------------------------------------------------------------

interface Konto {
  kaempfe: number;
  siege: number;
  unentschieden: number;
  anDerUhr: number;
}

/**
 * Rechnet das Turnier einer Kostenstufe durch.
 *
 * GEORDNETE Paarungen: Jede Einheit tritt gegen jede andere einmal auf Seite 0
 * und einmal auf Seite 1 an. Der Kampf ist zwar bei getauschten Aufstellungen
 * spiegelsymmetrisch (arena.ts) — aber nur, solange niemand laeuft, und
 * gelaufen wird seit der Arenaluecke immer (Board-Karte 461be03d). Wer nur
 * ungeordnete Paare rechnet, bekommt die halbe Wahrheit und merkt es nicht.
 */
function turnierStufe(kosten: Kosten, o: Required<Turnieroptionen>): Turnierstufe {
  const einheiten = einheitenMitKosten(kosten);
  const konten = new Map<EinheitId, Konto>(
    einheiten.map((e) => [e.id, { kaempfe: 0, siege: 0, unentschieden: 0, anDerUhr: 0 }]),
  );
  let dauerSumme = 0;
  let kaempfe = 0;
  let anDerUhr = 0;

  for (const a of einheiten) {
    for (const b of einheiten) {
      if (a.id === b.id) continue;
      for (let n = 0; n < o.saaten; n++) {
        const bericht = simuliereKampf(
          [monokultur(a.id, o.stufe, o.kopien), monokultur(b.id, o.stufe, o.kopien)],
          `${o.saatBasis}:${kosten}:${a.id}:${b.id}:${n}`,
          o.regler,
        );
        const kontoA = konten.get(a.id)!;
        const kontoB = konten.get(b.id)!;
        kontoA.kaempfe += 1;
        kontoB.kaempfe += 1;
        if (bericht.sieger === 0) kontoA.siege += 1;
        else if (bericht.sieger === 1) kontoB.siege += 1;
        else {
          kontoA.unentschieden += 1;
          kontoB.unentschieden += 1;
        }
        if (bericht.grund === 'zeit') {
          kontoA.anDerUhr += 1;
          kontoB.anDerUhr += 1;
          anDerUhr += 1;
        }
        dauerSumme += bericht.dauerMs;
        kaempfe += 1;
      }
    }
  }

  const zeilen = einheiten
    .map((e) => {
      const k = konten.get(e.id)!;
      return {
        id: e.id,
        name: e.name,
        kosten: e.kosten,
        rolle: e.rolle,
        kaempfe: k.kaempfe,
        siege: k.siege,
        unentschieden: k.unentschieden,
        anDerUhr: k.anDerUhr,
        quote: k.kaempfe === 0 ? null : k.siege / k.kaempfe,
      };
    })
    // Absteigend nach Quote, bei Gleichstand nach Katalogreihenfolge: Die
    // Frage, um die es geht, ist immer die nach der LETZTEN Zeile.
    .sort((x, y) => (y.quote ?? -1) - (x.quote ?? -1));

  return {
    kosten,
    kaempfe,
    zeilen,
    dauerSchnittMs: kaempfe === 0 ? 0 : Math.round(dauerSumme / kaempfe),
    anDerUhrAnteil: kaempfe === 0 ? 0 : anDerUhr / kaempfe,
  };
}

/** Die Vorgaben an einer Stelle, damit beide Messungen dieselben benutzen. */
function vollstaendig(optionen: Turnieroptionen): Required<Turnieroptionen> {
  const kopien = optionen.kopien ?? KOPIEN;
  if (!Number.isInteger(kopien) || kopien < 2 || kopien > KOPIEN_HOECHSTZAHL) {
    throw new Error(`kopien muss zwischen 2 und ${KOPIEN_HOECHSTZAHL} liegen, nicht ${kopien}`);
  }
  return {
    saaten: optionen.saaten ?? 3,
    kopien,
    saatBasis: optionen.saatBasis ?? 'turnier-v1',
    stufe: optionen.stufe ?? 1,
    regler: optionen.regler ?? STANDARD_REGLER,
  };
}

/** Das ganze Turnier ueber alle Kostenstufen. */
export function turnier(optionen: Turnieroptionen = {}): Turnierbefund {
  const voll = vollstaendig(optionen);
  const stufen = KOSTENSTUFEN.map((kosten) => turnierStufe(kosten, voll));
  return { stufen, kaempfe: stufen.reduce((s, z) => s + z.kaempfe, 0) };
}

// ---------------------------------------------------------------------------
// Die Beistandsprobe
// ---------------------------------------------------------------------------

/**
 * Ist ein Brettplatz fuer einen Beistand gut angelegt?
 *
 * WARUM ES DAS MONOKULTUR-TURNIER NICHT BEANTWORTET, und das ist der Grund,
 * aus dem diese zweite Messung ueberhaupt existiert: Drei Beistaende
 * gegeneinander sind drei Einheiten, die kaum Schaden machen und sich
 * gegenseitig auffuellen. So ein Kampf kann gar nicht anders enden als an der
 * Uhr — gemessen sind bei Heilfaktor 1,5 ALLE Siege des Moosheilers
 * Zeitentscheidungen. Die Zahl steigt mit dem Faktor und sagt trotzdem nichts
 * darueber, ob die Rolle im Spiel etwas wert ist: Ein Beistand ohne jemanden,
 * dem er beisteht, ist ein Widerspruch in sich.
 *
 * DIE FRAGE, DIE EIN SPIELER SICH STELLT, ist eine andere: Ich habe drei
 * Plaetze — lohnt es sich, einen davon fuer einen Heiler zu geben, statt einen
 * dritten Kaempfer hinzustellen? Genau das rechnet diese Probe: `kopien - 1`
 * Kopien einer Einheit PLUS ein Beistand derselben Kostenstufe gegen `kopien`
 * Kopien derselben Einheit. Ueber 50 % heisst: Der Platz ist gut angelegt.
 * Deutlich darueber heisst: Er ist zu gut angelegt, und dann steht in jedem
 * Heer ein Heiler.
 *
 * Gegen die EIGENE Einheit und nicht gegen ein gemischtes Brett, damit der
 * Vergleich nur einen Unterschied hat: den getauschten Platz. Beide Seiten
 * antreten zu lassen (`gemischtAufSeite`) faengt ausserdem den Erstzieher und
 * die Laufwege ab — der Kampf ist nur symmetrisch, solange niemand laeuft
 * (Board-Karte 461be03d).
 */
export interface Beistandszeile {
  readonly beistand: EinheitId;
  readonly name: string;
  readonly kosten: Kosten;
  /** Gegen wen der Vergleich lief — die Einheit, die den Platz haette. */
  readonly gegen: EinheitId;
  readonly gegenName: string;
  readonly kaempfe: number;
  /** Siege der Seite MIT dem Beistand. */
  readonly siege: number;
  readonly unentschieden: number;
  readonly anDerUhr: number;
  readonly quote: number | null;
}

export interface Beistandsbefund {
  readonly zeilen: readonly Beistandszeile[];
  readonly kaempfe: number;
  readonly siege: number;
  readonly anDerUhr: number;
  /** Siegquote der Seite mit dem Beistand ueber alle Vergleiche. */
  readonly quote: number | null;
}

export function beistandsprobe(optionen: Turnieroptionen = {}): Beistandsbefund {
  const o = vollstaendig(optionen);
  const zeilen: Beistandszeile[] = [];

  for (const kosten of KOSTENSTUFEN) {
    const stufe = einheitenMitKosten(kosten);
    for (const heiler of stufe.filter((e) => e.rolle === 'beistand')) {
      for (const gegen of stufe) {
        if (gegen.rolle === 'beistand') continue;
        let kaempfe = 0;
        let siege = 0;
        let unentschieden = 0;
        let anDerUhr = 0;
        // Beide Seiten: einmal steht das gemischte Brett auf Seite 0, einmal
        // auf Seite 1. Sonst haengt die Zahl am Erstzieher.
        for (const gemischtAufSeite of [0, 1] as const) {
          for (let n = 0; n < o.saaten; n++) {
            const gemischt = stelleAuf(
              [...new Array(o.kopien - 1).fill(gegen.id), heiler.id],
              o.stufe,
            );
            const rein = monokultur(gegen.id, o.stufe, o.kopien);
            const bretter: readonly [Brettseite, Brettseite] =
              gemischtAufSeite === 0 ? [gemischt, rein] : [rein, gemischt];
            const bericht = simuliereKampf(
              bretter,
              `${o.saatBasis}:beistand:${o.kopien}:${heiler.id}:${gegen.id}:${gemischtAufSeite}:${n}`,
              o.regler,
            );
            kaempfe += 1;
            if (bericht.sieger === gemischtAufSeite) siege += 1;
            else if (bericht.sieger === null) unentschieden += 1;
            if (bericht.grund === 'zeit') anDerUhr += 1;
          }
        }
        zeilen.push({
          beistand: heiler.id,
          name: heiler.name,
          kosten,
          gegen: gegen.id,
          gegenName: gegen.name,
          kaempfe,
          siege,
          unentschieden,
          anDerUhr,
          quote: kaempfe === 0 ? null : siege / kaempfe,
        });
      }
    }
  }

  const kaempfe = zeilen.reduce((s, z) => s + z.kaempfe, 0);
  const siege = zeilen.reduce((s, z) => s + z.siege, 0);
  return {
    zeilen,
    kaempfe,
    siege,
    anDerUhr: zeilen.reduce((s, z) => s + z.anDerUhr, 0),
    quote: kaempfe === 0 ? null : siege / kaempfe,
  };
}

/**
 * Alle Zeilen einer Rolle ueber alle Kostenstufen — die Frage, fuer die das
 * Turnier gebaut wurde: Wie steht eine ROLLE da?
 */
export function zeilenMitRolle(befund: Turnierbefund, rolle: Rolle): readonly Turnierzeile[] {
  return befund.stufen.flatMap((s) => s.zeilen.filter((z) => z.rolle === rolle));
}

/** Wie viele Siege alle Traeger einer Rolle zusammen holten, und aus wie vielen Kaempfen. */
export function rollenbilanz(
  befund: Turnierbefund,
  rolle: Rolle,
): { readonly siege: number; readonly kaempfe: number; readonly quote: number | null } {
  const zeilen = zeilenMitRolle(befund, rolle);
  const siege = zeilen.reduce((s, z) => s + z.siege, 0);
  const kaempfe = zeilen.reduce((s, z) => s + z.kaempfe, 0);
  return { siege, kaempfe, quote: kaempfe === 0 ? null : siege / kaempfe };
}
