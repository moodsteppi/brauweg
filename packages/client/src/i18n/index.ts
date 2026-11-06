/**
 * Uebersetzungen.
 *
 * Server und Spielmodule liefern ausschliesslich Schluessel, nie fertigen
 * Text. Bis zur Sprachgrundlage (Projekt „BroweGGames Language") war das hier
 * eine einzige Datei mit nur Deutsch; jetzt liegt je Sprache ein Ordner mit
 * Bereichsdateien daneben (`de/`, `en/`), die Liste der Sprachen in
 * `sprachen.ts`. Die Schnittstelle nach aussen ist dieselbe geblieben — `t`,
 * `cardLabel`, `cardName` usw. —, damit kein Aufrufer sich aendern musste.
 *
 * Welche Sprache gilt, entscheidet die Wahl am Konto: eine feste Sprache oder
 * „Automatisch" (die erste Geraetesprache, die wir haben, sonst Englisch).
 * Die Wahl liegt zusaetzlich im Geraet, damit schon das erste Bild vor
 * `/api/me` — und der Startbildschirm ohne Anmeldung — in ihr erscheint.
 */

import { geraeteSprachen, inApp } from '../laufzeit';
import { de } from './de';
import { en } from './en';
import {
  SPRACHEN,
  erkenneSprache,
  istSprache,
  type Sprache,
  type Sprachwahl,
} from './sprachen';
import type { Woerterbuch } from './woerterbuch';

export { SPRACHEN, erkenneSprache, type Sprache, type Sprachwahl } from './sprachen';

/** Alle Bereiche einer Sprache zu einem Nachschlagewerk zusammengelegt. */
function flach(bereiche: Partial<Record<string, Woerterbuch>>): Woerterbuch {
  return Object.assign({}, ...Object.values(bereiche));
}

/**
 * Je Sprache das zusammengelegte Woerterbuch. `Record<Sprache, …>`: Wer in
 * `SPRACHEN` eine Sprache ergaenzt, bekommt hier einen Typfehler, bis sie
 * auch geliefert wird.
 */
const WOERTERBUECHER: Record<Sprache, Woerterbuch> = {
  de: flach(de),
  en: flach(en),
};

const SPEICHER_SCHLUESSEL = 'brauweg.sprache';

function gespeicherteWahl(): Sprachwahl {
  try {
    const roh = typeof localStorage === 'undefined' ? null : localStorage.getItem(SPEICHER_SCHLUESSEL);
    return istSprache(roh) ? roh : 'auto';
  } catch {
    // Gesperrter Speicher (privates Fenster in manchen Browsern) — dann eben automatisch.
    return 'auto';
  }
}

let wahl: Sprachwahl = gespeicherteWahl();
let aktiv: Sprache = wahl === 'auto' ? erkenneSprache(geraeteSprachen()) : wahl;
const hoerer = new Set<() => void>();

function langSetzen(): void {
  // Fuer Vorleser und Silbentrennung (`hyphens: auto`) — beide richten sich nach `lang`.
  if (typeof document !== 'undefined') document.documentElement.lang = aktiv;
}
langSetzen();

/** Die Sprache, in der gerade gezeichnet wird. */
export function aktiveSprache(): Sprache {
  return aktiv;
}

/** Was eingestellt ist — auch „auto", anders als `aktiveSprache`. */
export function sprachwahl(): Sprachwahl {
  return wahl;
}

/**
 * Sprache umstellen. Zeichnet neu, ohne zu laden: Wer `useSprache()` haelt
 * (die Wurzel `App` tut es), rendert neu, und jedes `t()` darunter liest die
 * neue Sprache. Speichern am Konto ist Sache des Aufrufers — diese Funktion
 * laeuft auch beim Uebernehmen der Kontowahl aus `/api/me`, und dort waere ein
 * Schreibaufruf zurueck an den Server ein Kreis.
 */
export function setzeSprachwahl(neu: Sprachwahl): void {
  const neuAktiv = neu === 'auto' ? erkenneSprache(geraeteSprachen()) : neu;
  try {
    if (neu === 'auto') localStorage.removeItem(SPEICHER_SCHLUESSEL);
    else localStorage.setItem(SPEICHER_SCHLUESSEL, neu);
  } catch {
    // Ohne Speicher gilt die Wahl bis zum Neuladen; am Konto steht sie trotzdem.
  }
  if (neu === wahl && neuAktiv === aktiv) return;
  wahl = neu;
  aktiv = neuAktiv;
  langSetzen();
  for (const h of hoerer) h();
}

/** Fuer `useSyncExternalStore` (useSprache.ts). */
export function abonniereSprache(h: () => void): () => void {
  hoerer.add(h);
  return () => hoerer.delete(h);
}

/**
 * Text ohne Rueckfall auf den Schluessel — fuer Helfer, die selbst wissen,
 * was ohne Text zu zeigen ist (Kartenwerte zeigen dann die rohe Kennung).
 *
 * Rueckfall je Schluessel: aktive Sprache -> Englisch -> Deutsch. Englisch
 * vor Deutsch, weil es die Vorgabe fuer alle ist, deren Sprache wir nicht
 * haben; Deutsch zuletzt, weil es das einzige vollstaendige Woerterbuch ist.
 */
