/**
 * Browort und Clanwort, wie der Client sie vom Server bekommt
 * (packages/server/src/browort/dienst.ts). Zweitbeschreibung wie bei den
 * Spielsichten: Der Client importiert nichts aus dem Server.
 */

/** g = richtige Stelle, v = im Wort, aber woanders, x = nicht im Wort. */
export type Farbe = 'g' | 'v' | 'x';

export interface Versuch {
  wort: string;
  farben: Farbe[];
}

export interface Runde {
  tag: string;
  versuche: Versuch[];
  maxVersuche: number;
  fertig: boolean;
  geloest: boolean;
  /** Erst nach dem Ende der Runde gesetzt. */
  loesung: string | null;
}

/** Dieselbe Form wie `SerieHeute` beim Lernpfad. */
export interface WortSerie {
  serie: number;
  beste: number;
  heuteGespielt: boolean;
  brauchtSchutz: boolean;
  schutzFrei: boolean;
}

export interface BrowortAnsicht extends Runde {
  serie: WortSerie;
  statistik: {
    gespielt: number;
    geloest: number;
    schnitt: number | null;
    verteilung: number[];
  };
}

export interface Belohnung {
  muenzen: number;
  xp: number;
}

export type ClanwortPhase = 'waehlen' | 'warten' | 'raten' | 'wortgeber';

export interface ClanwortAnsicht extends Runde {
  clubId: string;
  phase: ClanwortPhase;
  waehler: { id: string; name: string } | null;
  wahlBis: number;
  zufall: boolean;
  rangliste: { accountId: string; name: string; versuche: number; geloest: boolean; fertig: boolean }[];
  serie: WortSerie;
}

/** Fuer die Flamme auf dem Start (`/api/me`). */
export interface BrowortKurz {
  serie: number;
  heuteGespielt: boolean;
  schnitt: number | null;
  geloest: number;
}

/** Im Profil — eigenem wie fremdem. null: noch nie gespielt. */
export interface BrowortProfil {
  serie: number;
  beste: number;
  schnitt: number | null;
  geloest: number;
  gespielt: number;
}
