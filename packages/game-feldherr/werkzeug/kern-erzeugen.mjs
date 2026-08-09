/**
 * FRUEHER schnitt dieses Werkzeug den Client-Kern AUS der Spieldatei.
 *
 * Seit Stufe 1 des 3D-Strukturumbaus (docs/FELDHERR-3D-UMBAU.md) ist die
 * Erzeugungsrichtung umgedreht: Die Quelle sind die Module unter
 * quelle/teile/, und bauen.mjs setzt daraus BEIDE Artefakte zusammen —
 * quelle/feldherr.html und den Client-Kern. Die Gleichschritt-Anbindung,
 * die frueher hier als Text eingebettet war, liegt jetzt selbst als Quelle
 * in quelle/teile/anbindung-kopf.js und anbindung-fuss.js.
 *
 * Diese Datei bleibt nur, damit der eingespielte Befehl weiter funktioniert:
 *
 *     node packages/game-feldherr/werkzeug/kern-erzeugen.mjs
 */

if (process.argv[2]) {
  console.error(
    'kern-erzeugen.mjs nimmt keine Pfade mehr an — die Quelle sind die Module\n' +
    'unter quelle/teile/. Bauen mit:\n' +
    '    node packages/game-feldherr/werkzeug/bauen.mjs',
  );
  process.exit(1);
}

await import('./bauen.mjs');
