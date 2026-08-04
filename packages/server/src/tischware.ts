/**
 * Ware fuer den Tisch: Szenerien und Kartenblaetter.
 *
 * Dieselbe Trennung wie bei der Pinguin-Kosmetik: **Der Server kennt Kennung
 * und Preis, nie das Aussehen.** Wie eine Szenerie aussieht, weiss allein der
 * Client — hier steht nur, was sie kostet und ob sie jemandem gehoert.
 *
 * Der Besitz liegt in derselben Tabelle wie die Kosmetik (`account_cosmetic`).
 * Sie traegt eine freie Kennung und kein Fremdschluesselfeld auf den Katalog;
 * damit ist eine neue Warenart eine Datei und keine Migration. Die Kennungen
 * duerfen sich zwischen den Katalogen deshalb nicht ueberschneiden — die
 * Praefixe `szene-` und `blatt-` halten sie auseinander.
 *
 * **Preis 0 heisst "gehoert allen".** Die zehn Szenerien der ersten Stunde
 * bleiben kostenlos: Wer sich an einen dunklen Filz gewoehnt hat, soll ihn
 * nicht ploetzlich kaufen muessen. Neu ist neu und kostet.
 *
 * **Die Preise sind vorlaeufig** — wie bei der Kosmetik. Sie stehen hier,
 * damit der Shop echte Zahlen zeigt; ausbalanciert ist daran nichts.
 */

import { and, eq, inArray } from 'drizzle-orm';

import type { Db } from './db/types.js';
import * as s from './db/schema.js';
import { notFound } from './errors.js';
import type { Seltenheit } from './kosmetik.js';
import type { Waehrung } from './waehrung.js';

/**
 * Warensorten.
 *
 * `ruecken` ist bewusst getrennt vom `blatt`: Die Rueckseite ist das, was
 * alle am Tisch sehen, die Vorderseiten sieht nur die eigene Hand. Damit ist
 * eine Rueckseite fuer sich verkaufbar — und genau deshalb sind die zehn neuen
 * Blaetter schon jetzt brauchbar, obwohl von ihnen erst die Rueckseite gemalt
 * ist.
 */
export type WareArt = 'szene' | 'blatt' | 'ruecken' | 'emote' | 'wappen';

export interface Ware {
  /** Kennung MIT Praefix, so wie sie in `account_cosmetic` steht. */
  readonly id: string;
  readonly art: WareArt;
  /** Kennung OHNE Praefix — so heisst sie in `account.tableScene` bzw. `cardDeck`. */
  readonly wert: string;
  readonly nameKey: string;
  readonly seltenheit: Seltenheit;
  readonly preis: number;
  readonly waehrung: Waehrung;
}

function ware(art: WareArt, praefix: string) {
  return (
    wert: string,
    preis: number,
    seltenheit: Seltenheit = 'gewoehnlich',
    waehrung: Waehrung = 'coins',
  ): Ware => ({
    id: `${praefix}-${wert}`,
    art,
    wert,
    nameKey: `${praefix}.${wert}`,
    seltenheit,
    preis,
    waehrung,
  });
}

const szene = ware('szene', 'szene');
const ruecken = ware('ruecken', 'ruecken');
const emote = ware('emote', 'emote');
/**
 * Wappen tragen ihre Kennung schon im Wert (`wappen-3`), damit sie ohne
 * Umrechnung in `club.crest` passt. Die Warenkennung heisst deshalb
 * `wappen-wappen-3` — haesslich, aber sie steht nirgends in der Oberflaeche,
 * und ein Sonderfall im Praefix waere schlimmer als ein haesslicher Schluessel.
 */
const wappen = ware('wappen', 'wappen');

/**
 * Der Katalog.
 *
 * Kartenblaetter fehlen hier noch mit Absicht: Von den zehn neuen Blaettern
 * ist bisher nur die Rueckseite gemalt. Ein Blatt ohne seine vierundzwanzig
 * Vorderseiten waere am Tisch ein Feld aus kaputten Bildern — verkaufen laesst
 * es sich erst, wenn es vollstaendig ist. Der Weg dorthin ist eine Zeile je
 * Blatt (`blatt('eiche', 600)`) und sonst nichts.
 */
