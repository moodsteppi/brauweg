/**
 * Die drei Minispiele ohne Uhr: Kategorien-Battle, Mehrheitsraten, Regel-Karte.
 *
 * Seit dem 22.09.2026 (Robins Entscheidung: fuenf und mehr neue Minispiele —
 * dies sind die drei ohne Zeitdruck). Sie stehen in einer eigenen Datei, weil
 * `partie.ts` gleichzeitig von mehreren Aenderungen angefasst wird; dort
 * haengen nur die Faeden (Rundentyp, `baueRunde`, `werteAus`, `verarbeite`),
 * die Regeln selbst stehen hier.
 *
 * Die Funktionen hier WERFEN NICHT. Ein Regelverstoss kommt als Zeichenkette
 * zurueck, und `verarbeite` wirft ihn als `RegelVerstoss` — so braucht diese
 * Datei zur Laufzeit nichts aus `partie.ts`, und die beiden importieren sich
 * nicht gegenseitig. Kommt dasselbe Objekt zurueck, war die Aktion
 * wirkungslos (doppelt oder zu spaet), genau wie ueberall in `verarbeite`.
 *
 * ZWEI NEUE BAUARTEN, beide mit Absicht:
 *
 *   KATEGORIEN laeuft reihum, aber IM KREIS: Nicht jeder Sitz einmal (wie
 *   Wer bin ich, Bus, W/P), sondern so lange, bis einer stockt. Es passt
 *   deshalb nicht in `istReihum` — dort endet die Runde, sobald jeder einmal
 *   dran war — und hat in `amZug`/`weiter` einen eigenen Zweig.
 *
 *   REGEL-KARTE ist das einzige Minispiel, dessen Wirkung die Runde
 *   UEBERLEBT. Die Karte selbst ist schnell gelesen; gespielt wird sie
 *   waehrend der naechsten zwei Minispiele. Dafuer traegt die Partie ein Feld
 *   (`PartykistePartie.regelKarte`), und das ist ein Strukturbruch: Bis dahin
 *   war alles Rundenwissen in `runde` und wurde mit ihr weggeworfen. Warum es
 *   trotzdem so und nicht anders geht, steht an `AktiveRegel`.
 *
 * WER MEHRHEIT IST. Einspruch (Kategorien) und Anklage (Regel-Karte) zaehlen
 * nur die anwesenden MENSCHEN ausser dem Beschuldigten. Ein Bot hoert nicht,
 * was am Tisch gesagt wird — er kann weder stocken hoeren noch einen
 * Vornamen. Zaehlten Bots mit, braeuchte ein Mensch unter fuenf Bots eine
 * Mehrheit, die er nie bekommt.
 */

import type { PartykistePartie, RundenBasis } from './partie.js';
import {
  KATEGORIEN_RUNDEN_UM_DEN_TISCH,
  PUNKTE,
  REGEL_KARTE_DAUER,
  SCHLUECKE,
  type PartykisteAktion,
} from './regeln.js';

/** -1 heisst "noch nicht" bzw. "keiner" — derselbe Wert wie `OFFEN` in partie.ts. */
const KEINER = -1;

// ---------------------------------------------------------------------------
// Rundentypen
// ---------------------------------------------------------------------------

/**
 * Kategorien-Battle: reihum im Kreis, bis einer stockt.
 *
 * Genannt wird LAUT, der Bildschirm kennt die Antworten nicht — er nimmt nur
 * "genannt" oder "gestockt" entgegen. Wer doppelt nennt oder ewig ueberlegt
 * und trotzdem "genannt" tippt, wird von der Runde benannt (`einspruch`).
 */
export interface KategorienRunde extends RundenBasis {
  readonly art: 'kategorien';
  readonly kategorieId: string;
  readonly kategorie: string;
  readonly amZug: number;
  /** Wie oft schon genannt wurde, ueber alle Sitze. */
  readonly nennungen: number;
  /** Ab so vielen Nennungen ist die Kategorie leergespielt (Runden um den Tisch x Anwesende). */
  readonly grenze: number;
  /** Wer zuletzt "genannt" getippt hat — gegen ihn geht noch Einspruch. -1 = noch keiner. */
  readonly letzter: number;
  /** Je Sitz: gegen wen er gerade Einspruch erhebt, -1 = gegen niemanden. */
  readonly einspruch: readonly number[];
  /** Wer verloren hat, -1 solange keiner. */
  readonly verlierer: number;
  /** Wie der Verlierer feststand: selbst gemeldet, von der Mehrheit benannt, oder (null) noch gar nicht. */
  readonly wie: 'selbst' | 'mehrheit' | null;
}

