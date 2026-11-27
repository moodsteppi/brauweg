export type Spieler = {
  id: string;
  name: string;
  bot: boolean;
  x: number;
  y: number;
  winkel: number;
  lebt: boolean;
  siege: number;
  laden: number;
  anker: number;
  item: string;
  bereit: boolean;
  verbunden: boolean;
};
export type Stand = {
  phase: string;
  code: string;
  ich: string;
  host: string;
  offen: boolean;
  warte: number;
  zeit: number;
  runde: number;
  radius: number;
  warnung: boolean;
  gewinner: string;
  spieler: Spieler[];
  effekte: {
    x: number;
    y: number;
    art: string;
    bis: number;
  }[];
  geschosse: {
    x: number;
    y: number;
    vx: number;
    vy: number;
  }[];
  fund: {
    x: number;
    y: number;
    art: string;
  } | null;
};