export const WAREN: readonly Ware[] = [
  // --- Die zehn der ersten Stunde: kostenlos, sie waren immer da ----------
  szene('stube', 0),
  szene('filz-blau', 0),
  szene('filz-rot', 0),
  szene('filz-grau', 0),
  szene('holz-hell', 0),
  szene('winter', 0),
  szene('sommer', 0),
  szene('nacht', 0),
  szene('zauberturm', 0),
  szene('sternenwiese', 0),

  // --- Neu und kaufbar ----------------------------------------------------
  szene('wirtshaus', 250),
  szene('kaminzimmer', 250),
  szene('bibliothek', 350, 'selten'),
  szene('berghuette', 350, 'selten'),
  szene('gartenlaube', 350, 'selten'),
  szene('herbst', 450, 'selten'),
  szene('marmor', 600, 'episch'),
  szene('samt-blau', 600, 'episch'),
  szene('kapitaen', 600, 'episch'),
  szene('basar', 900, 'legendaer'),

  // --- Kartenrueckseiten --------------------------------------------------
  // `standard` ist die Rueckseite des jeweils gewaehlten Blattes und damit
  // das, was ohne Zutun gilt.
  ruecken('standard', 0),
  ruecken('eiche', 200),
  ruecken('winterhof', 200),
  ruecken('sommerwiese', 200),
  ruecken('kupferstich', 300, 'selten'),
  ruecken('schiefer', 300, 'selten'),
  ruecken('nachthimmel', 400, 'selten'),
  ruecken('rubin', 500, 'episch'),
  ruecken('smaragd', 500, 'episch'),
  ruecken('koeniglich', 700, 'episch'),
  ruecken('pinguin', 900, 'legendaer'),

  // --- Emotes -------------------------------------------------------------
  // Zwei sind frei: Wer noch nie etwas gekauft hat, soll trotzdem einmal
  // lachen und einmal loben koennen. Ein Tisch, an dem nur zahlende Gaeste
  // reagieren duerfen, ist ein stiller Tisch.
  emote('grinsen', 0),
  emote('gut-gespielt', 0),
  emote('lachtraenen', 80),
  emote('schmunzeln', 80),
  emote('guter-stich', 100),
  emote('na-sowas', 100),
  emote('wird-eng', 100),
  emote('nochmal', 100),
  emote('prusten', 150, 'selten'),
  emote('verlegen', 150, 'selten'),

  // --- Wappen -------------------------------------------------------------
  // Die acht der ersten Stunde bleiben frei, damit jeder Clan ein Zeichen
  // hat. Die zehn neuen kosten.
  wappen('wappen-1', 0),
  wappen('wappen-2', 0),
  wappen('wappen-3', 0),
  wappen('wappen-4', 0),
  wappen('wappen-5', 0),
  wappen('wappen-6', 0),
  wappen('wappen-7', 0),
  wappen('wappen-8', 0),
  wappen('wappen-9', 250),
  wappen('wappen-10', 250),
  wappen('wappen-11', 250),
  wappen('wappen-12', 350, 'selten'),
  wappen('wappen-13', 350, 'selten'),
  wappen('wappen-14', 450, 'selten'),
  wappen('wappen-15', 450, 'selten'),
  wappen('wappen-16', 550, 'episch'),
  wappen('wappen-17', 550, 'episch'),
  wappen('wappen-18', 800, 'legendaer'),
];

const NACH_ID = new Map(WAREN.map((ware) => [ware.id, ware]));
/** Nach Art und Wert, fuer die Pruefung beim Einstellen. */
const NACH_WERT = new Map(WAREN.map((ware) => [`${ware.art}:${ware.wert}`, ware]));

export function wareMit(id: string): Ware | undefined {
  return NACH_ID.get(id);
}

export function requireWare(id: string): Ware {
  const ware = NACH_ID.get(id);
  if (!ware) throw notFound('itemUnknown');
  return ware;
}

/** Alle Kennungen, die dieses Konto besitzt — inklusive der kostenlosen. */
export async function besitzVon(
  db: Db,
  accountId: string,
  ownsEverything: boolean,
): Promise<Set<string>> {
  if (ownsEverything) return new Set(WAREN.map((w) => w.id));

  const gekauft = await db
    .select({ itemId: s.accountCosmetic.itemId })
    .from(s.accountCosmetic)
    .where(
      and(
        eq(s.accountCosmetic.accountId, accountId),
        inArray(
          s.accountCosmetic.itemId,
          WAREN.map((w) => w.id),
        ),
      ),
    );

  const eigen = new Set(gekauft.map((z) => z.itemId));
  for (const ware of WAREN) if (ware.preis === 0) eigen.add(ware.id);
  return eigen;
}

/**
 * Darf dieses Konto diese Szenerie beziehungsweise dieses Blatt einstellen?
 *
 * Wird beim Speichern der Themen gefragt. Ohne diese Pruefung waere ein
 * Aufruf mit fremder Kennung der Weg, eine Szenerie zu benutzen, ohne sie zu
 * haben — der Client entscheidet hier nichts.
 *
 * Unbekannte Kennungen gelten als erlaubt: Sie sind schon durch die Liste in
 * `scenes.ts` beziehungsweise `decks.ts` gegangen und gehoeren dann zu einer
 * Ware, die (noch) nicht im Katalog steht. Sperren wuerde bedeuten, dass ein
 * vergessener Katalogeintrag eine bestehende Einstellung unbrauchbar macht.
 */
export async function darfBenutzen(
  db: Db,
  accountId: string,
  art: WareArt,
  wert: string,
  ownsEverything: boolean,
): Promise<boolean> {
  const ware = NACH_WERT.get(`${art}:${wert}`);
  if (!ware) return true;
  if (ware.preis === 0 || ownsEverything) return true;

  const [zeile] = await db
    .select({ itemId: s.accountCosmetic.itemId })
    .from(s.accountCosmetic)
    .where(
      and(
        eq(s.accountCosmetic.accountId, accountId),
        eq(s.accountCosmetic.itemId, ware.id),
      ),
    );
  return Boolean(zeile);
}