function nachschlagen(key: string): string | undefined {
  return WOERTERBUECHER[aktiv][key] ?? WOERTERBUECHER.en[key] ?? WOERTERBUECHER.de[key];
}

/**
 * Name der Spielart.
 *
 * Ohne ihn ist der Tisch unlesbar: Im Herz-Solo ist die Herz-Neun Trumpf, im
 * Normalspiel eine Fehlkarte. Wer nicht weiss, was laeuft, haelt einen
 * regelkonformen Bedienzwang fuer einen Fehler.
 */
export function gameTypeLabel(gameType: { kind: string; solo?: string }): string {
  if (gameType.kind === 'solo' && gameType.solo) {
    return t(`spielart.solo.${gameType.solo}`);
  }
  return t(`spielart.${gameType.kind}`);
}

/**
 * Was in der App anders heisst als auf der Webseite.
 *
 * Filler heisst in der App „Farbduell" (Emile, 13.10.2026, erste
 * iOS-Fassung): Unter „Filler" steht im App Store schon ein bekanntes Spiel.
 * Die Kennung `filler` bleibt, sie steht in Datenbankzeilen und Nachrichten.
 * Hier und nicht am Bildschirm, damit Auswahl, Rangliste, Profil und Tisch
 * denselben Namen zeigen; den Push-Text fuehrt `SPIELNAMEN` im Server.
 *
 * Gilt in jeder Sprache: Es ist der Name im App Store, kein deutsches Wort.
 */
const APP_NAMEN: Record<string, string> = {
  'game.filler': 'Farbduell',
};

/** Text zu einem Schluessel. Fehlt er in jeder Sprache, steht der Schluessel selbst da. */
export function t(key: string): string {
  return (inApp ? APP_NAMEN[key] : undefined) ?? nachschlagen(key) ?? key;
}

const SUITS: Record<string, string> = { C: '♣', S: '♠', H: '♥', D: '♦' };

/**
 * Auf dem Handy liegen zwoelf Karten nebeneinander, von den meisten ist nur
 * ein schmaler Streifen sichtbar. Farbe und Wert muessen in diesem Streifen
 * stehen, deshalb steht das Zeichen vorn.
 *
 * Zauberer und Narr haben keine Farbe und keinen Wert - sie sind, was sie
 * sind. Ihr Zeichen steht deshalb allein, ohne Rangziffer: Die vier Exemplare
 * unterscheiden sich nur im Bild, nie in der Staerke.
 */
export function cardLabel(card: { suit: string; rank: string }): string {
  if (card.suit === 'Z') return t('karte.kurz.zauberer');
  if (card.suit === 'N') return t('karte.kurz.narr');
  return `${SUITS[card.suit] ?? card.suit}${rankLabel(card.rank)}`;
}

/** Nur der Wert, ohne Farbzeichen (für die gezeichnete Ecken-Anzeige). */
export function rankLabel(rank: string): string {
  return nachschlagen(`karte.kurz.${rank}`) ?? rank;
}

/**
 * Ausgeschriebener Name, z.B. "Kreuz Dame".
 *
 * Bei den Bildblaettern ist das der alt-Text: Wer nicht sieht, bekommt dieselbe
 * Auskunft wie alle anderen, und ein nicht geladenes Bild bleibt lesbar.
 */
export function cardName(card: { suit: string; rank: string }): string {
  if (card.suit === 'Z') return t('karte.zauberer');
  if (card.suit === 'N') return t('karte.narr');
  const suit = nachschlagen(`karte.farbe.${card.suit}`) ?? card.suit;
  const rank = nachschlagen(`karte.wert.${card.rank}`) ?? card.rank;
  return `${suit} ${rank}`;
}

export function isRed(card: { suit: string }): boolean {
  return card.suit === 'H' || card.suit === 'D';
}

/**
 * Grosse Zahlen kurz: 550, 1,5K, 12K, 10M.
 *
 * Die Kopfzeile hat wenig Platz; ein siebenstelliger Muenzstand (etwa das
 * Testkonto mit 9.999.999) schiebt sonst Name und Level ineinander. Bis 1000
 * bleibt die Zahl ganz, darueber wird sie mit K und M abgekuerzt - eine
 * Nachkommastelle nur unterhalb von zehn, damit "1,5K" lesbar bleibt, aber
 * "12K" nicht "12,3K" heisst.
 */
export function kompakteZahl(n: number): string {
  if (n < 1000) return String(n);
  const kurz = (wert: number, zeichen: string): string => {
    const zahl = wert < 10 ? wert.toFixed(1).replace(/[.,]0$/, '') : String(Math.round(wert));
    return zahl.replace('.', ',') + zeichen;
  };
  // Knapp unter einer Million auf M umschalten, sonst rundet 999.999 zu
  // "1000K" statt "1M".
  if (n < 999_950) return kurz(n / 1000, 'K');
  return kurz(n / 1_000_000, 'M');
}

/** Name einer Trumpffarbe fuer die Kopfzeile, oder null ohne Trumpf. */
export function suitName(suit: string | null): string | null {
  return suit ? (nachschlagen(`karte.farbe.${suit}`) ?? suit) : null;
}

export function suitSymbol(suit: string): string {
  return SUITS[suit] ?? suit;
}
