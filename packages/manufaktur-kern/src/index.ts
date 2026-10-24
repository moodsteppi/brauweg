/**
 * @brauweg/manufaktur-kern — die Kartenmanufaktur als reine Funktionen.
 *
 * Kein Netz, keine Datenbank, keine Uhr, kein Zufall. Der Server rechnet
 * damit massgeblich (Aktionen, Muenzen, Nachrechnen nach Abwesenheit), der
 * Client rechnet in jedem Bild dasselbe mit, damit jede Bewegung auf dem
 * Bildschirm an einem echten Zyklus haengt. Spielentwurf:
 * docs/SPEZIFIKATION-KARTENMANUFAKTUR.md.
 */

export * from './formeln.js';
export * from './stand.js';
export * from './zeit.js';
export * from './aktionen.js';
export * from './ansicht.js';
export * from './meister.js';
export * from './werkstattbuch.js';
export * from './renovieren.js';
export * from './baustelle.js';
