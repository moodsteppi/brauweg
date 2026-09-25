/**
 * Der Schachkern: Stellung, Zuggenerierung, Schach, Ausfuehren eines Zuges.
 *
 * Reine Funktionen auf einer JSON-tauglichen Stellung — kein Zustand, keine
 * Klasse. Die Partie (wer sitzt wo, Wiederholungen, Ende) steht in partie.ts;
 * hier steht nur, was ein Brett ueber sich selbst weiss.
 *
 * Felder sind Zahlen von 0 (a1) bis 63 (h8): `reihe * 8 + linie`. Nach aussen
 * (Aktion, Sicht) gehen sie als Namen wie "e4", damit eine Aktion im
 * Protokoll lesbar bleibt.
 *
 * Figuren schreiben sich wie in der FEN: Grossbuchstaben Weiss, Kleinbuchstaben
 * Schwarz, ein leeres Feld ist ''. FEN ist hier nicht Zierde, sondern das
 * Eingabeformat der Tests — und die Sicht, aus der der Ersatzbot rechnet.
 */

export type Farbe = 'w' | 'b';

/** Worin sich ein Bauer auf der letzten Reihe verwandeln darf. */
export type Umwandlung = 'q' | 'r' | 'b' | 'n';

/**
 * Reihenfolge der Umwandlungen in der Zugliste. Die Dame zuerst, weil der
 * Ersatzbot den ersten legalen Zug nimmt — und eine Unterverwandlung als
 * Voreinstellung waere ein Geschenk an den Gegner.
 */
export const UMWANDLUNGEN: readonly Umwandlung[] = ['q', 'r', 'b', 'n'];

export interface Stellung {
  /** 64 Felder, a1 zuerst. '' ist leer. */
  readonly brett: readonly string[];
  readonly amZug: Farbe;
  /** Teilmenge von "KQkq" in dieser Reihenfolge, '' wenn keine Rochade mehr geht. */
  readonly rochade: string;
  /** Feld, auf das ein Bauer en passant schlagen koennte, sonst null. */
  readonly epFeld: number | null;
  /** Halbzuege seit dem letzten Bauernzug oder Schlag (50-Zuege-Regel). */
  readonly halbzugUhr: number;
  /** Zugnummer wie in der FEN: beginnt bei 1, steigt nach jedem Zug von Schwarz. */
  readonly zugNummer: number;
}

export interface Zug {
  readonly von: number;
  readonly nach: number;
  readonly umwandlung?: Umwandlung;
}

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// ---------------------------------------------------------------------------
// Felder
// ---------------------------------------------------------------------------

const LINIEN = 'abcdefgh';

export const linieVon = (feld: number): number => feld % 8;
export const reiheVon = (feld: number): number => Math.floor(feld / 8);

/** Feld zu Linie und Reihe, oder -1 ausserhalb des Bretts. */
function feldBei(linie: number, reihe: number): number {
  if (linie < 0 || linie > 7 || reihe < 0 || reihe > 7) return -1;
  return reihe * 8 + linie;
}

export function feldName(feld: number): string {
  return `${LINIEN[linieVon(feld)]}${reiheVon(feld) + 1}`;
}

/** "e4" zu 28, oder -1 fuer alles, was kein Feld ist. */
export function feldIndex(name: string): number {
  if (typeof name !== 'string' || name.length !== 2) return -1;
  const linie = LINIEN.indexOf(name[0]!);
  const reihe = Number(name[1]) - 1;
  if (linie < 0 || !Number.isInteger(reihe)) return -1;
  return feldBei(linie, reihe);
}

export function farbeVon(figur: string): Farbe {
  return figur === figur.toUpperCase() ? 'w' : 'b';
}

const gegner = (farbe: Farbe): Farbe => (farbe === 'w' ? 'b' : 'w');

/** Figurbuchstabe in der Schreibweise der Farbe: ('q', 'w') -> 'Q'. */
const alsFarbe = (art: string, farbe: Farbe): string =>
  farbe === 'w' ? art.toUpperCase() : art.toLowerCase();

// ---------------------------------------------------------------------------
// FEN
// ---------------------------------------------------------------------------