/**
 * Mehrheitsraten: jeder antwortet fuer sich UND tippt die Mehrheit.
 *
 * Mit nur einer Eingabe waere es Entweder-oder unter anderem Namen: Wer die
 * Mehrheit tippt, bestimmt sie zugleich. Erst die eigene Antwort daneben
 * macht die Mehrheit zu etwas, das man RATEN muss — gewertet wird nur der
 * Tipp, die eigene Antwort ergibt die Mehrheit.
 */
export interface MehrheitRunde extends RundenBasis {
  readonly art: 'mehrheit';
  readonly frageId: string;
  readonly frage: string;
  readonly a: string;
  readonly b: string;
  /** Je Sitz die eigene Antwort: 0 A, 1 B, -1 keine. */
  readonly eigene: readonly number[];
  /** Je Sitz der Tipp auf die Mehrheit: 0 A, 1 B, -1 keiner. */
  readonly tipp: readonly number[];
  /** Erst im Ergebnis: 0 A, 1 B; -1 vorher und bei Gleichstand. */
  readonly mehrheit: number;
}

/** Regel-Karte: gezogen, gelesen, "Verstanden" getippt — gelten tut sie danach. */
export interface RegelkartenRunde extends RundenBasis {
  readonly art: 'regelkarte';
  readonly karteId: string;
  readonly text: string;
  /**
   * Bis zum Ende welcher Runde (0-basiert) die Regel gelten soll — Runde der
   * Karte plus REGEL_KARTE_DAUER. Noch nicht aufs Turnierende gekappt, weil
   * `baueRunde` die Rundenzahl nicht kennt; das macht `neueRegel`.
   */
  readonly bis: number;
}

/**
 * Die Regel, die gerade am Tisch gilt.
 *
 * DER EINZIGE ZUSTAND DER KISTE, DER EINE RUNDE UEBERLEBT. Er steht an der
 * Partie und nicht an der Runde, weil die Runde mit `naechsteRunde`
 * weggeworfen wird — und genau in den folgenden Runden wird die Regel
 * gebrochen. Die Alternativen waren schlechter:
 *
 *   - Die Regelkarten-Runde offen lassen, bis die Regel ablaeuft: Dann
 *     liefen zwei Runden gleichzeitig, und `runde` waere keine einzelne
 *     Runde mehr. Jede Stelle, die `partie.runde.art` fragt, luege.
 *   - Die Regel aus dem Protokoll rekonstruieren: Das Protokoll kennt nur
 *     Punkte und Schluecke, nicht Karte, Anklagen und offene Verstoesse.
 *
 * Abgerechnet wird trotzdem nur an EINER Stelle, in `werteAus` der jeweils
 * laufenden Runde (`regelAbrechnen`): Verstoesse seit der letzten Abrechnung
 * werden dort zu Schluecken dieser Runde. So stimmen Rundenprotokoll und
 * Turnierstand weiter ueberein, und ein Verstoss steht in der Abrechnung, die
 * alle ohnehin lesen.
 *
 * Optional an der Partie, weil Snapshots von vor dem 22.09.2026 das Feld
 * nicht haben — fehlt heisst: keine Regel.
 */
export interface AktiveRegel {
  readonly karteId: string;
  readonly text: string;
  /** Runde, in der die Karte gezogen wurde. */
  readonly ab: number;
  /** Bis zum Ende dieser Runde gilt die Regel — gekappt auf die letzte Runde des Turniers. */
  readonly bis: number;
  /** Je Sitz: Verstoesse seit die Regel gilt. */
  readonly verstoesse: readonly number[];
  /** Je Sitz: Verstoesse, die noch in keiner Abrechnung standen. */
  readonly offen: readonly number[];
  /** Je Sitz: wen er gerade anklagt, -1 = niemanden. */
  readonly anklage: readonly number[];
}

// ---------------------------------------------------------------------------
// Kleinzeug
// ---------------------------------------------------------------------------

function nullen(n: number): number[] {
  return Array.from({ length: n }, () => 0);
}

function keine(n: number): number[] {
  return Array.from({ length: n }, () => KEINER);
}

function lebende(partie: PartykistePartie): number[] {
  const raus = new Set(partie.ausgestiegen);
  const liste: number[] = [];
  for (let s = 0; s < partie.sitze; s++) if (!raus.has(s)) liste.push(s);
  return liste;
}

