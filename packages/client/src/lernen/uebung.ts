/**
 * Welche Tische Uebungsrunden aus dem Lernpfad sind — damit der
 * Doppelkopftisch dort die Tipps einblendet (LernTipp.tsx).
 *
 * Nur ein Merkzettel dieses Geraets und keine Serverangabe: Die Tipps sind
 * Hilfe am Bildschirm, keine Regel, und ob sie nach einem Neustart der App
 * noch dastehen, entscheidet nichts. Der Server kennt den Tisch ohnehin als
 * Uebung (`uebung` in den Tischfiltern) — dort zaehlt er die Serie.
 */

const SCHLUESSEL = 'brauweg.lernen.uebung';
/** Mehr als die letzten paar braucht niemand; der Zettel waechst sonst ewig. */
const HOECHSTENS = 5;

let imSpeicher: string[] = [];

function lesen(): string[] {
  try {
    const roh = window.localStorage.getItem(SCHLUESSEL);
    const liste: unknown = roh ? JSON.parse(roh) : [];
    return Array.isArray(liste) ? liste.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return imSpeicher;
  }
}

export function merkeUebung(tableId: string): void {
  const liste = [tableId, ...lesen().filter((id) => id !== tableId)].slice(0, HOECHSTENS);
  imSpeicher = liste;
  try {
    window.localStorage.setItem(SCHLUESSEL, JSON.stringify(liste));
  } catch {
    // Privates Fenster oder gesperrter Speicher: dann eben nur bis zum Neuladen.
  }
}

export function istUebung(tableId: string): boolean {
  return lesen().includes(tableId) || imSpeicher.includes(tableId);
}