export function ausFen(fen: string): Stellung {
  const teile = fen.trim().split(/\s+/);
  if (teile.length !== 6) throw new Error(`FEN braucht sechs Teile: ${fen}`);
  const [figuren, amZug, rochade, ep, uhr, nummer] = teile as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];

  const reihen = figuren.split('/');
  if (reihen.length !== 8) throw new Error(`FEN braucht acht Reihen: ${fen}`);
  const brett: string[] = Array.from({ length: 64 }, () => '');
  reihen.forEach((zeile, i) => {
    const reihe = 7 - i;
    let linie = 0;
    for (const zeichen of zeile) {
      if (/[1-8]/.test(zeichen)) {
        linie += Number(zeichen);
      } else if (/[pnbrqkPNBRQK]/.test(zeichen)) {
        if (linie > 7) throw new Error(`FEN-Reihe zu lang: ${zeile}`);
        brett[reihe * 8 + linie] = zeichen;
        linie += 1;
      } else {
        throw new Error(`Unbekanntes Zeichen in der FEN: ${zeichen}`);
      }
    }
    if (linie !== 8) throw new Error(`FEN-Reihe hat nicht acht Felder: ${zeile}`);
  });

  if (amZug !== 'w' && amZug !== 'b') throw new Error(`Wer am Zug ist, fehlt: ${fen}`);
  if (!/^(-|K?Q?k?q?)$/.test(rochade)) throw new Error(`Rochaderechte unlesbar: ${rochade}`);
  const epFeld = ep === '-' ? null : feldIndex(ep);
  if (epFeld === -1) throw new Error(`En-passant-Feld unlesbar: ${ep}`);

  return {
    brett,
    amZug,
    rochade: rochade === '-' ? '' : rochade,
    epFeld,
    halbzugUhr: Number(uhr),
    zugNummer: Number(nummer),
  };
}

export function zuFen(stellung: Stellung): string {
  const reihen: string[] = [];
  for (let reihe = 7; reihe >= 0; reihe -= 1) {
    let zeile = '';
    let leer = 0;
    for (let linie = 0; linie < 8; linie += 1) {
      const figur = stellung.brett[reihe * 8 + linie]!;
      if (figur === '') {
        leer += 1;
        continue;
      }
      if (leer > 0) zeile += String(leer);
      leer = 0;
      zeile += figur;
    }
    if (leer > 0) zeile += String(leer);
    reihen.push(zeile);
  }
  return [
    reihen.join('/'),
    stellung.amZug,
    stellung.rochade || '-',
    stellung.epFeld === null ? '-' : feldName(stellung.epFeld),
    String(stellung.halbzugUhr),
    String(stellung.zugNummer),
  ].join(' ');
}

// ---------------------------------------------------------------------------
// Angriff und Schach
// ---------------------------------------------------------------------------

const SPRINGER: readonly (readonly [number, number])[] = [
  [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];
const KOENIG: readonly (readonly [number, number])[] = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];
const GERADE: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const SCHRAEG: readonly (readonly [number, number])[] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

/** Greift `von` das Feld an? Unabhaengig davon, wer am Zug ist. */
export function angegriffen(brett: readonly string[], feld: number, von: Farbe): boolean {
  const l = linieVon(feld);
  const r = reiheVon(feld);

  // Ein weisser Bauer greift schraeg nach oben an, steht also eine Reihe tiefer.
  const bauernReihe = von === 'w' ? r - 1 : r + 1;
  for (const dl of [-1, 1]) {
    const f = feldBei(l + dl, bauernReihe);
    if (f >= 0 && brett[f] === alsFarbe('p', von)) return true;
  }
  for (const [dl, dr] of SPRINGER) {
    const f = feldBei(l + dl, r + dr);
    if (f >= 0 && brett[f] === alsFarbe('n', von)) return true;
  }
  for (const [dl, dr] of KOENIG) {
    const f = feldBei(l + dl, r + dr);
    if (f >= 0 && brett[f] === alsFarbe('k', von)) return true;
  }
  const strahl = (richtungen: typeof GERADE, arten: readonly string[]): boolean => {
    for (const [dl, dr] of richtungen) {
      let f = feldBei(l + dl, r + dr);
      let schritt = 1;
      while (f >= 0) {
        const figur = brett[f]!;
        if (figur !== '') {
          if (farbeVon(figur) === von && arten.includes(figur.toLowerCase())) return true;
          break;
        }
        schritt += 1;
        f = feldBei(l + dl * schritt, r + dr * schritt);
      }
    }
    return false;
  };
  return strahl(GERADE, ['r', 'q']) || strahl(SCHRAEG, ['b', 'q']);
}

function koenigsFeld(brett: readonly string[], farbe: Farbe): number {
  return brett.indexOf(alsFarbe('k', farbe));
}

/** Steht der König dieser Farbe im Schach? Ohne König (Teststellung) nie. */
export function imSchach(stellung: Stellung, farbe: Farbe = stellung.amZug): boolean {
  const koenig = koenigsFeld(stellung.brett, farbe);
  return koenig >= 0 && angegriffen(stellung.brett, koenig, gegner(farbe));
}

// ---------------------------------------------------------------------------
// Zuege
// ---------------------------------------------------------------------------