/** Der naechste anwesende Sitz nach `sitz`, im Kreis. Ist niemand sonst da, `sitz` selbst. */
export function naechsterImKreis(sitze: number, ausgestiegen: readonly number[], sitz: number): number {
  const raus = new Set(ausgestiegen);
  for (let i = 1; i <= sitze; i++) {
    const s = (((sitz + i) % sitze) + sitze) % sitze;
    if (!raus.has(s)) return s;
  }
  return sitz;
}

/** Wer ueber `ziel` abstimmen darf: anwesende Menschen ausser `ziel` (siehe Kopf der Datei). */
function stimmberechtigt(partie: PartykistePartie, ziel: number): number[] {
  const bots = new Set(partie.botSitze);
  return lebende(partie).filter((s) => s !== ziel && !bots.has(s));
}

/**
 * Wie viele Stimmen es braucht, um `ziel` zu benennen: mehr als die Haelfte
 * der Stimmberechtigten. 0 heisst: Es gibt niemanden, der abstimmen koennte
 * — dann geht es gar nicht (sonst genuegten null Stimmen).
 */
export function noetigGegen(partie: PartykistePartie, ziel: number): number {
  const zahl = stimmberechtigt(partie, ziel).length;
  return zahl === 0 ? 0 : Math.floor(zahl / 2) + 1;
}

/** Je Sitz: `noetigGegen` — fuer die Sicht, damit der Bildschirm "2 von 3" nicht selbst rechnet. */
export function noetigJeSitz(partie: PartykistePartie): number[] {
  return Array.from({ length: partie.sitze }, (_, s) => noetigGegen(partie, s));
}

function mehrheitGegen(partie: PartykistePartie, stimmen: readonly number[], ziel: number): boolean {
  const noetig = noetigGegen(partie, ziel);
  if (noetig === 0) return false;
  const dafuer = stimmberechtigt(partie, ziel).filter((s) => stimmen[s] === ziel).length;
  return dafuer >= noetig;
}

function gueltigerSitz(partie: PartykistePartie, ziel: unknown): ziel is number {
  return typeof ziel === 'number' && Number.isInteger(ziel) && ziel >= 0 && ziel < partie.sitze;
}

// ---------------------------------------------------------------------------
// Aufbau
// ---------------------------------------------------------------------------

/** Die Felder einer frischen Kategorien-Runde ausser Basis und Inhalt. */
export function kategorienStart(
  sitze: number,
  anwesend: readonly number[],
  start: number,
): Pick<KategorienRunde, 'amZug' | 'nennungen' | 'grenze' | 'letzter' | 'einspruch' | 'verlierer' | 'wie'> {
  return {
    amZug: start,
    nennungen: 0,
    grenze: Math.max(1, anwesend.length) * KATEGORIEN_RUNDEN_UM_DEN_TISCH,
    letzter: KEINER,
    einspruch: keine(sitze),
    verlierer: KEINER,
    wie: null,
  };
}

/** Bis zum Ende welcher Runde eine in Runde `nr` gezogene Karte gilt (vor der Kappung). */
export function regelBis(nr: number): number {
  return nr + REGEL_KARTE_DAUER;
}

// ---------------------------------------------------------------------------
// Kategorien-Battle
// ---------------------------------------------------------------------------

/**
 * Ist die Runde durch? Einer hat verloren, die Kategorie ist leergespielt,
 * oder es sitzt nur noch einer da (allein gibt es keinen Kreis).
 */
export function kategorieVorbei(partie: PartykistePartie, runde: KategorienRunde): boolean {
  return runde.verlierer >= 0 || runde.nennungen >= runde.grenze || lebende(partie).length < 2;
}

