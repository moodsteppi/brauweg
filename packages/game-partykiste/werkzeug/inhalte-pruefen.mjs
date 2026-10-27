// Schema-Pruefung der Partykiste-Inhalte im Build — laeuft nach tsc.
//
// WARUM ein eigener Schritt, obwohl jeder Katalog schon beim Import geprueft
// wird: tsc sieht den Inhalt einer JSON-Datei nicht als Fehler, und der Import
// passiert erst, wenn jemand das Modul laedt — im Test, oder beim Serverstart
// nach dem Deploy. Ein kaputter Katalog soll den Build brechen, nicht den
// Healthcheck. Und hier stehen ALLE Fehler auf einmal, nicht nur die ersten
// zwanzig aus der Ausnahme.
//
// Gelesen wird die Quelle (src/inhalte/daten/), nicht die Kopie in dist/:
// Die Quelle ist das, was im Pull Request steht.

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const paket = join(dirname(fileURLToPath(import.meta.url)), '..')
const { KATALOGE, pruefeKatalog } = await import('../dist/src/inhalte/schema.js')

const ordner = join(paket, 'src', 'inhalte', 'daten')
const vorhanden = new Set(readdirSync(ordner).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)))

let fehlerZahl = 0
const zeilen = []
for (const name of KATALOGE) {
  if (!vorhanden.has(name)) {
    console.error(`inhalte-pruefen: ${name}.json fehlt in src/inhalte/daten/`)
    fehlerZahl++
    continue
  }
  let roh
  try {
    roh = JSON.parse(readFileSync(join(ordner, `${name}.json`), 'utf8'))
  } catch (e) {
    console.error(`inhalte-pruefen: ${name}.json ist kein gueltiges JSON — ${e.message}`)
    fehlerZahl++
    continue
  }
  const fehler = pruefeKatalog(name, roh)
  for (const f of fehler) console.error(`inhalte-pruefen: ${name} ${f}`)
  fehlerZahl += fehler.length
  const e = Array.isArray(roh.eintraege) ? roh.eintraege : []
  const h = [1, 2, 3].map((s) => e.filter((x) => (x.haerte ?? 1) === s).length)
  zeilen.push(`${name} ${e.length} (${h.join('/')})`)
}

if (fehlerZahl > 0) {
  console.error(`inhalte-pruefen: ${fehlerZahl} Fehler — der Build bricht ab.`)
  process.exit(1)
}
console.log(`inhalte-pruefen: ${zeilen.join(', ')} — harmlos/pikant/derb`)