/**
 * Rochade je Recht: Königsfeld, Königsziel, Turmfeld, Felder, die leer sein
 * muessen, und Felder, die nicht angegriffen sein duerfen (Start, Durchgang,
 * Ziel — der König darf weder aus dem Schach heraus noch durch eines hindurch
 * rochieren).
 */
const ROCHADEN: Readonly<
  Record<'K' | 'Q' | 'k' | 'q', { koenig: number; ziel: number; turm: number; leer: number[]; sicher: number[] }>
> = {
  K: { koenig: 4, ziel: 6, turm: 7, leer: [5, 6], sicher: [4, 5, 6] },
  Q: { koenig: 4, ziel: 2, turm: 0, leer: [1, 2, 3], sicher: [4, 3, 2] },
  k: { koenig: 60, ziel: 62, turm: 63, leer: [61, 62], sicher: [60, 61, 62] },
  q: { koenig: 60, ziel: 58, turm: 56, leer: [57, 58, 59], sicher: [60, 59, 58] },
};

/** Alle Zuege nach Gangart, ohne Ruecksicht auf den eigenen König. */
function pseudoZuege(stellung: Stellung): Zug[] {
  const { brett, amZug } = stellung;
  const zuege: Zug[] = [];
  const feind = (f: number): boolean => brett[f] !== '' && farbeVon(brett[f]!) !== amZug;

  for (let von = 0; von < 64; von += 1) {
    const figur = brett[von]!;
    if (figur === '' || farbeVon(figur) !== amZug) continue;
    const l = linieVon(von);
    const r = reiheVon(von);
    const art = figur.toLowerCase();

    if (art === 'p') {
      const vor = amZug === 'w' ? 1 : -1;
      const startReihe = amZug === 'w' ? 1 : 6;
      const letzteReihe = amZug === 'w' ? 7 : 0;
      const bauernZug = (nach: number): void => {
        if (reiheVon(nach) === letzteReihe) {
          for (const umwandlung of UMWANDLUNGEN) zuege.push({ von, nach, umwandlung });
        } else {
          zuege.push({ von, nach });
        }
      };
      const eins = feldBei(l, r + vor);
      if (eins >= 0 && brett[eins] === '') {
        bauernZug(eins);
        const zwei = feldBei(l, r + 2 * vor);
        if (r === startReihe && brett[zwei] === '') zuege.push({ von, nach: zwei });
      }
      for (const dl of [-1, 1]) {
        const nach = feldBei(l + dl, r + vor);
        if (nach < 0) continue;
        if (feind(nach)) bauernZug(nach);
        else if (nach === stellung.epFeld && brett[nach] === '') zuege.push({ von, nach });
      }
      continue;
    }

    const schritte = (richtungen: typeof SPRINGER, weit: boolean): void => {
      for (const [dl, dr] of richtungen) {
        let schritt = 1;
        let nach = feldBei(l + dl, r + dr);
        while (nach >= 0) {
          if (brett[nach] === '') {
            zuege.push({ von, nach });
          } else {
            if (feind(nach)) zuege.push({ von, nach });
            break;
          }
          if (!weit) break;
          schritt += 1;
          nach = feldBei(l + dl * schritt, r + dr * schritt);
        }
      }
    };
    if (art === 'n') schritte(SPRINGER, false);
    else if (art === 'b') schritte(SCHRAEG, true);
    else if (art === 'r') schritte(GERADE, true);
    else if (art === 'q') schritte([...GERADE, ...SCHRAEG], true);
    else if (art === 'k') schritte(KOENIG, false);
  }

  for (const recht of ['K', 'Q', 'k', 'q'] as const) {
    if (!stellung.rochade.includes(recht) || farbeVon(recht) !== amZug) continue;
    const r = ROCHADEN[recht];
    // Das Recht allein genuegt nicht: In einer frei gesetzten Stellung kann
    // es stehen, obwohl König oder Turm fehlen.
    if (brett[r.koenig] !== alsFarbe('k', amZug) || brett[r.turm] !== alsFarbe('r', amZug)) continue;
    if (r.leer.some((f) => brett[f] !== '')) continue;
    if (r.sicher.some((f) => angegriffen(brett, f, gegner(amZug)))) continue;
    zuege.push({ von: r.koenig, nach: r.ziel });
  }

  return zuege;
}

/**
 * Fuehrt einen Zug aus, OHNE ihn zu pruefen. Nur fuer Zuege aus
 * `legaleZuege` — die Pruefung gegen Aktionen von aussen steht in partie.ts.
 */