export function kategorienZug(
  partie: PartykistePartie,
  runde: KategorienRunde,
  sitz: number,
  aktion: PartykisteAktion,
): PartykistePartie | string {
  if (kategorieVorbei(partie, runde)) return partie;
  switch (aktion.art) {
    case 'genannt': {
      if (sitz !== runde.amZug) return 'ein anderer Sitz ist dran';
      const amZug = naechsterImKreis(partie.sitze, partie.ausgestiegen, sitz);
      /*
       * Einsprueche gelten nur gegen den, der dran ist, und den, der gerade
       * genannt hat. Wer vor zwei Zuegen gedoppelt hat, ist durch — sonst
       * koennte die Runde jeden Namen der letzten Minuten nachtraeglich
       * aufrollen.
       */
      const einspruch = runde.einspruch.map((z) => (z === amZug || z === sitz ? z : KEINER));
      return {
        ...partie,
        runde: { ...runde, nennungen: runde.nennungen + 1, letzter: sitz, amZug, einspruch },
      };
    }
    case 'gestockt':
      if (sitz !== runde.amZug) return 'ein anderer Sitz ist dran';
      return { ...partie, runde: { ...runde, verlierer: sitz, wie: 'selbst' } };
    case 'einspruch': {
      if (!gueltigerSitz(partie, aktion.ziel)) return 'diesen Sitz gibt es nicht';
      const ziel = aktion.ziel;
      if (ziel === sitz) return 'wer selbst stockt, tippt „Gestockt"';
      /* Gegen jemanden, der weder dran ist noch gerade genannt hat: zu spaet,
         der Zug ist weitergelaufen. Kein Fehler — am Tisch passiert das. */
      if (ziel !== runde.amZug && ziel !== runde.letzter) return partie;
      if (partie.ausgestiegen.includes(ziel)) return partie;
      if (runde.einspruch[sitz] === ziel) return partie;
      const einspruch = [...runde.einspruch];
      einspruch[sitz] = ziel;
      if (mehrheitGegen(partie, einspruch, ziel)) {
        return { ...partie, runde: { ...runde, einspruch, verlierer: ziel, wie: 'mehrheit' } };
      }
      return { ...partie, runde: { ...runde, einspruch } };
    }
    default:
      return 'jetzt wird reihum genannt';
  }
}

/**
 * Wer verloren hat, bekommt die Schluecke; alle anderen Anwesenden einen
 * Punkt. Ist die Kategorie leergespielt, gibt es fuer alle den Punkt und fuer
 * niemanden einen Schluck — der Tisch hat die Kategorie besiegt.
 */
export function werteKategorien(
  runde: KategorienRunde,
  dabei: readonly number[],
  schluck: (wert: number) => number,
  punkte: number[],
  schlucke: number[],
): void {
  for (const s of dabei) {
    if (s === runde.verlierer) schlucke[s] = schluck(SCHLUECKE.kategorienVerloren);
    else punkte[s] = PUNKTE.kategorienDurch;
  }
}

// ---------------------------------------------------------------------------
// Mehrheitsraten
// ---------------------------------------------------------------------------

export function mehrheitZug(
  partie: PartykistePartie,
  runde: MehrheitRunde,
  sitz: number,
  aktion: PartykisteAktion,
): PartykistePartie | string {
  if (aktion.art !== 'mehrheitstipp') return 'jetzt wird die Mehrheit getippt';
  if (runde.fertig.includes(sitz)) return partie;
  if ((aktion.eigene !== 0 && aktion.eigene !== 1) || (aktion.tipp !== 0 && aktion.tipp !== 1)) {
    return 'A oder B, fuer beides';
  }
  const eigene = [...runde.eigene];
  const tipp = [...runde.tipp];
  eigene[sitz] = aktion.eigene;
  tipp[sitz] = aktion.tipp;
  return { ...partie, runde: { ...runde, eigene, tipp, fertig: [...runde.fertig, sitz] } };
}

/**
 * Rechnet ab und liefert die Mehrheit (0, 1 oder -1 bei Gleichstand).
 *
 * Gleichstand heisst: Es gab keine Mehrheit, also lag jeder Tipp daneben —
 * dieselbe Kneipenregel wie beim Entweder-oder, und wieder die einzige ohne
 * Sonderfall. Wer nicht getippt hat, liegt immer daneben.
 */
export function werteMehrheit(
  runde: MehrheitRunde,
  dabei: readonly number[],
  schluck: (wert: number) => number,
  punkte: number[],
  schlucke: number[],
): number {
  const a = dabei.filter((s) => runde.eigene[s] === 0).length;
  const b = dabei.filter((s) => runde.eigene[s] === 1).length;
  const mehrheit = a > b ? 0 : b > a ? 1 : KEINER;
  for (const s of dabei) {
    if (mehrheit !== KEINER && runde.tipp[s] === mehrheit) punkte[s] = PUNKTE.mehrheitRichtig;
    else schlucke[s] = schluck(SCHLUECKE.mehrheitDaneben);
  }
  return mehrheit;
}

// ---------------------------------------------------------------------------
// Regel-Karte
// ---------------------------------------------------------------------------

