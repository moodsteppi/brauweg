/**
 * Ob die Doko-Meister-Feier auf diesem Geraet schon zu sehen war (Feier.tsx).
 * Eigene Datei, damit der Start fragen kann, ohne die Feier mitzuladen.
 */

const SCHLUESSEL = 'brauweg.lernen.gefeiert';

export function schonGefeiert(): boolean {
  try {
    return window.localStorage.getItem(SCHLUESSEL) === '1';
  } catch {
    return false;
  }
}

export function merkeGefeiert(): void {
  try {
    window.localStorage.setItem(SCHLUESSEL, '1');
  } catch {
    // Ohne Speicher kommt die Feier eben noch einmal — besser als nie.
  }
}