export function wendeAn(stellung: Stellung, zug: Zug): Stellung {
  const brett = [...stellung.brett];
  const figur = brett[zug.von]!;
  const art = figur.toLowerCase();
  const farbe = stellung.amZug;
  let geschlagen = brett[zug.nach] !== '';

  if (art === 'p' && zug.nach === stellung.epFeld && brett[zug.nach] === '') {
    // En passant: Der geschlagene Bauer steht NEBEN dem Ziel, nicht darauf.
    brett[zug.nach + (farbe === 'w' ? -8 : 8)] = '';
    geschlagen = true;
  }

  brett[zug.nach] = zug.umwandlung ? alsFarbe(zug.umwandlung, farbe) : figur;
  brett[zug.von] = '';

  if (art === 'k' && Math.abs(zug.nach - zug.von) === 2) {
    const kurz = zug.nach > zug.von;
    const turmVon = kurz ? zug.von + 3 : zug.von - 4;
    const turmNach = kurz ? zug.von + 1 : zug.von - 1;
    brett[turmNach] = brett[turmVon]!;
    brett[turmVon] = '';
  }

  // Rechte fallen weg, sobald König oder Turm ziehen — und ebenso, wenn auf
  // dem Turmfeld geschlagen wird: Ein geschlagener Turm rochiert nicht mehr.
  let rochade = stellung.rochade;
  const streiche = (rechte: string): void => {
    for (const recht of rechte) rochade = rochade.replace(recht, '');
  };
  if (art === 'k') streiche(farbe === 'w' ? 'KQ' : 'kq');
  for (const feld of [zug.von, zug.nach]) {
    if (feld === 0) streiche('Q');
    if (feld === 7) streiche('K');
    if (feld === 56) streiche('q');
    if (feld === 63) streiche('k');
  }

  const doppelschritt = art === 'p' && Math.abs(zug.nach - zug.von) === 16;

  return {
    brett,
    amZug: gegner(farbe),
    rochade,
    epFeld: doppelschritt ? (zug.von + zug.nach) / 2 : null,
    halbzugUhr: art === 'p' || geschlagen ? 0 : stellung.halbzugUhr + 1,
    zugNummer: farbe === 'b' ? stellung.zugNummer + 1 : stellung.zugNummer,
  };
}

/** Alle legalen Zuege der Seite am Zug. Ein Zug, der den eigenen König im Schach laesst, fehlt. */
export function legaleZuege(stellung: Stellung): Zug[] {
  return pseudoZuege(stellung).filter(
    (zug) => !imSchach(wendeAn(stellung, zug), stellung.amZug),
  );
}

// ---------------------------------------------------------------------------
// Remis-Merkmale
// ---------------------------------------------------------------------------

/**
 * Schluessel fuer die Stellungswiederholung.
 *
 * Gleich ist eine Stellung, wenn Figuren, Zugrecht, Rochaderechte UND die
 * Moeglichkeit zum En-passant-Schlag gleich sind (FIDE 9.2). Das
 * En-passant-Feld zaehlt deshalb nur mit, wenn der Schlag auch wirklich
 * legal ist — sonst zaehlte jeder Doppelschritt als neue Stellung, und eine
 * echte Wiederholung fiele nie auf. Uhr und Zugnummer zaehlen nicht.
 */
export function stellungsSchluessel(stellung: Stellung): string {
  const ep =
    stellung.epFeld !== null &&
    legaleZuege(stellung).some(
      (z) => z.nach === stellung.epFeld && stellung.brett[z.von]!.toLowerCase() === 'p',
    )
      ? feldName(stellung.epFeld)
      : '-';
  return zuFen({ ...stellung, epFeld: null, halbzugUhr: 0, zugNummer: 1 })
    .split(' ')
    .slice(0, 3)
    .concat(ep)
    .join(' ');
}

/**
 * Kann keine Seite mehr mattsetzen? König gegen König, König und eine
 * Leichtfigur gegen König, oder nur noch Läufer, alle auf derselben
 * Feldfarbe. Mehr gehoert hier nicht hinein: Mit zwei Springern ist ein Matt
 * zwar nicht zu erzwingen, aber moeglich — die Partie laeuft dann weiter.
 */
export function ungenuegendesMaterial(brett: readonly string[]): boolean {
  const figuren: { art: string; feld: number }[] = [];
  brett.forEach((figur, feld) => {
    if (figur !== '' && figur.toLowerCase() !== 'k') figuren.push({ art: figur.toLowerCase(), feld });
  });
  if (figuren.length === 0) return true;
  if (figuren.length === 1 && (figuren[0]!.art === 'n' || figuren[0]!.art === 'b')) return true;
  if (figuren.every((f) => f.art === 'b')) {
    const feldfarbe = (f: number): number => (linieVon(f) + reiheVon(f)) % 2;
    return figuren.every((f) => feldfarbe(f.feld) === feldfarbe(figuren[0]!.feld));
  }
  return false;
}
