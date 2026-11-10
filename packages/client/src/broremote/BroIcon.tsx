/** Eigene, durchgehend lesbare Symbole statt systemabhängiger Emoji-Tasten. */
const wege = {
  bildschirm: 'M3 4h18v12H3z M8 21h8 M12 16v5',
  handy: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2 M10 5h4 M11 19h2',
  solo: 'M8 7a4 4 0 1 0 8 0 4 4 0 1 0-8 0 M4 21v-2a8 8 0 0 1 16 0v2',
  signal: 'M4 20v-4 M9 20v-8 M14 20V8 M19 20V4',
  links: 'M19 12H5 M11 6l-6 6 6 6',
  rechts: 'M5 12h14 M13 6l6 6-6 6',
  drehen: 'M20 4v6h-6 M20 10a8 8 0 1 0 0 5',
  fallen: 'M12 3v13 M6 10l6 6 6-6 M4 21h16',
  anker: 'M9 5a3 3 0 1 0 6 0 3 3 0 1 0-6 0 M12 8v13 M7 11h10 M3 14a9 9 0 0 0 18 0 M3 14v4 M21 14v4',
  gewicht: 'M9 5a3 3 0 1 0 6 0 3 3 0 1 0-6 0 M6 8h12l3 13H3z',
  plattform: 'M3 12h18v5H3z M5 17v4 M19 17v4 M12 2v7 M8 5l4 4 4-4 M6 12v5 M18 12v5',
  stein: 'M12 2l9 5v10l-9 5-9-5V7z M3 7l9 5 9-5 M12 12v10 M12 2v5',
  eis: 'M12 2v20 M3 7l18 10 M3 17 21 7 M9 4l3 3 3-3 M9 20l3-3 3 3 M3 10l4-1-1-4 M18 19l-1-4 4-1 M3 14l4 1-1 4 M18 5l-1 4 4 1',
  oben: 'M12 20V4 M6 10l6-6 6 6',
  unten: 'M12 4v16 M6 14l6 6 6-6',
  zufall: 'M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z M20 2v4 M18 4h4',
  pokal: 'M7 3h10v6a5 5 0 0 1-10 0z M7 5H3v3a4 4 0 0 0 4 4 M17 5h4v3a4 4 0 0 1-4 4 M12 14v7 M8 21h8',
  kopieren: 'M8 8h13v13H8z M16 8V3H3v13h5',
  vollbild: 'M8 3H3v5 M16 3h5v5 M3 16v5h5 M21 16v5h-5',
  schliessen: 'M6 6l12 12 M6 18 18 6',
  haken: 'M4 12l5 5L20 6',
  start: 'M8 4l13 8-13 8z',
  pause: 'M8 4v16 M16 4v16',
  ton: 'M3 9h4l5-5v16l-5-5H3z M16 8a6 6 0 0 1 0 8 M19 5a10 10 0 0 1 0 14',
  qr: 'M3 3h6v6H3z M15 3h6v6h-6z M3 15h6v6H3z M15 15h2v2h4v4h-6z M21 12v2 M12 3v1 M12 11v2 M3 12h3',
} as const;
export type BroSymbol = keyof typeof wege;
export function BroIcon({ name }: { name: BroSymbol }): React.JSX.Element {
  return <svg className="br-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={wege[name]} /></svg>;
}