/**
 * Darf gerade ein Verstoss gemeldet werden?
 *
 * Solange die Regel gilt — mit einer Ausnahme: in einer Abrechnung, nach der
 * keine Abrechnung dieser Regel mehr kommt (ihre letzte Runde, oder die
 * letzte Runde des Turniers). Ein Verstoss dort landete nirgends; lieber
 * sperren als still verschlucken.
 */
export function meldenMoeglich(partie: PartykistePartie): boolean {
  const regel = partie.regelKarte;
  if (!regel || partie.fertig) return false;
  if (partie.rundeNr > regel.bis) return false;
  if (partie.runde.phase !== 'ergebnis') return true;
  return partie.rundeNr < regel.bis && partie.rundeNr + 1 < partie.runden;
}

/**
 * Ein Verstoss: selbst gemeldet (`ziel === sitz`) zaehlt sofort, eine Anklage
 * erst, wenn die Mehrheit der Menschen denselben Sitz anklagt. Danach fallen
 * alle Anklagen gegen ihn — ein Verstoss, ein Schluck.
 *
 * Gilt keine Regel (mehr), ist die Meldung zu spaet und bleibt wirkungslos.
 */
export function meldeVerstoss(partie: PartykistePartie, sitz: number, ziel: unknown): PartykistePartie | string {
  if (!gueltigerSitz(partie, ziel)) return 'diesen Sitz gibt es nicht';
  const regel = partie.regelKarte;
  if (!regel || !meldenMoeglich(partie)) return partie;
  if (partie.ausgestiegen.includes(ziel)) return partie;

  const zaehlt = (anklage: readonly number[]): AktiveRegel => {
    const verstoesse = [...regel.verstoesse];
    const offen = [...regel.offen];
    verstoesse[ziel] = (verstoesse[ziel] ?? 0) + 1;
    offen[ziel] = (offen[ziel] ?? 0) + 1;
    return { ...regel, verstoesse, offen, anklage: anklage.map((z) => (z === ziel ? KEINER : z)) };
  };

  if (ziel === sitz) return { ...partie, regelKarte: zaehlt(regel.anklage) };

  if (regel.anklage[sitz] === ziel) return partie;
  const anklage = [...regel.anklage];
  anklage[sitz] = ziel;
  if (mehrheitGegen(partie, anklage, ziel)) return { ...partie, regelKarte: zaehlt(anklage) };
  return { ...partie, regelKarte: { ...regel, anklage } };
}

/**
 * Die Abrechnung der geltenden Regel, aufgerufen aus `werteAus` JEDER Runde.
 *
 * Offene Verstoesse werden zu Schluecken dieser Runde (`schlucke` wird
 * ergaenzt, nicht ueberschrieben). Endet die Regel hier — ihre letzte Runde,
 * die letzte des Turniers, oder eine neue Karte loest sie ab —, bekommt jeder
 * Anwesende ohne Verstoss seinen Punkt, und zurueck kommt null.
 */
export function regelAbrechnen(
  partie: PartykistePartie,
  dabei: readonly number[],
  schluck: (wert: number) => number,
  punkte: number[],
  schlucke: number[],
): AktiveRegel | null {
  const regel = partie.regelKarte;
  if (!regel) return null;
  for (const s of dabei) {
    const offen = regel.offen[s] ?? 0;
    if (offen > 0) schlucke[s] = (schlucke[s] ?? 0) + schluck(offen * SCHLUECKE.regelVerstoss);
  }
  const endet =
    partie.rundeNr >= regel.bis || partie.rundeNr >= partie.runden - 1 || partie.runde.art === 'regelkarte';
  if (endet) {
    for (const s of dabei) {
      if ((regel.verstoesse[s] ?? 0) === 0) punkte[s] = (punkte[s] ?? 0) + PUNKTE.regelSauber;
    }
    return null;
  }
  return { ...regel, offen: nullen(partie.sitze) };
}

/** Die Regel einer eben gelesenen Karte — gilt ab jetzt, gekappt aufs Turnierende. */
export function neueRegel(partie: PartykistePartie, runde: RegelkartenRunde): AktiveRegel {
  return {
    karteId: runde.karteId,
    text: runde.text,
    ab: partie.rundeNr,
    bis: Math.min(runde.bis, partie.runden - 1),
    verstoesse: nullen(partie.sitze),
    offen: nullen(partie.sitze),
    anklage: keine(partie.sitze),
  };
}
