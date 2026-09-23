/**
 * Partykiste — ein Turnier aus Partyminispielen fuer 4 bis 12 Leute.
 *
 * Reine Logikbibliothek: kein Netz, keine Datenbank, keine Uhr, kein Zufall
 * ausser dem uebergebenen Saatkorn. Was ein Sitz sieht, entsteht ausschliesslich
 * in `sicht.ts`; die Bildschirme liegen im Client
 * (`packages/client/src/minispiele/partykiste/`).
 */

export * from './regeln.js';
export * from './partie.js';
export * from './sicht.js';
export * from './modi.js';
export { botZug } from './bot.js';
export { partykiste } from './adapter.js';
export type {
  Aufgabe,
  EntwederOder,
  Haerte,
  Identitaet,
  ImposterWort,
  Inhalt,
  Paket,
  QuizFrage,
  SchaetzFrage,
  Schwierigkeit,
  Spruch,
} from './inhalte/typen.js';
export { PAKETE, istPaket } from './inhalte/typen.js';
export * from './inhalte/filter.js';
/*
 * Die Kataloge selbst nach aussen, damit Tests und Werkzeuge sie zaehlen und
 * pruefen koennen (Haerte, Pakete, Doppel). Der Client importiert sie nicht —
 * er bekommt Inhalte nur ueber die Sicht.
 */
export { ENTWEDER_ODER } from './inhalte/entweder.js';
export { IDENTITAETEN } from './inhalte/identitaeten.js';
export { IMPOSTER_WOERTER } from './inhalte/imposter.js';
export { NIEMALS_SPRUECHE } from './inhalte/niemals.js';
export { QUIZ_FRAGEN } from './inhalte/quiz.js';
export { SCHAETZ_FRAGEN } from './inhalte/schaetzen.js';
export { AUFGABEN } from './inhalte/wahrheitpflicht.js';
export { WER_EHER_SPRUECHE } from './inhalte/wereher.js';
/* Die drei ohne Uhr (22.09.2026): Kataloge, Inhaltsformen, Rundentypen. */
export { KATEGORIEN, type Kategorie } from './inhalte/kategorien.js';
export { MEHRHEITSFRAGEN, type Mehrheitsfrage } from './inhalte/mehrheit.js';
export { REGELKARTEN, type Regelkarte } from './inhalte/regelkarten.js';
export type { AktiveRegel, KategorienRunde, MehrheitRunde, RegelkartenRunde } from './ohne-uhr.js';
